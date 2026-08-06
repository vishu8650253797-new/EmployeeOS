const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test' });
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

const request = require('supertest');
const app = require('../src/app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/db');
const { createOrganization, createUser, createUserWithEmployee, authHeaderFor } = require('./helpers/factories');
const {
  OnboardingProcess, DocumentRequest, DocumentCategory, Employee, AuditLog,
  Candidate, JobOpening, JobApplication,
} = require('../src/models');

jest.setTimeout(30000);

beforeAll(async () => {
  await connect();
});

beforeEach(() => {
  process.env.SMTP_HOST = 'smtp.test.local';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'test@test.local';
  process.env.SMTP_PASS = 'testpass';
  mockSendMail.mockClear();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

async function startProcess(hr, employee, overrides = {}) {
  const res = await request(app)
    .post('/api/onboarding/processes')
    .set('Authorization', authHeaderFor(hr))
    .send({ employeeId: employee._id.toString(), type: 'ONBOARDING', ...overrides });
  return res;
}

describe('Welcome email on process creation', () => {
  test('sends a welcome email to the new hire when SMTP is configured', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const res = await startProcess(hr, employee);

    expect(res.status).toBe(201);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe(employee.email);
    expect(call.subject).toMatch(/welcome/i);
  });

  test('process creation still succeeds when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const res = await startProcess(hr, employee);

    expect(res.status).toBe(201);
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});

describe('Joining date confirmation', () => {
  test('confirms the joining date, syncs the employee record, and audits it', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const created = await startProcess(hr, employee);
    const newDate = '2027-03-01';

    const res = await request(app)
      .patch(`/api/onboarding/processes/${created.body.data._id}/joining-date`)
      .set('Authorization', authHeaderFor(hr))
      .send({ joiningDate: newDate });

    expect(res.status).toBe(200);
    expect(res.body.data.joiningDateConfirmed).toBe(true);
    expect(new Date(res.body.data.startDate).toISOString().slice(0, 10)).toBe(newDate);

    const updatedEmployee = await Employee.findById(employee._id).lean();
    expect(new Date(updatedEmployee.joiningDate).toISOString().slice(0, 10)).toBe(newDate);

    const logs = await AuditLog.find({ entityType: 'OnboardingProcess', action: 'JOINING_DATE_CONFIRMED' });
    expect(logs).toHaveLength(1);

    expect(mockSendMail).toHaveBeenCalledTimes(2); // welcome + joining-date-confirmed
  });

  test('syncToEmployee: false leaves the Employee record untouched', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE', joiningDate: new Date('2026-01-01') });
    const created = await startProcess(hr, employee);

    await request(app)
      .patch(`/api/onboarding/processes/${created.body.data._id}/joining-date`)
      .set('Authorization', authHeaderFor(hr))
      .send({ joiningDate: '2027-03-01', syncToEmployee: false });

    const updatedEmployee = await Employee.findById(employee._id).lean();
    expect(new Date(updatedEmployee.joiningDate).toISOString().slice(0, 10)).toBe('2026-01-01');
  });

  test('cannot confirm joining date on a cancelled process', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const created = await startProcess(hr, employee);
    await request(app)
      .patch(`/api/onboarding/processes/${created.body.data._id}/cancel`)
      .set('Authorization', authHeaderFor(hr))
      .send({});

    const res = await request(app)
      .patch(`/api/onboarding/processes/${created.body.data._id}/joining-date`)
      .set('Authorization', authHeaderFor(hr))
      .send({ joiningDate: '2027-03-01' });

    expect(res.status).toBe(400);
  });

  test('a plain employee cannot confirm a joining date', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const employeeUser = await createUser(org._id, { role: 'EMPLOYEE' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const created = await startProcess(hr, employee);

    const res = await request(app)
      .patch(`/api/onboarding/processes/${created.body.data._id}/joining-date`)
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ joiningDate: '2027-03-01' });

    expect(res.status).toBe(403);
  });
});

describe('Required document collection', () => {
  async function createTemplateWithDocs(org, hr, category) {
    const res = await request(app)
      .post('/api/onboarding-templates')
      .set('Authorization', authHeaderFor(hr))
      .send({
        name: 'Pre-boarding docs',
        type: 'ONBOARDING',
        tasks: [{ title: 'Sign offer letter' }],
        requiredDocuments: [
          { categoryId: category._id.toString(), title: 'PAN card', priority: 'HIGH', dueOffsetDays: 3 },
        ],
      });
    return res.body.data;
  }

  test('creates a document request per configured document and links it to the process', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const category = await DocumentCategory.create({ organizationId: org._id, name: 'Tax Document', code: 'TAX_DOCUMENT', createdBy: hr._id });
    const template = await createTemplateWithDocs(org, hr, category);
    const created = await startProcess(hr, employee, { templateId: template.id });

    const res = await request(app)
      .post(`/api/onboarding/processes/${created.body.data._id}/document-collection`)
      .set('Authorization', authHeaderFor(hr))
      .send({});

    expect(res.status).toBe(200);
    const requests = await DocumentRequest.find({ processId: created.body.data._id }).lean();
    expect(requests).toHaveLength(1);
    expect(requests[0].categoryId.toString()).toBe(category._id.toString());
    expect(requests[0].priority).toBe('HIGH');

    const process = await OnboardingProcess.findById(created.body.data._id).lean();
    const expectedDue = new Date(process.startDate);
    expectedDue.setDate(expectedDue.getDate() + 3);
    expect(new Date(requests[0].dueDate).toISOString().slice(0, 10)).toBe(expectedDue.toISOString().slice(0, 10));
  });

  test('re-triggering document collection does not create duplicates', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const category = await DocumentCategory.create({ organizationId: org._id, name: 'Tax Document', code: 'TAX_DOCUMENT', createdBy: hr._id });
    const template = await createTemplateWithDocs(org, hr, category);
    const created = await startProcess(hr, employee, { templateId: template.id });

    await request(app)
      .post(`/api/onboarding/processes/${created.body.data._id}/document-collection`)
      .set('Authorization', authHeaderFor(hr))
      .send({});
    await request(app)
      .post(`/api/onboarding/processes/${created.body.data._id}/document-collection`)
      .set('Authorization', authHeaderFor(hr))
      .send({});

    const requests = await DocumentRequest.find({ processId: created.body.data._id }).lean();
    expect(requests).toHaveLength(1);
  });

  test('returns 400 when there are no required documents configured', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const created = await startProcess(hr, employee);

    const res = await request(app)
      .post(`/api/onboarding/processes/${created.body.data._id}/document-collection`)
      .set('Authorization', authHeaderFor(hr))
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('Bank details', () => {
  test('an employee can read and update their own bank details', async () => {
    const org = await createOrganization();
    const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const putRes = await request(app)
      .put(`/api/employees/${employee._id}/bank-details`)
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ accountHolderName: 'Jane Doe', accountNumber: '1234567890', bankName: 'First Bank', routingCode: 'ABCD0123' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.data.accountNumber).toBe('1234567890');

    const getRes = await request(app)
      .get(`/api/employees/${employee._id}/bank-details`)
      .set('Authorization', authHeaderFor(employeeUser));
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.accountNumber).toBe('1234567890');
    expect(getRes.body.data.bankName).toBe('First Bank');
  });

  test('a stranger cannot read or write another employee\'s bank details', async () => {
    const org = await createOrganization();
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const stranger = await createUser(org._id, { role: 'EMPLOYEE' });

    const getRes = await request(app)
      .get(`/api/employees/${employee._id}/bank-details`)
      .set('Authorization', authHeaderFor(stranger));
    expect(getRes.status).toBe(403);

    const putRes = await request(app)
      .put(`/api/employees/${employee._id}/bank-details`)
      .set('Authorization', authHeaderFor(stranger))
      .send({ accountNumber: '000' });
    expect(putRes.status).toBe(403);
  });

  test('the account number is hidden from the generic employee fetch', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    await request(app)
      .put(`/api/employees/${employee._id}/bank-details`)
      .set('Authorization', authHeaderFor(hr))
      .send({ accountNumber: 'SECRET123' });

    const res = await request(app)
      .get(`/api/employees/${employee._id}`)
      .set('Authorization', authHeaderFor(hr));

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body.data)).not.toContain('SECRET123');
  });

  test('audit metadata records field names, never raw values', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    await request(app)
      .put(`/api/employees/${employee._id}/bank-details`)
      .set('Authorization', authHeaderFor(hr))
      .send({ accountNumber: 'SECRET456', bankName: 'Vault Bank' });

    const logs = await AuditLog.find({ action: 'EMPLOYEE_BANK_DETAILS_UPDATED', entityId: employee._id }).lean();
    expect(logs).toHaveLength(1);
    expect(logs[0].metadata.fieldsChanged.sort()).toEqual(['accountNumber', 'bankName'].sort());
    expect(JSON.stringify(logs[0].metadata)).not.toContain('SECRET456');
  });
});

describe('Tax info', () => {
  test('an employee can read and update their own tax info, hidden from generic fetch', async () => {
    const org = await createOrganization();
    const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const putRes = await request(app)
      .put(`/api/employees/${employee._id}/tax-info`)
      .set('Authorization', authHeaderFor(employeeUser))
      .send({ taxId: 'PAN12345', taxCountry: 'IN' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.data.taxId).toBe('PAN12345');

    const genericRes = await request(app)
      .get(`/api/employees/${employee._id}`)
      .set('Authorization', authHeaderFor(employeeUser));
    expect(JSON.stringify(genericRes.body.data)).not.toContain('PAN12345');
  });

  test('a stranger cannot access another employee\'s tax info', async () => {
    const org = await createOrganization();
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const stranger = await createUser(org._id, { role: 'EMPLOYEE' });

    const res = await request(app)
      .get(`/api/employees/${employee._id}/tax-info`)
      .set('Authorization', authHeaderFor(stranger));
    expect(res.status).toBe(403);
  });
});

describe('Profile photo', () => {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);

  test('uploads a valid photo and streams it back', async () => {
    const org = await createOrganization();
    const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const uploadRes = await request(app)
      .patch(`/api/employees/${employee._id}/photo`)
      .set('Authorization', authHeaderFor(employeeUser))
      .attach('photo', PNG_SIGNATURE, 'photo.png');

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.data.avatar).toBe(`/api/employees/${employee._id}/photo`);

    const streamRes = await request(app)
      .get(`/api/employees/${employee._id}/photo`)
      .set('Authorization', authHeaderFor(employeeUser));
    expect(streamRes.status).toBe(200);
    expect(streamRes.headers['content-type']).toBe('image/png');
    expect(Buffer.from(streamRes.body)).toEqual(PNG_SIGNATURE);
  });

  test('rejects a file whose content does not match its declared extension', async () => {
    const org = await createOrganization();
    const { user: employeeUser, employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });

    const res = await request(app)
      .patch(`/api/employees/${employee._id}/photo`)
      .set('Authorization', authHeaderFor(employeeUser))
      .attach('photo', Buffer.from('not a real png'), 'photo.png');

    expect(res.status).toBe(400);
  });

  test('a stranger cannot upload a photo for another employee', async () => {
    const org = await createOrganization();
    const { employee } = await createUserWithEmployee(org._id, { role: 'EMPLOYEE' });
    const stranger = await createUser(org._id, { role: 'EMPLOYEE' });

    const res = await request(app)
      .patch(`/api/employees/${employee._id}/photo`)
      .set('Authorization', authHeaderFor(stranger))
      .attach('photo', PNG_SIGNATURE, 'photo.png');

    expect(res.status).toBe(403);
  });
});

describe('Offer email hooks', () => {
  async function createSentOffer(org, hr) {
    const candidate = await Candidate.create({ organizationId: org._id, firstName: 'Cand', lastName: 'Idate', email: 'candidate@example.com' });
    const job = await JobOpening.create({ organizationId: org._id, title: 'Engineer', slug: 'engineer', createdBy: hr._id });
    const application = await JobApplication.create({ organizationId: org._id, jobId: job._id, candidateId: candidate._id });

    const createRes = await request(app)
      .post('/api/recruitment/offers')
      .set('Authorization', authHeaderFor(hr))
      .send({ applicationId: application._id.toString(), salary: 100000 });

    const sendRes = await request(app)
      .put(`/api/recruitment/offers/${createRes.body.data.id}/send`)
      .set('Authorization', authHeaderFor(hr));

    const token = sendRes.body.data.publicResponseUrl.split('/').pop();
    return { candidate, job, application, sendRes, token };
  }

  test('sending an offer emails the candidate', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });

    const { sendRes } = await createSentOffer(org, hr);

    expect(sendRes.status).toBe(200);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0].to).toBe('candidate@example.com');
  });

  test('accepting an offer publicly sends a response confirmation email', async () => {
    const org = await createOrganization();
    const hr = await createUser(org._id, { role: 'HR_ADMIN' });
    const { token } = await createSentOffer(org, hr);
    mockSendMail.mockClear();

    const res = await request(app).put(`/api/public/offers/${token}/accept`);

    expect(res.status).toBe(200);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('candidate@example.com');
    expect(call.subject).toMatch(/accepted/i);
  });
});
