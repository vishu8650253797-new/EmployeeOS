const request = require('supertest');
const app = require('../src/app');
const { TimeEntry } = require('../src/models');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser, createUserWithEmployee, authHeaderFor } = require('./helpers/factories');

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

async function setup() {
  const org = await createOrganization();
  const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });
  return { org, employeeUser, employee };
}

describe('Time Entries — model/schema', () => {
  test('required fields are enforced at the schema level', async () => {
    await expect(TimeEntry.create({})).rejects.toThrow();
  });
});

describe('Time Entries — start/end lifecycle', () => {
  test('an employee can start a time entry and it defaults to ACTIVE', async () => {
    const { employeeUser } = await setup();
    const res = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.startTime).toBeTruthy();
    expect(res.body.data.endTime).toBeFalsy();
    expect(res.body.data.entryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('the entry owner is always server-resolved, never taken from the client', async () => {
    const { employeeUser, employee } = await setup();
    const res = await request(app)
      .post('/api/ess/time-entries/start')
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ employeeId: '000000000000000000000000', organizationId: '000000000000000000000000', status: 'COMPLETED' });

    expect(res.status).toBe(201);
    expect(res.body.data.employeeId).toBe(employee._id.toString());
    expect(res.body.data.status).toBe('ACTIVE');
  });

  test('an employee cannot start a second active entry while one is already active (partial unique index)', async () => {
    const { employeeUser } = await setup();
    await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));
    const second = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));
    expect(second.status).toBe(409);
  });

  test('ending an entry computes duration server-side and transitions to COMPLETED', async () => {
    const { employeeUser } = await setup();
    const started = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));
    const id = started.body.data.id;

    const ended = await request(app)
      .post(`/api/ess/time-entries/${id}/end`)
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ notes: 'Worked on onboarding docs', durationMinutes: 999999 });

    expect(ended.status).toBe(200);
    expect(ended.body.data.status).toBe('COMPLETED');
    expect(ended.body.data.endTime).toBeTruthy();
    expect(typeof ended.body.data.durationMinutes).toBe('number');
    expect(ended.body.data.durationMinutes).toBeLessThan(5); // just started, ended immediately
    expect(ended.body.data.notes).toBe('Worked on onboarding docs');
  });

  test('an entry cannot be ended twice', async () => {
    const { employeeUser } = await setup();
    const started = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));
    const id = started.body.data.id;
    await request(app).post(`/api/ess/time-entries/${id}/end`).set('Authorization', authHeaderFor(employeeUser));

    const secondEnd = await request(app).post(`/api/ess/time-entries/${id}/end`).set('Authorization', authHeaderFor(employeeUser));
    expect(secondEnd.status).toBe(409);
  });

  test('after ending an entry, a new one can be started', async () => {
    const { employeeUser } = await setup();
    const started = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));
    await request(app).post(`/api/ess/time-entries/${started.body.data.id}/end`).set('Authorization', authHeaderFor(employeeUser));

    const secondStart = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));
    expect(secondStart.status).toBe(201);
  });
});

describe('Time Entries — listing and validation', () => {
  test('an employee can list their own entries, paginated', async () => {
    const { employeeUser } = await setup();
    const started = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));
    await request(app).post(`/api/ess/time-entries/${started.body.data.id}/end`).set('Authorization', authHeaderFor(employeeUser));

    const res = await request(app).get('/api/ess/time-entries').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  test('an invalid status filter is rejected with a validation error', async () => {
    const { employeeUser } = await setup();
    const res = await request(app)
      .get('/api/ess/time-entries')
      .query({ status: 'NOT_A_REAL_STATUS' })
      .set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(400);
  });

  test('a malformed date filter is rejected', async () => {
    const { employeeUser } = await setup();
    const res = await request(app)
      .get('/api/ess/time-entries')
      .query({ startDate: '09/22/2026', endDate: '2026-09-30' })
      .set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(400);
  });
});

describe('Time Entries — security', () => {
  test('unauthenticated requests are rejected', async () => {
    const res = await request(app).post('/api/ess/time-entries/start');
    expect(res.status).toBe(401);
  });

  test('a user with no linked employee record gets a clean error, not a crash', async () => {
    const org = await createOrganization();
    const userWithoutEmployee = await createUser(org._id, { role: 'EMPLOYEE' });
    const res = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(userWithoutEmployee));
    expect(res.status).toBe(404);
  });

  test('an employee cannot view another employee\'s time entry (IDOR)', async () => {
    const { org, employeeUser } = await setup();
    const { user: otherUser } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });
    const started = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));

    const res = await request(app)
      .get(`/api/ess/time-entries/${started.body.data.id}`)
      .set('Authorization', authHeaderFor(otherUser));
    expect(res.status).toBe(404);
  });

  test('an employee cannot end another employee\'s time entry', async () => {
    const { org, employeeUser } = await setup();
    const { user: otherUser } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });
    const started = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));

    const res = await request(app)
      .post(`/api/ess/time-entries/${started.body.data.id}/end`)
      .set('Authorization', authHeaderFor(otherUser));
    expect(res.status).toBe(404);

    const stillActive = await TimeEntry.findById(started.body.data.id).lean();
    expect(stillActive.status).toBe('ACTIVE');
  });

  test('an employee cannot see or reach another organization\'s time entry', async () => {
    const { employeeUser } = await setup();
    const orgB = await createOrganization();
    const { user: orgBUser } = await createUserWithEmployee(orgB._id, { joiningDate: new Date('2025-01-01') });
    const started = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));

    const res = await request(app)
      .get(`/api/ess/time-entries/${started.body.data.id}`)
      .set('Authorization', authHeaderFor(orgBUser));
    expect(res.status).toBe(404);

    const listRes = await request(app).get('/api/ess/time-entries').set('Authorization', authHeaderFor(orgBUser));
    expect(listRes.body.data).toHaveLength(0);
  });

  test('a malformed time entry ID is handled safely, not with a 500', async () => {
    const { employeeUser } = await setup();
    const res = await request(app).get('/api/ess/time-entries/not-a-valid-id').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(400);
  });
});
