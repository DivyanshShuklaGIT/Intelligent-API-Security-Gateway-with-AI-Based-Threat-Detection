// ─── IP Filter Middleware ───────────────────────────────────────────
// Whitelist / Blacklist based IP filtering with Redis-backed dynamic lists.

const redis = require('../utils/redisClient');
const { securityLogger } = require('../utils/logger');

const BLACKLIST_KEY = 'ip:blacklist';
const WHITELIST_KEY = 'ip:whitelist';

/**
 * Checks if the requesting IP is blacklisted (Redis set).
 * Whitelisted IPs bypass all downstream security checks.
 */
async function ipFilter(req, res, next) {
  const ip = req.ip;

  try {
    // Whitelist takes priority
    const isWhitelisted = await redis.sismember(WHITELIST_KEY, ip);
    if (isWhitelisted) {
      req.whitelisted = true;
      return next();
    }

    // Check blacklist
    const isBlacklisted = await redis.sismember(BLACKLIST_KEY, ip);
    if (isBlacklisted) {
      securityLogger.warn('Blacklisted IP blocked', { ip, path: req.originalUrl });
      return res.status(403).json({ error: 'Forbidden', message: 'Your IP has been blocked.' });
    }
  } catch (err) {
    // If Redis is down, allow traffic (fail-open) but log
    securityLogger.error('IP filter Redis error – failing open', { error: err.message });
  }

  next();
}

// ── Admin helpers to manage lists ──────────────────────────────────
async function blacklistIP(ip, ttl = 0) {
  await redis.sadd(BLACKLIST_KEY, ip);
  if (ttl > 0) await redis.expire(BLACKLIST_KEY, ttl);
  securityLogger.warn('IP blacklisted', { ip });
}

async function whitelistIP(ip) {
  await redis.sadd(WHITELIST_KEY, ip);
}

async function removeBlacklist(ip) {
  await redis.srem(BLACKLIST_KEY, ip);
}

async function getBlacklist() {
  return redis.smembers(BLACKLIST_KEY);
}

module.exports = { ipFilter, blacklistIP, whitelistIP, removeBlacklist, getBlacklist };
