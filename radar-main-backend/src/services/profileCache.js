const redisClient = require('./redisClient');

const MapCache = new Map();

const memoryGet = (key) => {
  if (!key) return null;
  const k = String(key);
  const entry = MapCache.get(k);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    MapCache.delete(k);
    return null;
  }
  return entry.data;
};

const memorySet = (key, data, ttlMs = 30000) => {
  if (!key) return;
  const k = String(key);
  MapCache.set(k, { data, expiresAt: Date.now() + Number(ttlMs || 0) });
};

const memoryInvalidate = (key) => {
  if (!key) return;
  MapCache.delete(String(key));
};

const memoryInvalidateAll = () => MapCache.clear();

const get = async (key) => {
  if (redisClient.isReady()) return redisClient.get(key);
  return memoryGet(key);
};

const set = async (key, data, ttlMs = 30000) => {
  if (redisClient.isReady()) return redisClient.set(key, data, ttlMs);
  return memorySet(key, data, ttlMs);
};

const invalidate = async (key) => {
  if (redisClient.isReady()) return redisClient.del(key);
  return memoryInvalidate(key);
};

const invalidateAll = async () => {
  if (redisClient.isReady()) return false; // don't implement mass delete for Redis here
  return memoryInvalidateAll();
};

module.exports = { get, set, invalidate, invalidateAll };
