// ─── Redis Client ──────────────────────────────────────────────────
// Shared IoRedis instance used across rate-limiter, fingerprint store,
// abuse detector, and cache service.

const Redis = require('ioredis');
const config = require('../config');
const { logger } = require('./logger');

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { error: err.message }));

module.exports = redis;
