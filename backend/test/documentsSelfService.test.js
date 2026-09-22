const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser, createUserWithEmployee, authHeaderFor } = require('./helpers/factories');

jest.setTimeout(30000);

// A minimal valid PDF (the file-validation layer checks the real magic
// bytes, not just the declared extension/MIME type).
const PDF_BUFFER = Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

const storageRoot = process.env.DOCUMENT_STORAGE_ROOT || path.join(process.cwd(), 'storage');
const orgIdsToClean = [];

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
  // Only remove the per-org subtrees this suite created — never touch any
  // other organization's uploaded files under the shared storage root.
  for (const orgId of orgIdsToClean) {
    await fs.promises.rm(path.join(storageRoot, 'documents', orgId), { recursive: true, force: true });
  }
});

async function setupWithDocument() {
  const org = await createOrganization();
  orgIdsToClean.push(org._id.toString());
  const hrAdmin = await createUser(org._id, { role: 'HR_ADMIN' });
  const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });

  const category = (await request(app)
    .post('/api/document-categories')
    .set('Authorization', authHeaderFor(hrAdmin))
    .send({ name: 'Identity Documents' })).body.data;

  const uploadRes = await request(app)
    .post('/api/documents')
    .set('Authorization', authHeaderFor(hrAdmin))
    .field('categoryId', category.id)
    .field('title', 'PAN Card')
    .field('employeeId', employee._id.toString())
    .attach('file', PDF_BUFFER, { filename: 'pan.pdf', contentType: 'application/pdf' });

  return { org, hrAdmin, employeeUser, employee, document: uploadRes.body.data };
}

describe('Documents — employee self-service', () => {
  test('an employee can list their own documents via /my', async () => {
    const { employeeUser } = await setupWithDocument();
    const res = await request(app).get('/api/documents/my').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('PAN Card');
  });

  test('an employee can view and download their own document', async () => {
    const { employeeUser, document } = await setupWithDocument();

    const details = await request(app).get(`/api/documents/${document.id}`).set('Authorization', authHeaderFor(employeeUser));
    expect(details.status).toBe(200);

    const download = await request(app).get(`/api/documents/${document.id}/download`).set('Authorization', authHeaderFor(employeeUser));
    expect(download.status).toBe(200);
    expect(download.headers['content-disposition']).toContain('attachment');

    const preview = await request(app).get(`/api/documents/${document.id}/preview`).set('Authorization', authHeaderFor(employeeUser));
    expect(preview.status).toBe(200);
    expect(preview.headers['content-disposition']).toContain('inline');
  });

  test('an employee cannot view, download, or preview another employee\'s document (IDOR)', async () => {
    const { org, document } = await setupWithDocument();
    const { user: otherUser } = await createUserWithEmployee(org._id, { joiningDate: new Date('2025-01-01') });

    const details = await request(app).get(`/api/documents/${document.id}`).set('Authorization', authHeaderFor(otherUser));
    expect(details.status).toBe(403);

    const download = await request(app).get(`/api/documents/${document.id}/download`).set('Authorization', authHeaderFor(otherUser));
    expect(download.status).toBe(403);

    const preview = await request(app).get(`/api/documents/${document.id}/preview`).set('Authorization', authHeaderFor(otherUser));
    expect(preview.status).toBe(403);
  });

  test('an employee cannot access a document from another organization', async () => {
    const { document } = await setupWithDocument();
    const orgB = await createOrganization();
    const { user: orgBUser } = await createUserWithEmployee(orgB._id, { joiningDate: new Date('2025-01-01') });

    const res = await request(app).get(`/api/documents/${document.id}`).set('Authorization', authHeaderFor(orgBUser));
    expect(res.status).toBe(404);
  });

  test('invalid document IDs are handled safely, not with a 500', async () => {
    const { employeeUser } = await setupWithDocument();
    const res = await request(app).get('/api/documents/not-a-valid-id').set('Authorization', authHeaderFor(employeeUser));
    expect(res.status).toBe(400);
  });

  test('unauthenticated document access is rejected', async () => {
    const { document } = await setupWithDocument();
    const res = await request(app).get(`/api/documents/${document.id}/download`);
    expect(res.status).toBe(401);
  });

  test('HR admin can still view any employee\'s document in their organization', async () => {
    const { hrAdmin, document } = await setupWithDocument();
    const res = await request(app).get(`/api/documents/${document.id}`).set('Authorization', authHeaderFor(hrAdmin));
    expect(res.status).toBe(200);
  });

  test('a user with no linked employee record gets a clean 400 from /my, not a 500', async () => {
    const org = await createOrganization();
    orgIdsToClean.push(org._id.toString());
    const userWithoutEmployee = await createUser(org._id, { role: 'HR_ADMIN' });
    const res = await request(app).get('/api/documents/my').set('Authorization', authHeaderFor(userWithoutEmployee));
    expect(res.status).toBe(400);
  });
});
