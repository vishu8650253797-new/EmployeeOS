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

async function createComponent(hrAdmin, overrides = {}) {
  const res = await request(app)
    .post('/api/payroll/components')
    .set('Authorization', authHeaderFor(hrAdmin))
    .send({ code: 'BASIC', name: 'Basic', type: 'EARNING', calculationType: 'FIXED', ...overrides });
  return res.body.data;
}

function createStructureFixture(hrAdmin, overrides = {}) {
  return request(app)
    .post('/api/payroll/structures')
    .set('Authorization', authHeaderFor(hrAdmin))
    .send({ name: 'Engineering L2', ...overrides });
}

describe('Salary structures', () => {
  test('HR admin can create a structure; a plain employee cannot', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const employee = await createUser(org._id, { role: 'EMPLOYEE' });

    const okRes = await createStructureFixture(hrAdmin);
    expect(okRes.status).toBe(201);

    const forbiddenRes = await createStructureFixture(employee, { name: 'Other' });
    expect(forbiddenRes.status).toBe(403);
  });

  test('rejects a duplicate structure name within the same organization', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });

    await createStructureFixture(hrAdmin);
    const dupeRes = await createStructureFixture(hrAdmin);

    expect(dupeRes.status).toBe(409);
  });

  test('rejects a PERCENTAGE_OF_BASIC component with no basicComponentId configured', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const basic = await createComponent(hrAdmin, { code: 'BASIC' });
    const hra = await createComponent(hrAdmin, { code: 'HRA', calculationType: 'PERCENTAGE_OF_BASIC' });

    const res = await createStructureFixture(hrAdmin, {
      components: [{ componentId: basic.id, value: 5000000 }, { componentId: hra.id, value: 4000 }],
    });
    expect(res.status).toBe(400);
  });

  test('accepts a valid PERCENTAGE_OF_BASIC component when basicComponentId is configured', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const basic = await createComponent(hrAdmin, { code: 'BASIC' });
    const hra = await createComponent(hrAdmin, { code: 'HRA', calculationType: 'PERCENTAGE_OF_BASIC' });

    const res = await createStructureFixture(hrAdmin, {
      basicComponentId: basic.id,
      components: [{ componentId: basic.id, value: 5000000 }, { componentId: hra.id, value: 4000 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.components).toHaveLength(2);
  });

  test('rejects a circular percentage-of-component reference', async () => {
    const org = await createOrganization();
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
    const a = await createComponent(hrAdmin, { code: 'A', calculationType: 'FIXED' });
    const b = await createComponent(hrAdmin, { code: 'B', calculationType: 'PERCENTAGE_OF_COMPONENT', percentageOfComponentId: a.id });

    // Flip A to reference B after the fact via update, creating a cycle A -> B -> A.
    await request(app)
      .put(`/api/payroll/components/${a.id}`)
      .set('Authorization', authHeaderFor(hrAdmin))
      .send({ calculationType: 'PERCENTAGE_OF_COMPONENT', percentageOfComponentId: b.id });

    const res = await createStructureFixture(hrAdmin, {
      components: [{ componentId: a.id, value: 5000 }, { componentId: b.id, value: 5000 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/circular/i);
  });

  test('cross-org: a structure created in org A is not reachable from org B', async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const hrAdminA = await createUser(orgA._id, { role: 'HR_ADMIN' });
    const hrAdminB = await createUser(orgB._id, { role: 'HR_ADMIN' });

    const created = (await createStructureFixture(hrAdminA)).body.data;

    const res = await request(app)
      .get(`/api/payroll/structures/${created.id}`)
      .set('Authorization', authHeaderFor(hrAdminB));
    expect(res.status).toBe(404);
  });
});
