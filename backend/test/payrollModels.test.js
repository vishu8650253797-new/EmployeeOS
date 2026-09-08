const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser, createEmployee } = require('./helpers/factories');
const {
  SalaryComponent, SalaryStructure, EmployeeCompensation, PayrollPeriod, PayrollRun, PayrollRecord,
} = require('../src/models');

jest.setTimeout(30000);

beforeAll(async () => {
  await connect();
  // Mongoose builds indexes asynchronously in the background after a model is
  // compiled; these tests assert unique-index behavior directly (not through
  // an app-level pre-check), so wait for index builds to finish first.
  await Promise.all(
    [SalaryComponent, SalaryStructure, EmployeeCompensation, PayrollPeriod, PayrollRun, PayrollRecord].map((m) => m.init())
  );
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

test('SalaryComponent enforces a unique code per organization', async () => {
  const org = await createOrganization();
  await SalaryComponent.create({ organizationId: org._id, code: 'BASIC', name: 'Basic', type: 'EARNING', calculationType: 'FIXED' });
  await expect(
    SalaryComponent.create({ organizationId: org._id, code: 'BASIC', name: 'Basic 2', type: 'EARNING', calculationType: 'FIXED' })
  ).rejects.toThrow();
});

test('SalaryStructure enforces a unique name per organization', async () => {
  const org = await createOrganization();
  await SalaryStructure.create({ organizationId: org._id, name: 'Engineering L2' });
  await expect(SalaryStructure.create({ organizationId: org._id, name: 'Engineering L2' })).rejects.toThrow();
});

test('EmployeeCompensation allows only one ACTIVE row per employee', async () => {
  const org = await createOrganization();
  const user = await createUser(org._id, { role: 'HR_ADMIN' });
  const employee = await createEmployee(org._id);
  const structure = await SalaryStructure.create({ organizationId: org._id, name: 'Structure A' });

  await EmployeeCompensation.create({
    organizationId: org._id, employeeId: employee._id, structureId: structure._id,
    effectiveFrom: new Date(), createdBy: user._id,
  });

  await expect(
    EmployeeCompensation.create({
      organizationId: org._id, employeeId: employee._id, structureId: structure._id,
      effectiveFrom: new Date(), createdBy: user._id,
    })
  ).rejects.toThrow();

  // A superseded/cancelled row for the same employee does not collide.
  await EmployeeCompensation.create({
    organizationId: org._id, employeeId: employee._id, structureId: structure._id,
    effectiveFrom: new Date(), createdBy: user._id, status: 'CANCELLED',
  });
});

test('PayrollPeriod enforces one period per organization per year/month', async () => {
  const org = await createOrganization();
  await PayrollPeriod.create({
    organizationId: org._id, year: 2026, month: 9,
    startDate: new Date('2026-09-01'), endDate: new Date('2026-09-30'), payDate: new Date('2026-10-01'),
  });
  await expect(
    PayrollPeriod.create({
      organizationId: org._id, year: 2026, month: 9,
      startDate: new Date('2026-09-01'), endDate: new Date('2026-09-30'), payDate: new Date('2026-10-01'),
    })
  ).rejects.toThrow();
});

test('PayrollRecord prevents paying the same employee twice for the same period', async () => {
  const org = await createOrganization();
  const employee = await createEmployee(org._id);
  const period = await PayrollPeriod.create({
    organizationId: org._id, year: 2026, month: 9,
    startDate: new Date('2026-09-01'), endDate: new Date('2026-09-30'), payDate: new Date('2026-10-01'),
  });
  const run = await PayrollRun.create({ organizationId: org._id, payrollPeriodId: period._id });

  await PayrollRecord.create({
    organizationId: org._id, payrollRunId: run._id, payrollPeriodId: period._id, employeeId: employee._id,
    paidDays: 30, totalDaysInPeriod: 30,
  });

  const otherRun = await PayrollRun.create({ organizationId: org._id, payrollPeriodId: period._id, runType: 'SUPPLEMENTARY' });
  await expect(
    PayrollRecord.create({
      organizationId: org._id, payrollRunId: otherRun._id, payrollPeriodId: period._id, employeeId: employee._id,
      paidDays: 30, totalDaysInPeriod: 30,
    })
  ).rejects.toThrow();
});
