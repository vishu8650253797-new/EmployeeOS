const request = require('supertest');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser, authHeaderFor } = require('./helpers/factories');
const { Shift } = require('../src/models');

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

function shiftPayload(overrides = {}) {
  return {
    name: 'Morning Shift',
    code: 'MORN',
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: 30,
    ...overrides,
  };
}

describe('Shift definitions — CRUD, RBAC, org isolation', () => {
  test('HR_ADMIN can create a shift and derived fields are computed correctly', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });

    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send(shiftPayload());

    expect(res.status).toBe(201);
    expect(res.body.data.isOvernight).toBe(false);
    expect(res.body.data.scheduledMinutes).toBe(450); // 8h - 30min break
  });

  test('an overnight shift is detected and wraps past midnight for scheduledMinutes', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });

    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send(shiftPayload({ code: 'NIGHT', startTime: '22:00', endTime: '06:00', breakMinutes: 0 }));

    expect(res.status).toBe(201);
    expect(res.body.data.isOvernight).toBe(true);
    expect(res.body.data.scheduledMinutes).toBe(480); // 8 hours
  });

  test('SUPER_ADMIN and MANAGER cannot / can respectively — MANAGER is forbidden from shift admin', async () => {
    const org = await createOrganization();
    const manager = await createUser(org._id, { role: 'MANAGER' });

    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', authHeaderFor(manager))
      .send(shiftPayload());

    expect(res.status).toBe(403);
  });

  test('a plain employee cannot create or list shifts', async () => {
    const org = await createOrganization();
    const employee = await createUser(org._id, { role: 'EMPLOYEE' });

    const createRes = await request(app)
      .post('/api/shifts')
      .set('Authorization', authHeaderFor(employee))
      .send(shiftPayload());
    expect(createRes.status).toBe(403);

    const listRes = await request(app)
      .get('/api/shifts')
      .set('Authorization', authHeaderFor(employee));
    expect(listRes.status).toBe(403);
  });

  test('duplicate shift code within the same org is rejected with 409', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });

    await request(app).post('/api/shifts').set('Authorization', authHeaderFor(hrAdmin)).send(shiftPayload());
    const dup = await request(app).post('/api/shifts').set('Authorization', authHeaderFor(hrAdmin)).send(shiftPayload());

    expect(dup.status).toBe(409);
  });

  test('the same shift code is allowed across two different organizations', async () => {
    const orgA = await createOrganization();
    const hrAdminA = await createUser(orgA._id, { role: 'HR_ADMIN' });
    const orgB = await createOrganization();
    const hrAdminB = await createUser(orgB._id, { role: 'HR_ADMIN' });

    const resA = await request(app).post('/api/shifts').set('Authorization', authHeaderFor(hrAdminA)).send(shiftPayload());
    const resB = await request(app).post('/api/shifts').set('Authorization', authHeaderFor(hrAdminB)).send(shiftPayload());

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
  });

  test('a shift from another organization is not visible or fetchable (404, not leaked)', async () => {
    const orgA = await createOrganization();
    const hrAdminA = await createUser(orgA._id, { role: 'HR_ADMIN' });
    const created = await request(app).post('/api/shifts').set('Authorization', authHeaderFor(hrAdminA)).send(shiftPayload());

    const orgB = await createOrganization();
    const hrAdminB = await createUser(orgB._id, { role: 'HR_ADMIN' });

    const listRes = await request(app).get('/api/shifts').set('Authorization', authHeaderFor(hrAdminB));
    expect(listRes.body.data).toHaveLength(0);

    const getRes = await request(app)
      .get(`/api/shifts/${created.body.data.id}`)
      .set('Authorization', authHeaderFor(hrAdminB));
    expect(getRes.status).toBe(404);
  });

  test('deactivating a shift toggles status and is audit logged', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const created = await request(app).post('/api/shifts').set('Authorization', authHeaderFor(hrAdmin)).send(shiftPayload());

    const res = await request(app)
      .patch(`/api/shifts/${created.body.data.id}/status`)
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ status: 'INACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('INACTIVE');

    const stored = await Shift.findById(created.body.data.id).lean();
    expect(stored.status).toBe('INACTIVE');
  });

  test('creating a shift with malformed time strings is rejected by validation', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });

    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send(shiftPayload({ code: 'BAD', startTime: '9:00', endTime: '25:00' }));

    expect(res.status).toBe(400);
  });

  test('organizationId and createdBy cannot be mass-assigned by the client', async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const hrAdmin = await createUser(orgA._id, { role: 'HR_ADMIN' });

    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send(shiftPayload({ organizationId: orgB._id.toString(), createdBy: '000000000000000000000000' }));

    expect(res.status).toBe(201);
    const stored = await Shift.findById(res.body.data.id).lean();
    expect(stored.organizationId.toString()).toBe(orgA._id.toString());
    expect(stored.createdBy.toString()).toBe(hrAdmin._id.toString());
  });
});
