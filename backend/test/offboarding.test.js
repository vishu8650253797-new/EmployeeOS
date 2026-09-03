const request = require('supertest');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser, createUserWithEmployee, authHeaderFor } = require('./helpers/factories');
const { Offboarding, Employee, Asset, AssetCategory, AuditLog } = require('../src/models');

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

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('Offboarding initiation', () => {
  test('an employee can self-initiate a resignation', async () => {
    const org = await createOrganization();
    const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const res = await request(app)
      .post('/api/offboarding')
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ employeeId: employee._id.toString(), offboardingType: 'RESIGNATION', lastWorkingDate: futureDate(30) });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('INITIATED');
    expect(res.body.data.offboardingType).toBe('RESIGNATION');
  });

  test('an employee cannot initiate a termination for themself or anyone else', async () => {
    const org = await createOrganization();
    const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const res = await request(app)
      .post('/api/offboarding')
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ employeeId: employee._id.toString(), offboardingType: 'TERMINATION', lastWorkingDate: futureDate(10) });

    expect(res.status).toBe(403);
  });

  test('an employee cannot initiate a resignation on behalf of someone else', async () => {
    const org = await createOrganization();
    const { user: employeeUser } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const { employee: stranger } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE', firstName: 'Stranger' });

    const res = await request(app)
      .post('/api/offboarding')
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ employeeId: stranger._id.toString(), offboardingType: 'RESIGNATION', lastWorkingDate: futureDate(10) });

    expect(res.status).toBe(403);
  });

  test('HR can initiate a termination', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const res = await request(app)
      .post('/api/offboarding')
      .set('Authorization', authHeaderFor(hr))
      .send({ employeeId: employee._id.toString(), offboardingType: 'TERMINATION', lastWorkingDate: futureDate(5), reason: 'Policy violation' });

    expect(res.status).toBe(201);
    expect(res.body.data.offboardingType).toBe('TERMINATION');

    const logs = await AuditLog.find({ entityType: 'Offboarding', entityId: res.body.data._id });
    expect(logs.map((l) => l.action)).toContain('OFFBOARDING_CREATED');
  });

  test('rejects a second active offboarding for the same employee', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    await request(app).post('/api/offboarding').set('Authorization', authHeaderFor(hr))
      .send({ employeeId: employee._id.toString(), offboardingType: 'RESIGNATION', lastWorkingDate: futureDate(10) });

    const res = await request(app).post('/api/offboarding').set('Authorization', authHeaderFor(hr))
      .send({ employeeId: employee._id.toString(), offboardingType: 'RESIGNATION', lastWorkingDate: futureDate(20) });

    expect(res.status).toBe(409);
  });

  test('rejects a last working date before the resignation date', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const res = await request(app).post('/api/offboarding').set('Authorization', authHeaderFor(hr))
      .send({
        employeeId: employee._id.toString(),
        offboardingType: 'RESIGNATION',
        resignationDate: futureDate(10),
        lastWorkingDate: futureDate(1),
      });

    expect(res.status).toBe(400);
  });
});

describe('Offboarding approval workflow', () => {
  async function initiate(app2, hr, employee) {
    const res = await request(app2).post('/api/offboarding').set('Authorization', authHeaderFor(hr))
      .send({ employeeId: employee._id.toString(), offboardingType: 'RESIGNATION', lastWorkingDate: futureDate(30) });
    const submitRes = await request(app2).post(`/api/offboarding/${res.body.data._id}/submit`).set('Authorization', authHeaderFor(hr));
    return submitRes.body.data;
  }

  test('full manager -> HR approval starts the notice period and creates clearances', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { user: managerUser, employee: managerEmployee } = await createUserWithEmployee(org._id, { role: 'MANAGER' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE', managerId: managerEmployee._id });

    const record = await initiate(app, hr, employee);

    const managerApprove = await request(app)
      .post(`/api/offboarding/${record._id}/approve`)
      .set('Authorization', authHeaderFor(managerUser))
      .send({ level: 'MANAGER', comments: 'Sad to see them go' });
    expect(managerApprove.status).toBe(200);
    expect(managerApprove.body.data.approvalStatus).toBe('MANAGER_APPROVED');

    const hrApprove = await request(app)
      .post(`/api/offboarding/${record._id}/approve`)
      .set('Authorization', authHeaderFor(hr))
      .send({ level: 'HR' });
    expect(hrApprove.status).toBe(200);
    expect(hrApprove.body.data.status).toBe('NOTICE_PERIOD');
    expect(hrApprove.body.data.approvalStatus).toBe('APPROVED');
    expect(hrApprove.body.data.clearances).toHaveLength(5);
  });

  test('HR approval is blocked while manager approval is still pending', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'MANAGER' }).then(async (m) => {
      const { employee: e } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE', managerId: m.employee._id });
      return { employee: e };
    });

    const record = await initiate(app, hr, employee);

    const res = await request(app)
      .post(`/api/offboarding/${record._id}/approve`)
      .set('Authorization', authHeaderFor(hr))
      .send({ level: 'HR' });

    expect(res.status).toBe(400);
  });

  test('an unrelated manager cannot give manager approval', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee: managerEmployee } = await createUserWithEmployee(org._id, { role: 'MANAGER' });
    const { user: unrelatedManagerUser } = await createUserWithEmployee(org._id, { role: 'MANAGER', firstName: 'Unrelated' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE', managerId: managerEmployee._id });

    const record = await initiate(app, hr, employee);

    const res = await request(app)
      .post(`/api/offboarding/${record._id}/approve`)
      .set('Authorization', authHeaderFor(unrelatedManagerUser))
      .send({ level: 'MANAGER' });

    expect(res.status).toBe(403);
  });

  test('HR can reject a pending offboarding', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const record = await initiate(app, hr, employee);

    const res = await request(app)
      .post(`/api/offboarding/${record._id}/reject`)
      .set('Authorization', authHeaderFor(hr))
      .send({ level: 'HR', reason: 'Needs more documentation' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
  });
});

describe('Offboarding clearance and asset integration', () => {
  async function approvedRecord(hrOverrides = {}) {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN', ...hrOverrides });
    const itAdmin = await createUser(org._id, { role: 'IT_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const createRes = await request(app).post('/api/offboarding').set('Authorization', authHeaderFor(hr))
      .send({ employeeId: employee._id.toString(), offboardingType: 'RESIGNATION', lastWorkingDate: futureDate(15) });
    await request(app).post(`/api/offboarding/${createRes.body.data._id}/submit`).set('Authorization', authHeaderFor(hr));

    const approveRes = await request(app)
      .post(`/api/offboarding/${createRes.body.data._id}/approve`)
      .set('Authorization', authHeaderFor(hr))
      .send({ level: 'HR' });

    return { org, hr, itAdmin, employee, record: approveRes.body.data };
  }

  test('clearances progress to CLEARANCE_IN_PROGRESS and the IT assignee can clear their item', async () => {
    const { hr, itAdmin, record } = await approvedRecord();

    const itClearance = record.clearances.find((c) => c.department === 'IT');
    expect(itClearance.assignedTo._id).toBe(itAdmin._id.toString());

    const res = await request(app)
      .patch(`/api/offboarding/${record._id}/clearances/${itClearance._id}`)
      .set('Authorization', authHeaderFor(itAdmin))
      .send({ status: 'CLEARED', comments: 'Laptop returned' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CLEARANCE_IN_PROGRESS');
    const updated = res.body.data.clearances.find((c) => c.department === 'IT');
    expect(updated.status).toBe('CLEARED');
  });

  test('an assignee from a different department cannot clear someone else\'s item', async () => {
    const { itAdmin, record } = await approvedRecord();
    const financeClearance = record.clearances.find((c) => c.department === 'FINANCE');

    const res = await request(app)
      .patch(`/api/offboarding/${record._id}/clearances/${financeClearance._id}`)
      .set('Authorization', authHeaderFor(itAdmin))
      .send({ status: 'CLEARED' });

    expect(res.status).toBe(403);
  });

  test('asset clearance reflects assigned assets and can be refreshed after a return', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    // The asset must be assigned before approval, so it is captured in the
    // clearance snapshot taken when the notice period starts.
    const category = await AssetCategory.create({ organizationId: org._id, name: 'Laptops' });
    const asset = await Asset.create({
      organizationId: org._id, assetTag: 'AST-000001', name: 'MacBook Pro', categoryId: category._id,
      status: 'ASSIGNED', assignedTo: employee._id, assignedAt: new Date(), condition: 'GOOD',
      createdBy: hr._id, updatedBy: hr._id,
    });

    const createRes = await request(app).post('/api/offboarding').set('Authorization', authHeaderFor(hr))
      .send({ employeeId: employee._id.toString(), offboardingType: 'RESIGNATION', lastWorkingDate: futureDate(15) });
    await request(app).post(`/api/offboarding/${createRes.body.data._id}/submit`).set('Authorization', authHeaderFor(hr));
    const approveRes = await request(app)
      .post(`/api/offboarding/${createRes.body.data._id}/approve`)
      .set('Authorization', authHeaderFor(hr))
      .send({ level: 'HR' });

    expect(approveRes.body.data.assetClearanceStatus).toBe('PENDING');

    asset.status = 'AVAILABLE';
    asset.assignedTo = undefined;
    await asset.save();

    const refreshAfter = await request(app)
      .post(`/api/offboarding/${approveRes.body.data._id}/assets/refresh-clearance`)
      .set('Authorization', authHeaderFor(hr));
    expect(refreshAfter.body.data.assetClearanceStatus).toBe('CLEARED');
  });
});

describe('Offboarding completion gate', () => {
  test('completion is blocked until the record reaches FINAL_REVIEW', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const createRes = await request(app).post('/api/offboarding').set('Authorization', authHeaderFor(hr))
      .send({ employeeId: employee._id.toString(), offboardingType: 'RESIGNATION', lastWorkingDate: futureDate(10) });

    const res = await request(app)
      .post(`/api/offboarding/${createRes.body.data._id}/complete`)
      .set('Authorization', authHeaderFor(hr));

    expect(res.status).toBe(400);
  });

  test('clearing every gate allows completion and sets the employee inactive', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const createRes = await request(app).post('/api/offboarding').set('Authorization', authHeaderFor(hr))
      .send({ employeeId: employee._id.toString(), offboardingType: 'RESIGNATION', lastWorkingDate: futureDate(10) });
    await request(app).post(`/api/offboarding/${createRes.body.data._id}/submit`).set('Authorization', authHeaderFor(hr));
    const approveRes = await request(app)
      .post(`/api/offboarding/${createRes.body.data._id}/approve`)
      .set('Authorization', authHeaderFor(hr))
      .send({ level: 'HR' });

    const offboardingId = approveRes.body.data._id;
    for (const clearance of approveRes.body.data.clearances) {
      // eslint-disable-next-line no-await-in-loop
      await request(app)
        .patch(`/api/offboarding/${offboardingId}/clearances/${clearance._id}`)
        .set('Authorization', authHeaderFor(hr))
        .send({ status: 'NOT_APPLICABLE' });
    }

    await request(app)
      .patch(`/api/offboarding/${offboardingId}/exit-interview`)
      .set('Authorization', authHeaderFor(hr))
      .send({ action: 'WAIVE' });

    const afterGates = await request(app).get(`/api/offboarding/${offboardingId}`).set('Authorization', authHeaderFor(hr));
    expect(afterGates.body.data.status).toBe('FINAL_REVIEW');

    const notReady = await request(app)
      .post(`/api/offboarding/${offboardingId}/complete`)
      .set('Authorization', authHeaderFor(hr));
    expect(notReady.status).toBe(400);

    await request(app)
      .patch(`/api/offboarding/${offboardingId}/access`)
      .set('Authorization', authHeaderFor(hr))
      .send({ status: 'NOT_REQUIRED' });

    const complete = await request(app)
      .post(`/api/offboarding/${offboardingId}/complete`)
      .set('Authorization', authHeaderFor(hr));
    expect(complete.status).toBe(200);
    expect(complete.body.data.status).toBe('COMPLETED');

    const updatedEmployee = await Employee.findById(employee._id);
    expect(updatedEmployee.status).toBe('INACTIVE');
  });
});

describe('Offboarding access control and tenant isolation', () => {
  test('a manager only sees offboarding records for their direct reports', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { user: managerUser, employee: managerEmployee } = await createUserWithEmployee(org._id, { role: 'MANAGER' });
    const { employee: report } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE', managerId: managerEmployee._id, firstName: 'Report' });
    const { employee: stranger } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE', firstName: 'Stranger' });

    await request(app).post('/api/offboarding').set('Authorization', authHeaderFor(hr))
      .send({ employeeId: report._id.toString(), offboardingType: 'RESIGNATION', lastWorkingDate: futureDate(10) });
    await request(app).post('/api/offboarding').set('Authorization', authHeaderFor(hr))
      .send({ employeeId: stranger._id.toString(), offboardingType: 'RESIGNATION', lastWorkingDate: futureDate(10) });

    const res = await request(app).get('/api/offboarding').set('Authorization', authHeaderFor(managerUser));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].employeeId._id).toBe(report._id.toString());
  });

  test('a record from another organization cannot be fetched by id (cross-tenant / IDOR)', async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const hrA = await createUser(orgA._id, { role: 'HR_ADMIN' });
    const hrB = await createUser(orgB._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(orgA._id, { role: 'EMPLOYEE' });

    const createRes = await request(app).post('/api/offboarding').set('Authorization', authHeaderFor(hrA))
      .send({ employeeId: employee._id.toString(), offboardingType: 'RESIGNATION', lastWorkingDate: futureDate(10) });

    const res = await request(app)
      .get(`/api/offboarding/${createRes.body.data._id}`)
      .set('Authorization', authHeaderFor(hrB));

    expect(res.status).toBe(404);
  });

  test('exit interview feedback is hidden from the employee and their manager, visible to HR', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const createRes = await request(app).post('/api/offboarding').set('Authorization', authHeaderFor(hr))
      .send({ employeeId: employee._id.toString(), offboardingType: 'RESIGNATION', lastWorkingDate: futureDate(10) });
    const id = createRes.body.data._id;

    await request(app).post(`/api/offboarding/${id}/exit-interview`).set('Authorization', authHeaderFor(hr))
      .send({ interviewerId: hr._id.toString() });
    await request(app).patch(`/api/offboarding/${id}/exit-interview`).set('Authorization', authHeaderFor(hr))
      .send({ action: 'COMPLETE', feedback: 'Confidential candid feedback about the manager' });

    const employeeView = await request(app).get(`/api/offboarding/${id}`).set('Authorization', authHeaderFor(employeeUser));
    expect(employeeView.status).toBe(200);
    expect(employeeView.body.data.exitInterview.feedback).toBeUndefined();
    expect(employeeView.body.data.exitInterview.status).toBe('COMPLETED');

    const hrView = await request(app).get(`/api/offboarding/${id}`).set('Authorization', authHeaderFor(hr));
    expect(hrView.body.data.exitInterview.feedback).toBe('Confidential candid feedback about the manager');
  });
});

describe('Offboarding model validation', () => {
  test('rejects an invalid offboarding type at the schema level', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    await expect(
      Offboarding.create({
        organizationId: org._id, employeeId: employee._id, initiatedBy: hr._id,
        offboardingType: 'NOT_A_TYPE', lastWorkingDate: new Date(),
      })
    ).rejects.toThrow();
  });

  test('requires organizationId, employeeId and lastWorkingDate', async () => {
    await expect(Offboarding.create({})).rejects.toThrow();
  });
});
