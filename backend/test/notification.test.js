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

  test('the isRead filter returns only matching notifications', async () => {
    const org = await createOrganization();
    const userA = await createUser(org._id, { role: 'EMPLOYEE' });
    const read = await seedNotification(org, userA, { title: 'Already read' });
    await seedNotification(org, userA, { title: 'Still unread' });
    await request(app).put(`/api/notifications/${read._id}/read`).set('Authorization', authHeaderFor(userA));

    const unreadRes = await request(app).get('/api/notifications?isRead=false').set('Authorization', authHeaderFor(userA));
    expect(unreadRes.body.data).toHaveLength(1);
    expect(unreadRes.body.data[0].title).toBe('Still unread');

    const readRes = await request(app).get('/api/notifications?isRead=true').set('Authorization', authHeaderFor(userA));
    expect(readRes.body.data).toHaveLength(1);
    expect(readRes.body.data[0].title).toBe('Already read');
  });

  test('an HrRequest notification is categorized as HR_REQUEST', async () => {
    const org = await createOrganization();
    const userA = await createUser(org._id, { role: 'EMPLOYEE' });
    const notification = await seedNotification(org, userA, {
      type: 'HR_REQUEST_CREATED', entityType: 'HrRequest', title: 'New HR request',
    });
    expect(notification.category).toBe('HR_REQUEST');
  });

  test('a user in another organization cannot see or mark-read a notification from a different org', async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const userA = await createUser(orgA._id, { role: 'EMPLOYEE' });
    const userB = await createUser(orgB._id, { role: 'EMPLOYEE' });
    const notification = await seedNotification(orgA, userA);

    const listRes = await request(app).get('/api/notifications').set('Authorization', authHeaderFor(userB));
    expect(listRes.body.data).toHaveLength(0);

    const readRes = await request(app)
      .put(`/api/notifications/${notification._id}/read`)
      .set('Authorization', authHeaderFor(userB));
    expect(readRes.status).toBe(404);
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
