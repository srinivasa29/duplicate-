const twelve = require('./priceProviders/twelveDataProvider');
const marketstack = require('./priceProviders/marketstackProvider');
const tiingo = require('./priceProviders/tiingoProvider');

// Simple in-memory provider health and cooldown tracking
const providers = [
  { name: 'twelve', impl: twelve, priority: 1, healthy: true, cooldownUntil: 0, metrics: { requests: 0, successes: 0, failures: 0, lastUsed: null, avgResponseTime: 0 } },
  { name: 'marketstack', impl: marketstack, priority: 2, healthy: true, cooldownUntil: 0, metrics: { requests: 0, successes: 0, failures: 0, lastUsed: null, avgResponseTime: 0 } },
  { name: 'tiingo', impl: tiingo, priority: 3, healthy: true, cooldownUntil: 0, metrics: { requests: 0, successes: 0, failures: 0, lastUsed: null, avgResponseTime: 0 } },
];

const COOLDOWN_MS = 1000 * 60 * 2; // 2 minutes

function now() { return Date.now(); }

function markProviderFailure(name) {
  const p = providers.find(x => x.name === name);
  if (!p) return;
  p.healthy = false;
  p.cooldownUntil = now() + COOLDOWN_MS;
}

function markProviderSuccess(name) {
  const p = providers.find(x => x.name === name);
  if (!p) return;
  p.healthy = true;
  p.cooldownUntil = 0;
}

function getAvailableProviders() {
  const t = now();
  return providers
    .filter(p => p.healthy || (p.cooldownUntil && p.cooldownUntil <= t))
    .sort((a,b) => a.priority - b.priority);
}

async function fetchQuotesWithFallback(symbols = [], opts = {}) {
  const available = getAvailableProviders();
  if (!available.length) throw new Error('No price providers available');

  const errors = [];
  for (const provider of available) {
    const startTime = Date.now();
    try {
      provider.metrics.requests++;
      const res = await provider.impl.fetchQuotes(symbols, opts);
      // Basic validation: ensure at least one numeric price present
      const anyValid = Array.isArray(res) && res.some(r => Number.isFinite(Number(r.price)));
      if (anyValid) {
        const duration = Date.now() - startTime;
        provider.metrics.successes++;
        provider.metrics.lastUsed = new Date();
        // Update rolling avg response time
        provider.metrics.avgResponseTime = (provider.metrics.avgResponseTime * (provider.metrics.successes - 1) + duration) / provider.metrics.successes;
        markProviderSuccess(provider.name);
        return { provider: provider.name, data: res };
      }
      throw new Error('Invalid response payload');
    } catch (err) {
      provider.metrics.failures++;
      errors.push({ provider: provider.name, error: err.message });
      markProviderFailure(provider.name);
      // try next provider
    }
  }

  const ex = new Error('All providers failed');
  ex.details = errors;
  throw ex;
}

function getProviderMetrics() {
  return providers.map(p => ({
    name: p.name,
    priority: p.priority,
    healthy: p.healthy,
    cooldownUntil: p.cooldownUntil,
    requests: p.metrics.requests,
    successes: p.metrics.successes,
    failures: p.metrics.failures,
    successRate: p.metrics.requests > 0 ? ((p.metrics.successes / p.metrics.requests) * 100).toFixed(1) : 0,
    lastUsed: p.metrics.lastUsed,
    avgResponseTime: p.metrics.avgResponseTime.toFixed(0),
  }));
}

module.exports = { fetchQuotesWithFallback, markProviderFailure, markProviderSuccess, getAvailableProviders, getProviderMetrics };
