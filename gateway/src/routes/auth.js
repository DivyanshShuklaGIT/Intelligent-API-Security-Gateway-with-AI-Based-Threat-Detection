// ─── Auth Routes ───────────────────────────────────────────────────
// Register, login, and token refresh endpoints.

const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body } = require('express-validator');
const router = express.Router();

const User = require('../models/User');
const config = require('../config');
const { logger, securityLogger, auditLogger } = require('../utils/logger');
const { handleValidationErrors } = require('../middleware/security');

// ── POST /auth/register ────────────────────────────────────────────
router.post(
  '/register',
  [
    body('username').isLength({ min: 3, max: 30 }).trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { username, email, password } = req.body;

      // Check existing user
      const exists = await User.findOne({ $or: [{ username }, { email }] });
      if (exists) {
        return res.status(409).json({ error: 'Username or email already exists' });
      }

      const user = new User({
        username,
        email,
        password,
        apiKey: `gw-key-${uuidv4()}`,
      });

      await user.save();

      auditLogger.info('User registered', { username, email });

      // Issue JWT
      const token = jwt.sign(
        { id: user._id, username: user.username, role: user.role },
        config.jwt.secret,
        { expiresIn: config.jwt.expiry }
      );

      res.status(201).json({
        message: 'Registration successful',
        token,
        apiKey: user.apiKey,
        user: { id: user._id, username: user.username, role: user.role },
      });
    } catch (err) {
      logger.error('Registration error', { error: err.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── POST /auth/login ───────────────────────────────────────────────
router.post(
  '/login',
  [
    body('username').notEmpty().trim(),
    body('password').notEmpty(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { username, password } = req.body;

      const user = await User.findOne({ username });
      if (!user) {
        securityLogger.warn('Login failed – user not found', { username, ip: req.ip });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check lockout
      if (user.isLocked()) {
        securityLogger.warn('Login attempt on locked account', { username, ip: req.ip });
        return res.status(423).json({
          error: 'Account locked',
          message: 'Too many failed attempts. Try again later.',
        });
      }

      // Verify password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        await user.incLoginAttempts();
        securityLogger.warn('Login failed – wrong password', {
          username,
          ip: req.ip,
          attempts: user.loginAttempts + 1,
        });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Reset attempts on success
      await user.updateOne({
        $set: { loginAttempts: 0, lastLogin: new Date() },
        $unset: { lockUntil: 1 },
      });

      const token = jwt.sign(
        { id: user._id, username: user.username, role: user.role },
        config.jwt.secret,
        { expiresIn: config.jwt.expiry }
      );

      auditLogger.info('User logged in', { username, ip: req.ip });

      res.json({
        message: 'Login successful',
        token,
        user: { id: user._id, username: user.username, role: user.role },
      });
    } catch (err) {
      logger.error('Login error', { error: err.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;
