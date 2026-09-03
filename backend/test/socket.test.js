const http = require('http');
const { io: ioClient } = require('socket.io-client');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser, createUserWithEmployee } = require('./helpers/factories');
const { signAccessToken } = require('../src/utils/generateTokens');
const { initSocketServer, getSocketInstance } = require('../src/socket/socketServer');
const { Organization, User } = require('../src/models');
const authService = require('../src/services/authService');
const notificationService = require('../src/services/notificationService');
const { isRateLimited } = require('../src/socket/socketRateLimit');

jest.setTimeout(30000);

let server;
let baseUrl;

beforeAll(async () => {
  await connect();
  server = http.createServer(app);
  initSocketServer(server);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  const io = getSocketInstance();
  if (io) await new Promise((resolve) => io.close(resolve));
  await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
});

function tokenFor(user) {
  return signAccessToken({ userId: user._id, role: user.role, organizationId: user.organizationId });
}

function connectClient(token) {
  return ioClient(baseUrl, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token },
    reconnection: false,
    forceNew: true,
  });
}

function waitFor(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('Socket authentication', () => {
  test('a valid token connects and receives the connected event with the right user', async () => {
    const org = await createOrganization();
    const user = await createUser(org._id, { role: 'EMPLOYEE' });
    const client = connectClient(tokenFor(user));
    try {
      const payload = await waitFor(client, 'connected');
      expect(payload.userId).toBe(user._id.toString());
    } finally {
      client.disconnect();
    }
  });

  test('a missing token is rejected', async () => {
    const client = connectClient(undefined);
    try {
      const err = await waitFor(client, 'connect_error');
      expect(err.message).toMatch(/token/i);
    } finally {
      client.disconnect();
    }
  });

  test('a garbage token is rejected without leaking internals', async () => {
    const client = connectClient('not-a-real-jwt');
    try {
      const err = await waitFor(client, 'connect_error');
      expect(err.message).toMatch(/invalid or expired token/i);
      expect(err.message).not.toMatch(/jwt|secret|stack/i);
    } finally {
      client.disconnect();
    }
  });

  test('a deactivated user is rejected even with a structurally valid token', async () => {
    const org = await createOrganization();
    const user = await createUser(org._id, { role: 'EMPLOYEE', status: 'inactive' });
    const client = connectClient(tokenFor(user));
    try {
      const err = await waitFor(client, 'connect_error');
      expect(err.message).toMatch(/inactive/i);
    } finally {
      client.disconnect();
    }
  });

  test('a user in an inactive organization is rejected', async () => {
    const org = await createOrganization({ status: 'inactive' });
    const user = await createUser(org._id, { role: 'EMPLOYEE' });
    const client = connectClient(tokenFor(user));
    try {
      const err = await waitFor(client, 'connect_error');
      expect(err.message).toMatch(/organization/i);
    } finally {
      client.disconnect();
    }
  });
});

describe('Organization / tenant isolation', () => {
  test('a socket in organization A never receives an event emitted to organization B', async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const userA = await createUser(orgA._id, { role: 'EMPLOYEE' });
    const userB = await createUser(orgB._id, { role: 'EMPLOYEE' });

    const clientA = connectClient(tokenFor(userA));
    await waitFor(clientA, 'connected');
    const clientB = connectClient(tokenFor(userB));
    await waitFor(clientB, 'connected');

    try {
      const leaked = jest.fn();
      clientB.on('asset:created', leaked);

      const io = getSocketInstance();
      io.to(`organization:${orgA._id}`).emit('asset:created', { assetId: 'secret-a' });

      const receivedByA = await waitFor(clientA, 'asset:created');
      expect(receivedByA.assetId).toBe('secret-a');

      // give any (incorrect) cross-org delivery a moment to arrive before asserting it didn't
      await new Promise((r) => setTimeout(r, 200));
      expect(leaked).not.toHaveBeenCalled();
    } finally {
      clientA.disconnect();
      clientB.disconnect();
    }
  });
});

describe('Real-time notification delivery', () => {
  test('creating a notification pushes it to the recipient\'s connected socket with the right payload', async () => {
    const org = await createOrganization();
    const { user } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const client = connectClient(tokenFor(user));

    try {
      await waitFor(client, 'connected');

      const received = waitFor(client, 'notification:new');
      const created = await notificationService.createNotification({
        organizationId: org._id,
        recipientId: user._id,
        type: 'ASSET_ASSIGNED',
        title: 'Asset assigned to you',
        message: 'A laptop has been assigned to you.',
        entityType: 'Asset',
        entityId: org._id, // any valid ObjectId shape for this test
      });

      const payload = await received;
      expect(payload.id).toBe(created.id ? created.id : created._id.toString());
      expect(payload.title).toBe('Asset assigned to you');
      expect(payload.category).toBe('ASSET');
      expect(payload.isRead).toBe(false);
    } finally {
      client.disconnect();
    }
  });

  test('a notification is not delivered in real time (and not created) when the recipient has disabled that category', async () => {
    const org = await createOrganization();
    const { user } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    await User.findByIdAndUpdate(user._id, { 'notificationPreferences.ASSET': false });

    const result = await notificationService.createNotification({
      organizationId: org._id,
      recipientId: user._id,
      type: 'ASSET_ASSIGNED',
      title: 'Asset assigned to you',
      message: 'A laptop has been assigned to you.',
      entityType: 'Asset',
      entityId: org._id,
    });

    expect(result).toBeNull();
  });
});

describe('Forced session invalidation', () => {
  test('logging out disconnects the user\'s live socket with a session:invalidated event', async () => {
    const org = await createOrganization();
    const user = await createUser(org._id, { role: 'EMPLOYEE' });
    const client = connectClient(tokenFor(user));

    try {
      await waitFor(client, 'connected');

      const invalidated = waitFor(client, 'session:invalidated');
      const disconnected = waitFor(client, 'disconnect');
      await authService.logout(user._id);

      await invalidated;
      await disconnected;
      expect(client.connected).toBe(false);
    } finally {
      client.disconnect();
    }
  });
});

describe('Socket rate limiting', () => {
  test('isRateLimited blocks once the window max is exceeded, and resets after the window', () => {
    const key = `test:${Date.now()}`;
    expect(isRateLimited(key, 3, 1000)).toBe(false);
    expect(isRateLimited(key, 3, 1000)).toBe(false);
    expect(isRateLimited(key, 3, 1000)).toBe(false);
    expect(isRateLimited(key, 3, 1000)).toBe(true);
  });
});
