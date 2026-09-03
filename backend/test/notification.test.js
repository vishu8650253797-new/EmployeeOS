const request = require('supertest');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser, authHeaderFor } = require('./helpers/factories');
const notificationService = require('../src/services/notificationService');

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

async function seedNotification(org, recipient, overrides = {}) {
  return notificationService.createNotification({
    organizationId: org._id,
    recipientId: recipient._id,
    type: 'ASSET_ASSIGNED',
    title: 'A notification',
    message: 'Something happened.',
    entityType: 'Asset',
    entityId: org._id,
    ...overrides,
  });
}

describe('Notification API', () => {
  test('a user only sees their own notifications, scoped and paginated', async () => {
    const org = await createOrganization();
    const userA = await createUser(org._id, { role: 'EMPLOYEE' });
    const userB = await createUser(org._id, { role: 'EMPLOYEE' });

    await seedNotification(org, userA, { title: 'For A 1' });
    await seedNotification(org, userA, { title: 'For A 2' });
    await seedNotification(org, userB, { title: 'For B' });

    const res = await request(app)
      .get('/api/notifications?page=1&limit=1')
      .set('Authorization', authHeaderFor(userA));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.data.every((n) => n.title.startsWith('For A'))).toBe(true);
  });

  test('unread count reflects only the authenticated user\'s unread notifications', async () => {
    const org = await createOrganization();
    const userA = await createUser(org._id, { role: 'EMPLOYEE' });
    const userB = await createUser(org._id, { role: 'EMPLOYEE' });
    await seedNotification(org, userA);
    await seedNotification(org, userA);
    await seedNotification(org, userB);

    const res = await request(app).get('/api/notifications/unread-count').set('Authorization', authHeaderFor(userA));
    expect(res.body.data.count).toBe(2);
  });

  test('a user cannot mark another user\'s notification as read (IDOR)', async () => {
    const org = await createOrganization();
    const userA = await createUser(org._id, { role: 'EMPLOYEE' });
    const userB = await createUser(org._id, { role: 'EMPLOYEE' });
    const notification = await seedNotification(org, userA);

    const res = await request(app)
      .put(`/api/notifications/${notification._id}/read`)
      .set('Authorization', authHeaderFor(userB));

    expect(res.status).toBe(404);

    const stillUnread = await request(app).get('/api/notifications/unread-count').set('Authorization', authHeaderFor(userA));
    expect(stillUnread.body.data.count).toBe(1);
  });

  test('mark all as read only affects the authenticated user\'s notifications', async () => {
    const org = await createOrganization();
    const userA = await createUser(org._id, { role: 'EMPLOYEE' });
    const userB = await createUser(org._id, { role: 'EMPLOYEE' });
    await seedNotification(org, userA);
    await seedNotification(org, userA);
    await seedNotification(org, userB);

    const res = await request(app).put('/api/notifications/read-all').set('Authorization', authHeaderFor(userA));
    expect(res.status).toBe(200);

    const aCount = await request(app).get('/api/notifications/unread-count').set('Authorization', authHeaderFor(userA));
    const bCount = await request(app).get('/api/notifications/unread-count').set('Authorization', authHeaderFor(userB));
    expect(aCount.body.data.count).toBe(0);
    expect(bCount.body.data.count).toBe(1);
  });

  test('a request without a token is rejected', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});

describe('Notification preferences', () => {
  test('a user can read and update their own notification preferences', async () => {
    const org = await createOrganization();
    const user = await createUser(org._id, { role: 'EMPLOYEE' });

    const initial = await request(app).get('/api/users/me/notification-preferences').set('Authorization', authHeaderFor(user));
    expect(initial.status).toBe(200);

    const updated = await request(app)
      .patch('/api/users/me/notification-preferences')
      .set('Authorization', authHeaderFor(user))
      .send({ ASSET: false, NOT_A_REAL_CATEGORY: false });

    expect(updated.status).toBe(200);
    expect(updated.body.data.ASSET).toBe(false);
    expect(updated.body.data.NOT_A_REAL_CATEGORY).toBeUndefined();
  });

  test('disabling a category prevents new notifications of that category from being created', async () => {
    const org = await createOrganization();
    const user = await createUser(org._id, { role: 'EMPLOYEE' });

    await request(app)
      .patch('/api/users/me/notification-preferences')
      .set('Authorization', authHeaderFor(user))
      .send({ ASSET: false });

    const result = await seedNotification(org, user);
    expect(result).toBeNull();

    const count = await request(app).get('/api/notifications/unread-count').set('Authorization', authHeaderFor(user));
    expect(count.body.data.count).toBe(0);
  });
});
