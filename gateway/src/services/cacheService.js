// ─── Cache Service ─────────────────────────────────────────────────
// Redis-backed response cache for GET requests to reduce upstream load.

const redis = require('../utils/redisClient');
const { logger } = require('../utils/logger');

const CACHE_PREFIX = 'cache:';
const DEFAULT_TTL = 60; // seconds

/**
 * Middleware – caches GET responses.
 * @param {number} ttl – cache TTL in seconds
 */
function cacheMiddleware(ttl = DEFAULT_TTL) {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();

    const key = `${CACHE_PREFIX}${req.originalUrl}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        logger.info('Cache HIT', { path: req.originalUrl });
        const parsed = JSON.parse(cached);
        return res.status(200).json(parsed);
      }
    } catch (err) {
      logger.error('Cache read error', { error: err.message });
    }

    // Override res.json to intercept and cache the response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) {
        redis
          .setex(key, ttl, JSON.stringify(body))
          .catch((err) => logger.error('Cache write error', { error: err.message }));
      }
      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate cache for a specific path.
 */
async function invalidateCache(path) {
  const key = `${CACHE_PREFIX}${path}`;
  await redis.del(key);
  logger.info('Cache invalidated', { path });
}

/**
 * Flush all cached responses.
 */
async function flushCache() {
  const keys = await redis.keys(`${CACHE_PREFIX}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
    logger.info('Cache flushed', { count: keys.length });
  }
}

module.exports = { cacheMiddleware, invalidateCache, flushCache };
