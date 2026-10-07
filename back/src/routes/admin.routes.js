
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth.middleware");
const redisClient = require("../config/redis.config");
const { flushCache, invalidateCache } = require("../middlewares/cache.middleware");
const User = require("../models/User");

// ========================================
// GET /admin/cache/stats - Statistiques du cache
// ========================================
router.get("/cache/stats", protect, authorize("admin"), async (req, res) => {
  try {
    const redis = redisClient.getClient();

    if (!redis) {
      return res.status(503).json({
        success: false,
        message: "Redis non disponible"
      });
    }

    // Récupérer toutes les clés de cache
    const allKeys = await redis.keys("*");
    const cacheKeys = await redis.keys("cache:*");

    // Grouper par endpoint
    const keysByEndpoint = cacheKeys.reduce((acc, key) => {
      // Extraire l'endpoint : cache:GET:/api/courses:user:123 → courses
      const parts = key.split(":");
      let endpoint = "other";

      if (parts.length >= 3) {
        const url = parts[2]; // /api/courses ou /api/enrollments/me
        const match = url.match(/\/api\/([^\/]+)/);
        if (match) {
          endpoint = match[1]; // courses, enrollments, etc.
        }
      }

      acc[endpoint] = (acc[endpoint] || 0) + 1;
      return acc;
    }, {});

    // Nombre total de clés en base
    const dbsize = await redis.dbsize();

    // Exemples de clés (pour debugging)
    const sampleKeys = cacheKeys.slice(0, 10);

    // Calculer la taille approximative du cache
    let totalMemory = 0;
    for (const key of cacheKeys.slice(0, 100)) {
      // Limiter à 100 pour performance
      const value = await redis.get(key);
      if (value) {
        totalMemory += Buffer.byteLength(value, "utf8");
      }
    }

    res.status(200).json({
      success: true,
      data: {
        redis: {
          status: "connected",
          totalKeys: dbsize,
          cacheKeys: cacheKeys.length,
          otherKeys: allKeys.length - cacheKeys.length
        },
        cache: {
          keysByEndpoint,
          approximateSize: `${(totalMemory / 1024).toFixed(2)} KB`,
          sampleKeys
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des stats",
      error: error.message
    });
  }
});

// ========================================
// DELETE /admin/cache - Vider tout le cache
// ========================================
router.delete("/cache", protect, authorize("admin"), async (req, res) => {
  try {
    await flushCache();

    res.status(200).json({
      success: true,
      message: " Cache entièrement vidé",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erreur lors du vidage du cache",
      error: error.message
    });
  }
});

// ========================================
// DELETE /admin/cache/:pattern - Invalider par pattern
// ========================================
router.delete("/cache/:pattern", protect, authorize("admin"), async (req, res) => {
  try {
    // Construire le pattern
    // Ex: /admin/cache/courses → cache:*courses*
    const pattern = `cache:*${req.params.pattern}*`;

    const count = await invalidateCache(pattern);

    res.status(200).json({
      success: true,
      message: ` ${count} clé(s) invalidée(s)`,
      pattern,
      count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'invalidation",
      error: error.message
    });
  }
});


router.get("/users", protect, authorize("admin"), async (req, res) => {
  try {
    console.log(" GET /admin/users called");

    const users = await User.find()
      .select("firstname lastname email role isActive createdAt avatar")
      .sort({ createdAt: -1 });

    console.log(" Users found:", users.length);
    res.status(200).json(users);
  } catch (error) {
    console.error(" Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
