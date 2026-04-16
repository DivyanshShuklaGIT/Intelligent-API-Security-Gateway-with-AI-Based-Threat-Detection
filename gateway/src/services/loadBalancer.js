// ─── Load Balancer ─────────────────────────────────────────────────
// Simple round-robin load balancer for distributing requests across
// multiple instances of an upstream service.

const { logger } = require('../utils/logger');

class LoadBalancer {
  /**
   * @param {string} name     – service name for logging
   * @param {string[]} targets – array of upstream URLs
   */
  constructor(name, targets = []) {
    this.name = name;
    this.targets = targets;
    this.index = 0;
    this.healthStatus = new Map();

    // Initialize all targets as healthy
    targets.forEach((t) => this.healthStatus.set(t, true));
  }

  /**
   * Returns the next healthy target URL (round-robin).
   * @returns {string|null}
   */
  getNext() {
    const healthy = this.targets.filter((t) => this.healthStatus.get(t));
    if (healthy.length === 0) {
      logger.error(`LoadBalancer [${this.name}]: No healthy targets available`);
      return null;
    }

    const target = healthy[this.index % healthy.length];
    this.index = (this.index + 1) % healthy.length;
    return target;
  }

  /**
   * Mark a target as unhealthy.
   * @param {string} target
   */
  markUnhealthy(target) {
    this.healthStatus.set(target, false);
    logger.warn(`LoadBalancer [${this.name}]: Marked ${target} as unhealthy`);

    // Auto-recover after 30 seconds
    setTimeout(() => {
      this.healthStatus.set(target, true);
      logger.info(`LoadBalancer [${this.name}]: Recovered ${target}`);
    }, 30000);
  }

  /**
   * Get current health status of all targets.
   */
  getStatus() {
    const status = {};
    this.healthStatus.forEach((healthy, target) => {
      status[target] = healthy ? 'healthy' : 'unhealthy';
    });
    return { name: this.name, targets: status };
  }
}

module.exports = LoadBalancer;
