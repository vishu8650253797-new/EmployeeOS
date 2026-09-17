const request = require('supertest');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser, createUserWithEmployee, authHeaderFor } = require('./helpers/factories');
const { Employee } = require('../src/models');

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

describe('GET /api/ess/me', () => {
  test('returns a safe self-service context for a valid, active employee', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id, { firstName: 'Ada', lastName: 'Lovelace' });

    const res = await request(app).get('/api/ess/me').set('Authorization', authHeaderFor(user));

    expect(res.status).toBe(200);
    expect(res.body.data.employeeId).toBe(employee._id.toString());
    expect(res.body.data.displayName).toBe('Ada Lovelace');
    expect(res.body.data.employeeStatus).toBe('ACTIVE');
    expect(res.body.data.accountStatus).toBe('active');
    expect(res.body.data.organizationName).toBe(org.name);
    expect(res.body.data).not.toHaveProperty('password');
    expect(res.body.data).not.toHaveProperty('accessToken');

    const capabilities = res.body.data.capabilities;
    expect(capabilities.profile.status).toBe('available');
    expect(capabilities.leave.status).toBe('available');
    expect(capabilities.attendance.status).toBe('available');
    expect(capabilities.payroll.status).toBe('available');
    expect(capabilities.documents.status).toBe('available');
    expect(capabilities.requests.status).toBe('coming_soon');
    expect(capabilities.notifications.status).toBe('available');
  });

  test('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/ess/me');
    expect(res.status).toBe(401);
  });

  test('returns 404 when the user has no linked employee record', async () => {
    const org = await createOrganization();
    const user = await createUser(org._id, { role: 'EMPLOYEE' }); // no employeeId

    const res = await request(app).get('/api/ess/me').set('Authorization', authHeaderFor(user));
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/no employee record/i);
  });

  test('returns 404 when the linked employee has been soft-deleted', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id);
    await Employee.updateOne({ _id: employee._id }, { isDeleted: true });

    const res = await request(app).get('/api/ess/me').set('Authorization', authHeaderFor(user));
    expect(res.status).toBe(404);
  });

  test('returns 403 when the linked employee is INACTIVE', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id);
    await Employee.updateOne({ _id: employee._id }, { status: 'INACTIVE' });

    const res = await request(app).get('/api/ess/me').set('Authorization', authHeaderFor(user));
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/inactive/i);
  });

  test('a SUSPENDED employee still resolves, but non-essential capabilities are restricted', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id);
    await Employee.updateOne({ _id: employee._id }, { status: 'SUSPENDED' });

    const res = await request(app).get('/api/ess/me').set('Authorization', authHeaderFor(user));
    expect(res.status).toBe(200);
    expect(res.body.data.capabilities.leave.status).toBe('restricted');
    expect(res.body.data.capabilities.profile.status).toBe('available');
    expect(res.body.data.capabilities.notifications.status).toBe('available');
  });

  test('ignores a client-supplied employeeId — the session is the only source of identity (IDOR guard)', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id);
    const { employee: otherEmployee } = await createUserWithEmployee(org._id);

    const res = await request(app)
      .get('/api/ess/me')
      .query({ employeeId: otherEmployee._id.toString() })
      .set('Authorization', authHeaderFor(user));

    expect(res.status).toBe(200);
    expect(res.body.data.employeeId).toBe(employee._id.toString());
  });

  test('cross-org: a user only ever resolves their own organization\'s employee record', async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const { user: userA, employee: employeeA } = await createUserWithEmployee(orgA._id);
    await createUserWithEmployee(orgB._id);

    const res = await request(app).get('/api/ess/me').set('Authorization', authHeaderFor(userA));
    expect(res.status).toBe(200);
    expect(res.body.data.employeeId).toBe(employeeA._id.toString());
    expect(res.body.data.organizationName).toBe(orgA.name);
  });
});
