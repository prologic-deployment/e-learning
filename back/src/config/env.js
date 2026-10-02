/**
 * ✅ Environment validation — the server refuses to start with missing secrets.
 * Also centralizes all configuration so controllers never read process.env directly.
 */
const crypto = require('crypto');

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

function requireEnv(name, opts = {}) {
  const value = process.env[name];
  if (!value || (opts.notPlaceholder && isPlaceholder(value))) {
    throw new Error(
      `❌ Missing/invalid environment variable: ${name}. ` +
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
  if (isProd) {
    return requireEnv(name, {
      notPlaceholder: true,
      help: `In production ${name} is mandatory (min ${minLength} chars). Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    });
  }
  if (!value || isPlaceholder(value) || value.length < minLength) {
    const generated = crypto.randomBytes(48).toString('hex');
    console.warn(
      `⚠️  ${name} not set (or too weak) — using an ephemeral dev secret. ` +
      `Sessions/encrypted data will NOT survive restarts. Set a real value before production.`
    );
    return generated;
  }
  return value;
}

const config = {
  nodeEnv: NODE_ENV,
  isProd,

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

  // ✅ DEV-ONLY testing aid: return the login OTP in the API response so
  // manual testing works with fake inboxes (@test.com). Hard-blocked in prod.
  devExposeOtp: process.env.DEV_EXPOSE_OTP === 'true'
};

function validateEnv() {
  if (isProd) {
    requireEnv('MONGO_URI');
    console.log('✅ Environment validation passed (production)');
  } else {
    if (!process.env.MONGO_URI) {
      console.warn('⚠️  MONGO_URI not set — using default mongodb://127.0.0.1:27017/elearning');
    }
    console.log('✅ Environment validation passed (development)');
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY not set — chatbot/NLP features will return errors');
  }
  if (!process.env.EMAIL_HOST) {
    console.warn('⚠️  EMAIL_* not set — OTP emails will fail (log-only mode)');
  }
  return config;
}

module.exports = config;
module.exports.validateEnv = validateEnv;
