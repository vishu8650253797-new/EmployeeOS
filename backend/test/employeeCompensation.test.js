const request = require('supertest');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser, createUserWithEmployee, authHeaderFor } = require('./helpers/factories');
const { EmployeeCompensation } = require('../src/models');

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

async function createStructure(hrAdmin) {
  const res = await request(app)
    .post('/api/payroll/structures')
    .set('Authorization', authHeaderFor(hrAdmin))
    .send({ name: 'Engineering L2' });
  return res.body.data;
}

describe('Employee compensation', () => {
  test('assigning new compensation transactionally supersedes the prior ACTIVE row', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id);
    const structure = await createStructure(hrAdmin);

    const first = await request(app)
      .post('/api/payroll/compensation')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ employeeId: employee._id.toString(), structureId: structure.id, effectiveFrom: '2026-01-01' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/payroll/compensation')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ employeeId: employee._id.toString(), structureId: structure.id, effectiveFrom: '2026-07-01' });
    expect(second.status).toBe(201);

    const rows = await EmployeeCompensation.find({ employeeId: employee._id }).sort({ effectiveFrom: 1 }).lean();
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe('SUPERSEDED');
    expect(rows[0].effectiveTo.toISOString().slice(0, 10)).toBe('2026-07-01');
    expect(rows[1].status).toBe('ACTIVE');

    const activeCount = await EmployeeCompensation.countDocuments({ employeeId: employee._id, status: 'ACTIVE' });
    expect(activeCount).toBe(1);
  });

  test('an employee can view their own compensation but not another employee\'s', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const { user: selfUser, employee: selfEmployee } = await createUserWithEmployee(org._id);
    const { employee: otherEmployee } = await createUserWithEmployee(org._id);
    const structure = await createStructure(hrAdmin);

    await request(app)
      .post('/api/payroll/compensation')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ employeeId: selfEmployee._id.toString(), structureId: structure.id, effectiveFrom: '2026-01-01' });
    await request(app)
      .post('/api/payroll/compensation')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ employeeId: otherEmployee._id.toString(), structureId: structure.id, effectiveFrom: '2026-01-01' });

    const ownRes = await request(app)
      .get(`/api/payroll/compensation/employee/${selfEmployee._id}/current`)
      .set('Authorization', authHeaderFor(selfUser));
    expect(ownRes.status).toBe(200);

    const otherRes = await request(app)
      .get(`/api/payroll/compensation/employee/${otherEmployee._id}/current`)
      .set('Authorization', authHeaderFor(selfUser));
    expect(otherRes.status).toBe(403);

    const hrRes = await request(app)
      .get(`/api/payroll/compensation/employee/${otherEmployee._id}/current`)
      .set('Authorization', authHeaderFor(hrAdmin));
    expect(hrRes.status).toBe(200);
  });

  test('a plain employee cannot assign compensation', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const employee = await createUser(org._id, { role: 'EMPLOYEE' });
    const { employee: targetEmployee } = await createUserWithEmployee(org._id);
    const structure = await createStructure(hrAdmin);

    const res = await request(app)
      .post('/api/payroll/compensation')
      .set('Authorization', authHeaderFor(employee))
      .send({ employeeId: targetEmployee._id.toString(), structureId: structure.id, effectiveFrom: '2026-01-01' });
    expect(res.status).toBe(403);
  });
});
