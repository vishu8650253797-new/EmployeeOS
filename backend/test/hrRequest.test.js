const request = require('supertest');
const app = require('../src/app');
const { AuditLog } = require('../src/models');
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

const VALID_REQUEST = {
  category: 'SALARY_CERTIFICATE',
  subject: 'Need a salary certificate for a visa application',
  description: 'Please issue a salary certificate covering the last 6 months.',
};

async function setup() {
  const org = await createOrganization();
  const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
  const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });
  return { org, hrAdmin, employeeUser, employee };
}

describe('HR Requests — employee self-service', () => {
  test('an employee can submit an HR request and it is owned by them', async () => {
    const { employeeUser } = await setup();

    const res = await request(app)
      .post('/api/ess/requests')
      .set('Authorization', authHeaderFor(employeeUser))
      .send(VALID_REQUEST);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('SUBMITTED');
    expect(res.body.data.category).toBe('SALARY_CERTIFICATE');
  });

  test('the request owner is always server-resolved, never taken from the client body', async () => {
    const { employeeUser, employee } = await setup();

    const res = await request(app)
      .post('/api/ess/requests')
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ ...VALID_REQUEST, employeeId: '000000000000000000000000', organizationId: '000000000000000000000000' });

    expect(res.status).toBe(201);
    expect(res.body.data.employeeId).toBe(employee._id.toString());
  });

  test('validation rejects a missing subject/description or an unknown category', async () => {
    const { employeeUser } = await setup();

    const missingFields = await request(app)
      .post('/api/ess/requests')
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ category: 'SALARY_CERTIFICATE' });
    expect(missingFields.status).toBe(400);

    const badCategory = await request(app)
      .post('/api/ess/requests')
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ ...VALID_REQUEST, category: 'NOT_A_REAL_CATEGORY' });
    expect(badCategory.status).toBe(400);
  });

  test('an employee can list and view only their own requests', async () => {
    const { org, employeeUser } = await setup();
    const { user: otherUser } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });

    await request(app).post('/api/ess/requests').set('Authorization', authHeaderFor(employeeUser)).send(VALID_REQUEST);

    const mine = await request(app).get('/api/ess/requests').set('Authorization', authHeaderFor(employeeUser));
    expect(mine.body.data).toHaveLength(1);

    const othersView = await request(app).get('/api/ess/requests').set('Authorization', authHeaderFor(otherUser));
    expect(othersView.body.data).toHaveLength(0);
  });

  test('an employee cannot view another employee\'s request by ID (IDOR)', async () => {
    const { org, employeeUser } = await setup();
    const { user: otherUser } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });

    const created = await request(app).post('/api/ess/requests').set('Authorization', authHeaderFor(employeeUser)).send(VALID_REQUEST);
    const id = created.body.data.id;

    const res = await request(app).get(`/api/ess/requests/${id}`).set('Authorization', authHeaderFor(otherUser));
    expect(res.status).toBe(404);
  });

  test('an employee cannot view another organization\'s request', async () => {
    const { employeeUser } = await setup();
    const orgB = await createOrganization();
    const { user: orgBUser } = await createUserWithEmployee(orgB._id, { joiningDate: new Date('2025-01-01') });

    const created = await request(app).post('/api/ess/requests').set('Authorization', authHeaderFor(employeeUser)).send(VALID_REQUEST);
    const id = created.body.data.id;

    const res = await request(app).get(`/api/ess/requests/${id}`).set('Authorization', authHeaderFor(orgBUser));
    expect(res.status).toBe(404);
  });

  test('invalid request IDs are handled safely, not with a 500', async () => {
    const { employeeUser } = await setup();
    const res = await request(app).get('/api/ess/requests/not-a-valid-id').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(400);
  });

  test('a user with no linked employee record gets a clean error, not a crash', async () => {
    const org = await createOrganization();
    const userWithoutEmployee = await createUser(org._id, { role: 'EMPLOYEE' });
    const res = await request(app).get('/api/ess/requests').set('Authorization', authHeaderFor(userWithoutEmployee));
    expect(res.status).toBe(404);
  });

  test('unauthenticated requests are rejected', async () => {
    const res = await request(app).get('/api/ess/requests');
    expect(res.status).toBe(401);
  });

  test('an employee can add a follow-up message and it is audit-logged', async () => {
    const { employeeUser } = await setup();
    const created = await request(app).post('/api/ess/requests').set('Authorization', authHeaderFor(employeeUser)).send(VALID_REQUEST);
    const id = created.body.data.id;

    const res = await request(app)
      .post(`/api/ess/requests/${id}/messages`)
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ message: 'Any update on this?' });

    expect(res.status).toBe(201);
    expect(res.body.data.messages).toHaveLength(1);

    const logs = await AuditLog.find({ action: 'ESS_HR_REQUEST_MESSAGE_ADDED', entityId: id });
    expect(logs).toHaveLength(1);
  });

  test('an employee cannot add a message to another employee\'s request', async () => {
    const { org, employeeUser } = await setup();
    const { user: otherUser } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });
    const created = await request(app).post('/api/ess/requests').set('Authorization', authHeaderFor(employeeUser)).send(VALID_REQUEST);
    const id = created.body.data.id;

    const res = await request(app)
      .post(`/api/ess/requests/${id}/messages`)
      .set('Authorization', authHeaderFor(otherUser))
      .send({ message: 'Trying to butt in' });
    expect(res.status).toBe(404);
  });

  test('an employee can cancel a SUBMITTED request but not one already IN_PROGRESS', async () => {
    const { hrAdmin, employeeUser } = await setup();
    const created = await request(app).post('/api/ess/requests').set('Authorization', authHeaderFor(employeeUser)).send(VALID_REQUEST);
    const id = created.body.data.id;

    const cancelled = await request(app).post(`/api/ess/requests/${id}/cancel`).set('Authorization', authHeaderFor(employeeUser));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');

    const created2 = await request(app).post('/api/ess/requests').set('Authorization', authHeaderFor(employeeUser)).send(VALID_REQUEST);
    const id2 = created2.body.data.id;
    await request(app).patch(`/api/hr-requests/${id2}/status`).set('Authorization', authHeaderFor(hrAdmin)).send({ status: 'IN_PROGRESS' });

    const blocked = await request(app).post(`/api/ess/requests/${id2}/cancel`).set('Authorization', authHeaderFor(employeeUser));
    expect(blocked.status).toBe(409);
  });

  test('an employee cannot set an arbitrary status via the messages/cancel endpoints', async () => {
    const { employeeUser } = await setup();
    const created = await request(app).post('/api/ess/requests').set('Authorization', authHeaderFor(employeeUser)).send(VALID_REQUEST);
    const id = created.body.data.id;

    // There is no employee-facing status-update endpoint at all — the admin
    // PATCH route is role-gated and rejects a plain employee outright.
    const res = await request(app)
      .patch(`/api/hr-requests/${id}/status`)
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(403);
  });
});

describe('HR Requests — admin/HR side', () => {
  test('HR admin can list and view any request in the organization', async () => {
    const { hrAdmin, employeeUser } = await setup();
    await request(app).post('/api/ess/requests').set('Authorization', authHeaderFor(employeeUser)).send(VALID_REQUEST);

    const list = await request(app).get('/api/hr-requests').set('Authorization', authHeaderFor(hrAdmin));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const id = list.body.data[0].id;
    const details = await request(app).get(`/api/hr-requests/${id}`).set('Authorization', authHeaderFor(hrAdmin));
    expect(details.status).toBe(200);
  });

  test('a plain employee cannot access the admin HR-requests endpoints', async () => {
    const { employeeUser } = await setup();
    const res = await request(app).get('/api/hr-requests').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(403);
  });

  test('HR admin cannot see another organization\'s requests', async () => {
    const { hrAdmin, employeeUser } = await setup();
    await request(app).post('/api/ess/requests').set('Authorization', authHeaderFor(employeeUser)).send(VALID_REQUEST);

    const orgB = await createOrganization();
    const hrAdminB = await createUser(orgB._id, { role: 'HR_ADMIN' });
    const listB = await request(app).get('/api/hr-requests').set('Authorization', authHeaderFor(hrAdminB));
    expect(listB.body.data).toHaveLength(0);
  });

  test('HR admin can change status and reply, and the employee sees it', async () => {
    const { hrAdmin, employeeUser } = await setup();
    const created = await request(app).post('/api/ess/requests').set('Authorization', authHeaderFor(employeeUser)).send(VALID_REQUEST);
    const id = created.body.data.id;

    const statusRes = await request(app)
      .patch(`/api/hr-requests/${id}/status`)
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ status: 'UNDER_REVIEW', note: 'Looking into it' });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('UNDER_REVIEW');

    const msgRes = await request(app)
      .post(`/api/hr-requests/${id}/messages`)
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ message: 'We are processing your certificate.' });
    expect(msgRes.status).toBe(201);

    const employeeView = await request(app).get(`/api/ess/requests/${id}`).set('Authorization', authHeaderFor(employeeUser));
    expect(employeeView.body.data.status).toBe('UNDER_REVIEW');
    expect(employeeView.body.data.messages).toHaveLength(1);
  });

  test('a fully closed/cancelled request rejects further status changes', async () => {
    const { hrAdmin, employeeUser } = await setup();
    const created = await request(app).post('/api/ess/requests').set('Authorization', authHeaderFor(employeeUser)).send(VALID_REQUEST);
    const id = created.body.data.id;

    await request(app).post(`/api/ess/requests/${id}/cancel`).set('Authorization', authHeaderFor(employeeUser));

    const res = await request(app)
      .patch(`/api/hr-requests/${id}/status`)
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(409);
  });
});
