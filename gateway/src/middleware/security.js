// ─── Security Headers, CORS & Input Validation ────────────────────
// Bundles helmet, CORS, body size limits, and express-validator helpers.

const helmet = require('helmet');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const { securityLogger } = require('../utils/logger');

// ── Helmet – secure HTTP headers ───────────────────────────────────
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-site' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// ── CORS ───────────────────────────────────────────────────────────
const corsOptions = cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  maxAge: 86400,
});

// ── Input Sanitisation Rules ───────────────────────────────────────
const sanitiseBody = [
  body('*').trim().escape(),
];

// ── Validation Error Handler ───────────────────────────────────────
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    securityLogger.warn('Input validation failed', {
      ip: req.ip,
      path: req.originalUrl,
      errors: errors.array(),
    });
    return res.status(400).json({ error: 'Validation error', details: errors.array() });
  }
  next();
}

// ── Payload Size Limiter (applied in server.js via express.json) ───
const BODY_SIZE_LIMIT = '10kb';

module.exports = {
  securityHeaders,
  corsOptions,
  sanitiseBody,
  handleValidationErrors,
  BODY_SIZE_LIMIT,
};
