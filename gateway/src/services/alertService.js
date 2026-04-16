// ─── Real-Time Alert Service ───────────────────────────────────────
// Dispatches asynchronous alerts via SMTP mock and Slack webhook stub.
// Employs throttle timers to prevent alert fatigue (spam).

const nodemailer = require('nodemailer');
const axios = require('axios');
const config = require('../config');
const { logger, securityLogger } = require('../utils/logger');

// ── Throttle state ─────────────────────────────────────────────────
const lastAlertTime = new Map();

/**
 * Check if an alert should be throttled.
 * @param {string} key – unique identifier for throttle grouping
 * @returns {boolean}
 */
function isThrottled(key) {
  const last = lastAlertTime.get(key);
  if (last && Date.now() - last < config.alert.throttleMs) {
    return true;
  }
  lastAlertTime.set(key, Date.now());
  return false;
}

// ── SMTP Transporter (mock-friendly) ───────────────────────────────
const transporter = nodemailer.createTransport({
  host: config.alert.smtp.host,
  port: config.alert.smtp.port,
  secure: false,
  auth: {
    user: config.alert.smtp.user,
    pass: config.alert.smtp.pass,
  },
  // In dev/test, don't actually send
  ...(config.env !== 'production' ? { jsonTransport: true } : {}),
});

/**
 * Send an email alert.
 */
async function sendEmailAlert(alertData) {
  try {
    const info = await transporter.sendMail({
      from: `"API Gateway Alerts" <${config.alert.smtp.user}>`,
      to: config.alert.emailTo,
      subject: `[${alertData.severity?.toUpperCase()}] Gateway Alert: ${alertData.type}`,
      html: `
        <h2>🚨 API Gateway Security Alert</h2>
        <table style="border-collapse:collapse;">
          <tr><td><strong>Type:</strong></td><td>${alertData.type}</td></tr>
          <tr><td><strong>Severity:</strong></td><td>${alertData.severity}</td></tr>
          <tr><td><strong>IP:</strong></td><td>${alertData.ip || 'N/A'}</td></tr>
          <tr><td><strong>Path:</strong></td><td>${alertData.path || 'N/A'}</td></tr>
          <tr><td><strong>Time:</strong></td><td>${alertData.timestamp}</td></tr>
        </table>
        <pre>${JSON.stringify(alertData, null, 2)}</pre>
      `,
    });
    logger.info('Email alert sent', { messageId: info.messageId || 'mock' });
  } catch (err) {
    logger.error('Email alert failed', { error: err.message });
  }
}

/**
 * Send a Slack webhook alert.
 */
async function sendSlackAlert(alertData) {
  if (!config.alert.slackWebhook) return;

  try {
    await axios.post(config.alert.slackWebhook, {
      text: `🚨 *Gateway Alert [${alertData.severity?.toUpperCase()}]*`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: [
              `*Type:* ${alertData.type}`,
              `*Severity:* ${alertData.severity}`,
              `*IP:* ${alertData.ip || 'N/A'}`,
              `*Path:* ${alertData.path || 'N/A'}`,
              `*Time:* ${alertData.timestamp}`,
            ].join('\n'),
          },
        },
      ],
    });
    logger.info('Slack alert sent');
  } catch (err) {
    logger.error('Slack alert failed', { error: err.message });
  }
}

/**
 * Primary dispatch function – throttled, non-blocking.
 * @param {object} alertData – { type, severity, ip, path, timestamp, ... }
 */
function dispatch(alertData) {
  const throttleKey = `${alertData.type}:${alertData.ip || 'global'}`;

  if (isThrottled(throttleKey)) {
    logger.info('Alert throttled', { key: throttleKey });
    return;
  }

  securityLogger.warn('Alert dispatched', alertData);

  // Fire-and-forget (non-blocking)
  sendEmailAlert(alertData).catch(() => {});
  sendSlackAlert(alertData).catch(() => {});
}

module.exports = { dispatch, sendEmailAlert, sendSlackAlert };
