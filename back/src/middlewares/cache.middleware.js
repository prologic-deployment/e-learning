
const redisClient = require('../config/redis.config');

const cache = (ttl = 1800) => {
  return async (req, res, next) => {
    
    if (req.method !== 'GET') {
      return next();
    }

    // Vérifier si le cache est activé
    if (process.env.CACHE_ENABLED === 'false') {
      return next();
    }

    try {
      const redis = redisClient.getClient();
      if (!redis) return next(); 

      
      const userId = req.user?.id || req.user?._id || 'guest';
      const cacheKey = `cache:${req.method}:${req.originalUrl || req.url}:user:${userId}`;

      
      const cachedData = await redis.get(cacheKey);

      if (cachedData) {
        console.log(`✅ CACHE HIT: ${cacheKey}`);
        return res.status(200).json({
          ...JSON.parse(cachedData),
          _cache: {
            hit: true,
            timestamp: new Date().toISOString()
          }
        });
      }

      console.log(`❌ CACHE MISS: ${cacheKey}`);

      
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Cache population must not delay a successful application response.
          Promise.resolve().then(() => redis.setex(cacheKey, ttl, JSON.stringify(data))).catch(() => {});
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('⚠️ Erreur middleware cache:', error.message);
      next();
    }
  };
};


const cacheConfig = {
  short: cache(300),      // 5 minutes
  medium: cache(1800),    // 30 minutes
  long: cache(3600)       // 1 heure
};


const invalidateCache = async (pattern) => {
  try {
    const redis = redisClient.getClient();
    if (!redis) return 0;

    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`🗑️ Cache invalidé: ${keys.length} clé(s) - Pattern: ${pattern}`);
      return keys.length;
    }
    return 0;
  } catch (error) {
    console.error('⚠️ Erreur invalidation:', error.message);
    return 0;
  }
};

/**
 * Vider tout le cache
 */
const flushCache = async () => {
  try {
    const redis = redisClient.getClient();
    if (!redis) return;
    await redis.flushall();
    console.log('🗑️ Tout le cache vidé');
  } catch (error) {
    console.error('⚠️ Erreur flush cache:', error.message);
  }
};


module.exports = {
  cache,
  cacheConfig,        
  invalidateCache,
  flushCache          
};