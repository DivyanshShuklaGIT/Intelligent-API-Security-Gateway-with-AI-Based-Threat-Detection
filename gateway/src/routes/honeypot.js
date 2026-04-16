// ─── Honeypot Endpoints ────────────────────────────────────────────
// Fake endpoints that real users would never hit.  Any traffic to these
// is a strong indicator of automated scanning / attack tools.

const express = require('express');
const router = express.Router();
const { securityLogger } = require('../utils/logger');
const { blacklistIP } = require('../middleware/ipFilter');
const alertService = require('../services/alertService');

const HONEYPOT_PATHS = [
  '/admin.php',
  '/wp-login.php',
  '/wp-admin',
  '/.env',
  '/phpinfo.php',
  '/actuator',
  '/debug',
  '/config.json',
  '/api/v1/internal/debug',
];

HONEYPOT_PATHS.forEach((path) => {
  router.all(path, async (req, res) => {
    const ip = req.ip;

    securityLogger.warn('Honeypot triggered', {
      ip,
      path: req.originalUrl,
      method: req.method,
      userAgent: req.headers['user-agent'],
      fingerprint: req.fingerprint,
    });

    // Auto-block the IP
    await blacklistIP(ip, 600); // 10 min block

    // Dispatch alert
    alertService.dispatch({
      type: 'honeypot',
      severity: 'high',
      ip,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });

    // Return a deliberately slow, misleading response
    setTimeout(() => {
      res.status(404).json({ error: 'Not Found' });
    }, 2000);
  });
});

module.exports = router;
