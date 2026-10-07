// Disposable real API/database for browser tests. No fixtures are injected into the UI.
const crypto = require('crypto');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.RATE_LIMIT_LOGIN_MAX = '1000';
process.env.CACHE_ENABLED = 'false';
process.env.CORS_ORIGINS = 'http://localhost:4200,http://127.0.0.1:4200';
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const app = require('../src/app');
  const server = app.listen(5000, '0.0.0.0', () => console.log('Isolated browser-test API ready on 5000 (disposable database)'));
  const stop = async () => {server.close(); await mongoose.disconnect(); await mongo.stop(); process.exit(0);};
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
})().catch(() => {console.error('Browser-test API failed to start');process.exit(1);});
