const crypto = require('crypto');
const OTPAuth = require('otpauth');
const issuer = 'FormaPath';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function key() {
  const raw = process.env.TOTP_ENCRYPTION_KEY || '';
  if (!/^[A-Za-z0-9+/]{43}=$/.test(raw) || Buffer.from(raw, 'base64').length !== 32) {
    const err = new Error('Authenticator service is not configured. Contact your administrator.');
    err.status = 503; throw err;
  }
  return Buffer.from(raw, 'base64');
}
function encrypt(secret, userId) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(String(userId)));
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}
function decrypt(value, userId) {
  const [version, iv, tag, data] = value.split('.');
  if (version !== 'v1') throw new Error('Invalid authenticator ciphertext');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from(String(userId)));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
function totp(secret, email = '') {
  return new OTPAuth.TOTP({ issuer, label: email, algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
}
function verifyStep(secret, code, now = Date.now()) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
  const delta = totp(secret).validate({ token: code, timestamp: now, window: 1 });
  return delta === null ? null : Math.floor(now / 30000) + delta;
}
function recoveryHash(code) {
  if (typeof code !== 'string') return null;
  const clean = code.replace(/[-\s]/g, '').toLowerCase();
  return /^[a-f0-9]{32}$/.test(clean) ? digest('recovery:' + clean) : null;
}
function recoveryCodes() {
  const codes = Array.from({ length: 10 }, () => crypto.randomBytes(16).toString('hex').match(/.{4}/g).join('-'));
  return { codes, hashes: codes.map(recoveryHash) };
}
module.exports = { key, digest, encrypt, decrypt, totp, verifyStep, recoveryHash, recoveryCodes,
  createSecret: () => new OTPAuth.Secret({ size: 20 }).base32 };
