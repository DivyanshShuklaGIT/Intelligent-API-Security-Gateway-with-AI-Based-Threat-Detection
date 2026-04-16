// ─── API Abuse Detector ────────────────────────────────────────────
// Evaluates Redis counters to track endpoint scraping, bot-like
// repetitiveness, and excessive usage.  Dynamically issues blocks.

const redis = require('../utils/redisClient');
const { securityLogger } = require('../utils/logger');
const { blacklistIP } = require('./ipFilter');

const ABUSE_PREFIX = 'abuse:';
const ABUSE_WINDOW = 60;       // seconds
const SCRAPE_THRESHOLD = 50;   // unique endpoints in window
const REPEAT_THRESHOLD = 30;   // same endpoint in window
const BLOCK_DURATION = 300;    // seconds (5 min auto-block)

/**
 * Middleware – increments per-IP counters for unique endpoints
 * and per-endpoint hit counts.  Triggers auto-block on breach.
 */
async function abuseDetector(req, res, next) {
  if (req.whitelisted) return next();

  const ip = req.ip;
  const endpoint = req.method + ':' + req.path;

  try {
    const uniqueKey = `${ABUSE_PREFIX}endpoints:${ip}`;
    const repeatKey = `${ABUSE_PREFIX}repeat:${ip}:${endpoint}`;

    // Track unique endpoints accessed
    await redis.sadd(uniqueKey, endpoint);
    await redis.expire(uniqueKey, ABUSE_WINDOW);
    const uniqueCount = await redis.scard(uniqueKey);

    // Track repeat hits to same endpoint
    const repeatCount = await redis.incr(repeatKey);
    if (repeatCount === 1) await redis.expire(repeatKey, ABUSE_WINDOW);

    // ── Scraping detection ──────────────────────────────────────
    if (uniqueCount > SCRAPE_THRESHOLD) {
      securityLogger.warn('Endpoint scraping detected', {
        ip,
        uniqueEndpoints: uniqueCount,
        action: 'auto-block',
      });
      await blacklistIP(ip, BLOCK_DURATION);
      return res.status(403).json({
        error: 'Blocked',
        message: 'Suspicious scraping activity detected.',
      });
    }

    // ── Bot-like repetitiveness ─────────────────────────────────
    if (repeatCount > REPEAT_THRESHOLD) {
      securityLogger.warn('Bot-like repetitive access detected', {
        ip,
        endpoint,
        hits: repeatCount,
        action: 'auto-block',
      });
      await blacklistIP(ip, BLOCK_DURATION);
      return res.status(403).json({
        error: 'Blocked',
        message: 'Automated abuse detected.',
      });
    }

    // Attach abuse metrics for AI engine
    req.abuseMetrics = { uniqueEndpoints: uniqueCount, repeatHits: repeatCount };
  } catch (err) {
    securityLogger.error('Abuse detector error – failing open', { error: err.message });
  }

  next();
}

module.exports = abuseDetector;
