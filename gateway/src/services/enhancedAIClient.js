// ─── Enhanced AI Client (Fail-Safe) ────────────────────────────────
// Communicates with the Python AI engine.  Features:
//   • Configurable timeout & retries
//   • Circuit breaker integration
//   • Fallback to static rule-based detection when AI is offline

const axios = require('axios');
const config = require('../config');
const CircuitBreaker = require('./circuitBreaker');
const { logger, securityLogger } = require('../utils/logger');

const aiCircuit = new CircuitBreaker('AI-Engine', {
  threshold: 3,
  timeout: 30000,
});

// ── Static fallback rules ──────────────────────────────────────────
function staticFallback(features) {
  const {
    requestFrequency = 0,
    payloadSize = 0,
    authFailures = 0,
    uniqueEndpoints = 0,
  } = features;

  let riskScore = 0;
  if (requestFrequency > 60) riskScore += 0.3;
  if (payloadSize > 10000) riskScore += 0.2;
  if (authFailures > 5) riskScore += 0.3;
  if (uniqueEndpoints > 20) riskScore += 0.2;

  return {
    riskScore: Math.min(riskScore, 1),
    isMalicious: riskScore >= 0.6,
    source: 'static-fallback',
    message: 'AI engine offline – using static rules',
  };
}

/**
 * Analyse a request through the AI engine.
 * @param {object} features – feature vector
 * @returns {Promise<object>} – { riskScore, isMalicious, source }
 */
async function analyseRequest(features) {
  try {
    const result = await aiCircuit.execute(async () => {
      const response = await axios.post(
        `${config.aiEngine.url}/analyse`,
        { features },
        {
          timeout: config.aiEngine.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      return { ...response.data, source: 'ai-engine' };
    });

    return result;
  } catch (err) {
    // Circuit open or AI down → fallback
    securityLogger.warn('AI engine unavailable – using fallback', {
      error: err.message,
      circuitState: aiCircuit.getState(),
    });
    return staticFallback(features);
  }
}

/**
 * Health check for the AI engine.
 */
async function healthCheck() {
  try {
    const res = await axios.get(`${config.aiEngine.url}/health`, { timeout: 2000 });
    return { status: 'healthy', data: res.data, circuit: aiCircuit.getState() };
  } catch {
    return { status: 'unhealthy', circuit: aiCircuit.getState() };
  }
}

module.exports = { analyseRequest, healthCheck, aiCircuit };
