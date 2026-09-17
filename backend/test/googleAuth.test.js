const request = require('supertest');

// Mock google-auth-library so the test never calls Google's real servers.
// Each test configures what the "verified token" payload looks like.
let mockPayload = null;
let mockShouldThrow = false;
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(async () => {
      if (mockShouldThrow) throw new Error('invalid token');
      return { getPayload: () => mockPayload };
    }),
  })),
}));

const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser } = require('./helpers/factories');
const { User, Organization } = require('../src/models');

jest.setTimeout(30000);

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
  mockPayload = null;
  mockShouldThrow = false;
});

afterAll(async () => {
  await closeDatabase();
});

function setPayload(overrides = {}) {
  mockPayload = {
    sub: 'google-sub-123',
    email: 'newperson@example.com',
    email_verified: true,
    given_name: 'New',
    family_name: 'Person',
    picture: 'https://example.com/pic.jpg',
    ...overrides,
  };
}

describe('POST /api/auth/google', () => {
  test('rejects a missing idToken', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    expect(res.status).toBe(400);
  });

  test('rejects an unverified Google email', async () => {
    setPayload({ email_verified: false });
    const res = await request(app).post('/api/auth/google').send({ idToken: 'fake' });
    expect(res.status).toBe(401);
  });

  test('rejects an invalid/unverifiable token', async () => {
    mockShouldThrow = true;
    const res = await request(app).post('/api/auth/google').send({ idToken: 'garbage' });
    expect(res.status).toBe(401);
  });

  test('creates a brand-new organization + SUPER_ADMIN user for a first-time signer', async () => {
    setPayload();
    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid' });

    expect(res.status).toBe(201);
    expect(res.body.isNewUser).toBe(true);
    expect(res.body.user.email).toBe('newperson@example.com');
    expect(res.body.user.role).toBe('SUPER_ADMIN');
    expect(res.body.accessToken).toBeTruthy();

    const user = await User.findOne({ email: 'newperson@example.com' }).select('+googleId +password');
    expect(user.googleId).toBe('google-sub-123');
    expect(user.authProvider).toBe('google');
    expect(user.password).toBeTruthy(); // a random placeholder was generated

    const org = await Organization.findById(user.organizationId);
    expect(org).toBeTruthy();
    expect(org.name).toBe("New's Organization");
  });

  test('a second sign-in with the same Google account logs in the existing user (no duplicate org)', async () => {
    setPayload();
    await request(app).post('/api/auth/google').send({ idToken: 'valid' });
    const secondRes = await request(app).post('/api/auth/google').send({ idToken: 'valid' });

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.isNewUser).toBe(false);
    expect(secondRes.body.user.email).toBe('newperson@example.com');

    const orgCount = await Organization.countDocuments({});
    expect(orgCount).toBe(1);
    const userCount = await User.countDocuments({ email: 'newperson@example.com' });
    expect(userCount).toBe(1);
  });

  test('links Google to an existing local (password-based) account with the same verified email, without touching the password', async () => {
    const org = await createOrganization();
    const localUser = await createUser(org._id, { email: 'existing@example.com', password: 'OriginalPass1!' });

    setPayload({ email: 'existing@example.com', sub: 'google-sub-existing' });
    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid' });

    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(false);
    expect(res.body.user._id).toBe(localUser._id.toString());

    // The original password still works — linking Google never touched it.
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'existing@example.com', password: 'OriginalPass1!' });
    expect(loginRes.status).toBe(200);
  });

  test('rejects sign-in for an inactive account', async () => {
    const org = await createOrganization();
    await createUser(org._id, { email: 'blocked@example.com', status: 'inactive' });

    setPayload({ email: 'blocked@example.com' });
    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid' });
    expect(res.status).toBe(403);
  });

  test('the issued access token grants access to protected routes', async () => {
    setPayload();
    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid' });
    const token = res.body.accessToken;

    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('newperson@example.com');
  });
});
