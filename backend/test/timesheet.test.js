const request = require('supertest');
const app = require('../src/app');
const { TimeEntry, Timesheet, AuditLog } = require('../src/models');
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
