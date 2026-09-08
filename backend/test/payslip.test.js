const request = require('supertest');
const app = require('../src/app');
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

async function setupFinalizedPayroll() {
  const org = await createOrganization();
  const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
  const finance = await createUser(org._id, { role: 'FINANCE' });
  const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });

  const basic = (await request(app)
    .post('/api/payroll/components')
    .set('Authorization', authHeaderFor(hrAdmin))
    .send({ code: 'BASIC', name: 'Basic', type: 'EARNING', calculationType: 'FIXED' })).body.data;

  const structure = (await request(app)
    .post('/api/payroll/structures')
    .set('Authorization', authHeaderFor(hrAdmin))
    .send({ name: 'Engineering L2', components: [{ componentId: basic.id, value: 5000000 }] })).body.data;

  await request(app)
    .post('/api/payroll/compensation')
    .set('Authorization', authHeaderFor(hrAdmin))
    .send({ employeeId: employee._id.toString(), structureId: structure.id, effectiveFrom: '2026-01-01' });

  const run = (await request(app)
    .post('/api/payroll/runs')
    .set('Authorization', authHeaderFor(hrAdmin))
    .send({ year: 2026, month: 9 })).body.data;

  await request(app).post(`/api/payroll/runs/${run.id}/process`).set('Authorization', authHeaderFor(hrAdmin));
  await request(app).post(`/api/payroll/runs/${run.id}/submit`).set('Authorization', authHeaderFor(hrAdmin));
  await request(app).post(`/api/payroll/runs/${run.id}/approve`).set('Authorization', authHeaderFor(finance));
  await request(app).post(`/api/payroll/runs/${run.id}/finalize`).set('Authorization', authHeaderFor(finance));

  return { org, hrAdmin, finance, employeeUser, employee, run };
}

describe('Payslips', () => {
  test('an employee can see only their own finalized payslips', async () => {
    const { employeeUser } = await setupFinalizedPayroll();

    const res = await request(app).get('/api/payroll/payslips/me').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('FINALIZED');
  });

  test('an employee cannot fetch another employee\'s payslip via /me/:id or /:id', async () => {
    const { org, employeeUser } = await setupFinalizedPayroll();
    const { user: otherUser } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });

    const mineRes = await request(app).get('/api/payroll/payslips/me').set('Authorization', authHeaderFor(employeeUser));
    const recordId = mineRes.body.data[0].id;

    const otherViaMe = await request(app)
      .get(`/api/payroll/payslips/me/${recordId}`)
      .set('Authorization', authHeaderFor(otherUser));
    expect(otherViaMe.status).toBe(404);

    const otherViaAdmin = await request(app)
      .get(`/api/payroll/payslips/${recordId}`)
      .set('Authorization', authHeaderFor(otherUser));
    expect(otherViaAdmin.status).toBe(403);
  });

  test('records belonging to a non-finalized run are excluded from /me', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });
    const basic = (await request(app)
      .post('/api/payroll/components')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ code: 'BASIC', name: 'Basic', type: 'EARNING', calculationType: 'FIXED' })).body.data;
    const structure = (await request(app)
      .post('/api/payroll/structures')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ name: 'Engineering L2', components: [{ componentId: basic.id, value: 5000000 }] })).body.data;
    await request(app)
      .post('/api/payroll/compensation')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ employeeId: employee._id.toString(), structureId: structure.id, effectiveFrom: '2026-01-01' });
    const run = (await request(app)
      .post('/api/payroll/runs')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ year: 2026, month: 9 })).body.data;
    await request(app).post(`/api/payroll/runs/${run.id}/process`).set('Authorization', authHeaderFor(hrAdmin));

    const res = await request(app).get('/api/payroll/payslips/me').set('Authorization', authHeaderFor(employeeUser));
    expect(res.body.data).toHaveLength(0);
  });

  test('HR/Finance can fetch any employee\'s payslip via the org-wide endpoint', async () => {
    const { hrAdmin, employee } = await setupFinalizedPayroll();
    const res = await request(app)
      .get('/api/payroll/payslips')
      .query({ employeeId: employee._id.toString() })
      .set('Authorization', authHeaderFor(hrAdmin));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
