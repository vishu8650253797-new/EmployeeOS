const { Organization, User } = require('../models');

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@employeeos.io').toLowerCase().trim();
  const password = 'Password123';
  const firstName = process.env.SEED_ADMIN_FIRST_NAME || 'Admin';
  const lastName = process.env.SEED_ADMIN_LAST_NAME || 'User';

  const existing = await User.findOne({ email });
  if (existing) {
    existing.password = password;
    existing.markModified('password');
    await existing.save();
    console.log(`Seed admin already exists, password updated: ${email} / ${password}`);
    return;
  }

  const organization = await Organization.create({
    name: 'EmployeeOS',
    slug: `employeeos-${Date.now()}`,
    status: 'active',
  });

  await User.create({
    organizationId: organization._id,
    firstName,
    lastName,
    email,
    password,
    role: 'SUPER_ADMIN',
    department: 'Administration',
    jobTitle: 'Super Admin',
    status: 'active',
  });

  console.log(`Seeded admin account: ${email} / ${password}`);
}

module.exports = seedAdmin;
