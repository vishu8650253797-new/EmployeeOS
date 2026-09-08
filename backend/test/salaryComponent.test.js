const request = require('supertest');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser, authHeaderFor } = require('./helpers/factories');

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

function createComponentFixture(hrAdmin, overrides = {}) {
  return request(app)
    .post('/api/payroll/components')
    .set('Authorization', authHeaderFor(hrAdmin))
    .send({ code: 'BASIC', name: 'Basic', type: 'EARNING', calculationType: 'FIXED', ...overrides });
}

describe('Salary components', () => {
  test('HR admin can create a component; a plain employee cannot', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const employee = await createUser(org._id, { role: 'EMPLOYEE' });

    const okRes = await createComponentFixture(hrAdmin);
    expect(okRes.status).toBe(201);
    expect(okRes.body.data.code).toBe('BASIC');

    const forbiddenRes = await createComponentFixture(employee, { code: 'HRA' });
    expect(forbiddenRes.status).toBe(403);
  });

  test('rejects a duplicate code within the same organization', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });

    await createComponentFixture(hrAdmin);
    const dupeRes = await createComponentFixture(hrAdmin);

    expect(dupeRes.status).toBe(409);
  });

  test('rejects PERCENTAGE_OF_COMPONENT without a percentageOfComponentId', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });

    const res = await createComponentFixture(hrAdmin, { code: 'HRA', calculationType: 'PERCENTAGE_OF_COMPONENT' });
    expect(res.status).toBe(400);
  });

  test('cross-org: a component created in org A is not reachable from org B', async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const hrAdminA = await createUser(orgA._id, { role: 'HR_ADMIN' });
    const hrAdminB = await createUser(orgB._id, { role: 'HR_ADMIN' });

    const created = (await createComponentFixture(hrAdminA)).body.data;

    const res = await request(app)
      .get(`/api/payroll/components/${created.id}`)
      .set('Authorization', authHeaderFor(hrAdminB));
    expect(res.status).toBe(404);
  });

  test('delete is blocked while the component is referenced by a salary structure', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const component = (await createComponentFixture(hrAdmin)).body.data;

    await request(app)
      .post('/api/payroll/structures')
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ name: 'Engineering L2', components: [{ componentId: component.id, value: 5000000 }] });

    const deleteRes = await request(app)
      .delete(`/api/payroll/components/${component.id}`)
      .set('Authorization', authHeaderFor(hrAdmin));
    expect(deleteRes.status).toBe(409);
  });
});
