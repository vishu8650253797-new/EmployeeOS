const request = require('supertest');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser, createUserWithEmployee, authHeaderFor } = require('./helpers/factories');
const { EmployeeSchedule } = require('../src/models');

jest.setTimeout(30000);

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

async function createShift(hrAdmin, overrides = {}) {
  const res = await request(app)
    .post('/api/shifts')
    .set('Authorization', authHeaderFor(hrAdmin))
    .send({ name: 'Morning Shift', code: 'MORN', startTime: '09:00', endTime: '17:00', ...overrides });
  return res.body.data;
}

async function setupManagerAndReport(org) {
  const { user: managerUser, employee: managerEmployee } = await createUserWithEmployee(org._id, { role: 'MANAGER' });
  const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE', managerId: managerEmployee._id });
  return { managerUser, managerEmployee, employeeUser, employee };
}

describe('Employee schedule assignment — effective-dating, manager scope, org isolation', () => {
  test('assigning a new schedule supersedes the prior ACTIVE row', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await setupManagerAndReport(org);
    const shift = await createShift(hrAdmin);

    const first = await request(app)
      .post('/api/employee-schedules')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ employeeId: employee._id.toString(), shiftId: shift.id, effectiveFrom: '2026-01-01' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/employee-schedules')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ employeeId: employee._id.toString(), shiftId: shift.id, effectiveFrom: '2026-07-01' });
    expect(second.status).toBe(201);

    const rows = await EmployeeSchedule.find({ employeeId: employee._id }).sort({ effectiveFrom: 1 }).lean();
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe('SUPERSEDED');
    expect(rows[0].effectiveTo.toISOString().slice(0, 10)).toBe('2026-07-01');
    expect(rows[1].status).toBe('ACTIVE');

    const activeCount = await EmployeeSchedule.countDocuments({ employeeId: employee._id, status: 'ACTIVE' });
    expect(activeCount).toBe(1);
  });

  test('a manager can assign a schedule to their direct report', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const { managerUser, employee } = await setupManagerAndReport(org);
    const shift = await createShift(hrAdmin);

    const res = await request(app)
      .post('/api/employee-schedules')
      .set('Authorization', authHeaderFor(managerUser))
      .send({ employeeId: employee._id.toString(), shiftId: shift.id, effectiveFrom: '2026-01-01' });

    expect(res.status).toBe(201);
  });

  test('a manager cannot assign a schedule to an employee outside their reporting line', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const { managerUser } = await setupManagerAndReport(org);
    const { employee: unrelatedEmployee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const shift = await createShift(hrAdmin);

    const res = await request(app)
      .post('/api/employee-schedules')
      .set('Authorization', authHeaderFor(managerUser))
      .send({ employeeId: unrelatedEmployee._id.toString(), shiftId: shift.id, effectiveFrom: '2026-01-01' });

    expect(res.status).toBe(403);
  });

  test('a plain employee cannot assign schedules', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employeeUser, employee } = await setupManagerAndReport(org);
    const shift = await createShift(hrAdmin);

    const res = await request(app)
      .post('/api/employee-schedules')
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ employeeId: employee._id.toString(), shiftId: shift.id, effectiveFrom: '2026-01-01' });

    expect(res.status).toBe(403);
  });

  test('cannot assign an inactive shift', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await setupManagerAndReport(org);
    const shift = await createShift(hrAdmin);
    await request(app)
      .patch(`/api/shifts/${shift.id}/status`)
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ status: 'INACTIVE' });

    const res = await request(app)
      .post('/api/employee-schedules')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ employeeId: employee._id.toString(), shiftId: shift.id, effectiveFrom: '2026-01-01' });

    expect(res.status).toBe(400);
  });

  test('a shift from another organization cannot be referenced (cross-org reference rejection)', async () => {
    const orgA = await createOrganization();
    const hrAdminA = await createUser(orgA._id, { role: 'HR_ADMIN' });
    const { employee } = await setupManagerAndReport(orgA);

    const orgB = await createOrganization();
    const hrAdminB = await createUser(orgB._id, { role: 'HR_ADMIN' });
    const shiftB = await createShift(hrAdminB);

    const res = await request(app)
      .post('/api/employee-schedules')
      .set('Authorization', authHeaderFor(hrAdminA))
      .send({ employeeId: employee._id.toString(), shiftId: shiftB.id, effectiveFrom: '2026-01-01' });

    expect(res.status).toBe(404);
  });

  test('an employee from another organization cannot be referenced', async () => {
    const orgA = await createOrganization();
    const hrAdminA = await createUser(orgA._id, { role: 'HR_ADMIN' });
    const shiftA = await createShift(hrAdminA);

    const orgB = await createOrganization();
    const { employee: employeeB } = await createUserWithEmployee(orgB._id, { role: 'EMPLOYEE' });

    const res = await request(app)
      .post('/api/employee-schedules')
      .set('Authorization', authHeaderFor(hrAdminA))
      .send({ employeeId: employeeB._id.toString(), shiftId: shiftA.id, effectiveFrom: '2026-01-01' });

    expect(res.status).toBe(404);
  });

  test('a manager cannot list schedules from another organization', async () => {
    const orgA = await createOrganization();
    const hrAdminA = await createUser(orgA._id, { role: 'HR_ADMIN' });
    const { employee } = await setupManagerAndReport(orgA);
    const shiftA = await createShift(hrAdminA);
    await request(app)
      .post('/api/employee-schedules')
      .set('Authorization', authHeaderFor(hrAdminA))
      .send({ employeeId: employee._id.toString(), shiftId: shiftA.id, effectiveFrom: '2026-01-01' });

    const orgB = await createOrganization();
    const { managerUser: managerB } = await setupManagerAndReport(orgB);

    const res = await request(app)
      .get('/api/employee-schedules')
      .set('Authorization', authHeaderFor(managerB));

    expect(res.body.data).toHaveLength(0);
  });

  test('rejects invalid daysOfWeek values', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await setupManagerAndReport(org);
    const shift = await createShift(hrAdmin);

    const res = await request(app)
      .post('/api/employee-schedules')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ employeeId: employee._id.toString(), shiftId: shift.id, effectiveFrom: '2026-01-01', daysOfWeek: [7, 8] });

    expect(res.status).toBe(400);
  });

  test('cancelling an ACTIVE assignment sets status and cancelledBy/At', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await setupManagerAndReport(org);
    const shift = await createShift(hrAdmin);
    const created = await request(app)
      .post('/api/employee-schedules')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ employeeId: employee._id.toString(), shiftId: shift.id, effectiveFrom: '2026-01-01' });

    const res = await request(app)
      .post(`/api/employee-schedules/${created.body.data.id}/cancel`)
      .set('Authorization', authHeaderFor(hrAdmin));

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');

    const stored = await EmployeeSchedule.findById(created.body.data.id).lean();
    expect(stored.cancelledBy.toString()).toBe(hrAdmin._id.toString());
    expect(stored.cancelledAt).toBeTruthy();
  });

  test('organizationId and assignedBy cannot be mass-assigned by the client', async () => {
    const orgA = await createOrganization();
    const hrAdmin = await createUser(orgA._id, { role: 'HR_ADMIN' });
    const { employee } = await setupManagerAndReport(orgA);
    const shift = await createShift(hrAdmin);
    const orgB = await createOrganization();

    const res = await request(app)
      .post('/api/employee-schedules')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({
        employeeId: employee._id.toString(), shiftId: shift.id, effectiveFrom: '2026-01-01',
        organizationId: orgB._id.toString(), assignedBy: '000000000000000000000000',
      });

    expect(res.status).toBe(201);
    const stored = await EmployeeSchedule.findById(res.body.data.id).lean();
    expect(stored.organizationId.toString()).toBe(orgA._id.toString());
    expect(stored.assignedBy.toString()).toBe(hrAdmin._id.toString());
  });
});

describe('ESS self-service — GET /api/ess/schedule', () => {
  test('an employee can view their own current active schedule', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employeeUser, employee } = await setupManagerAndReport(org);
    const shift = await createShift(hrAdmin);
    await request(app)
      .post('/api/employee-schedules')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ employeeId: employee._id.toString(), shiftId: shift.id, effectiveFrom: '2026-01-01' });

    const res = await request(app)
      .get('/api/ess/schedule')
      .set('Authorization', authHeaderFor(employeeUser));

    expect(res.status).toBe(200);
    expect(res.body.data.shiftId.code).toBe('MORN');
  });

  test('an employee with no schedule assigned gets null, not an error', async () => {
    const org = await createOrganization();
    const { user: employeeUser } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const res = await request(app)
      .get('/api/ess/schedule')
      .set('Authorization', authHeaderFor(employeeUser));

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  test('a user with no linked employee record gets 404', async () => {
    const org = await createOrganization();
    const user = await createUser(org._id, { role: 'EMPLOYEE' });

    const res = await request(app)
      .get('/api/ess/schedule')
      .set('Authorization', authHeaderFor(user));

    expect(res.status).toBe(404);
  });
});
