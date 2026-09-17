const request = require('supertest');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUserWithEmployee, authHeaderFor } = require('./helpers/factories');
const { Attendance } = require('../src/models');

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

async function createAttendance(orgId, employeeId, date, overrides = {}) {
  return Attendance.create({
    organizationId: orgId, employeeId, date, status: 'PRESENT', workingMinutes: 480, ...overrides,
  });
}

describe('GET /api/ess/attendance', () => {
  test('returns only the caller\'s own attendance records', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id);
    const { employee: other } = await createUserWithEmployee(org._id);

    await createAttendance(org._id, employee._id, '2026-01-05');
    await createAttendance(org._id, employee._id, '2026-01-06', { status: 'LATE', lateMinutes: 15 });
    await createAttendance(org._id, other._id, '2026-01-05');

    const res = await request(app).get('/api/ess/attendance').set('Authorization', authHeaderFor(user));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((r) => r.employeeId === employee._id.toString() || r.employee?.id === employee._id.toString())).toBe(true);
  });

  test('filters by month/year', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id);
    await createAttendance(org._id, employee._id, '2026-01-05');
    await createAttendance(org._id, employee._id, '2026-02-05');

    const res = await request(app)
      .get('/api/ess/attendance')
      .query({ month: 1, year: 2026 })
      .set('Authorization', authHeaderFor(user));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/ess/attendance/summary', () => {
  test('computes present/late/absent counts from the caller\'s own records', async () => {
    const org = await createOrganization();
    const { user, employee } = await createUserWithEmployee(org._id);
    await createAttendance(org._id, employee._id, '2026-01-05', { status: 'PRESENT', workingMinutes: 480 });
    await createAttendance(org._id, employee._id, '2026-01-06', { status: 'LATE', workingMinutes: 420 });
    await createAttendance(org._id, employee._id, '2026-01-07', { status: 'ABSENT', workingMinutes: 0 });

    const res = await request(app)
      .get('/api/ess/attendance/summary')
      .query({ startDate: '2026-01-01', endDate: '2026-01-31' })
      .set('Authorization', authHeaderFor(user));

    expect(res.status).toBe(200);
    expect(res.body.data.totalDays).toBe(3);
    expect(res.body.data.present).toBe(1);
    expect(res.body.data.late).toBe(1);
    expect(res.body.data.absent).toBe(1);
  });
});

describe('GET /api/ess/attendance/:id (ownership)', () => {
  test('an employee cannot view another employee\'s attendance record', async () => {
    const org = await createOrganization();
    const { user: victimUser, employee: victim } = await createUserWithEmployee(org._id);
    const { user: attacker } = await createUserWithEmployee(org._id);
    const record = await createAttendance(org._id, victim._id, '2026-01-05');

    const ownRes = await request(app)
      .get(`/api/ess/attendance/${record._id}`)
      .set('Authorization', authHeaderFor(victimUser));
    expect(ownRes.status).toBe(200);

    const attackRes = await request(app)
      .get(`/api/ess/attendance/${record._id}`)
      .set('Authorization', authHeaderFor(attacker));
    expect(attackRes.status).toBe(403);
  });
});

describe('Cross-org isolation', () => {
  test('attendance from another organization is not reachable', async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const { user: userA } = await createUserWithEmployee(orgA._id);
    const { employee: employeeB } = await createUserWithEmployee(orgB._id);
    const record = await createAttendance(orgB._id, employeeB._id, '2026-01-05');

    const res = await request(app)
      .get(`/api/ess/attendance/${record._id}`)
      .set('Authorization', authHeaderFor(userA));
    expect([403, 404]).toContain(res.status);
  });
});
