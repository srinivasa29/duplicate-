let redis = null;
let ready = false;

try {
  const IORedis = require('ioredis');
  const url = process.env.REDIS_URL || process.env.REDIS_URI || null;
  if (url) {
    redis = new IORedis(url, { maxRetriesPerRequest: 1 });
    redis.on('ready', () => { ready = true; });
    redis.on('error', () => { ready = false; });
  }
} catch (e) {
  // ioredis not installed or not configured — fall back to memory
  redis = null;
}

const isReady = () => Boolean(redis && ready);

const get = async (key) => {
  if (!isReady()) return null;
  try {
    const raw = await redis.get(String(key));
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

const set = async (key, value, ttlMs = 30000) => {
  if (!isReady()) return false;
  try {
    const raw = JSON.stringify(value);
    if (Number(ttlMs) > 0) {
      await redis.set(String(key), raw, 'PX', Number(ttlMs));
    } else {
      await redis.set(String(key), raw);
    }
    return true;
  } catch (_) {
    return false;
  }
};

const del = async (key) => {
  if (!isReady()) return false;
  try {
    await redis.del(String(key));
    return true;
  } catch (_) {
    return false;
  }
};

module.exports = { redis, isReady, get, set, del };
