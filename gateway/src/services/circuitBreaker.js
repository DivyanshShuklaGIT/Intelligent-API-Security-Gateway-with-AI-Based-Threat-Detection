// ─── Circuit Breaker ───────────────────────────────────────────────
// Lightweight circuit breaker for upstream service calls.
// States: CLOSED → OPEN → HALF_OPEN → CLOSED

const { logger } = require('../utils/logger');

class CircuitBreaker {
  /**
   * @param {string} name        – identifier for logging
   * @param {object} opts
   * @param {number} opts.threshold    – failures before opening (default 5)
   * @param {number} opts.timeout      – ms to stay open before half-open (default 30s)
   */
  constructor(name, opts = {}) {
    this.name = name;
    this.threshold = opts.threshold || 5;
    this.timeout = opts.timeout || 30000;

    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  /**
   * Execute a function through the circuit breaker.
   * @param {Function} fn – async function to execute
   * @returns {Promise<*>}
   */
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = 'HALF_OPEN';
        logger.info(`Circuit [${this.name}] → HALF_OPEN`);
      } else {
        throw new Error(`Circuit [${this.name}] is OPEN – request rejected`);
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  _onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 2) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        logger.info(`Circuit [${this.name}] → CLOSED`);
      }
    } else {
      this.failureCount = 0;
    }
  }

  _onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      logger.warn(`Circuit [${this.name}] → OPEN (failures: ${this.failureCount})`);
    }
  }

  getState() {
    return { name: this.name, state: this.state, failures: this.failureCount };
  }
}

module.exports = CircuitBreaker;
