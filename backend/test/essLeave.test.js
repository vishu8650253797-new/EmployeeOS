const request = require('supertest');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUserWithEmployee, authHeaderFor } = require('./helpers/factories');
const { LeaveType, LeaveBalance, LeaveRequest } = require('../src/models');

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

const YEAR = new Date().getFullYear();

async function createLeaveType(orgId, overrides = {}) {
  return LeaveType.create({
    organizationId: orgId, name: 'Annual Leave', code: 'ANNUAL', totalDays: 20, status: 'ACTIVE', ...overrides,
  });
}

async function createBalance(orgId, employeeId, leaveTypeId, overrides = {}) {
  return LeaveBalance.create({
    organizationId: orgId, employeeId, leaveTypeId, year: YEAR,
    allocatedDays: 20, usedDays: 0, pendingDays: 0, remainingDays: 20, ...overrides,
  });
}

// A Monday-to-Tuesday range so working-day counting is deterministic
// regardless of which day the test happens to run on.
function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
  return d;
}

describe('GET /api/ess/leave/types', () => {
  test('returns only active leave types for the org', async () => {
    const org = await createOrganization();
    const { user } = await createUserWithEmployee(org._id);
    await createLeaveType(org._id, { name: 'Annual', code: 'ANN' });
    await createLeaveType(org._id, { name: 'Retired Type', code: 'OLD', status: 'INACTIVE' });

    const res = await request(app).get('/api/ess/leave/types').set('Authorization', authHeaderFor(user));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].code).toBe('ANN');
  });
});

describe('GET /api/ess/leave/balance', () => {
  test('returns the caller\'s own balances only', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id);
    const { employee: other } = await createUserWithEmployee(org._id);
    const leaveType = await createLeaveType(org._id);
    await createBalance(org._id, employee._id, leaveType._id);
    await createBalance(org._id, other._id, leaveType._id, { allocatedDays: 99, remainingDays: 99 });

    const res = await request(app).get('/api/ess/leave/balance').set('Authorization', authHeaderFor(user));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].remaining).toBe(20);
  });
});

describe('POST /api/ess/leave/requests', () => {
  test('creates a leave request for the caller and reserves balance', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id);
    const leaveType = await createLeaveType(org._id);
    await createBalance(org._id, employee._id, leaveType._id);

    const start = nextMonday();
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const res = await request(app)
      .post('/api/ess/leave/requests')
      .set('Authorization', authHeaderFor(user))
      .send({ leaveTypeId: leaveType._id.toString(), startDate: start.toISOString(), endDate: end.toISOString(), reason: 'Trip' });

    expect(res.status).toBe(201);
    expect(res.body.data.employeeId).toBe(employee._id.toString());
    expect(res.body.data.numberOfDays).toBe(2);

    const balance = await LeaveBalance.findOne({ employeeId: employee._id, leaveTypeId: leaveType._id });
    expect(balance.pendingDays).toBe(2);
    expect(balance.remainingDays).toBe(18);
  });

  test('mass assignment: a client-supplied employeeId is ignored — the request is always created for the caller', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id);
    const { employee: victim } = await createUserWithEmployee(org._id);
    const leaveType = await createLeaveType(org._id);
    await createBalance(org._id, employee._id, leaveType._id);
    await createBalance(org._id, victim._id, leaveType._id);

    const start = nextMonday();
    const end = new Date(start);

    const res = await request(app)
      .post('/api/ess/leave/requests')
      .set('Authorization', authHeaderFor(user))
      .send({
        employeeId: victim._id.toString(),
        leaveTypeId: leaveType._id.toString(),
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.employeeId).toBe(employee._id.toString());

    const victimRequests = await LeaveRequest.countDocuments({ employeeId: victim._id });
    expect(victimRequests).toBe(0);
  });

  test('rejects insufficient balance', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id);
    const leaveType = await createLeaveType(org._id);
    await createBalance(org._id, employee._id, leaveType._id, { allocatedDays: 1, remainingDays: 1 });

    const start = nextMonday();
    const end = new Date(start);
    end.setDate(end.getDate() + 4); // 5 working days requested, only 1 remaining

    const res = await request(app)
      .post('/api/ess/leave/requests')
      .set('Authorization', authHeaderFor(user))
      .send({ leaveTypeId: leaveType._id.toString(), startDate: start.toISOString(), endDate: end.toISOString() });

    expect(res.status).toBe(400);
  });

  test('rejects an overlapping request', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id);
    const leaveType = await createLeaveType(org._id);
    await createBalance(org._id, employee._id, leaveType._id);

    const start = nextMonday();
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    await request(app)
      .post('/api/ess/leave/requests')
      .set('Authorization', authHeaderFor(user))
      .send({ leaveTypeId: leaveType._id.toString(), startDate: start.toISOString(), endDate: end.toISOString() });

    const overlapRes = await request(app)
      .post('/api/ess/leave/requests')
      .set('Authorization', authHeaderFor(user))
      .send({ leaveTypeId: leaveType._id.toString(), startDate: start.toISOString(), endDate: end.toISOString() });

    expect(overlapRes.status).toBe(400);
  });
});

describe('GET /api/ess/leave/requests', () => {
  test('lists only the caller\'s own requests, paginated', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id);
    const { employee: other } = await createUserWithEmployee(org._id);
    const leaveType = await createLeaveType(org._id);
    await createBalance(org._id, employee._id, leaveType._id);
    await createBalance(org._id, other._id, leaveType._id);

    const start = nextMonday();
    await request(app)
      .post('/api/ess/leave/requests')
      .set('Authorization', authHeaderFor(user))
      .send({ leaveTypeId: leaveType._id.toString(), startDate: start.toISOString(), endDate: start.toISOString() });

    await LeaveRequest.create({
      organizationId: org._id, employeeId: other._id, leaveTypeId: leaveType._id,
      startDate: start, endDate: start, numberOfDays: 1, status: 'PENDING',
    });

    const res = await request(app)
      .get('/api/ess/leave/requests')
      .query({ page: 1, limit: 10 })
      .set('Authorization', authHeaderFor(user));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].employeeId).toBe(employee._id.toString());
    expect(res.body.pagination.total).toBe(1);
  });
});

describe('Leave request ownership (IDOR)', () => {
  test('an employee cannot view another employee\'s leave request', async () => {
    const org = await createOrganization();
    const { user: victimUser, employee: victim } = await createUserWithEmployee(org._id);
    const { user: attacker } = await createUserWithEmployee(org._id);
    const leaveType = await createLeaveType(org._id);
    await createBalance(org._id, victim._id, leaveType._id);

    const start = nextMonday();
    const createRes = await request(app)
      .post('/api/ess/leave/requests')
      .set('Authorization', authHeaderFor(victimUser))
      .send({ leaveTypeId: leaveType._id.toString(), startDate: start.toISOString(), endDate: start.toISOString() });
    const requestId = createRes.body.data.id;

    const viewRes = await request(app)
      .get(`/api/ess/leave/requests/${requestId}`)
      .set('Authorization', authHeaderFor(attacker));
    expect(viewRes.status).toBe(403);

    const cancelRes = await request(app)
      .post(`/api/ess/leave/requests/${requestId}/cancel`)
      .set('Authorization', authHeaderFor(attacker));
    expect(cancelRes.status).toBe(403);
  });

  test('the owner can cancel their own pending request and balance is restored', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id);
    const leaveType = await createLeaveType(org._id);
    await createBalance(org._id, employee._id, leaveType._id);

    const start = nextMonday();
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const createRes = await request(app)
      .post('/api/ess/leave/requests')
      .set('Authorization', authHeaderFor(user))
      .send({ leaveTypeId: leaveType._id.toString(), startDate: start.toISOString(), endDate: end.toISOString() });

    const cancelRes = await request(app)
      .post(`/api/ess/leave/requests/${createRes.body.data.id}/cancel`)
      .set('Authorization', authHeaderFor(user));
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    const balance = await LeaveBalance.findOne({ employeeId: employee._id, leaveTypeId: leaveType._id });
    expect(balance.pendingDays).toBe(0);
    expect(balance.remainingDays).toBe(20);
  });
});
