// ─── Authentication Middleware ──────────────────────────────────────
// Validates incoming requests via JWT bearer tokens OR static API keys.

const jwt = require('jsonwebtoken');
const config = require('../config');
const { securityLogger } = require('../utils/logger');

// In-memory API key store (production: use Redis/DB)
const VALID_API_KEYS = new Set([
  'gw-key-demo-12345',
  'gw-key-test-67890',
]);

/**
 * Express middleware – authenticates via:
 *  1. Authorization: Bearer <jwt>
 *  2. x-api-key: <key>
 */
function authMiddleware(req, res, next) {
  // ── Try JWT first ─────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = decoded; // { id, username, role }
      return next();
    } catch (err) {
      securityLogger.warn('JWT verification failed', {
        ip: req.ip,
        error: err.message,
        path: req.originalUrl,
      });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  // ── Try API key ───────────────────────────────────────────────
  const apiKey = req.headers['x-api-key'];
  if (apiKey && VALID_API_KEYS.has(apiKey)) {
    req.user = { id: 'api-key-user', username: 'api-client', role: 'user' };
    return next();
  }

  securityLogger.warn('Missing authentication credentials', {
    ip: req.ip,
    path: req.originalUrl,
  });
  return res.status(401).json({ error: 'Authentication required' });
}

module.exports = authMiddleware;
