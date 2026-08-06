const request = require('supertest');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser, createUserWithEmployee, authHeaderFor } = require('./helpers/factories');
const { OnboardingProcess, OnboardingTask, AuditLog } = require('../src/models');
const onboardingService = require('../src/services/onboardingService');

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

async function createTemplateFixture(org, hrUser, overrides = {}) {
  const res = await request(app)
    .post('/api/onboarding-templates')
    .set('Authorization', authHeaderFor(hrUser))
    .send({
      name: 'Standard Onboarding',
      type: 'ONBOARDING',
      tasks: [
        { title: 'Sign offer letter', category: 'DOCUMENTATION', defaultAssigneeRole: 'HR_ADMIN', dueOffsetDays: 0, order: 0 },
        { title: 'Provision laptop', category: 'IT_SETUP', defaultAssigneeRole: 'IT_ADMIN', dueOffsetDays: 1, order: 1 },
        { title: 'Manager welcome chat', category: 'OTHER', defaultAssigneeRole: 'MANAGER', dueOffsetDays: 2, order: 2 },
      ],
      ...overrides,
    });
  return res;
}

describe('Onboarding templates', () => {
  test('HR admin can create a template', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });

    const res = await createTemplateFixture(org, hr);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.taskCount).toBe(3);
  });

  test('a plain employee cannot create a template', async () => {
    const org = await createOrganization();
    const employeeUser = await createUser(org._id, { role: 'EMPLOYEE' });

    const res = await createTemplateFixture(org, employeeUser);

    expect(res.status).toBe(403);
  });

  test('rejects a template with an invalid type', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });

    const res = await request(app)
      .post('/api/onboarding-templates')
      .set('Authorization', authHeaderFor(hr))
      .send({ name: 'Bad Template', type: 'NOT_A_TYPE', tasks: [] });

    expect(res.status).toBe(400);
  });
});

describe('Onboarding processes', () => {
  test('HR admin starts an onboarding process from a template and tasks are generated', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const itAdmin = await createUser(org._id, { role: 'IT_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const templateRes = await createTemplateFixture(org, hr);
    const templateId = templateRes.body.data.id;

    const res = await request(app)
      .post('/api/onboarding/processes')
      .set('Authorization', authHeaderFor(hr))
      .send({ employeeId: employee._id.toString(), type: 'ONBOARDING', templateId });

    expect(res.status).toBe(201);
    expect(res.body.data.tasks).toHaveLength(3);
    expect(res.body.data.status).toBe('NOT_STARTED');

    const itTask = res.body.data.tasks.find((t) => t.title === 'Provision laptop');
    expect(itTask.assigneeId._id).toBe(itAdmin._id.toString());

    const auditEntries = await AuditLog.find({ entityId: res.body.data._id, entityType: 'OnboardingProcess' });
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].action).toBe('ONBOARDING_PROCESS_CREATED');
  });

  test('template tasks assigned to MANAGER go to the employee\'s actual manager, not an arbitrary one', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    // An unrelated manager created first — with the old bug, resolveAssignee would have picked this one.
    await createUserWithEmployee(org._id, { role: 'MANAGER', firstName: 'Unrelated', lastName: 'Manager' });
    const { user: realManagerUser, employee: realManagerEmployee } = await createUserWithEmployee(org._id, {
      role: 'MANAGER', firstName: 'Real', lastName: 'Manager',
    });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE', managerId: realManagerEmployee._id });

    const templateRes = await createTemplateFixture(org, hr);
    const templateId = templateRes.body.data.id;

    const res = await request(app)
      .post('/api/onboarding/processes')
      .set('Authorization', authHeaderFor(hr))
      .send({ employeeId: employee._id.toString(), type: 'ONBOARDING', templateId });

    expect(res.status).toBe(201);
    const managerTask = res.body.data.tasks.find((t) => t.title === 'Manager welcome chat');
    expect(managerTask.assigneeId._id).toBe(realManagerUser._id.toString());
  });

  test('rejects a second active onboarding process for the same employee', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    await request(app)
      .post('/api/onboarding/processes')
      .set('Authorization', authHeaderFor(hr))
      .send({ employeeId: employee._id.toString(), type: 'ONBOARDING' });

    const res = await request(app)
      .post('/api/onboarding/processes')
      .set('Authorization', authHeaderFor(hr))
      .send({ employeeId: employee._id.toString(), type: 'ONBOARDING' });

    expect(res.status).toBe(409);
  });

  test('a plain employee cannot start a process', async () => {
    const org = await createOrganization();
    const employeeUser = await createUser(org._id, { role: 'EMPLOYEE' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const res = await request(app)
      .post('/api/onboarding/processes')
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ employeeId: employee._id.toString(), type: 'ONBOARDING' });

    expect(res.status).toBe(403);
  });
});

describe('Onboarding task lifecycle', () => {
  async function startProcess(org, hr, employee) {
    const res = await request(app)
      .post('/api/onboarding/processes')
      .set('Authorization', authHeaderFor(hr))
      .send({ employeeId: employee._id.toString(), type: 'ONBOARDING' });
    return res.body.data;
  }

  test('completing every task auto-completes the process', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const process = await startProcess(org, hr, employee);

    const addRes = await request(app)
      .post(`/api/onboarding/processes/${process._id}/tasks`)
      .set('Authorization', authHeaderFor(hr))
      .send({ title: 'Only task' });
    const task = addRes.body.data.tasks[0];

    const completeRes = await request(app)
      .patch(`/api/onboarding/tasks/${task._id}/status`)
      .set('Authorization', authHeaderFor(hr))
      .send({ status: 'COMPLETED' });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.tasks[0].status).toBe('COMPLETED');
    expect(completeRes.body.data.status).toBe('COMPLETED');
    expect(completeRes.body.data.progress).toBe(100);
  });

  test('a required task cannot be skipped', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const process = await startProcess(org, hr, employee);

    const addRes = await request(app)
      .post(`/api/onboarding/processes/${process._id}/tasks`)
      .set('Authorization', authHeaderFor(hr))
      .send({ title: 'Mandatory task', isRequired: true });
    const task = addRes.body.data.tasks[0];

    const res = await request(app)
      .patch(`/api/onboarding/tasks/${task._id}/status`)
      .set('Authorization', authHeaderFor(hr))
      .send({ status: 'SKIPPED' });

    expect(res.status).toBe(400);
  });

  test('an optional task can be skipped', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const process = await startProcess(org, hr, employee);

    const addRes = await request(app)
      .post(`/api/onboarding/processes/${process._id}/tasks`)
      .set('Authorization', authHeaderFor(hr))
      .send({ title: 'Optional task', isRequired: false });
    const task = addRes.body.data.tasks[0];

    const res = await request(app)
      .patch(`/api/onboarding/tasks/${task._id}/status`)
      .set('Authorization', authHeaderFor(hr))
      .send({ status: 'SKIPPED' });

    expect(res.status).toBe(200);
    expect(res.body.data.tasks[0].status).toBe('SKIPPED');
  });

  test('an assignee can update their own task status without elevated role', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const { user: assigneeUser } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE', firstName: 'Assignee' });
    const process = await startProcess(org, hr, employee);

    const addRes = await request(app)
      .post(`/api/onboarding/processes/${process._id}/tasks`)
      .set('Authorization', authHeaderFor(hr))
      .send({ title: 'Assigned task', assigneeId: assigneeUser._id.toString() });
    const task = addRes.body.data.tasks[0];

    const res = await request(app)
      .patch(`/api/onboarding/tasks/${task._id}/status`)
      .set('Authorization', authHeaderFor(assigneeUser))
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    expect(res.body.data.tasks[0].status).toBe('IN_PROGRESS');
  });
});

describe('Onboarding access control', () => {
  test('a manager only sees processes for their direct reports', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { user: managerUser, employee: managerEmployee } = await createUserWithEmployee(org._id, { role: 'MANAGER' });
    const { employee: report } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE', managerId: managerEmployee._id, firstName: 'Report' });
    const { employee: stranger } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE', firstName: 'Stranger' });

    await request(app).post('/api/onboarding/processes').set('Authorization', authHeaderFor(hr))
      .send({ employeeId: report._id.toString(), type: 'ONBOARDING' });
    await request(app).post('/api/onboarding/processes').set('Authorization', authHeaderFor(hr))
      .send({ employeeId: stranger._id.toString(), type: 'ONBOARDING' });

    const res = await request(app)
      .get('/api/onboarding/processes')
      .set('Authorization', authHeaderFor(managerUser));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].employeeId._id).toBe(report._id.toString());
  });

  test('a manager cannot open a process belonging to a non-report', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { user: managerUser } = await createUserWithEmployee(org._id, { role: 'MANAGER' });
    const { employee: stranger } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE', firstName: 'Stranger' });

    const createRes = await request(app).post('/api/onboarding/processes').set('Authorization', authHeaderFor(hr))
      .send({ employeeId: stranger._id.toString(), type: 'ONBOARDING' });

    const res = await request(app)
      .get(`/api/onboarding/processes/${createRes.body.data._id}`)
      .set('Authorization', authHeaderFor(managerUser));

    expect(res.status).toBe(403);
  });

  test('an employee can view their own onboarding process', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const createRes = await request(app).post('/api/onboarding/processes').set('Authorization', authHeaderFor(hr))
      .send({ employeeId: employee._id.toString(), type: 'ONBOARDING' });

    const res = await request(app)
      .get(`/api/onboarding/processes/${createRes.body.data._id}`)
      .set('Authorization', authHeaderFor(employeeUser));

    expect(res.status).toBe(200);
  });
});

describe('Onboarding transaction integrity', () => {
  test('a failed task insert rolls back the whole process creation', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const templateRes = await createTemplateFixture(org, hr);
    const templateId = templateRes.body.data.id;

    const spy = jest.spyOn(OnboardingTask, 'insertMany').mockRejectedValueOnce(new Error('simulated insert failure'));

    await expect(
      onboardingService.createProcess(
        org._id.toString(),
        { employeeId: employee._id.toString(), type: 'ONBOARDING', templateId },
        hr
      )
    ).rejects.toThrow('simulated insert failure');

    spy.mockRestore();

    const processes = await OnboardingProcess.find({ organizationId: org._id });
    expect(processes).toHaveLength(0);

    const tasks = await OnboardingTask.find({ organizationId: org._id });
    expect(tasks).toHaveLength(0);

    const logs = await AuditLog.find({ entityType: 'OnboardingProcess' });
    expect(logs).toHaveLength(0);
  });
});
