// Initialize a persistent key only after proving no stored authenticator depends on an old one.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { key } = require('../src/services/totp.service');
const envFile = path.resolve(process.env.AUTH_ENV_FILE || path.join(__dirname, '../.env'));
const lockFile = envFile + '.2fa.lock';
const temporaryFile = envFile + '.2fa.tmp-' + process.pid;
async function main() {
  let locked = false;
  try {
    fs.closeSync(fs.openSync(lockFile, 'wx', 0o600));
    locked = true;
    const original = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
    const parsed = dotenv.parse(original);
    dotenv.config({ path: envFile, quiet: true });
    if (process.env.TOTP_ENCRYPTION_KEY || parsed.TOTP_ENCRYPTION_KEY) {
      key(); // Invalid existing material must never be silently replaced.
      console.log('TOTP key is configured. No key was changed. Restart the API after changing its environment.');
      return;
    }
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required to check existing authenticator enrollments before creating a key.');
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    const existing = await mongoose.connection.collection('users').findOne({ $or: [
      { 'twoFactor.secret': { $exists: true, $nin: [null, ''] } },
      { 'twoFactor.pendingSecret': { $exists: true, $nin: [null, ''] } },
      { 'twoFactor.enabled': true },
    ] }, { projection: { _id: 1 } });
    if (existing) throw new Error('Stored authenticators exist. Restore the ORIGINAL TOTP_ENCRYPTION_KEY from your secret store or backup. Refusing to generate a replacement.');
    const current = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
    if (current !== original) throw new Error('Environment file changed during the check. No key written; retry.');
    const secret = crypto.randomBytes(32).toString('base64');
    // Remove only empty declarations; keep every other environment setting unchanged.
    const cleaned = original.replace(/^(?:export\s+)?TOTP_ENCRYPTION_KEY\s*=\s*(?:""|'')?\s*(?:#.*)?$/gm, '');
    fs.writeFileSync(temporaryFile, cleaned.replace(/\s*$/, '') + '\nTOTP_ENCRYPTION_KEY=' + secret + '\n', { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporaryFile, envFile);
    console.log('Created a persistent TOTP key in the backend environment file (mode 0600). Key value was not printed.');
    console.log('Back up this key securely and restart the API. All backend replicas must use the same key. Do not commit the environment file.');
  } finally {
    await mongoose.disconnect();
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
    if (locked) fs.unlinkSync(lockFile);
  }
}
main().catch(error => {
  // Never echo connection URIs, user documents or secrets from driver errors.
  const safe = /^(MONGO_URI is required|Stored authenticators exist|Environment file changed|Authenticator service is not configured)/.test(error.message);
  console.error(safe ? error.message : 'Configuration failed. Check database connectivity, environment-file permissions, and that no other configuration command is running. No secret values are logged.');
  process.exitCode = 1;
});
