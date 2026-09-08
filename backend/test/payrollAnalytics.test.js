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

describe('Payroll analytics', () => {
  test('PAYROLL_VIEW roles get correct aggregate totals against a finalized run', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const finance = await createUser(org._id, { role: 'FINANCE' });
    const { employee } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });

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

    const overviewRes = await request(app).get('/api/payroll/analytics/overview').set('Authorization', authHeaderFor(hrAdmin));
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.latestRun.totalGrossMinorUnits).toBe(5000000);
    expect(overviewRes.body.data.latestRun.employeeCount).toBe(1);

    const trendsRes = await request(app).get('/api/payroll/analytics/trends').set('Authorization', authHeaderFor(hrAdmin));
    expect(trendsRes.status).toBe(200);
    expect(trendsRes.body.data).toHaveLength(1);

    const deptRes = await request(app)
      .get('/api/payroll/analytics/department-cost')
      .query({ payrollPeriodId: run.payrollPeriodId })
      .set('Authorization', authHeaderFor(hrAdmin));
    expect(deptRes.status).toBe(200);
    expect(deptRes.body.data[0].employeeCount).toBe(1);
  });

  test('a plain employee gets 403 on analytics endpoints', async () => {
    const org = await createOrganization();
    const employeeUser = await createUser(org._id, { role: 'EMPLOYEE' });

    const res = await request(app).get('/api/payroll/analytics/overview').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(403);
  });
});
