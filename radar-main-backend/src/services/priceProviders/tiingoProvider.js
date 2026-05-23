const axios = require('axios');

const API_BASE = 'https://api.tiingo.com';
const KEY = process.env.TIINGO_API_KEY;

async function fetchQuotes(symbols = []) {
  if (!Array.isArray(symbols) || symbols.length === 0) return [];
  const results = [];
  for (const s of symbols) {
    try {
      const resp = await axios.get(`${API_BASE}/tiingo/daily/${encodeURIComponent(s)}/prices`, {
        params: { token: KEY, resampleFreq: 'daily', format: 'json' },
        timeout: 15000,
      });
      const d = Array.isArray(resp.data) ? resp.data[0] : resp.data;
      results.push({ symbol: s, price: Number(d?.close ?? 0), raw: d });
    } catch (err) {
      results.push({ symbol: s, price: null, error: err.message });
    }
  }
  return results;
}

module.exports = { fetchQuotes };
