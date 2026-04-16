// ─── Proxy Routes ──────────────────────────────────────────────────
// Reverse-proxy configuration forwarding authenticated requests to
// upstream microservices with RBAC enforcement and AI threat analysis.

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const router = express.Router();

const config = require('../config');
const authMiddleware = require('../middleware/auth');
const rbac = require('../middleware/rbacMiddleware');
const { cacheMiddleware } = require('../services/cacheService');
const { analyseRequest } = require('../services/enhancedAIClient');
const alertService = require('../services/alertService');
const { securityLogger, logger } = require('../utils/logger');
const redis = require('../utils/redisClient');

// ── AI Threat Analysis Middleware ──────────────────────────────────
async function aiThreatCheck(req, res, next) {
  if (req.whitelisted) return next();

  try {
    // Build feature vector for AI analysis
    const ipKey = `freq:${req.ip}`;
    const freqStr = await redis.get(ipKey);
    const requestFrequency = parseInt(freqStr, 10) || 0;

    // Increment frequency counter
    await redis.incr(ipKey);
    await redis.expire(ipKey, 60);

    const features = {
      requestFrequency,
      payloadSize: parseInt(req.headers['content-length'], 10) || 0,
      authFailures: 0, // tracked elsewhere, placeholder
      uniqueEndpoints: req.abuseMetrics?.uniqueEndpoints || 0,
      avgTimeBetweenRequests: 0, // computed by AI engine
    };

    const result = await analyseRequest(features);

    // Attach result for downstream logging
    req.aiResult = result;

    if (result.isMalicious) {
      securityLogger.warn('AI flagged malicious request', {
        ip: req.ip,
        riskScore: result.riskScore,
        source: result.source,
        path: req.originalUrl,
      });

      alertService.dispatch({
        type: 'ai-threat',
        severity: result.riskScore > 0.8 ? 'critical' : 'high',
        ip: req.ip,
        path: req.originalUrl,
        riskScore: result.riskScore,
        timestamp: new Date().toISOString(),
      });

      return res.status(403).json({
        error: 'Request Blocked',
        message: 'Threat detected by security analysis.',
        riskScore: result.riskScore,
      });
    }
  } catch (err) {
    // AI failure shouldn't block legitimate traffic
    logger.error('AI threat check error', { error: err.message });
  }

  next();
}

// ── Proxy to User Service ──────────────────────────────────────────
router.use(
  '/users',
  authMiddleware,
  rbac('users'),
  aiThreatCheck,
  cacheMiddleware(30),
  createProxyMiddleware({
    target: config.services.userService,
    changeOrigin: true,
    pathRewrite: { '^/api/users': '/' },
    on: {
      proxyReq: (proxyReq, req) => {
        proxyReq.setHeader('X-Gateway-User', req.user?.username || 'anonymous');
        proxyReq.setHeader('X-Gateway-Role', req.user?.role || 'none');
        proxyReq.setHeader('X-Request-Fingerprint', req.fingerprint || 'none');
        logger.info('Proxying to user-service', { path: req.originalUrl, user: req.user?.username });
      },
      error: (err, req, res) => {
        logger.error('Proxy error (user-service)', { error: err.message });
        res.status(502).json({ error: 'Bad Gateway', message: 'User service unavailable' });
      },
    },
  })
);

// ── Proxy to Order Service (Admin only) ────────────────────────────
router.use(
  '/orders',
  authMiddleware,
  rbac('orders'),
  aiThreatCheck,
  cacheMiddleware(30),
  createProxyMiddleware({
    target: config.services.orderService,
    changeOrigin: true,
    pathRewrite: { '^/api/orders': '/' },
    on: {
      proxyReq: (proxyReq, req) => {
        proxyReq.setHeader('X-Gateway-User', req.user?.username || 'anonymous');
        proxyReq.setHeader('X-Gateway-Role', req.user?.role || 'none');
        proxyReq.setHeader('X-Request-Fingerprint', req.fingerprint || 'none');
        logger.info('Proxying to order-service', { path: req.originalUrl, user: req.user?.username });
      },
      error: (err, req, res) => {
        logger.error('Proxy error (order-service)', { error: err.message });
        res.status(502).json({ error: 'Bad Gateway', message: 'Order service unavailable' });
      },
    },
  })
);

module.exports = router;
