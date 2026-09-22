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

  test('unauthenticated requests are rejected on every self-service payslip route', async () => {
    const overviewRes = await request(app).get('/api/payroll/payslips/me/overview');
    const listRes = await request(app).get('/api/payroll/payslips/me');
    expect(overviewRes.status).toBe(401);
    expect(listRes.status).toBe(401);
  });

  test('a user with no linked employee record gets a clean 400, not a crash', async () => {
    const org = await createOrganization();
    const userWithoutEmployee = await createUser(org._id, { role: 'EMPLOYEE' });

    const res = await request(app).get('/api/payroll/payslips/me').set('Authorization', authHeaderFor(userWithoutEmployee));
    expect(res.status).toBe(400);
  });

  test('a user cannot see another organization\'s payslip even with a valid record id', async () => {
    const { employeeUser: orgAEmployeeUser } = await setupFinalizedPayroll();

    const orgB = await createOrganization();
    const { user: orgBEmployeeUser } = await createUserWithEmployee(orgB._id, { joiningDate: new Date('2025-01-01') });

    const mineRes = await request(app).get('/api/payroll/payslips/me').set('Authorization', authHeaderFor(orgAEmployeeUser));
    const recordId = mineRes.body.data[0].id;

    const crossOrgRes = await request(app)
      .get(`/api/payroll/payslips/me/${recordId}`)
      .set('Authorization', authHeaderFor(orgBEmployeeUser));
    expect(crossOrgRes.status).toBe(404);
  });

  test('viewing a payslip records an audit log entry scoped to the viewer', async () => {
    const { employeeUser } = await setupFinalizedPayroll();
    const mineRes = await request(app).get('/api/payroll/payslips/me').set('Authorization', authHeaderFor(employeeUser));
    const recordId = mineRes.body.data[0].id;

    await request(app).get(`/api/payroll/payslips/me/${recordId}`).set('Authorization', authHeaderFor(employeeUser));

    const logs = await AuditLog.find({ action: 'PAYSLIP_VIEWED', entityType: 'PayrollRecord', entityId: recordId });
    expect(logs).toHaveLength(1);
    expect(logs[0].userId.toString()).toBe(employeeUser._id.toString());
  });

  test('overview returns the latest finalized payslip summary and count', async () => {
    const { employeeUser } = await setupFinalizedPayroll();

    const res = await request(app).get('/api/payroll/payslips/me/overview').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(200);
    expect(res.body.data.hasPayslips).toBe(true);
    expect(res.body.data.payslipCount).toBe(1);
    expect(res.body.data.latestPayslip).toMatchObject({ status: 'FINALIZED' });
    expect(res.body.data.latestPayslip.period).toMatchObject({ year: 2026, month: 9 });
  });

  test('overview reports no payslips for an employee with none yet', async () => {
    const org = await createOrganization();
    const { user: employeeUser } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });

    const res = await request(app).get('/api/payroll/payslips/me/overview').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ hasPayslips: false, payslipCount: 0, latestPayslip: null });
  });
});
