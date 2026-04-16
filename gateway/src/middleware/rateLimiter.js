// ─── Distributed Rate Limiter ──────────────────────────────────────
// Uses express-rate-limit backed by Redis for distributed state.

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const redis = require('../utils/redisClient');
const config = require('../config');
const { securityLogger } = require('../utils/logger');

const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,

  // Redis-backed store for distributed rate limiting across instances
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rl:',
  }),

  handler: (req, res) => {
    securityLogger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.originalUrl,
      user: req.user?.username || 'anonymous',
    });
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please slow down.',
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
    });
  },

  keyGenerator: (req) => {
    // Use fingerprint if available, fall back to IP
    return req.fingerprint || req.ip;
  },
});

module.exports = rateLimiter;
