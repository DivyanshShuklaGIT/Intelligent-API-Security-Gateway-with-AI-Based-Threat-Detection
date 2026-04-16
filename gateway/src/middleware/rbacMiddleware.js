// ─── Role-Based Access Control Middleware ──────────────────────────
// Enforces route-level access based on user roles extracted from JWT.

const { securityLogger } = require('../utils/logger');

// ── Role hierarchy & route map ─────────────────────────────────────
const ROLE_PERMISSIONS = {
  admin: ['users', 'orders', 'admin'],
  user: ['users'],
};

/**
 * Factory – returns middleware that checks if req.user.role
 * has access to the specified resource.
 * @param {string} resource - The resource key (e.g. 'orders', 'users')
 */
function rbac(resource) {
  return (req, res, next) => {
    const role = req.user?.role || 'anonymous';
    const allowed = ROLE_PERMISSIONS[role] || [];

    if (!allowed.includes(resource)) {
      securityLogger.warn('RBAC denied', {
        ip: req.ip,
        user: req.user?.username,
        role,
        resource,
        path: req.originalUrl,
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: `Role '${role}' does not have access to '${resource}'`,
      });
    }

    next();
  };
}

module.exports = rbac;
