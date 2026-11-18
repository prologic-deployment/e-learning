const Redis = require('ioredis');

/**
 * Redis is used only as a response cache, and it is OPTIONAL.
 *
 * - CACHE_ENABLED=true  → connect to Redis and cache responses.
 * - anything else       → Redis is never contacted; every cache operation is
 *                         a no-op and requests go straight to MongoDB.
 *
 * When enabled but Redis is down, getClient() returns null until the
 * connection is ready again, so requests never wait on Redis retries.
 */
class RedisClient {
  constructor() {
    this.client = null;
    this.errorLogged = false;
  }

  isEnabled() {
    return String(process.env.CACHE_ENABLED || '').toLowerCase() === 'true';
  }

  async connect() {
    if (!this.isEnabled()) {
      console.log('ℹ️ Cache disabled (CACHE_ENABLED is not "true") — Redis not used');
      return null;
    }

    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      // Fail fast instead of queueing commands while Redis is unreachable
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      // Keep reconnecting in the background (max 10 s between attempts)
      retryStrategy: (times) => Math.min(times * 500, 10000)
    });

    // Handlers are attached BEFORE connecting so a failed start is handled
    // (no "Unhandled error event" flood) and only logged once per outage.
    this.client.on('ready', () => {
      this.errorLogged = false;
      console.log('✅ Redis connected — cache enabled');
    });
    this.client.on('error', (err) => {
      if (!this.errorLogged) {
        console.warn(`⚠️ Redis unavailable (${err.message || err.code}) — serving without cache, retrying in background`);
        this.errorLogged = true;
      }
    });

    try {
      await this.client.connect();
    } catch {
      // Already logged by the 'error' handler; the server keeps running
      // without cache and ioredis keeps retrying.
    }
    return this.client;
  }

  /** Returns a usable client, or null when the cache is disabled or Redis is not ready. */
  getClient() {
    if (!this.isEnabled() || !this.client) return null;
    return this.client.status === 'ready' ? this.client : null;
  }

  async healthCheck() {
    const client = this.getClient();
    if (!client) return false;
    try {
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async disconnect() {
    if (!this.client) return;
    try {
      if (this.client.status === 'ready') {
        await this.client.quit();
      } else {
        this.client.disconnect();
      }
      console.log('👋 Redis disconnected');
    } catch {
      this.client.disconnect();
    }
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
