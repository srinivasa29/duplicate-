require('dotenv').config();
const axios = require('axios');
const path = require('path');

const { connectDB } = require('../src/config/db');
const OHLC = require('../src/models/OHLC');
const logger = require('../src/config/logger');

// Define universe (same as frontend config)
const INDICES = {
  SENSEX_30: [
    "ADANIPORTS", "ASIANPAINT", "AXISBANK", "BAJFINANCE", "BAJAJFINSV",
    "BHARTIARTL", "HCLTECH", "HDFCBANK", "HINDUNILVR", "ICICIBANK",
    "INDUSINDBK", "INFY", "ITC", "JSWSTEEL", "KOTAKBANK",
    "LT", "M&M", "MARUTI", "NESTLEIND", "NTPC",
    "POWERGRID", "RELIANCE", "SBIN", "SUNPHARMA", "TCS",
    "TATAMOTORS", "TATASTEEL", "TECHM", "TITAN", "ULTRACEMCO"
  ],
  NIFTY_50: [
    "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK",
    "BAJAJ-AUTO", "BAJFINANCE", "BAJAJFINSV", "BEL", "BPCL",
    "BHARTIARTL", "BRITANNIA", "CIPLA", "COALINDIA", "DIVISLAB",
    "DRREDDY", "EICHERMOT", "GRASIM", "HCLTECH", "HDFCBANK",
    "HDFCLIFE", "HINDALCO", "HINDUNILVR", "ICICIBANK", "INDUSINDBK",
    "INFY", "ITC", "JSWSTEEL", "KOTAKBANK", "LT",
    "LTIM", "M&M", "MARUTI", "NESTLEIND", "NTPC",
    "ONGC", "POWERGRID", "RELIANCE", "SBILIFE", "SHRIRAMFIN",
    "SBIN", "SUNPHARMA", "TCS", "TATACONSUM", "TATAMOTORS",
    "TATASTEEL", "TECHM", "TITAN", "TRENT", "ULTRACEMCO"
  ]
};

const getUniqueUniverse = () => {
  const combined = [...INDICES.SENSEX_30, ...INDICES.NIFTY_50];
  return [...new Set(combined)];
};

const TWELVE_KEY = process.env.TWELVE_API_KEY || process.env.TWELVE_DATA_API_KEY;
const EXCHANGE = (process.env.EXCHANGE || 'NSE').toUpperCase();
const OUTPUT_SIZE = process.env.OUTPUT_SIZE || 500;

if (!TWELVE_KEY) {
  logger.error('Missing TWELVE_API_KEY in environment. Aborting seed.');
  process.exit(1);
}

const fetchSymbolOHLC = async (symbol) => {
  const apiSymbol = `${symbol}.${EXCHANGE}`;
  const url = `https://api.twelvedata.com/time_series`;
  try {
    const res = await axios.get(url, {
      params: {
        symbol: apiSymbol,
        interval: '1day',
        outputsize: OUTPUT_SIZE,
        format: 'JSON',
        apikey: TWELVE_KEY,
      },
      timeout: 20000,
    });

    if (res.data && res.data.values && Array.isArray(res.data.values)) {
      // values are newest-first; convert to oldest-first
      return res.data.values.slice().reverse();
    }

    logger.warn(`No values for ${apiSymbol}`, res.data);
    return [];
  } catch (err) {
    logger.error(`Failed to fetch ${apiSymbol}: ${err.message}`);
    return [];
  }
};

const upsertOHLCBatch = async (symbol, rows) => {
  if (!rows || rows.length === 0) return 0;

  const ops = rows.map((r) => {
    const ts = new Date(r.datetime || r.timestamp || r.date);
    return {
      updateOne: {
        filter: { symbol: String(symbol).toUpperCase(), timeframe: '1d', timestamp: ts },
        update: {
          $set: {
            symbol: String(symbol).toUpperCase(),
            exchange: EXCHANGE,
            timeframe: '1d',
            timestamp: ts,
            open: Number(r.open),
            high: Number(r.high),
            low: Number(r.low),
            close: Number(r.close),
            volume: Number(r.volume || 0),
            source: 'twelvedata',
          }
        },
        upsert: true,
      }
    };
  });

  try {
    const result = await OHLC.bulkWrite(ops, { ordered: false });
    return result.nUpserted + (result.nModified || 0);
  } catch (err) {
    logger.error(`bulkWrite failed for ${symbol}: ${err.message}`);
    return 0;
  }
};

const main = async () => {
  const connected = await connectDB();
  if (!connected) {
    logger.error('Could not connect to DB, aborting.');
    process.exit(1);
  }
  // Acquire a distributed lock to avoid concurrent/sequential runs
  const locks = require('mongoose').connection.collection('cronLocks');
  const LOCK_NAME = 'seedUniverseOHLC';
  const LOCK_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

  // Ensure TTL index exists (expiresAt field)
  try {
    await locks.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  } catch (e) {
    // ignore index exists errors
  }

  const now = Date.now();
  const expiresAt = new Date(now + LOCK_TTL_MS);

  const lockRes = await locks.findOneAndUpdate(
    { name: LOCK_NAME, $or: [ { locked: { $exists: false } }, { locked: false }, { expiresAt: { $lt: new Date() } } ] },
    { $set: { name: LOCK_NAME, locked: true, startedAt: new Date(), expiresAt } },
    { upsert: true, returnDocument: 'after' }
  );

  if (!lockRes.value || !lockRes.value.locked) {
    logger.warn('Another seeder run appears to be active. Exiting.');
    process.exit(0);
  }

  const universe = getUniqueUniverse();
  logger.info(`Beginning seed for ${universe.length} symbols on exchange ${EXCHANGE}`);

  try {
    for (const symbol of universe) {
    logger.info(`Fetching OHLC for ${symbol}`);
    const rows = await fetchSymbolOHLC(symbol);
    const count = await upsertOHLCBatch(symbol, rows);
    logger.info(`Inserted/updated ${count} rows for ${symbol}`);

    // Respect rate limits: small delay between symbols
    await new Promise((res) => setTimeout(res, 600));
  }

    logger.info('Seed complete.');

    // Release lock
    try {
      await locks.updateOne({ name: LOCK_NAME }, { $set: { locked: false, finishedAt: new Date(), success: true } });
    } catch (e) {
      logger.warn('Failed to release seeder lock', { error: e.message });
    }

    process.exit(0);
  } catch (err) {
    logger.error('Seed failed', err);
    try {
      await locks.updateOne({ name: LOCK_NAME }, { $set: { locked: false, finishedAt: new Date(), success: false, error: err.message } });
    } catch (e) {
      logger.warn('Failed to release seeder lock after error', { error: e.message });
    }
    process.exit(1);
  }
};

main().catch((err) => {
  logger.error('Seed failed', err);
  process.exit(1);
});
