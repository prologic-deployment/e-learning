/**
 * ✅ Environment validation — the server refuses to start with missing secrets.
 * Also centralizes all configuration so controllers never read process.env directly.
 */
const crypto = require('crypto');

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
// ✅ PRE-PRODUCTION: a staging tier that behaves like production (real
// secrets required, generic error responses, seeder blocked) while still
// allowing the login dev code on screen for UAT sign-off.
const isPreProd = NODE_ENV === 'preprod' || NODE_ENV === 'staging';
// ✅ Shared by every production-only behaviour so preprod cannot drift into
// "accidentally development-like".
const prodLike = isProd || isPreProd;

function requireEnv(name, opts = {}) {
  const value = process.env[name];
  if (!value || (opts.notPlaceholder && isPlaceholder(value))) {
    throw new Error(
      ` Missing/invalid environment variable: ${name}. ` +
      (opts.help || `Set it in your .env file before starting the server.`)
    );
  }
  return value;
}

function isPlaceholder(value) {
  const placeholders = [
    'change-me', 'changeme', 'default-key-change-me-in-production-32chars',
    'your-secret', 'secret', 'password', 'xxxx'
  ];
  const v = value.toLowerCase();
  return placeholders.some(p => v.includes(p));
}

/**
 * In production, JWT_SECRET and ENCRYPTION_KEY must be provided.
 * In development we generate ephemeral ones so a forgotten .env fails loudly
 * in prod but still runs locally (tokens invalidate on each restart).
 */
function resolveSecret(name, { minLength = 32 } = {}) {
  const value = process.env[name];
  if (prodLike) {
    return requireEnv(name, {
      notPlaceholder: true,
      help: `In production ${name} is mandatory (min ${minLength} chars). Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    });
  }
  if (!value || isPlaceholder(value) || value.length < minLength) {
    const generated = crypto.randomBytes(48).toString('hex');
    console.warn(
      `  ${name} not set (or too weak) — using an ephemeral dev secret. ` +
      `Sessions/encrypted data will NOT survive restarts. Set a real value before production.`
    );
    return generated;
  }
  return value;
}

const config = {
  nodeEnv: NODE_ENV,
  isProd,
  isPreProd,
  prodLike,

  port: Number(process.env.PORT) || 5000,

  // URLs — derived from env, never hardcoded localhost in emails/sockets
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/$/, ''),
  backendUrl: (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, ''),

  // Auth
  jwtSecret: resolveSecret('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',

  // Encryption
  encryptionKey: resolveSecret('ENCRYPTION_KEY', { minLength: 16 }),

  // CORS — comma-separated list of allowed origins
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:4200')
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean),

  // Rate limiting
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000,
    loginMax: Number(process.env.RATE_LIMIT_LOGIN_MAX) || 10,
    apiMax: Number(process.env.RATE_LIMIT_API_MAX) || 600,
    aiMax: Number(process.env.RATE_LIMIT_AI_MAX) || 20
  },


};

function validateEnv() {
  try {
    require('../services/totp.service').key();
  } catch {
    const message = 'TOTP_ENCRYPTION_KEY is missing or invalid. Restore the original key if authenticators exist; otherwise run npm run auth:configure, then restart the API. The key must be 32 random bytes encoded as base64.';
    if (prodLike) throw new Error(message);
    console.warn(message);
  }
  if (prodLike) {
    requireEnv('MONGO_URI');
    console.log(` Environment validation passed (${NODE_ENV})`);
  } else {
    if (!process.env.MONGO_URI) {
      console.warn('  MONGO_URI not set — using default mongodb://127.0.0.1:27017/elearning');
    }
    console.log(' Environment validation passed (development)');
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn('  GEMINI_API_KEY not set — chat will use the live catalogue fallback; AI/NLP features require configuration');
  }
  if (!process.env.EMAIL_HOST) {
    console.warn('  EMAIL_* not set — password-reset emails will fail');
  }
  return config;
}

module.exports = config;
module.exports.validateEnv = validateEnv;
