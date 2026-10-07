const Redis = require('ioredis');
class RedisClient {
  constructor(RedisImplementation = Redis) {
    this.Redis = RedisImplementation;
    this.client = null;
    this.isConnected = false;
  }
  async connect() {
    if (process.env.CACHE_ENABLED === 'false') return null;
    if (this.client) return this.getClient();
    const client = this.client = new this.Redis({
      host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 0,
      connectTimeout: 1000, commandTimeout: 250,
      retryStrategy: times => times <= 3 ? Math.min(times * 100, 500) : null
    });
    // Register before connect: a fast ready event must not be missed.
    client.on('ready', () => { this.isConnected = true; });
    for (const event of ['error', 'close', 'end', 'reconnecting']) client.on(event, () => { this.isConnected = false; });
    try { await client.connect(); return this.getClient(); }
    catch { this.isConnected = false; return null; }
  }
  getClient() { return this.isConnected && this.client?.status === 'ready' ? this.client : null; }
  async healthCheck() {
    const client = this.getClient(); if (!client) return false;
    try { return await client.ping() === 'PONG'; } catch { return false; }
  }
  async disconnect() {
    this.isConnected = false;
    // No queued QUIT command while disconnected.
    this.client?.disconnect(); this.client = null;
  }
}
module.exports = new RedisClient();
module.exports.RedisClient = RedisClient;
