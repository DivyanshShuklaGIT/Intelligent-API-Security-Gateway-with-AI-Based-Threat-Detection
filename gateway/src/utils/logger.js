// ─── Segmented Logger ──────────────────────────────────────────────
// Uses Winston to bifurcate output into three structured JSON streams:
//   • normal.log   – Standard traffic & application logs
//   • security.log – Blocked requests, attacks, AI flags
//   • audit.log    – Admin API actions, config changes

const winston = require('winston');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');

// ── Shared format ──────────────────────────────────────────────────
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ── Normal Logger (general traffic) ────────────────────────────────
const logger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: { service: 'api-gateway' },
  transports: [
    new winston.transports.File({ filename: path.join(LOG_DIR, 'normal.log') }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// ── Security Logger (threats & blocks) ─────────────────────────────
const securityLogger = winston.createLogger({
  level: 'warn',
  format: jsonFormat,
  defaultMeta: { service: 'api-gateway', stream: 'security' },
  transports: [
    new winston.transports.File({ filename: path.join(LOG_DIR, 'security.log') }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// ── Audit Logger (admin actions) ───────────────────────────────────
const auditLogger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: { service: 'api-gateway', stream: 'audit' },
  transports: [
    new winston.transports.File({ filename: path.join(LOG_DIR, 'audit.log') }),
  ],
});

module.exports = { logger, securityLogger, auditLogger };
