const { Types } = require('mongoose');
const { Employee, Department } = require('../models');
const AppError = require('../utils/AppError');
const { withTransaction } = require('../utils/withTransaction');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { getSocketInstance } = require('../socket/socketServer');
const { getOrganizationRoom } = require('../socket/socketRooms');
const auditLogService = require('./auditLogService');
const essAccess = require('../utils/essAccess');

// Explicit allowlists — mirrors the pattern already used by
// employeeService.updateBankDetails/updateTaxInfo (field-by-field
// assignment), not employeeService.updateEmployee's looser
// `Object.assign(existing, { ...payload })` spread. Self-service must be the
// most restrictive write path in the app, so it gets the safest pattern.
const PROFILE_EDITABLE_FIELDS = ['phone', 'personalEmail', 'alternatePhone'];
const ADDRESS_FIELDS = ['street', 'city', 'state', 'country', 'postalCode'];
const EMERGENCY_CONTACT_FIELDS = ['name', 'relationship', 'phone', 'alternatePhone', 'email'];
const MAX_EMERGENCY_CONTACTS = 3;

function emitToOrg(organizationId, event, payload) {
  try {
    const io = getSocketInstance();
    if (io) io.to(getOrganizationRoom(organizationId.toString())).emit(event, payload);
  } catch (err) {
    console.error('[ess-profile] socket emit failed:', err);
  }
}

function toContactDTO(contact) {
  return {
    id: contact._id.toString(),
    name: contact.name,
    relationship: contact.relationship,
    phone: contact.phone,
    alternatePhone: contact.alternatePhone || '',
    email: contact.email || '',
  };
}

function toProfileDTO(employee, department) {
  return {
    employeeId: employee._id.toString(),
    firstName: employee.firstName,
    lastName: employee.lastName,
    dateOfBirth: employee.dateOfBirth || null,
    gender: employee.gender || null,
    avatar: employee.avatar || null,
    // Editable, employee-owned fields.
    phone: employee.phone || '',
    personalEmail: employee.personalEmail || '',
    alternatePhone: employee.alternatePhone || '',
    address: {
      street: employee.address?.street || '',
      city: employee.address?.city || '',
      state: employee.address?.state || '',
      country: employee.address?.country || '',
      postalCode: employee.address?.postalCode || '',
    },
    emergencyContacts: (employee.emergencyContacts || []).map(toContactDTO),
    // Read-only, HR-controlled employment information — no salary/payroll
    // data here, that belongs to the Payroll self-service step.
    employment: {
      employeeCode: employee.employeeId,
      workEmail: employee.email,
      jobTitle: employee.jobTitle,
      departmentName: department?.name || null,
      employmentType: employee.employmentType,
      status: employee.status,
      joiningDate: employee.joiningDate,
    },
  };
}

// Re-fetches the full profile after a mutation — always through the same
// ownership-checked path, never assembled ad hoc from the mutation result.
async function getProfile(organizationId, user) {
  const employee = await essAccess.resolveSelfEmployee(user, organizationId);
  const department = employee.departmentId
    ? await Department.findById(employee.departmentId).select('name').lean()
    : null;
  return toProfileDTO(employee, department);
}

// Loads a live (non-lean) document for mutation, scoped and validated
// exactly the same way as essAccess.resolveSelfEmployee (org + isDeleted +
// active status) — resolveSelfEmployee itself can't take a transaction
// session, so mutations re-resolve the live doc directly while still
// reusing resolveSelfEmployee up front for its identity/active-status
// error messages.
async function findSelfEmployeeDoc(user, organizationId, opts) {
  const emp = await Employee.findOne(
    { _id: user.employeeId, organizationId: new Types.ObjectId(organizationId), isDeleted: false },
    null,
    opts
  );
  if (!emp) throw new AppError('No employee record is linked to your account', 404);
  return emp;
}

async function updateProfile(organizationId, user, payload, reqMeta = {}) {
  await essAccess.resolveSelfEmployee(user, organizationId);

  const employee = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const emp = await findSelfEmployeeDoc(user, organizationId, opts);
    const changedFields = [];

    PROFILE_EDITABLE_FIELDS.forEach((f) => {
      if (payload[f] !== undefined && payload[f] !== emp[f]) {
        emp[f] = payload[f];
        changedFields.push(f);
      }
    });

    if (payload.address && typeof payload.address === 'object') {
      ADDRESS_FIELDS.forEach((f) => {
        if (payload.address[f] !== undefined && payload.address[f] !== emp.address[f]) {
          emp.address[f] = payload.address[f];
          changedFields.push(`address.${f}`);
        }
      });
    }

    if (changedFields.length > 0) {
      await emp.save(opts);
      // Metadata records which fields changed, never their values — the
      // audit trail must not become a second copy of personal data.
      await auditLogService.recordAction({
        organizationId, userId: user._id, action: 'ESS_PROFILE_UPDATED',
        entityType: 'Employee', entityId: emp._id, metadata: { changedFields }, session, ...reqMeta,
      });
    }
    return emp;
  });

  emitToOrg(organizationId, SOCKET_EVENTS.EMPLOYEE_PROFILE_UPDATED, { employeeId: employee._id.toString() });
  return getProfile(organizationId, user);
}

async function addEmergencyContact(organizationId, user, payload, reqMeta = {}) {
  await essAccess.resolveSelfEmployee(user, organizationId);

  const { employee, contact } = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const emp = await findSelfEmployeeDoc(user, organizationId, opts);

    if (emp.emergencyContacts.length >= MAX_EMERGENCY_CONTACTS) {
      throw new AppError(`You can have at most ${MAX_EMERGENCY_CONTACTS} emergency contacts`, 400);
    }

    const entry = {};
    EMERGENCY_CONTACT_FIELDS.forEach((f) => {
      if (payload[f] !== undefined) entry[f] = payload[f];
    });
    emp.emergencyContacts.push(entry);
    await emp.save(opts);
    const created = emp.emergencyContacts[emp.emergencyContacts.length - 1];

    await auditLogService.recordAction({
      organizationId, userId: user._id, action: 'ESS_EMERGENCY_CONTACT_ADDED',
      entityType: 'Employee', entityId: emp._id, metadata: { contactId: created._id.toString() }, session, ...reqMeta,
    });
    return { employee: emp, contact: created };
  });

  emitToOrg(organizationId, SOCKET_EVENTS.EMPLOYEE_PROFILE_UPDATED, { employeeId: employee._id.toString() });
  return toContactDTO(contact);
}

async function updateEmergencyContact(organizationId, user, contactId, payload, reqMeta = {}) {
  await essAccess.resolveSelfEmployee(user, organizationId);

  const { employee, contact } = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const emp = await findSelfEmployeeDoc(user, organizationId, opts);
    const c = emp.emergencyContacts.id(contactId);
    if (!c) throw new AppError('Emergency contact not found', 404);

    EMERGENCY_CONTACT_FIELDS.forEach((f) => {
      if (payload[f] !== undefined) c[f] = payload[f];
    });
    await emp.save(opts);

    await auditLogService.recordAction({
      organizationId, userId: user._id, action: 'ESS_EMERGENCY_CONTACT_UPDATED',
      entityType: 'Employee', entityId: emp._id, metadata: { contactId }, session, ...reqMeta,
    });
    return { employee: emp, contact: c };
  });

  emitToOrg(organizationId, SOCKET_EVENTS.EMPLOYEE_PROFILE_UPDATED, { employeeId: employee._id.toString() });
  return toContactDTO(contact);
}

async function removeEmergencyContact(organizationId, user, contactId, reqMeta = {}) {
  await essAccess.resolveSelfEmployee(user, organizationId);

  const employee = await withTransaction(async (session) => {
    const opts = session ? { session } : undefined;
    const emp = await findSelfEmployeeDoc(user, organizationId, opts);
    const c = emp.emergencyContacts.id(contactId);
    if (!c) throw new AppError('Emergency contact not found', 404);

    emp.emergencyContacts.pull(contactId);
    await emp.save(opts);

    await auditLogService.recordAction({
      organizationId, userId: user._id, action: 'ESS_EMERGENCY_CONTACT_REMOVED',
      entityType: 'Employee', entityId: emp._id, metadata: { contactId }, session, ...reqMeta,
    });
    return emp;
  });

  emitToOrg(organizationId, SOCKET_EVENTS.EMPLOYEE_PROFILE_UPDATED, { employeeId: employee._id.toString() });
  return { success: true, message: 'Emergency contact removed' };
}

module.exports = {
  getProfile,
  updateProfile,
  addEmergencyContact,
  updateEmergencyContact,
  removeEmergencyContact,
  MAX_EMERGENCY_CONTACTS,
};
