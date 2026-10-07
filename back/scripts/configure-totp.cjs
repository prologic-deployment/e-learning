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
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--replace-invalid')) throw new Error('Usage: npm run auth:configure -- [--replace-invalid]');
  const inheritedKey = Object.prototype.hasOwnProperty.call(process.env, 'TOTP_ENCRYPTION_KEY');
  let locked = false;
  try {
    fs.closeSync(fs.openSync(lockFile, 'wx', 0o600));
    locked = true;
    const original = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
    const parsed = dotenv.parse(original);
    dotenv.config({ path: envFile, quiet: true });
    if (inheritedKey || parsed.TOTP_ENCRYPTION_KEY) {
      try {
        key();
        console.log('TOTP key is configured. No key was changed. Restart the API after changing its environment.');
        return;
      } catch {
        if (inheritedKey) throw new Error('Invalid TOTP_ENCRYPTION_KEY in the process environment overrides the file. Restore the correct deployment secret, or remove the stale override in PowerShell with: Remove-Item Env:TOTP_ENCRYPTION_KEY. Then rerun this command. No file was changed.');
        if (!args.includes('--replace-invalid')) throw new Error('Invalid TOTP_ENCRYPTION_KEY in the backend environment file. If no authenticators exist, run: npm run auth:configure -- --replace-invalid. The command will check the database before replacing it. Otherwise restore the ORIGINAL key. No file was changed.');
      }
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
    // Remove empty or explicitly approved invalid declarations; preserve other settings.
    const cleaned = original.replace(/^(?:export[ \t]+)?TOTP_ENCRYPTION_KEY[ \t]*=[ \t]*(?:"[^"]*"|'[^']*'|`[^`]*`|[^\r\n]*)[^\r\n]*/gm, '');
    fs.writeFileSync(temporaryFile, cleaned.replace(/\s*$/, '') + '\nTOTP_ENCRYPTION_KEY=' + secret + '\n', { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporaryFile, envFile);
    console.log('Created a persistent TOTP key in the backend environment file. Key value was not printed. Restrict access with Windows file permissions or Unix mode 0600.');
    console.log('Back up this key securely and restart the API. All backend replicas must use the same key. Do not commit the environment file.');
  } finally {
    await mongoose.disconnect();
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
    if (locked) fs.unlinkSync(lockFile);
  }
}
main().catch(error => {
  // Never echo connection URIs, user documents or secrets from driver errors.
  const safe = /^(Usage:|Invalid TOTP_ENCRYPTION_KEY|MONGO_URI is required|Stored authenticators exist|Environment file changed|Authenticator service is not configured)/.test(error.message);
  console.error(safe ? error.message : 'Configuration failed. Check database connectivity, environment-file permissions, and that no other configuration command is running. No secret values are logged.');
  process.exitCode = 1;
});
