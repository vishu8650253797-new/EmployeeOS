const request = require('supertest');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser, createUserWithEmployee, authHeaderFor } = require('./helpers/factories');
const { PayrollRun, PayrollRecord, PayrollPeriod } = require('../src/models');

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

async function setupOrgWithPayableEmployee(overrides = {}) {
  const org = await createOrganization();
  const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
  const finance = await createUser(org._id, { role: 'FINANCE' });
  const { employee } = await createUserWithEmployee(org._id, {
    joiningDate: new Date('2025-01-01'), ...overrides,
  });

  const basicRes = await request(app)
    .post('/api/payroll/components')
    .set('Authorization', authHeaderFor(hrAdmin))
    .send({ code: 'BASIC', name: 'Basic', type: 'EARNING', calculationType: 'FIXED' });
  const hraRes = await request(app)
    .post('/api/payroll/components')
    .set('Authorization', authHeaderFor(hrAdmin))
    .send({ code: 'HRA', name: 'HRA', type: 'EARNING', calculationType: 'PERCENTAGE_OF_BASIC' });
  const basic = basicRes.body.data;
  const hra = hraRes.body.data;

  const structureRes = await request(app)
    .post('/api/payroll/structures')
    .set('Authorization', authHeaderFor(hrAdmin))
    .send({
      name: 'Engineering L2',
      basicComponentId: basic.id,
      components: [{ componentId: basic.id, value: 5000000 }, { componentId: hra.id, value: 4000 }],
    });
  const structure = structureRes.body.data;

  await request(app)
    .post('/api/payroll/compensation')
    .set('Authorization', authHeaderFor(hrAdmin))
    .send({ employeeId: employee._id.toString(), structureId: structure.id, effectiveFrom: '2026-01-01' });

  return { org, hrAdmin, finance, employee, structure };
}

async function runFullWorkflowToCalculated(hrAdmin) {
  const createRes = await request(app)
    .post('/api/payroll/runs')
    .set('Authorization', authHeaderFor(hrAdmin))
    .send({ year: 2026, month: 9 });
  const run = createRes.body.data;

  const processRes = await request(app)
    .post(`/api/payroll/runs/${run.id}/process`)
    .set('Authorization', authHeaderFor(hrAdmin));
  return processRes.body.data;
}

describe('Payroll run — full workflow', () => {
  test('create -> process -> submit -> approve -> finalize', async () => {
    const { hrAdmin, finance, employee } = await setupOrgWithPayableEmployee();

    const createRes = await request(app)
      .post('/api/payroll/runs')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ year: 2026, month: 9 });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('DRAFT');
    const runId = createRes.body.data.id;

    const processRes = await request(app)
      .post(`/api/payroll/runs/${runId}/process`)
      .set('Authorization', authHeaderFor(hrAdmin));
    expect(processRes.status).toBe(200);
    expect(processRes.body.data.status).toBe('CALCULATED');
    expect(processRes.body.data.employeeCount).toBe(1);
    expect(processRes.body.data.totalGrossMinorUnits).toBe(7000000); // 5,000,000 basic + 40% HRA

    const recordsRes = await request(app)
      .get(`/api/payroll/runs/${runId}/records`)
      .set('Authorization', authHeaderFor(hrAdmin));
    expect(recordsRes.status).toBe(200);
    expect(recordsRes.body.data).toHaveLength(1);
    expect(recordsRes.body.data[0].employeeId).toBe(employee._id.toString());

    const submitRes = await request(app)
      .post(`/api/payroll/runs/${runId}/submit`)
      .set('Authorization', authHeaderFor(hrAdmin));
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe('SUBMITTED');

    const approveRes = await request(app)
      .post(`/api/payroll/runs/${runId}/approve`)
      .set('Authorization', authHeaderFor(finance));
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');

    const finalizeRes = await request(app)
      .post(`/api/payroll/runs/${runId}/finalize`)
      .set('Authorization', authHeaderFor(finance));
    expect(finalizeRes.status).toBe(200);
    expect(finalizeRes.body.data.status).toBe('FINALIZED');

    const period = await PayrollPeriod.findOne({ year: 2026, month: 9 });
    expect(period.status).toBe('FINALIZED');

    const records = await PayrollRecord.find({ payrollRunId: runId });
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('FINALIZED');
    expect(records[0].isLocked).toBe(true);
  });

  test('HR admin can submit but not approve or finalize (separation of duties)', async () => {
    const { hrAdmin } = await setupOrgWithPayableEmployee();
    const run = await runFullWorkflowToCalculated(hrAdmin);

    await request(app).post(`/api/payroll/runs/${run.id}/submit`).set('Authorization', authHeaderFor(hrAdmin));

    const approveRes = await request(app)
      .post(`/api/payroll/runs/${run.id}/approve`)
      .set('Authorization', authHeaderFor(hrAdmin));
    expect(approveRes.status).toBe(403);
  });

  test('a plain employee cannot view payroll runs', async () => {
    const { org } = await setupOrgWithPayableEmployee();
    const employeeUser = await createUser(org._id, { role: 'EMPLOYEE' });

    const listRes = await request(app).get('/api/payroll/runs').set('Authorization', authHeaderFor(employeeUser));
    expect(listRes.status).toBe(403);
  });

  test('duplicate REGULAR run creation for the same period is rejected while one is already active', async () => {
    const { hrAdmin } = await setupOrgWithPayableEmployee();

    const first = await request(app)
      .post('/api/payroll/runs')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ year: 2026, month: 9 });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/payroll/runs')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ year: 2026, month: 9 });
    expect(second.status).toBe(409);
  });

  test('recalculate after CALCULATED wipes and regenerates records without a duplicate-key error', async () => {
    const { hrAdmin } = await setupOrgWithPayableEmployee();
    const run = await runFullWorkflowToCalculated(hrAdmin);

    const recalcRes = await request(app)
      .post(`/api/payroll/runs/${run.id}/recalculate`)
      .set('Authorization', authHeaderFor(hrAdmin));
    expect(recalcRes.status).toBe(200);
    expect(recalcRes.body.data.status).toBe('CALCULATED');

    const records = await PayrollRecord.find({ payrollRunId: run.id });
    expect(records).toHaveLength(1);
  });

  test('a run with an employee missing compensation lands that employee in failedEmployees and blocks submit', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') }); // no compensation assigned

    const createRes = await request(app)
      .post('/api/payroll/runs')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ year: 2026, month: 9 });
    const processRes = await request(app)
      .post(`/api/payroll/runs/${createRes.body.data.id}/process`)
      .set('Authorization', authHeaderFor(hrAdmin));

    expect(processRes.body.data.status).toBe('FAILED');
    expect(processRes.body.data.failedEmployees).toHaveLength(1);

    const submitRes = await request(app)
      .post(`/api/payroll/runs/${createRes.body.data.id}/submit`)
      .set('Authorization', authHeaderFor(hrAdmin));
    expect(submitRes.status).toBe(400);
  });

  test('reject requires a reason, and recalculate is reachable from REJECTED', async () => {
    const { hrAdmin, finance } = await setupOrgWithPayableEmployee();
    const run = await runFullWorkflowToCalculated(hrAdmin);
    await request(app).post(`/api/payroll/runs/${run.id}/submit`).set('Authorization', authHeaderFor(hrAdmin));

    const noReasonRes = await request(app)
      .post(`/api/payroll/runs/${run.id}/reject`)
      .set('Authorization', authHeaderFor(finance))
      .send({});
    expect(noReasonRes.status).toBe(400);

    const rejectRes = await request(app)
      .post(`/api/payroll/runs/${run.id}/reject`)
      .set('Authorization', authHeaderFor(finance))
      .send({ reason: 'Incorrect structure assigned' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('REJECTED');

    const recalcRes = await request(app)
      .post(`/api/payroll/runs/${run.id}/recalculate`)
      .set('Authorization', authHeaderFor(hrAdmin));
    expect(recalcRes.status).toBe(200);
    expect(recalcRes.body.data.status).toBe('CALCULATED');
  });

  test('immutability: every mutating endpoint is rejected once a run is FINALIZED', async () => {
    const { hrAdmin, finance } = await setupOrgWithPayableEmployee();
    const run = await runFullWorkflowToCalculated(hrAdmin);
    await request(app).post(`/api/payroll/runs/${run.id}/submit`).set('Authorization', authHeaderFor(hrAdmin));
    await request(app).post(`/api/payroll/runs/${run.id}/approve`).set('Authorization', authHeaderFor(finance));
    const finalizeRes = await request(app).post(`/api/payroll/runs/${run.id}/finalize`).set('Authorization', authHeaderFor(finance));
    expect(finalizeRes.status).toBe(200);

    const records = await PayrollRecord.find({ payrollRunId: run.id });
    const recordId = records[0]._id.toString();

    const attempts = [
      request(app).post(`/api/payroll/runs/${run.id}/process`).set('Authorization', authHeaderFor(hrAdmin)),
      request(app).post(`/api/payroll/runs/${run.id}/recalculate`).set('Authorization', authHeaderFor(hrAdmin)),
      request(app).put(`/api/payroll/runs/${run.id}/records/${recordId}`).set('Authorization', authHeaderFor(hrAdmin)).send({ adjustmentNote: 'x' }),
      request(app).post(`/api/payroll/runs/${run.id}/submit`).set('Authorization', authHeaderFor(hrAdmin)),
      request(app).post(`/api/payroll/runs/${run.id}/approve`).set('Authorization', authHeaderFor(finance)),
      request(app).post(`/api/payroll/runs/${run.id}/reject`).set('Authorization', authHeaderFor(finance)).send({ reason: 'x' }),
      request(app).post(`/api/payroll/runs/${run.id}/cancel`).set('Authorization', authHeaderFor(hrAdmin)),
    ];
    const results = await Promise.all(attempts);
    results.forEach((res) => expect(res.status).toBe(409));
  });

  test('cross-org: a run created in org A is not reachable from org B', async () => {
    const { hrAdmin } = await setupOrgWithPayableEmployee();
    const createRes = await request(app)
      .post('/api/payroll/runs')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ year: 2026, month: 9 });

    const orgB = await createOrganization();
    const hrAdminB = await createUser(orgB._id, { role: 'HR_ADMIN' });

    const res = await request(app)
      .get(`/api/payroll/runs/${createRes.body.data.id}`)
      .set('Authorization', authHeaderFor(hrAdminB));
    expect(res.status).toBe(404);
  });

  test('cancel releases the period back to OPEN and deletes generated records', async () => {
    const { hrAdmin } = await setupOrgWithPayableEmployee();
    const run = await runFullWorkflowToCalculated(hrAdmin);

    const cancelRes = await request(app)
      .post(`/api/payroll/runs/${run.id}/cancel`)
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ reason: 'Wrong period' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    const period = await PayrollPeriod.findOne({ year: 2026, month: 9 });
    expect(period.status).toBe('OPEN');

    const records = await PayrollRecord.find({ payrollRunId: run.id });
    expect(records).toHaveLength(0);
  });

  test('a fresh REGULAR run can be created after the prior one is cancelled', async () => {
    const { hrAdmin } = await setupOrgWithPayableEmployee();
    const run = await runFullWorkflowToCalculated(hrAdmin);
    await request(app).post(`/api/payroll/runs/${run.id}/cancel`).set('Authorization', authHeaderFor(hrAdmin));

    const secondRes = await request(app)
      .post('/api/payroll/runs')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ year: 2026, month: 9 });
    expect(secondRes.status).toBe(201);
  });
});
