const request = require('supertest');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser, createUserWithEmployee, authHeaderFor } = require('./helpers/factories');
const { Asset } = require('../src/models');

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

async function createCategoryFixture(org, itAdmin, overrides = {}) {
  return request(app)
    .post('/api/assets/categories')
    .set('Authorization', authHeaderFor(itAdmin))
    .send({ name: 'Laptop', ...overrides });
}

async function createAssetFixture(org, itAdmin, categoryId, overrides = {}) {
  return request(app)
    .post('/api/assets')
    .set('Authorization', authHeaderFor(itAdmin))
    .send({
      name: 'MacBook Pro 16"',
      categoryId,
      brand: 'Apple',
      model: 'M3',
      condition: 'NEW',
      ...overrides,
    });
}

describe('Asset categories', () => {
  test('IT admin can create a category; a plain employee cannot', async () => {
    const org = await createOrganization();
    const itAdmin = await createUser(org._id, { role: 'IT_ADMIN' });
    const employee = await createUser(org._id, { role: 'EMPLOYEE' });

    const okRes = await createCategoryFixture(org, itAdmin);
    expect(okRes.status).toBe(201);
    expect(okRes.body.data.name).toBe('Laptop');

    const forbiddenRes = await createCategoryFixture(org, employee, { name: 'Monitor' });
    expect(forbiddenRes.status).toBe(403);
  });

  test('rejects a duplicate category name within the same organization', async () => {
    const org = await createOrganization();
    const itAdmin = await createUser(org._id, { role: 'IT_ADMIN' });

    await createCategoryFixture(org, itAdmin);
    const dupeRes = await createCategoryFixture(org, itAdmin);

    expect(dupeRes.status).toBe(409);
  });
});

describe('Asset CRUD', () => {
  test('creates an asset with an auto-generated asset tag', async () => {
    const org = await createOrganization();
    const itAdmin = await createUser(org._id, { role: 'IT_ADMIN' });
    const category = (await createCategoryFixture(org, itAdmin)).body.data;

    const res = await createAssetFixture(org, itAdmin, category.id);

    expect(res.status).toBe(201);
    expect(res.body.data.assetTag).toMatch(/^AST-\d{6}$/);
    expect(res.body.data.status).toBe('AVAILABLE');
  });

  test('rejects a duplicate serial number within the same organization', async () => {
    const org = await createOrganization();
    const itAdmin = await createUser(org._id, { role: 'IT_ADMIN' });
    const category = (await createCategoryFixture(org, itAdmin)).body.data;

    await createAssetFixture(org, itAdmin, category.id, { serialNumber: 'SN-100' });
    const dupeRes = await createAssetFixture(org, itAdmin, category.id, { serialNumber: 'SN-100' });

    expect(dupeRes.status).toBe(409);
    expect(dupeRes.body.message).toMatch(/serial number/i);
  });

  test('a plain employee cannot list the organization-wide inventory', async () => {
    const org = await createOrganization();
    const employee = await createUser(org._id, { role: 'EMPLOYEE' });

    const res = await request(app).get('/api/assets').set('Authorization', authHeaderFor(employee));

    expect(res.status).toBe(403);
  });

  test('org isolation: an asset created in org A is not reachable from org B, even with a valid ObjectId', async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const itAdminA = await createUser(orgA._id, { role: 'IT_ADMIN' });
    const itAdminB = await createUser(orgB._id, { role: 'IT_ADMIN' });
    const category = (await createCategoryFixture(orgA, itAdminA)).body.data;
    const asset = (await createAssetFixture(orgA, itAdminA, category.id)).body.data;

    const res = await request(app)
      .get(`/api/assets/${asset.id}`)
      .set('Authorization', authHeaderFor(itAdminB));

    expect(res.status).toBe(404);
  });
});

describe('Asset assignment lifecycle', () => {
  async function setup() {
    const org = await createOrganization();
    const itAdmin = await createUser(org._id, { role: 'IT_ADMIN' });
    const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const category = (await createCategoryFixture(org, itAdmin)).body.data;
    const asset = (await createAssetFixture(org, itAdmin, category.id)).body.data;
    return { org, itAdmin, employeeUser, employee, category, asset };
  }

  test('assigns an available asset to an active employee and it shows up in their asset list', async () => {
    const { itAdmin, employeeUser, employee, asset } = await setup();

    const assignRes = await request(app)
      .post(`/api/assets/${asset.id}/assign`)
      .set('Authorization', authHeaderFor(itAdmin))
      .send({ employeeId: employee._id.toString() });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.data.status).toBe('ASSIGNED');
    expect(assignRes.body.data.assignedTo._id).toBe(employee._id.toString());

    const myAssetsRes = await request(app)
      .get(`/api/employees/${employee._id}/assets`)
      .set('Authorization', authHeaderFor(employeeUser));

    expect(myAssetsRes.status).toBe(200);
    expect(myAssetsRes.body.data).toHaveLength(1);
    expect(myAssetsRes.body.data[0].assetTag).toBe(asset.assetTag);
  });

  test('an employee cannot view another employee\'s assigned assets (IDOR guard)', async () => {
    const { itAdmin, employee, asset } = await setup();
    const otherEmployee = await createUser((await Asset.findById(asset.id)).organizationId, { role: 'EMPLOYEE' });

    await request(app)
      .post(`/api/assets/${asset.id}/assign`)
      .set('Authorization', authHeaderFor(itAdmin))
      .send({ employeeId: employee._id.toString() });

    const res = await request(app)
      .get(`/api/employees/${employee._id}/assets`)
      .set('Authorization', authHeaderFor(otherEmployee));

    expect(res.status).toBe(403);
  });

  test('cannot assign an asset that is already assigned — must reassign instead', async () => {
    const { itAdmin, employee, asset, org } = await setup();
    const { employee: secondEmployee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    await request(app)
      .post(`/api/assets/${asset.id}/assign`)
      .set('Authorization', authHeaderFor(itAdmin))
      .send({ employeeId: employee._id.toString() });

    const reassignRes = await request(app)
      .post(`/api/assets/${asset.id}/reassign`)
      .set('Authorization', authHeaderFor(itAdmin))
      .send({ employeeId: secondEmployee._id.toString() });

    expect(reassignRes.status).toBe(200);
    expect(reassignRes.body.data.assignedTo._id).toBe(secondEmployee._id.toString());
  });

  test('returning a damaged asset opens a maintenance record and moves the asset to IN_MAINTENANCE', async () => {
    const { itAdmin, employee, asset } = await setup();

    await request(app)
      .post(`/api/assets/${asset.id}/assign`)
      .set('Authorization', authHeaderFor(itAdmin))
      .send({ employeeId: employee._id.toString() });

    const returnRes = await request(app)
      .post(`/api/assets/${asset.id}/return`)
      .set('Authorization', authHeaderFor(itAdmin))
      .send({ condition: 'DAMAGED', returnNotes: 'Cracked screen' });

    expect(returnRes.status).toBe(200);
    expect(returnRes.body.data.status).toBe('IN_MAINTENANCE');

    const maintenanceRes = await request(app)
      .get(`/api/assets/${asset.id}/maintenance`)
      .set('Authorization', authHeaderFor(itAdmin));

    expect(maintenanceRes.body.data).toHaveLength(1);
    expect(maintenanceRes.body.data[0].status).toBe('OPEN');
  });
});

describe('Asset requests end-to-end', () => {
  test('employee requests an asset, IT admin approves and fulfills it, employee cannot approve their own request', async () => {
    const org = await createOrganization();
    const itAdmin = await createUser(org._id, { role: 'IT_ADMIN' });
    const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const category = (await createCategoryFixture(org, itAdmin)).body.data;
    const asset = (await createAssetFixture(org, itAdmin, category.id)).body.data;

    const createRes = await request(app)
      .post('/api/assets/requests')
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ assetCategoryId: category.id, reason: 'Need a laptop for onboarding', priority: 'HIGH' });
    expect(createRes.status).toBe(201);
    const requestId = createRes.body.data.id;

    const selfApproveRes = await request(app)
      .put(`/api/assets/requests/${requestId}/approve`)
      .set('Authorization', authHeaderFor(employeeUser))
      .send();
    expect(selfApproveRes.status).toBe(403);

    const approveRes = await request(app)
      .put(`/api/assets/requests/${requestId}/approve`)
      .set('Authorization', authHeaderFor(itAdmin))
      .send();
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');

    const fulfillRes = await request(app)
      .put(`/api/assets/requests/${requestId}/fulfill`)
      .set('Authorization', authHeaderFor(itAdmin))
      .send({ assetId: asset.id });
    expect(fulfillRes.status).toBe(200);
    expect(fulfillRes.body.data.status).toBe('FULFILLED');

    const finalAsset = await Asset.findById(asset.id).lean();
    expect(finalAsset.status).toBe('ASSIGNED');
    expect(finalAsset.assignedTo.toString()).toBe(employee._id.toString());
  });

  test('rejecting a request requires a rejection reason', async () => {
    const org = await createOrganization();
    const itAdmin = await createUser(org._id, { role: 'IT_ADMIN' });
    const { user: employeeUser } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const category = (await createCategoryFixture(org, itAdmin)).body.data;

    const createRes = await request(app)
      .post('/api/assets/requests')
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ assetCategoryId: category.id, reason: 'Need a monitor' });
    const requestId = createRes.body.data.id;

    const missingReasonRes = await request(app)
      .put(`/api/assets/requests/${requestId}/reject`)
      .set('Authorization', authHeaderFor(itAdmin))
      .send({});
    expect(missingReasonRes.status).toBe(400);

    const rejectRes = await request(app)
      .put(`/api/assets/requests/${requestId}/reject`)
      .set('Authorization', authHeaderFor(itAdmin))
      .send({ rejectionReason: 'Budget frozen this quarter' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('REJECTED');
  });
});

describe('Asset maintenance lifecycle', () => {
  test('a reported issue moves the asset to IN_MAINTENANCE, completing it restores ASSIGNED', async () => {
    const org = await createOrganization();
    const itAdmin = await createUser(org._id, { role: 'IT_ADMIN' });
    const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const category = (await createCategoryFixture(org, itAdmin)).body.data;
    const asset = (await createAssetFixture(org, itAdmin, category.id)).body.data;

    await request(app)
      .post(`/api/assets/${asset.id}/assign`)
      .set('Authorization', authHeaderFor(itAdmin))
      .send({ employeeId: employee._id.toString() });

    const reportRes = await request(app)
      .post(`/api/assets/${asset.id}/maintenance`)
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ issueType: 'HARDWARE', description: 'Battery not charging', priority: 'HIGH' });
    expect(reportRes.status).toBe(201);
    const maintenanceId = reportRes.body.data.id;

    const startRes = await request(app)
      .put(`/api/assets/maintenance/${maintenanceId}`)
      .set('Authorization', authHeaderFor(itAdmin))
      .send({ status: 'IN_PROGRESS' });
    expect(startRes.status).toBe(200);
    expect((await Asset.findById(asset.id).lean()).status).toBe('IN_MAINTENANCE');

    const completeRes = await request(app)
      .put(`/api/assets/maintenance/${maintenanceId}`)
      .set('Authorization', authHeaderFor(itAdmin))
      .send({ status: 'COMPLETED', maintenanceCost: 49.99 });
    expect(completeRes.status).toBe(200);
    expect((await Asset.findById(asset.id).lean()).status).toBe('ASSIGNED');
  });
});

describe('Asset analytics', () => {
  test('overview aggregates status counts for the organization', async () => {
    const org = await createOrganization();
    const itAdmin = await createUser(org._id, { role: 'IT_ADMIN' });
    const category = (await createCategoryFixture(org, itAdmin)).body.data;
    await createAssetFixture(org, itAdmin, category.id, { name: 'Asset 1' });
    await createAssetFixture(org, itAdmin, category.id, { name: 'Asset 2' });

    const res = await request(app)
      .get('/api/assets/analytics/overview')
      .set('Authorization', authHeaderFor(itAdmin));

    expect(res.status).toBe(200);
    expect(res.body.data.totalAssets).toBe(2);
    expect(res.body.data.available).toBe(2);
  });
});
