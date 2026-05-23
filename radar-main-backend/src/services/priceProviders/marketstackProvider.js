const axios = require('axios');

const API_BASE = 'http://api.marketstack.com/v1';
const KEY = process.env.MARKETSTACK_API_KEY;

async function fetchQuotes(symbols = []) {
  if (!Array.isArray(symbols) || symbols.length === 0) return [];
  // marketstack expects single symbol per request for real-time; batch sequentially
  const results = [];
  for (const s of symbols) {
    try {
      const resp = await axios.get(`${API_BASE}/eod`, { params: { access_key: KEY, symbols: s, limit: 1 }, timeout: 15000 });
      const d = resp.data?.data?.[0];
      results.push({ symbol: s, price: Number(d?.close ?? d?.adj_close ?? 0), raw: d });
    } catch (err) {
      results.push({ symbol: s, price: null, error: err.message });
    }
  }
  return results;
}

module.exports = { fetchQuotes };
