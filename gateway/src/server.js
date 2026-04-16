// ─── API Gateway – Main Server ─────────────────────────────────────
// The central entry point wiring all middleware, routes, and services.

const express = require('express');
const mongoose = require('mongoose');
const promClient = require('prom-client');

const config = require('./config');
const redis = require('./utils/redisClient');
const { logger } = require('./utils/logger');

// Middleware
const { securityHeaders, corsOptions, BODY_SIZE_LIMIT } = require('./middleware/security');
const { ipFilter } = require('./middleware/ipFilter');
const fingerprint = require('./middleware/fingerprint');
const abuseDetector = require('./middleware/abuseDetector');
const rateLimiter = require('./middleware/rateLimiter');

// Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const proxyRoutes = require('./routes/proxy');
const honeypotRoutes = require('./routes/honeypot');

const app = express();

// ── Prometheus Metrics ─────────────────────────────────────────────
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'gateway_' });

const httpRequestDuration = new promClient.Histogram({
  name: 'gateway_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

const httpRequestTotal = new promClient.Counter({
  name: 'gateway_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// ── Request timing middleware ──────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    httpRequestDuration.labels(req.method, route, res.statusCode).observe(duration);
    httpRequestTotal.labels(req.method, route, res.statusCode).inc();
  });
  next();
});

// ── Global Middleware Stack ────────────────────────────────────────
app.use(securityHeaders);
app.use(corsOptions);
app.use(express.json({ limit: BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: false, limit: BODY_SIZE_LIMIT }));

// Security pipeline (order matters)
app.use(ipFilter);         // 1. Block blacklisted IPs first
app.use(fingerprint);      // 2. Generate request fingerprint
app.use(abuseDetector);    // 3. Detect abuse patterns
app.use(rateLimiter);      // 4. Enforce rate limits

// ── Honeypot Routes (no auth needed – they're traps) ───────────────
app.use(honeypotRoutes);

// ── Health & Metrics ───────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// ── API Routes ─────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/api', proxyRoutes);

// ── 404 Handler ────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ── Global Error Handler ───────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal Server Error' });
});

// ── Bootstrap ──────────────────────────────────────────────────────
async function start() {
  try {
    // Connect Redis
    await redis.connect();
    logger.info('Redis connected');

    // Connect MongoDB
    await mongoose.connect(config.mongo.uri);
    logger.info('MongoDB connected');

    // Start server
    app.listen(config.port, () => {
      logger.info(`🛡️  API Gateway running on port ${config.port}`, {
        env: config.env,
      });
    });
  } catch (err) {
    logger.error('Failed to start gateway', { error: err.message });
    process.exit(1);
  }
}

start();

module.exports = app; // For testing
