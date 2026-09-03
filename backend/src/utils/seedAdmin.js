const { Organization, User } = require('../models');

// Dev-only bootstrap, gated by SEED_ADMIN (documented in .env.example, default off).
// Two invariants that must never regress:
//  1. Never runs unless explicitly opted into via SEED_ADMIN=true.
//  2. Never touches an already-existing account's password — a fresh deploy
//     creates the seed admin once; every subsequent restart is a no-op for it.
//     Silently resetting the password on every restart would let anyone who
//     changed it for security get quietly reverted to a known default.
async function seedAdmin() {
  if (process.env.SEED_ADMIN !== 'true') return;

  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@employeeos.io').toLowerCase().trim();
  const firstName = process.env.SEED_ADMIN_FIRST_NAME || 'Admin';
  const lastName = process.env.SEED_ADMIN_LAST_NAME || 'User';

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Seed admin already exists — leaving it untouched: ${email}`);
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD || 'Password123';

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

  console.log(`Seeded admin account: ${email} / ${password} — change this password after first login.`);
}

module.exports = seedAdmin;
