
const Redis = require('ioredis');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      await this.client.connect();

      this.client.on('ready', () => {
        console.log('✅ Redis connecté');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('❌ Erreur Redis:', err.message);
        this.isConnected = false;
      });

      return this.client;
    } catch (error) {
      console.warn('⚠️ Redis non disponible, cache désactivé');
      return null;
    }
  }

  getClient() {
    return this.client;
  }

  async healthCheck() {
    try {
      if (!this.client || !this.isConnected) return false;
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      console.log('👋 Redis déconnecté');
    }
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;