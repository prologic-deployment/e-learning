/**
 * 🏭 PRODUCTION SEED — reference data every environment needs.
 *
 *   npm run seed:prod
 *
 * What it does (idempotent — safe to run on every deploy):
 *   1. Upserts course categories & sub-categories (seeder/data/categories.js)
 *   2. Creates the badge definitions (initBadges)
 *   3. Creates the first admin account from .env if it does not exist yet
 *
 * What it never does: delete or overwrite data, reset passwords, or create
 * test users/courses. Allowed in every NODE_ENV, including production.
 *
 * Admin account variables (back/.env):
 *   ADMIN_EMAIL=admin@yourcompany.tn      required to create the admin
 *   ADMIN_PASSWORD=...                    ≥ 8 chars, 1 uppercase, 1 digit
 *   ADMIN_FIRSTNAME=Platform              optional
 *   ADMIN_LASTNAME=Admin                  optional
 *   ADMIN_DATE_OF_BIRTH=1990-01-01        optional
 *   ADMIN_PHONE=+216...                   optional
 */
const User = require('../src/models/User');
const Badge = require('../src/models/Badge');
const { initBadges } = require('../src/services/badge.service');
const { COLORS, log, step, count, seedCategories } = require('./lib/common');

async function seedBadges() {
  log(COLORS.cyan, '\n🏅 Seeding badge definitions...');
  await initBadges();
  count('badges', await Badge.countDocuments());
}

async function ensureAdmin() {
  log(COLORS.cyan, '\n🔐 Checking the admin account...');
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email) {
    const anyAdmin = await User.exists({ role: 'admin' });
    if (anyAdmin) {
      step('ADMIN_EMAIL not set — an admin already exists, nothing to do');
      return;
    }
    throw new Error(
      'No admin account exists and ADMIN_EMAIL / ADMIN_PASSWORD are not set in back/.env. ' +
      'Set them and run `npm run seed:prod` again.'
    );
  }

  const existing = await User.findOne({ email });
  if (existing) {
    const roles = Array.isArray(existing.role) ? existing.role : [existing.role];
    step(`${email} already exists (role: ${roles.join(', ')}) — left unchanged`);
    if (!roles.includes('admin')) {
      log(COLORS.yellow, `  ⚠️  ${email} is not an admin. Change it from the admin dashboard if intended.`);
    }
    return;
  }

  if (!password) {
    throw new Error(`ADMIN_PASSWORD is required to create the admin account ${email}.`);
  }

  await User.create({
    firstname: process.env.ADMIN_FIRSTNAME || 'Platform',
    lastname: process.env.ADMIN_LASTNAME || 'Admin',
    email,
    password,                                   // hashed by the User pre-save hook
    dateOfBirth: new Date(process.env.ADMIN_DATE_OF_BIRTH || '1990-01-01'),
    phone: process.env.ADMIN_PHONE || undefined,
    role: ['admin'],
    isActive: true
  });
  count('admin created', email);
  log(COLORS.dim, '  Remove ADMIN_PASSWORD from .env once you have signed in and changed it.');
}

async function run() {
  await seedCategories();
  await seedBadges();
  await ensureAdmin();
}

module.exports = { run, seedBadges };
