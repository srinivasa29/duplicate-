import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const ENDPOINT = `${API_BASE}/api/market/universe`;
const CACHE_KEY = 'radar_market_universe_v1';

export const fetchUniverse = async (force = false) => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached && !force) {
      return JSON.parse(cached);
    }

    const resp = await axios.get(ENDPOINT);
    const payload = resp.data?.data ?? resp.data;
    const universe = payload?.universe || [];
    localStorage.setItem(CACHE_KEY, JSON.stringify(universe));
    return universe;
  } catch (err) {
    console.error('Failed to fetch universe from server, falling back to local config', err?.message || err);
    // Fallback to local static file if available
    try {
      const local = await import('../config/marketUniverse');
      const u = local.getUniqueUniverse();
      localStorage.setItem(CACHE_KEY, JSON.stringify(u));
      return u;
    } catch (e) {
      console.error('No local fallback available', e);
      return [];
    }
  }
};

export const getCachedUniverse = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return [];
    return JSON.parse(cached);
  } catch (err) {
    return [];
  }
};

export const isValidSymbolSync = (symbol) => {
  if (!symbol) return false;
  const u = getCachedUniverse();
  const s = String(symbol).toUpperCase().replace(/\.(NS|BO)$/i, '');
  return u.includes(s);
};

export default { fetchUniverse, getCachedUniverse, isValidSymbolSync };
