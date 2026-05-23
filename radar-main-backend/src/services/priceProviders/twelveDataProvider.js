const axios = require('axios');

const API_BASE = 'https://api.twelvedata.com';
const KEY = process.env.TWELVE_API_KEY;

async function fetchQuotes(symbols = []) {
  if (!Array.isArray(symbols) || symbols.length === 0) return [];
  const joined = symbols.join(',');
  const url = `${API_BASE}/price?symbol=${encodeURIComponent(joined)}&apikey=${KEY}`;

  const resp = await axios.get(url, { timeout: 15000 });
  // Twelve Data returns object for single symbol or map for multiple
  const data = resp.data || {};
  if (Array.isArray(symbols) && symbols.length === 1) {
    const s = symbols[0];
    return [{ symbol: s, price: Number(data.price || data, 10), raw: data }];
  }

  return Object.keys(data).map(k => ({ symbol: k, price: Number(data[k]?.price ?? data[k]), raw: data[k] }));
}

module.exports = { fetchQuotes };
