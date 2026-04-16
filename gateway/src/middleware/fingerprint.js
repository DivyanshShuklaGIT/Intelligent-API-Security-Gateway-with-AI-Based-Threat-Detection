// ─── Request Fingerprinting ────────────────────────────────────────
// Generates a deterministic SHA-256 fingerprint from IP + User-Agent +
// Accept-Language + Accept-Encoding headers.  Stores history in Redis
// to detect IP-rotation anomalies.

const crypto = require('crypto');
const redis = require('../utils/redisClient');
const { securityLogger } = require('../utils/logger');

const FP_HISTORY_PREFIX = 'fp:history:';
const FP_TTL = 3600; // 1 hour

/**
 * Middleware – computes a fingerprint and attaches it to req.fingerprint.
 * Also records it in Redis so the abuse detector can query patterns.
 */
async function fingerprint(req, _res, next) {
  const components = [
    req.ip,
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
  ].join('|');

  const hash = crypto.createHash('sha256').update(components).digest('hex');
  req.fingerprint = hash;

  try {
    const key = `${FP_HISTORY_PREFIX}${hash}`;
    const now = Date.now();

    // Store timestamped entry in a sorted set
    await redis.zadd(key, now, `${req.ip}:${now}`);
    await redis.expire(key, FP_TTL);

    // Count unique IPs seen for this fingerprint (detect IP rotation)
    const entries = await redis.zrange(key, 0, -1);
    const uniqueIPs = new Set(entries.map((e) => e.split(':')[0]));

    if (uniqueIPs.size > 5) {
      securityLogger.warn('IP rotation anomaly detected', {
        fingerprint: hash,
        uniqueIPs: uniqueIPs.size,
        ip: req.ip,
      });
      req.ipRotationAnomaly = true;
    }
  } catch (err) {
    // Non-blocking – fingerprinting errors shouldn't kill requests
    securityLogger.error('Fingerprint Redis error', { error: err.message });
  }

  next();
}

module.exports = fingerprint;
