/**
 * 🌱 Seeder entry point.
 *
 *   npm run seed:prod            production reference data (safe, idempotent)
 *   npm run seed:test            wipe + full test data set   (dev/QA only)
 *   npm run seed:test -- --users wipe + users/teams only     (dev/QA only)
 *
 * Equivalent long form: `npm run seed -- prod` / `npm run seed -- test`.
 * See seeder/README.md for details.
 */
require('dotenv').config();
const config = require('../src/config/env');
const { COLORS, log, rule, connect, disconnect } = require('./lib/common');

const args = process.argv.slice(2);
const mode = (args.find(a => !a.startsWith('-')) || '').toLowerCase();
const usersOnly = args.includes('--users');

function usage() {
  console.log(`
Usage:
  npm run seed:prod              Categories, sub-categories, badges and the admin
                                 account (from ADMIN_EMAIL / ADMIN_PASSWORD).
                                 Safe on production — never deletes anything.
  npm run seed:test              WIPES the database, then loads the full test set
                                 (users, courses, quizzes, enrollments, reviews…).
  npm run seed:test -- --users   WIPES, then loads users and teams only.
`);
}

async function main() {
  if (mode !== 'prod' && mode !== 'test') {
    usage();
    process.exitCode = mode ? 1 : 0;
    return;
  }

  rule();
  log(COLORS.cyan, mode === 'prod'
    ? '🏭 PRODUCTION SEED — reference data only'
    : `🧪 TEST SEED — ${usersOnly ? 'users & teams only' : 'full demo data set'}`);
  log(COLORS.dim, `NODE_ENV=${config.nodeEnv}`);
  rule();

  if (mode === 'test' && config.prodLike) {
    log(COLORS.red, `\n🚫 Refusing to load TEST data: NODE_ENV=${config.nodeEnv}.`);
    log(COLORS.red, '   The test seed wipes the database. Use `npm run seed:prod` on production/preprod.');
    process.exitCode = 1;
    return;
  }

  try {
    await connect();

    if (mode === 'prod') {
      await require('./production').run();
      rule();
      log(COLORS.green, '✅ PRODUCTION SEED COMPLETE');
      rule();
    } else {
      const testSeed = require('./test');
      await testSeed.run({ usersOnly });
      rule();
      log(COLORS.green, '✅ TEST SEED COMPLETE\n');
      testSeed.printAccounts();
      rule();
    }
  } catch (error) {
    log(COLORS.red, `\n❌ Seed failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await disconnect().catch(() => {});
  }
}

main();
