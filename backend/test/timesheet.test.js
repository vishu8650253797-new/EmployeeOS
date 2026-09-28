const request = require('supertest');
const app = require('../src/app');
const { TimeEntry, Timesheet, AuditLog, Notification } = require('../src/models');
const timesheetService = require('../src/services/timesheetService');
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

// ---- Pure logic (no DB) --------------------------------------------------

describe('timesheetService — pure period/validation logic', () => {
  test('mondayOf resolves any day in a week to that week\'s Monday', () => {
    expect(timesheetService.mondayOf('2026-09-23').toISOString().slice(0, 10)).toBe('2026-09-21'); // Wednesday
    expect(timesheetService.mondayOf('2026-09-21').toISOString().slice(0, 10)).toBe('2026-09-21'); // Monday itself
    expect(timesheetService.mondayOf('2026-09-27').toISOString().slice(0, 10)).toBe('2026-09-21'); // Sunday
  });

  test('buildSnapshot flags a missing clock-out as blocking and computes no total for it', () => {
    const snapshot = timesheetService.buildSnapshot([
      { status: 'ACTIVE', startTime: new Date(), endTime: null, entryDate: '2026-09-21' },
    ]);
    expect(snapshot.isReadyForSubmission).toBe(false);
    expect(snapshot.validationErrors.some((e) => e.code === 'MISSING_CLOCKOUT')).toBe(true);
  });

  test('buildSnapshot flags zero entries as blocking', () => {
    const snapshot = timesheetService.buildSnapshot([]);
    expect(snapshot.isReadyForSubmission).toBe(false);
    expect(snapshot.validationErrors.some((e) => e.code === 'NO_ENTRIES')).toBe(true);
  });

  test('buildSnapshot flags negative duration as blocking', () => {
    const snapshot = timesheetService.buildSnapshot([
      { status: 'COMPLETED', startTime: new Date('2026-09-21T09:00:00Z'), endTime: new Date('2026-09-21T17:00:00Z'), durationMinutes: -5, entryDate: '2026-09-21', notes: 'x' },
    ]);
    expect(snapshot.isReadyForSubmission).toBe(false);
    expect(snapshot.validationErrors.some((e) => e.code === 'INVALID_DURATION')).toBe(true);
  });

  test('buildSnapshot warns (non-blocking) on a long entry and missing notes', () => {
    const snapshot = timesheetService.buildSnapshot([
      { status: 'COMPLETED', startTime: new Date('2026-09-21T00:00:00Z'), endTime: new Date('2026-09-21T13:00:00Z'), durationMinutes: 780, entryDate: '2026-09-21', notes: '' },
    ]);
    expect(snapshot.isReadyForSubmission).toBe(true);
    expect(snapshot.validationWarnings.some((w) => w.code === 'LONG_DURATION')).toBe(true);
    expect(snapshot.validationWarnings.some((w) => w.code === 'MISSING_NOTES')).toBe(true);
    expect(snapshot.totalMinutes).toBe(780);
  });

  test('buildSnapshot is ready when every entry is complete, valid and reasonable', () => {
    const snapshot = timesheetService.buildSnapshot([
      { status: 'COMPLETED', startTime: new Date('2026-09-21T09:00:00Z'), endTime: new Date('2026-09-21T17:00:00Z'), durationMinutes: 480, entryDate: '2026-09-21', notes: 'Worked on X' },
    ]);
    expect(snapshot.isReadyForSubmission).toBe(true);
    expect(snapshot.validationErrors).toHaveLength(0);
    expect(snapshot.totalMinutes).toBe(480);
  });
});

// ---- API-level ------------------------------------------------------------

async function setup() {
  const org = await createOrganization();
  const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });
  return { org, employeeUser, employee };
}

// A completed entry directly in the current week, bypassing the start/end
// API so tests can control exact timestamps/duration.
async function seedCompletedEntry(org, employee, { entryDate, startTime, endTime, durationMinutes, notes = 'test' }) {
  return TimeEntry.create({
    organizationId: org._id, employeeId: employee._id, entryDate, startTime, endTime, durationMinutes,
    timezone: 'Asia/Kolkata', status: 'COMPLETED', source: 'WEB', notes, createdBy: employee.userId,
  });
}

function currentPeriodMonday() {
  const { periodStart } = timesheetService.getCurrentPeriodBounds('Asia/Kolkata');
  return periodStart;
}

describe('Timesheets — preparation', () => {
  test('an employee can prepare a timesheet and totals are calculated on the backend', async () => {
    const { org, employeeUser, employee } = await setup();
    const monday = currentPeriodMonday();
    await seedCompletedEntry(org, employee, {
      entryDate: monday,
      startTime: new Date(`${monday}T09:00:00.000Z`),
      endTime: new Date(`${monday}T17:00:00.000Z`),
      durationMinutes: 480,
      notes: 'Worked on onboarding',
    });

    const res = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.totalMinutes).toBe(480);
    expect(res.body.data.entryCount).toBe(1);
    expect(res.body.data.isReadyForSubmission).toBe(true);
  });

  test('preparing twice is safe and idempotent — no duplicate timesheet is created', async () => {
    const { org, employeeUser, employee } = await setup();
    const monday = currentPeriodMonday();
    await seedCompletedEntry(org, employee, { entryDate: monday, startTime: new Date(`${monday}T09:00:00.000Z`), endTime: new Date(`${monday}T13:00:00.000Z`), durationMinutes: 240 });

    const first = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));
    const second = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));
    expect(first.body.data.id).toBe(second.body.data.id);

    const count = await Timesheet.countDocuments({ organizationId: org._id, employeeId: employee._id });
    expect(count).toBe(1);
  });

  test('a missing clock-out is detected and blocks submission readiness', async () => {
    const { org, employeeUser, employee } = await setup();
    const monday = currentPeriodMonday();
    await TimeEntry.create({
      organizationId: org._id, employeeId: employee._id, entryDate: monday,
      startTime: new Date(`${monday}T09:00:00.000Z`), timezone: 'Asia/Kolkata', status: 'ACTIVE', source: 'WEB', createdBy: employee.userId,
    });

    const res = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));
    expect(res.body.data.isReadyForSubmission).toBe(false);
    expect(res.body.data.validationErrors.some((e) => e.code === 'MISSING_CLOCKOUT')).toBe(true);
  });

  test('the client cannot inject totals, status, employeeId or organizationId via the prepare payload', async () => {
    const { org, employeeUser, employee } = await setup();
    const monday = currentPeriodMonday();
    await seedCompletedEntry(org, employee, { entryDate: monday, startTime: new Date(`${monday}T09:00:00.000Z`), endTime: new Date(`${monday}T10:00:00.000Z`), durationMinutes: 60 });

    const res = await request(app)
      .post('/api/ess/timesheets/prepare')
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ totalMinutes: 999999, status: 'SUBMITTED', employeeId: '000000000000000000000000', organizationId: '000000000000000000000000' });

    expect(res.status).toBe(201);
    expect(res.body.data.employeeId).toBe(employee._id.toString());
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.totalMinutes).toBe(60);
  });

  test('cannot prepare a timesheet for a period that has not started yet', async () => {
    const { employeeUser } = await setup();
    const futureMonday = '2099-01-05';
    const res = await request(app)
      .post('/api/ess/timesheets/prepare')
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ periodStart: futureMonday });
    expect(res.status).toBe(400);
  });

  test('an invalid periodStart format is rejected by validation', async () => {
    const { employeeUser } = await setup();
    const res = await request(app)
      .post('/api/ess/timesheets/prepare')
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ periodStart: '09/21/2026' });
    expect(res.status).toBe(400);
  });
});

describe('Timesheets — current period and listing', () => {
  test('current period is returned even before anything has been prepared', async () => {
    const { employeeUser } = await setup();
    const res = await request(app).get('/api/ess/timesheets/current').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(200);
    expect(res.body.data.period.periodStart).toBe(currentPeriodMonday());
    expect(res.body.data.timesheet).toBeNull();
  });

  test('current period reflects the prepared draft after preparation', async () => {
    const { org, employeeUser, employee } = await setup();
    const monday = currentPeriodMonday();
    await seedCompletedEntry(org, employee, { entryDate: monday, startTime: new Date(`${monday}T09:00:00.000Z`), endTime: new Date(`${monday}T10:00:00.000Z`), durationMinutes: 60 });
    await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));

    const res = await request(app).get('/api/ess/timesheets/current').set('Authorization', authHeaderFor(employeeUser));
    expect(res.body.data.timesheet.totalMinutes).toBe(60);
  });

  test('a newly added entry is reflected on the next read of a still-DRAFT timesheet', async () => {
    const { org, employeeUser, employee } = await setup();
    const monday = currentPeriodMonday();
    await seedCompletedEntry(org, employee, { entryDate: monday, startTime: new Date(`${monday}T09:00:00.000Z`), endTime: new Date(`${monday}T10:00:00.000Z`), durationMinutes: 60 });
    const prepared = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));

    await seedCompletedEntry(org, employee, { entryDate: monday, startTime: new Date(`${monday}T11:00:00.000Z`), endTime: new Date(`${monday}T12:00:00.000Z`), durationMinutes: 60 });

    const res = await request(app).get(`/api/ess/timesheets/${prepared.body.data.id}`).set('Authorization', authHeaderFor(employeeUser));
    expect(res.body.data.totalMinutes).toBe(120);
    expect(res.body.data.entryCount).toBe(2);
  });

  test('an employee can list their own timesheets', async () => {
    const { org, employeeUser, employee } = await setup();
    const monday = currentPeriodMonday();
    await seedCompletedEntry(org, employee, { entryDate: monday, startTime: new Date(`${monday}T09:00:00.000Z`), endTime: new Date(`${monday}T10:00:00.000Z`), durationMinutes: 60 });
    await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));

    const res = await request(app).get('/api/ess/timesheets').set('Authorization', authHeaderFor(employeeUser));
    expect(res.body.data).toHaveLength(1);
  });
});

describe('Timesheets — submission', () => {
  test('a valid timesheet can be submitted and its entries are frozen into a snapshot', async () => {
    const { org, employeeUser, employee } = await setup();
    const monday = currentPeriodMonday();
    await seedCompletedEntry(org, employee, { entryDate: monday, startTime: new Date(`${monday}T09:00:00.000Z`), endTime: new Date(`${monday}T17:00:00.000Z`), durationMinutes: 480, notes: 'x' });
    const prepared = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));

    const res = await request(app).post(`/api/ess/timesheets/${prepared.body.data.id}/submit`).set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUBMITTED');
    expect(res.body.data.submittedAt).toBeTruthy();
    expect(res.body.data.timeEntryIds).toHaveLength(1);

    const logs = await AuditLog.find({ action: 'TIMESHEET_SUBMITTED', entityId: prepared.body.data.id });
    expect(logs).toHaveLength(1);
  });

  test('a timesheet with blocking errors cannot be submitted', async () => {
    const { org, employeeUser, employee } = await setup();
    const monday = currentPeriodMonday();
    await TimeEntry.create({
      organizationId: org._id, employeeId: employee._id, entryDate: monday,
      startTime: new Date(`${monday}T09:00:00.000Z`), timezone: 'Asia/Kolkata', status: 'ACTIVE', source: 'WEB', createdBy: employee.userId,
    });
    const prepared = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));

    const res = await request(app).post(`/api/ess/timesheets/${prepared.body.data.id}/submit`).set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(422);

    const stillDraft = await Timesheet.findById(prepared.body.data.id).lean();
    expect(stillDraft.status).toBe('DRAFT');
  });

  test('a duplicate submission is rejected', async () => {
    const { org, employeeUser, employee } = await setup();
    const monday = currentPeriodMonday();
    await seedCompletedEntry(org, employee, { entryDate: monday, startTime: new Date(`${monday}T09:00:00.000Z`), endTime: new Date(`${monday}T10:00:00.000Z`), durationMinutes: 60, notes: 'x' });
    const prepared = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));
    await request(app).post(`/api/ess/timesheets/${prepared.body.data.id}/submit`).set('Authorization', authHeaderFor(employeeUser));

    const second = await request(app).post(`/api/ess/timesheets/${prepared.body.data.id}/submit`).set('Authorization', authHeaderFor(employeeUser));
    expect(second.status).toBe(409);
  });

  test('concurrent submit requests are handled safely — exactly one succeeds', async () => {
    const { org, employeeUser, employee } = await setup();
    const monday = currentPeriodMonday();
    await seedCompletedEntry(org, employee, { entryDate: monday, startTime: new Date(`${monday}T09:00:00.000Z`), endTime: new Date(`${monday}T10:00:00.000Z`), durationMinutes: 60, notes: 'x' });
    const prepared = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));

    const [a, b] = await Promise.all([
      request(app).post(`/api/ess/timesheets/${prepared.body.data.id}/submit`).set('Authorization', authHeaderFor(employeeUser)),
      request(app).post(`/api/ess/timesheets/${prepared.body.data.id}/submit`).set('Authorization', authHeaderFor(employeeUser)),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  test('once submitted, preparing the same period again is rejected rather than overwriting it', async () => {
    const { org, employeeUser, employee } = await setup();
    const monday = currentPeriodMonday();
    await seedCompletedEntry(org, employee, { entryDate: monday, startTime: new Date(`${monday}T09:00:00.000Z`), endTime: new Date(`${monday}T10:00:00.000Z`), durationMinutes: 60, notes: 'x' });
    const prepared = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));
    await request(app).post(`/api/ess/timesheets/${prepared.body.data.id}/submit`).set('Authorization', authHeaderFor(employeeUser));

    const reprepare = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));
    expect(reprepare.status).toBe(409);
  });
});

describe('Timesheets — security', () => {
  test('unauthenticated requests are rejected', async () => {
    const res = await request(app).post('/api/ess/timesheets/prepare');
    expect(res.status).toBe(401);
  });

  test('a user with no linked employee record gets a clean error, not a crash', async () => {
    const org = await createOrganization();
    const userWithoutEmployee = await createUser(org._id, { role: 'EMPLOYEE' });
    const res = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(userWithoutEmployee));
    expect(res.status).toBe(404);
  });

  test('an employee cannot view or submit another employee\'s timesheet (IDOR)', async () => {
    const { org, employeeUser, employee } = await setup();
    const { user: otherUser } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });
    const monday = currentPeriodMonday();
    await seedCompletedEntry(org, employee, { entryDate: monday, startTime: new Date(`${monday}T09:00:00.000Z`), endTime: new Date(`${monday}T10:00:00.000Z`), durationMinutes: 60, notes: 'x' });
    const prepared = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));

    const viewRes = await request(app).get(`/api/ess/timesheets/${prepared.body.data.id}`).set('Authorization', authHeaderFor(otherUser));
    expect(viewRes.status).toBe(404);

    const submitRes = await request(app).post(`/api/ess/timesheets/${prepared.body.data.id}/submit`).set('Authorization', authHeaderFor(otherUser));
    expect(submitRes.status).toBe(404);

    const stillDraft = await Timesheet.findById(prepared.body.data.id).lean();
    expect(stillDraft.status).toBe('DRAFT');
  });

  test('an employee cannot see or reach another organization\'s timesheet', async () => {
    const { org, employeeUser, employee } = await setup();
    const orgB = await createOrganization();
    const { user: orgBUser } = await createUserWithEmployee(orgB._id, { joiningDate: new Date('2025-01-01') });
    const monday = currentPeriodMonday();
    await seedCompletedEntry(org, employee, { entryDate: monday, startTime: new Date(`${monday}T09:00:00.000Z`), endTime: new Date(`${monday}T10:00:00.000Z`), durationMinutes: 60, notes: 'x' });
    const prepared = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));

    const res = await request(app).get(`/api/ess/timesheets/${prepared.body.data.id}`).set('Authorization', authHeaderFor(orgBUser));
    expect(res.status).toBe(404);

    const list = await request(app).get('/api/ess/timesheets').set('Authorization', authHeaderFor(orgBUser));
    expect(list.body.data).toHaveLength(0);
  });

  test('a malformed timesheet ID is handled safely, not with a 500', async () => {
    const { employeeUser } = await setup();
    const res = await request(app).get('/api/ess/timesheets/not-a-valid-id').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(400);
  });
});

// ---- Manager review (Step 13D) --------------------------------------------

async function setupSubmittedTimesheetFor(org, employeeUser) {
  const monday = currentPeriodMonday();
  const startRes = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));
  await request(app).post(`/api/ess/time-entries/${startRes.body.data.id}/end`).set('Authorization', authHeaderFor(employeeUser)).send({ notes: 'x' });
  const prepared = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));
  const submitted = await request(app).post(`/api/ess/timesheets/${prepared.body.data.id}/submit`).set('Authorization', authHeaderFor(employeeUser));
  return submitted.body.data.id;
}

async function setupManagerAndReport(org) {
  const { user: managerUser, employee: managerEmployee } = await createUserWithEmployee(org._id, { role: 'MANAGER' });
  const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE', managerId: managerEmployee._id, joiningDate: new Date('2025-01-01') });
  return { managerUser, managerEmployee, employeeUser, employee };
}

describe('Timesheets — manager review, authorization', () => {
  test('an authorized manager can list their direct report\'s submitted timesheets', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    await setupSubmittedTimesheetFor(org, employeeUser);

    const res = await request(app).get('/api/timesheets').set('Authorization', authHeaderFor(managerUser));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].employee.firstName).toBeTruthy();
  });

  test('a plain employee cannot access manager endpoints', async () => {
    const org = await createOrganization();
    const { employeeUser } = await setupManagerAndReport(org);
    const res = await request(app).get('/api/timesheets').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(403);
  });

  test('a manager cannot see timesheets from another organization', async () => {
    const orgA = await createOrganization();
    const { employeeUser } = await setupManagerAndReport(orgA);
    await setupSubmittedTimesheetFor(orgA, employeeUser);

    const orgB = await createOrganization();
    const { managerUser: managerB } = await setupManagerAndReport(orgB);

    const res = await request(app).get('/api/timesheets').set('Authorization', authHeaderFor(managerB));
    expect(res.body.data).toHaveLength(0);
  });

  test('an unrelated manager cannot view or act on an employee outside their scope', async () => {
    const org = await createOrganization();
    const { employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    const { user: unrelatedManager } = await createUserWithEmployee(org._id, { role: 'MANAGER', firstName: 'Unrelated' });

    const viewRes = await request(app).get(`/api/timesheets/${id}`).set('Authorization', authHeaderFor(unrelatedManager));
    expect(viewRes.status).toBe(403);

    const approveRes = await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(unrelatedManager));
    expect(approveRes.status).toBe(403);

    const stillSubmitted = await Timesheet.findById(id).lean();
    expect(stillSubmitted.status).toBe('SUBMITTED');
  });

  test('a manager can view full details of their direct report\'s submitted timesheet', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);

    const res = await request(app).get(`/api/timesheets/${id}`).set('Authorization', authHeaderFor(managerUser));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUBMITTED');

    const entriesRes = await request(app).get(`/api/timesheets/${id}/entries`).set('Authorization', authHeaderFor(managerUser));
    expect(entriesRes.body.data).toHaveLength(1);
  });

  test('HR_ADMIN (unscoped) can view and act on any employee\'s timesheet regardless of managerId', async () => {
    const org = await createOrganization();
    const { employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });

    const res = await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(hrAdmin));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
  });

  test('a draft timesheet is not reachable at the manager endpoint (not yet submitted)', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const startRes = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));
    await request(app).post(`/api/ess/time-entries/${startRes.body.data.id}/end`).set('Authorization', authHeaderFor(employeeUser));
    const prepared = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));

    const res = await request(app).get(`/api/timesheets/${prepared.body.data.id}`).set('Authorization', authHeaderFor(managerUser));
    expect(res.status).toBe(404);

    const approveRes = await request(app).post(`/api/timesheets/${prepared.body.data.id}/approve`).set('Authorization', authHeaderFor(managerUser));
    expect(approveRes.status).toBe(404);
  });
});

describe('Timesheets — approval workflow', () => {
  test('a manager can approve a valid submitted timesheet', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);

    const res = await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(managerUser));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.reviewedAt).toBeTruthy();
    expect(res.body.data.reviewedBy).toBeTruthy();
  });

  test('an already-approved timesheet cannot be approved again', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(managerUser));

    const res = await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(managerUser));
    expect(res.status).toBe(409);
  });

  test('an approved timesheet cannot subsequently be rejected (invalid transition)', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(managerUser));

    const res = await request(app).post(`/api/timesheets/${id}/reject`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'too late' });
    expect(res.status).toBe(409);
  });

  test('tampered reviewer, employee and organization IDs in the approve body are ignored', async () => {
    const org = await createOrganization();
    const { managerUser, managerEmployee, employeeUser, employee } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);

    const res = await request(app)
      .post(`/api/timesheets/${id}/approve`)
      .set('Authorization', authHeaderFor(managerUser))
      .send({ reviewerId: '000000000000000000000000', employeeId: '000000000000000000000000', organizationId: '000000000000000000000000', status: 'REJECTED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.employee.id).toBe(employee._id.toString());
  });

  test('concurrent approval requests are handled safely — exactly one succeeds', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);

    const [a, b] = await Promise.all([
      request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(managerUser)),
      request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(managerUser)),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  test('an audit log and employee notification are created on approval', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser, employee } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(managerUser));

    const logs = await AuditLog.find({ action: 'TIMESHEET_APPROVED', entityId: id });
    expect(logs).toHaveLength(1);

    const notifications = await Notification.find({ recipientId: employeeUser._id, type: 'TIMESHEET_APPROVED' });
    expect(notifications).toHaveLength(1);
  });

  test('the employee sees the approved status and reviewer info afterward', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(managerUser));

    const res = await request(app).get(`/api/ess/timesheets/${id}`).set('Authorization', authHeaderFor(employeeUser));
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.reviewedBy).toBeTruthy();
  });
});

describe('Timesheets — rejection workflow', () => {
  test('rejection requires a non-empty reason', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);

    const res = await request(app).post(`/api/timesheets/${id}/reject`).set('Authorization', authHeaderFor(managerUser)).send({});
    expect(res.status).toBe(400);

    const stillSubmitted = await Timesheet.findById(id).lean();
    expect(stillSubmitted.status).toBe('SUBMITTED');
  });

  test('an empty or whitespace-only reason is rejected', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);

    const res = await request(app).post(`/api/timesheets/${id}/reject`).set('Authorization', authHeaderFor(managerUser)).send({ reason: '   ' });
    expect(res.status).toBe(400);
  });

  test('a manager can reject with a valid reason, and the reason is visible to the employee', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);

    const res = await request(app)
      .post(`/api/timesheets/${id}/reject`)
      .set('Authorization', authHeaderFor(managerUser))
      .send({ reason: 'Missing notes on several entries' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
    expect(res.body.data.rejectionReason).toBe('Missing notes on several entries');

    const employeeView = await request(app).get(`/api/ess/timesheets/${id}`).set('Authorization', authHeaderFor(employeeUser));
    expect(employeeView.body.data.rejectionReason).toBe('Missing notes on several entries');
  });

  test('an already-rejected timesheet cannot be rejected again', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/reject`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'first' });

    const res = await request(app).post(`/api/timesheets/${id}/reject`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'second' });
    expect(res.status).toBe(409);
  });

  test('a rejected timesheet cannot be re-prepared (correction goes through /resubmit, not /prepare)', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/reject`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'x' });

    const res = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(409);
  });

  test('an audit log and employee notification (including the reason) are created on rejection', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/reject`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'Please add notes' });

    const logs = await AuditLog.find({ action: 'TIMESHEET_REJECTED', entityId: id });
    expect(logs).toHaveLength(1);
    expect(logs[0].metadata.reason).toBe('Please add notes');

    const notifications = await Notification.find({ recipientId: employeeUser._id, type: 'TIMESHEET_REJECTED' });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toContain('Please add notes');
  });
});

describe('Timesheets — self-approval protection', () => {
  test('an HR admin cannot approve or reject their own submitted timesheet', async () => {
    const org = await createOrganization();
    const { user: hrAdminUser, employee: hrAdminEmployee } = await createUserWithEmployee(org._id, { role: 'HR_ADMIN', joiningDate: new Date('2025-01-01') });
    const id = await setupSubmittedTimesheetFor(org, hrAdminUser);

    const approveRes = await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(hrAdminUser));
    expect(approveRes.status).toBe(403);

    const rejectRes = await request(app).post(`/api/timesheets/${id}/reject`).set('Authorization', authHeaderFor(hrAdminUser)).send({ reason: 'x' });
    expect(rejectRes.status).toBe(403);

    const stillSubmitted = await Timesheet.findById(id).lean();
    expect(stillSubmitted.status).toBe('SUBMITTED');
  });
});

// ---- Employee correction & resubmission (Step 13E) -------------------------

describe('Timesheets — employee correction & resubmission', () => {
  test('an employee sees the rejection reason and, after adding a valid entry, can resubmit', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser, employee } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/reject`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'Please add more detail' });

    const viewRes = await request(app).get(`/api/ess/timesheets/${id}`).set('Authorization', authHeaderFor(employeeUser));
    expect(viewRes.body.data.status).toBe('REJECTED');
    expect(viewRes.body.data.rejectionReason).toBe('Please add more detail');

    // Correction = clock a new entry for the period, then resubmit — there is
    // no edit-existing-entry endpoint in this codebase (Step 13B never built
    // one), so this is the only real correction mechanism available today.
    const start = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));
    await request(app).post(`/api/ess/time-entries/${start.body.data.id}/end`).set('Authorization', authHeaderFor(employeeUser)).send({ notes: 'correction entry' });

    const resubmitRes = await request(app).post(`/api/ess/timesheets/${id}/resubmit`).set('Authorization', authHeaderFor(employeeUser));
    expect(resubmitRes.status).toBe(200);
    expect(resubmitRes.body.data.status).toBe('SUBMITTED');
    expect(resubmitRes.body.data.entryCount).toBe(2);
    // The prior decision is cleared — it's no longer the current state —
    // but remains visible via history (tested separately below).
    expect(resubmitRes.body.data.rejectionReason).toBeFalsy();
  });

  test('a rejected timesheet still failing validation (e.g. an open entry) cannot be resubmitted', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser, employee } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/reject`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'x' });

    // Leave a new entry open (no clock-out) — still not ready.
    await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));

    const res = await request(app).post(`/api/ess/timesheets/${id}/resubmit`).set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(422);

    const stillRejected = await Timesheet.findById(id).lean();
    expect(stillRejected.status).toBe('REJECTED');
  });

  test('an employee cannot resubmit another employee\'s timesheet (IDOR)', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const { user: otherUser } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/reject`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'x' });

    const res = await request(app).post(`/api/ess/timesheets/${id}/resubmit`).set('Authorization', authHeaderFor(otherUser));
    expect(res.status).toBe(404);

    const stillRejected = await Timesheet.findById(id).lean();
    expect(stillRejected.status).toBe('REJECTED');
  });

  test('only a REJECTED timesheet is eligible for resubmission — not DRAFT, SUBMITTED, or APPROVED', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);

    // still SUBMITTED (never rejected)
    const res = await request(app).post(`/api/ess/timesheets/${id}/resubmit`).set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(409);

    await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(managerUser));
    const res2 = await request(app).post(`/api/ess/timesheets/${id}/resubmit`).set('Authorization', authHeaderFor(employeeUser));
    expect(res2.status).toBe(409);
  });

  test('duplicate/concurrent resubmission is prevented — exactly one succeeds', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/reject`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'x' });
    const start = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));
    await request(app).post(`/api/ess/time-entries/${start.body.data.id}/end`).set('Authorization', authHeaderFor(employeeUser)).send({ notes: 'x' });

    const [a, b] = await Promise.all([
      request(app).post(`/api/ess/timesheets/${id}/resubmit`).set('Authorization', authHeaderFor(employeeUser)),
      request(app).post(`/api/ess/timesheets/${id}/resubmit`).set('Authorization', authHeaderFor(employeeUser)),
    ]);
    // exactly one request wins the atomic status:'REJECTED' guard
    const successes = [a, b].filter((r) => r.status === 200);
    expect(successes).toHaveLength(1);

    const final = await Timesheet.findById(id).lean();
    expect(final.status).toBe('SUBMITTED');
  });

  test('the manager is notified when the employee resubmits, and sees it back in their queue', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/reject`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'x' });
    const start = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));
    await request(app).post(`/api/ess/time-entries/${start.body.data.id}/end`).set('Authorization', authHeaderFor(employeeUser)).send({ notes: 'x' });

    await request(app).post(`/api/ess/timesheets/${id}/resubmit`).set('Authorization', authHeaderFor(employeeUser));

    const notifications = await Notification.find({ recipientId: managerUser._id, type: 'TIMESHEET_RESUBMITTED' });
    expect(notifications).toHaveLength(1);

    const queue = await request(app).get('/api/timesheets?status=SUBMITTED').set('Authorization', authHeaderFor(managerUser));
    expect(queue.body.data.map((t) => t.id)).toContain(id);
  });
});

// ---- Manager reopen of an approved timesheet (Step 13E) --------------------

describe('Timesheets — manager reopen', () => {
  async function approveTimesheetFor(org, managerUser, employeeUser) {
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(managerUser));
    return id;
  }

  test('an authorized manager can reopen an approved timesheet with a reason', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await approveTimesheetFor(org, managerUser, employeeUser);

    const res = await request(app).post(`/api/timesheets/${id}/reopen`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'Found a discrepancy' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
    expect(res.body.data.rejectionReason).toBe('Found a discrepancy');
  });

  test('reopening without a reason is rejected', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await approveTimesheetFor(org, managerUser, employeeUser);

    const res = await request(app).post(`/api/timesheets/${id}/reopen`).set('Authorization', authHeaderFor(managerUser)).send({});
    expect(res.status).toBe(400);
  });

  test('an unrelated manager cannot reopen a timesheet outside their scope', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await approveTimesheetFor(org, managerUser, employeeUser);
    const { user: unrelatedManager } = await createUserWithEmployee(org._id, { role: 'MANAGER', firstName: 'Unrelated' });

    const res = await request(app).post(`/api/timesheets/${id}/reopen`).set('Authorization', authHeaderFor(unrelatedManager)).send({ reason: 'x' });
    expect(res.status).toBe(403);

    const stillApproved = await Timesheet.findById(id).lean();
    expect(stillApproved.status).toBe('APPROVED');
  });

  test('a manager cannot reopen another organization\'s timesheet', async () => {
    const orgA = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(orgA);
    const id = await approveTimesheetFor(orgA, managerUser, employeeUser);

    const orgB = await createOrganization();
    const { managerUser: managerB } = await setupManagerAndReport(orgB);

    // Cross-org lookup fails at "not found" before authorization is even
    // checked — the same pattern used everywhere else in this codebase
    // (never confirm a cross-org record's existence via a 403).
    const res = await request(app).post(`/api/timesheets/${id}/reopen`).set('Authorization', authHeaderFor(managerB)).send({ reason: 'x' });
    expect(res.status).toBe(404);
  });

  test('only an approved timesheet can be reopened — not a still-submitted one', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);

    const res = await request(app).post(`/api/timesheets/${id}/reopen`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'x' });
    expect(res.status).toBe(409);
  });

  test('an HR admin cannot reopen their own approved timesheet (self-reopen protection)', async () => {
    const org = await createOrganization();
    const { user: hrAdminUser } = await createUserWithEmployee(org._id, { role: 'HR_ADMIN', joiningDate: new Date('2025-01-01') });
    const id = await setupSubmittedTimesheetFor(org, hrAdminUser);
    await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(hrAdminUser));

    const res = await request(app).post(`/api/timesheets/${id}/reopen`).set('Authorization', authHeaderFor(hrAdminUser)).send({ reason: 'x' });
    expect(res.status).toBe(403);
  });

  test('concurrent reopen requests are handled safely — exactly one succeeds', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await approveTimesheetFor(org, managerUser, employeeUser);

    const [a, b] = await Promise.all([
      request(app).post(`/api/timesheets/${id}/reopen`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'first' }),
      request(app).post(`/api/timesheets/${id}/reopen`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'second' }),
    ]);
    const successes = [a, b].filter((r) => r.status === 200);
    expect(successes).toHaveLength(1);
  });

  test('an audit log is created and the employee is notified on reopen', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await approveTimesheetFor(org, managerUser, employeeUser);
    await request(app).post(`/api/timesheets/${id}/reopen`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'Please recheck Tuesday' });

    const logs = await AuditLog.find({ action: 'TIMESHEET_REOPENED', entityId: id });
    expect(logs).toHaveLength(1);
    expect(logs[0].metadata.reason).toBe('Please recheck Tuesday');

    const notifications = await Notification.find({ recipientId: employeeUser._id, type: 'TIMESHEET_REOPENED' });
    expect(notifications).toHaveLength(1);
  });

  test('full round trip: submit -> approve -> reopen -> correct -> resubmit -> re-approve', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await approveTimesheetFor(org, managerUser, employeeUser);

    await request(app).post(`/api/timesheets/${id}/reopen`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'One more check' });
    let current = await Timesheet.findById(id).lean();
    expect(current.status).toBe('REJECTED');

    const start = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));
    await request(app).post(`/api/ess/time-entries/${start.body.data.id}/end`).set('Authorization', authHeaderFor(employeeUser)).send({ notes: 'x' });
    const resubmitRes = await request(app).post(`/api/ess/timesheets/${id}/resubmit`).set('Authorization', authHeaderFor(employeeUser));
    expect(resubmitRes.body.data.status).toBe('SUBMITTED');

    const reapproveRes = await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(managerUser));
    expect(reapproveRes.status).toBe(200);
    expect(reapproveRes.body.data.status).toBe('APPROVED');
  });
});

// ---- Finalization / locking (Step 13E — reuses APPROVED as the locked state)

describe('Timesheets — finalization / locking (APPROVED is the locked state)', () => {
  test('an approved timesheet cannot be modified via prepare or resubmit — direct API bypass is blocked', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(managerUser));

    const prepareRes = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));
    expect(prepareRes.status).toBe(409);

    const resubmitRes = await request(app).post(`/api/ess/timesheets/${id}/resubmit`).set('Authorization', authHeaderFor(employeeUser));
    expect(resubmitRes.status).toBe(409);

    const stillApproved = await Timesheet.findById(id).lean();
    expect(stillApproved.status).toBe('APPROVED');
  });

  test('only an authorized manager can unlock (reopen) an approved timesheet — no unrestricted override exists', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(managerUser));

    // The employee themself has no reopen capability at all.
    const employeeAttempt = await request(app).post(`/api/timesheets/${id}/reopen`).set('Authorization', authHeaderFor(employeeUser)).send({ reason: 'x' });
    expect(employeeAttempt.status).toBe(403);
  });
});

// ---- Review history (Step 13E — reuses AuditLog, no duplicate history store)

describe('Timesheets — review history', () => {
  test('the full lifecycle is visible in history with the correct action names', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/reject`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'first pass' });

    const start = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));
    await request(app).post(`/api/ess/time-entries/${start.body.data.id}/end`).set('Authorization', authHeaderFor(employeeUser)).send({ notes: 'x' });
    await request(app).post(`/api/ess/timesheets/${id}/resubmit`).set('Authorization', authHeaderFor(employeeUser));
    await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(managerUser));

    const employeeView = await request(app).get(`/api/ess/timesheets/${id}`).set('Authorization', authHeaderFor(employeeUser));
    const actions = employeeView.body.data.history.map((h) => h.action);
    expect(actions).toEqual(['TIMESHEET_SUBMITTED', 'TIMESHEET_REJECTED', 'TIMESHEET_RESUBMITTED', 'TIMESHEET_APPROVED']);
  });

  test('a reopen is distinguishable in history from an ordinary rejection', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    const id = await setupSubmittedTimesheetFor(org, employeeUser);
    await request(app).post(`/api/timesheets/${id}/approve`).set('Authorization', authHeaderFor(managerUser));
    await request(app).post(`/api/timesheets/${id}/reopen`).set('Authorization', authHeaderFor(managerUser)).send({ reason: 'x' });

    const managerView = await request(app).get(`/api/timesheets/${id}`).set('Authorization', authHeaderFor(managerUser));
    const actions = managerView.body.data.history.map((h) => h.action);
    expect(actions).toContain('TIMESHEET_REOPENED');
    expect(actions).not.toContain('TIMESHEET_REJECTED');
  });
});

// ---- Notifications on submission (Step 13F — this was a real gap) ---------

describe('Timesheets — submission notification (Step 13F)', () => {
  test('the direct manager is notified when an employee submits a timesheet', async () => {
    const org = await createOrganization();
    const { managerUser, employeeUser } = await setupManagerAndReport(org);
    await setupSubmittedTimesheetFor(org, employeeUser);

    const notifications = await Notification.find({ recipientId: managerUser._id, type: 'TIMESHEET_SUBMITTED' });
    expect(notifications).toHaveLength(1);
  });

  test('no notification is sent (and nothing crashes) when the employee has no manager assigned', async () => {
    const org = await createOrganization();
    const { user: employeeUser } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') }); // no managerId
    const res = await request(app).post('/api/ess/time-entries/start').set('Authorization', authHeaderFor(employeeUser));
    await request(app).post(`/api/ess/time-entries/${res.body.data.id}/end`).set('Authorization', authHeaderFor(employeeUser)).send({ notes: 'x' });
    const prepared = await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser));

    const submitRes = await request(app).post(`/api/ess/timesheets/${prepared.body.data.id}/submit`).set('Authorization', authHeaderFor(employeeUser));
    expect(submitRes.status).toBe(200);

    const notifications = await Notification.find({ type: 'TIMESHEET_SUBMITTED' });
    expect(notifications).toHaveLength(0);
  });
});

// ---- Manager reporting / summary (Step 13F) --------------------------------

describe('Timesheets — manager reporting summary', () => {
  test('summary reflects counts and total minutes across the manager\'s scope, excluding drafts', async () => {
    const org = await createOrganization();
    const { managerUser, managerEmployee, employeeUser } = await setupManagerAndReport(org);
    await setupSubmittedTimesheetFor(org, employeeUser);

    // a second employee under the same manager, left in DRAFT — must not appear
    const { user: employeeUser2 } = await createUserWithEmployee(org._id, { managerId: managerEmployee._id, joiningDate: new Date('2025-01-01') });
    await request(app).post('/api/ess/timesheets/prepare').set('Authorization', authHeaderFor(employeeUser2));

    const res = await request(app).get('/api/timesheets/summary').set('Authorization', authHeaderFor(managerUser));
    expect(res.status).toBe(200);
    expect(res.body.data.totalTimesheets).toBe(1); // the DRAFT one is excluded
    expect(res.body.data.byStatus.SUBMITTED).toBe(1);
    expect(res.body.data.totalMinutes).toBeGreaterThanOrEqual(0);
  });

  test('an unrelated manager\'s summary does not include another manager\'s team', async () => {
    const org = await createOrganization();
    const { employeeUser } = await setupManagerAndReport(org);
    await setupSubmittedTimesheetFor(org, employeeUser);
    const { managerUser: unrelatedManager } = await setupManagerAndReport(org);

    const res = await request(app).get('/api/timesheets/summary').set('Authorization', authHeaderFor(unrelatedManager));
    expect(res.body.data.totalTimesheets).toBe(0);
  });

  test('a plain employee cannot access the summary endpoint', async () => {
    const org = await createOrganization();
    const { employeeUser } = await setupManagerAndReport(org);
    const res = await request(app).get('/api/timesheets/summary').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(403);
  });

  test('HR_ADMIN (unscoped) sees organization-wide totals across multiple managers', async () => {
    const org = await createOrganization();
    const { employeeUser: emp1 } = await setupManagerAndReport(org);
    await setupSubmittedTimesheetFor(org, emp1);
    const { employeeUser: emp2 } = await setupManagerAndReport(org);
    await setupSubmittedTimesheetFor(org, emp2);
    const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });

    const res = await request(app).get('/api/timesheets/summary').set('Authorization', authHeaderFor(hrAdmin));
    expect(res.body.data.totalTimesheets).toBe(2);
  });

  test('the summary endpoint cannot be widened via a spoofed organizationId or employeeId query param', async () => {
    const orgA = await createOrganization();
    const { employeeUser } = await setupManagerAndReport(orgA);
    await setupSubmittedTimesheetFor(orgA, employeeUser);

    const orgB = await createOrganization();
    const { managerUser: managerB } = await setupManagerAndReport(orgB);

    const res = await request(app)
      .get('/api/timesheets/summary')
      .query({ organizationId: orgA._id.toString() })
      .set('Authorization', authHeaderFor(managerB));
    expect(res.body.data.totalTimesheets).toBe(0); // still scoped to orgB, the spoofed param is ignored
  });
});

// ---- Manager list search (Step 13F) ----------------------------------------

describe('Timesheets — manager list search', () => {
  test('a manager can search their team by employee name', async () => {
    const org = await createOrganization();
    const { managerEmployee, managerUser } = await setupManagerAndReport(org);
    const { user: employeeUser } = await createUserWithEmployee(org._id, { firstName: 'Zendaya', lastName: 'Searchable', managerId: managerEmployee._id, joiningDate: new Date('2025-01-01') });
    await setupSubmittedTimesheetFor(org, employeeUser);

    const res = await request(app).get('/api/timesheets').query({ search: 'zendaya' }).set('Authorization', authHeaderFor(managerUser));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].employee.firstName).toBe('Zendaya');
  });

  test('search cannot surface an employee outside the manager\'s scope', async () => {
    const org = await createOrganization();
    const { managerUser } = await setupManagerAndReport(org);
    const { user: unrelatedEmployeeUser } = await createUserWithEmployee(org._id, { firstName: 'Outside', lastName: 'Scope', joiningDate: new Date('2025-01-01') });
    await setupSubmittedTimesheetFor(org, unrelatedEmployeeUser);

    const res = await request(app).get('/api/timesheets').query({ search: 'Outside' }).set('Authorization', authHeaderFor(managerUser));
    expect(res.body.data).toHaveLength(0);
  });
});
