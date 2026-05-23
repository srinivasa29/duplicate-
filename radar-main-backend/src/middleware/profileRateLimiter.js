const redisClient = require('../services/redisClient');

// Simple per-user sliding window rate limiter
// default: 60s window, max 30 requests
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 30;

const memoryStore = new Map();

const keyForReq = (req) => {
  if (req.user && req.user._id) return String(req.user._id);
  return req.ip || 'anon';
};

const middleware = (options = {}) => async (req, res, next) => {
  const windowMs = Number(options.windowMs) || WINDOW_MS;
  const max = Number(options.max) || MAX_REQUESTS;
  const key = keyForReq(req);

  // If Redis is available, use atomic INCR with expiry
  if (redisClient.isReady()) {
    try {
      const redis = require('../services/redisClient').redis;
      const counterKey = `ratelimit:${key}`;
      const count = await redis.incr(counterKey);
      if (count === 1) {
        await redis.pexpire(counterKey, windowMs);
      }
      const remaining = Math.max(0, max - count);
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      if (count > max) {
        res.status(429).json({ success: false, message: 'Rate limit exceeded' });
        return;
      }
      return next();
    } catch (e) {
      // fall through to memory fallback
    }
  }

  // Memory fallback
  const now = Date.now();
  const entry = memoryStore.get(key) || { count: 0, windowStart: now };
  if (now - entry.windowStart > windowMs) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  memoryStore.set(key, entry);
  const remaining = Math.max(0, max - entry.count);
  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  if (entry.count > max) {
    res.status(429).json({ success: false, message: 'Rate limit exceeded' });
    return;
  }
  next();
};

module.exports = middleware;
