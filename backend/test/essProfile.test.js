const request = require('supertest');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUserWithEmployee, authHeaderFor } = require('./helpers/factories');
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

describe('GET /api/ess/me/profile', () => {
  test('returns editable and read-only sections for the caller\'s own profile', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id, { jobTitle: 'Engineer' });

    const res = await request(app).get('/api/ess/me/profile').set('Authorization', authHeaderFor(user));

    expect(res.status).toBe(200);
    expect(res.body.data.employeeId).toBe(employee._id.toString());
    expect(res.body.data).toHaveProperty('phone');
    expect(res.body.data).toHaveProperty('address');
    expect(res.body.data).toHaveProperty('emergencyContacts', []);
    expect(res.body.data.employment.employeeCode).toBe(employee.employeeId);
    expect(res.body.data.employment.status).toBe('ACTIVE');
    expect(res.body.data).not.toHaveProperty('bankDetails');
    expect(res.body.data).not.toHaveProperty('taxInfo');
  });
});

describe('PATCH /api/ess/me/profile', () => {
  test('updates only the allowlisted fields', async () => {
    const org = await createOrganization();
    const { user } = await createUserWithEmployee(org._id);

    const res = await request(app)
      .patch('/api/ess/me/profile')
      .set('Authorization', authHeaderFor(user))
      .send({
        phone: '+1 555 123 4567',
        personalEmail: 'me@personal.example.com',
        alternatePhone: '+1 555 987 6543',
        address: { street: '221B Baker St', city: 'London', country: 'UK' },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+1 555 123 4567');
    expect(res.body.data.personalEmail).toBe('me@personal.example.com');
    expect(res.body.data.address.city).toBe('London');
  });

  test('rejects an invalid phone number', async () => {
    const org = await createOrganization();
    const { user } = await createUserWithEmployee(org._id);

    const res = await request(app)
      .patch('/api/ess/me/profile')
      .set('Authorization', authHeaderFor(user))
      .send({ phone: 'abc' });

    expect(res.status).toBe(400);
  });

  test('mass-assignment: protected fields in the body are silently ignored', async () => {
    const org = await createOrganization();
    const otherOrg = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id, { jobTitle: 'Engineer' });

    const res = await request(app)
      .patch('/api/ess/me/profile')
      .set('Authorization', authHeaderFor(user))
      .send({
        phone: '+1 555 000 1111',
        organizationId: otherOrg._id.toString(),
        role: 'SUPER_ADMIN',
        status: 'INACTIVE',
        employmentType: 'INTERN',
        departmentId: '65f000000000000000000000',
        jobTitle: 'CEO',
        salary: 999999,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+1 555 000 1111');
    expect(res.body.data.employment.status).toBe('ACTIVE');
    expect(res.body.data.employment.jobTitle).toBe('Engineer');

    const stored = await Employee.findById(employee._id);
    expect(stored.organizationId.toString()).toBe(org._id.toString());
    expect(stored.status).toBe('ACTIVE');
    expect(stored.jobTitle).toBe('Engineer');
    expect(stored.employmentType).not.toBe('INTERN');
    expect(stored.toObject()).not.toHaveProperty('salary');
  });

  test('an employee with no linked record gets 404, not a silent success', async () => {
    const org = await createOrganization();
    const { createUser } = require('./helpers/factories');
    const user = await createUser(org._id, { role: 'EMPLOYEE' });

    const res = await request(app)
      .patch('/api/ess/me/profile')
      .set('Authorization', authHeaderFor(user))
      .send({ phone: '+1 555 000 1111' });

    expect(res.status).toBe(404);
  });
});

describe('Emergency contacts', () => {
  test('add, update, and remove a contact end-to-end', async () => {
    const org = await createOrganization();
    const { user } = await createUserWithEmployee(org._id);

    const addRes = await request(app)
      .post('/api/ess/me/profile/emergency-contacts')
      .set('Authorization', authHeaderFor(user))
      .send({ name: 'Jane Doe', relationship: 'Spouse', phone: '+1 555 222 3333' });
    expect(addRes.status).toBe(201);
    expect(addRes.body.data.name).toBe('Jane Doe');
    const contactId = addRes.body.data.id;

    const updateRes = await request(app)
      .patch(`/api/ess/me/profile/emergency-contacts/${contactId}`)
      .set('Authorization', authHeaderFor(user))
      .send({ phone: '+1 555 444 5555' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.phone).toBe('+1 555 444 5555');
    expect(updateRes.body.data.name).toBe('Jane Doe');

    const profileRes = await request(app).get('/api/ess/me/profile').set('Authorization', authHeaderFor(user));
    expect(profileRes.body.data.emergencyContacts).toHaveLength(1);

    const deleteRes = await request(app)
      .delete(`/api/ess/me/profile/emergency-contacts/${contactId}`)
      .set('Authorization', authHeaderFor(user));
    expect(deleteRes.status).toBe(200);

    const afterRes = await request(app).get('/api/ess/me/profile').set('Authorization', authHeaderFor(user));
    expect(afterRes.body.data.emergencyContacts).toHaveLength(0);
  });

  test('rejects a contact missing required fields', async () => {
    const org = await createOrganization();
    const { user } = await createUserWithEmployee(org._id);

    const res = await request(app)
      .post('/api/ess/me/profile/emergency-contacts')
      .set('Authorization', authHeaderFor(user))
      .send({ name: 'Jane Doe' });
    expect(res.status).toBe(400);
  });

  test('enforces the maximum number of emergency contacts', async () => {
    const org = await createOrganization();
    const { user } = await createUserWithEmployee(org._id);

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app)
        .post('/api/ess/me/profile/emergency-contacts')
        .set('Authorization', authHeaderFor(user))
        .send({ name: `Contact ${i}`, relationship: 'Friend', phone: '+1 555 000 000' + i });
      expect(res.status).toBe(201);
    }

    const overLimitRes = await request(app)
      .post('/api/ess/me/profile/emergency-contacts')
      .set('Authorization', authHeaderFor(user))
      .send({ name: 'One Too Many', relationship: 'Friend', phone: '+1 555 000 9999' });
    expect(overLimitRes.status).toBe(400);
  });

  test('IDOR: cannot update or remove another employee\'s emergency contact', async () => {
    const org = await createOrganization();
    const { user: userA } = await createUserWithEmployee(org._id);
    const { user: userB } = await createUserWithEmployee(org._id);

    const addRes = await request(app)
      .post('/api/ess/me/profile/emergency-contacts')
      .set('Authorization', authHeaderFor(userA))
      .send({ name: 'A\'s Contact', relationship: 'Friend', phone: '+1 555 111 2222' });
    const contactId = addRes.body.data.id;

    const updateRes = await request(app)
      .patch(`/api/ess/me/profile/emergency-contacts/${contactId}`)
      .set('Authorization', authHeaderFor(userB))
      .send({ name: 'Hijacked' });
    expect(updateRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/ess/me/profile/emergency-contacts/${contactId}`)
      .set('Authorization', authHeaderFor(userB));
    expect(deleteRes.status).toBe(404);

    const stillThereRes = await request(app).get('/api/ess/me/profile').set('Authorization', authHeaderFor(userA));
    expect(stillThereRes.body.data.emergencyContacts).toHaveLength(1);
    expect(stillThereRes.body.data.emergencyContacts[0].name).toBe('A\'s Contact');
  });
});
