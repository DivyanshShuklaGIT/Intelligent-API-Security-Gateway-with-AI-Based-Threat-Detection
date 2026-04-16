// ─── Gateway Configuration ─────────────────────────────────────────
// Centralised config loaded from environment variables with sane defaults.

require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  env: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiry: process.env.JWT_EXPIRY || '1h',
  },

  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/api_gateway',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },

  aiEngine: {
    url: process.env.AI_ENGINE_URL || 'http://localhost:8000',
    timeout: 3000,   // ms – fail-fast for AI calls
    retries: 2,
  },

  services: {
    userService: process.env.USER_SERVICE_URL || 'http://localhost:4001',
    orderService: process.env.ORDER_SERVICE_URL || 'http://localhost:4002',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  alert: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.example.com',
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    emailTo: process.env.ALERT_EMAIL_TO || 'admin@example.com',
    slackWebhook: process.env.SLACK_WEBHOOK_URL || '',
    throttleMs: parseInt(process.env.ALERT_THROTTLE_MS, 10) || 60000,
  },
};
