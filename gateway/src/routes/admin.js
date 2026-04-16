// ─── Admin Routes ──────────────────────────────────────────────────
// Admin-only API for managing IP lists, viewing system state, flushing
// cache, and checking AI engine health.

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const rbac = require('../middleware/rbacMiddleware');
const { getBlacklist, blacklistIP, removeBlacklist, whitelistIP } = require('../middleware/ipFilter');
const { flushCache } = require('../services/cacheService');
const { healthCheck, aiCircuit } = require('../services/enhancedAIClient');
const { auditLogger } = require('../utils/logger');

// All admin routes require auth + admin role
router.use(authMiddleware);
router.use(rbac('admin'));

// ── GET /admin/blacklist ───────────────────────────────────────────
router.get('/blacklist', async (req, res) => {
  const list = await getBlacklist();
  res.json({ blacklist: list });
});

// ── POST /admin/blacklist ──────────────────────────────────────────
router.post('/blacklist', async (req, res) => {
  const { ip, ttl } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP is required' });
  await blacklistIP(ip, ttl || 0);
  auditLogger.info('Admin blacklisted IP', { admin: req.user.username, ip, ttl });
  res.json({ message: `IP ${ip} blacklisted` });
});

// ── DELETE /admin/blacklist ────────────────────────────────────────
router.delete('/blacklist', async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP is required' });
  await removeBlacklist(ip);
  auditLogger.info('Admin removed IP from blacklist', { admin: req.user.username, ip });
  res.json({ message: `IP ${ip} removed from blacklist` });
});

// ── POST /admin/whitelist ──────────────────────────────────────────
router.post('/whitelist', async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP is required' });
  await whitelistIP(ip);
  auditLogger.info('Admin whitelisted IP', { admin: req.user.username, ip });
  res.json({ message: `IP ${ip} whitelisted` });
});

// ── POST /admin/cache/flush ────────────────────────────────────────
router.post('/cache/flush', async (req, res) => {
  await flushCache();
  auditLogger.info('Admin flushed cache', { admin: req.user.username });
  res.json({ message: 'Cache flushed' });
});

// ── GET /admin/ai/health ───────────────────────────────────────────
router.get('/ai/health', async (req, res) => {
  const health = await healthCheck();
  res.json(health);
});

// ── GET /admin/ai/circuit ──────────────────────────────────────────
router.get('/ai/circuit', (req, res) => {
  res.json(aiCircuit.getState());
});

module.exports = router;
