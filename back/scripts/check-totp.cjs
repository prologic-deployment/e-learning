require('dotenv').config({path:process.env.AUTH_ENV_FILE || require('node:path').join(__dirname,'../.env'),quiet:true});
try {
  require('../src/services/totp.service').key();
  console.log('PASS: TOTP_ENCRYPTION_KEY is a valid 32-byte base64 key in this environment. This does not prove it matches existing enrollments.');
} catch {
  console.error('FAIL: TOTP_ENCRYPTION_KEY is missing or invalid. Set a persistent 32-byte base64 key and restart the API. If authenticators already exist, restore their original key; do not generate a new one.');
  process.exitCode = 1;
}
