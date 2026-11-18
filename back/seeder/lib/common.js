/**
 * Shared seeder helpers: console output, DB connection, and the
 * production-safe reference data (categories) used by both seed modes.
 */
const mongoose = require('mongoose');
const Category = require('../../src/models/Category');
const CATEGORIES = require('../data/categories');

const COLORS = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m'
};
const log = (c, m) => console.log(`${c}${m}${COLORS.reset}`);
const step = (m) => log(COLORS.cyan, `  ↳ ${m}`);
const count = (name, n) => log(COLORS.green, `  ✅ ${name}: ${n}`);
const rule = () => console.log('═'.repeat(60));

async function connect() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set — add it to back/.env');
  }
  await mongoose.connect(process.env.MONGO_URI);
  log(COLORS.dim, `📦 Connected to MongoDB database "${mongoose.connection.name}"`);
}

async function disconnect() {
  await mongoose.connection.close();
}

/**
 * Upsert every category by name. Safe to re-run in production: existing
 * categories are updated in place, nothing is deleted, nothing duplicated.
 */
async function seedCategories() {
  log(COLORS.cyan, '\n🗂️  Seeding categories & sub-categories...');
  let created = 0, updated = 0;
  for (const def of CATEGORIES) {
    const res = await Category.updateOne(
      { name: def.name },
      { $set: def },
      { upsert: true, runValidators: true }
    );
    if (res.upsertedCount) created++; else updated++;
    step(`${def.name} — ${def.subcategories.length} sub-categories`);
  }
  count('categories', `${CATEGORIES.length} (${created} created, ${updated} updated)`);
}

module.exports = { COLORS, log, step, count, rule, connect, disconnect, seedCategories };
