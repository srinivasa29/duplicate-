/**
 * fundamentalsEnrichmentService.js
 *
 * Fetch strategy:
 *   1. MongoDB (FundamentalsSnapshot) — served instantly if < 24h old
 *   2. Yahoo Finance quoteSummary    — on cache miss or forced refresh
 *   3. Persist to MongoDB            — so next call hits DB
 *   4. In-memory NodeCache (6 h)     — hot-path layer within same process
 *
 * Fields stored:
 *   pe, forwardPe, pb, ps, evEbitda, peg
 *   roe, roa, profitMargins, operatingMargins, grossMargins
 *   revenueGrowth, earningsGrowth
 *   debtToEquity, currentRatio, quickRatio
 *   marketCap, beta, dividendYield, payoutRatio
 *   fiftyTwoWeekHigh, fiftyTwoWeekLow
 *   volumeRatio, averageVolume
 *   sector, industry, country, longBusinessSummary, website
 *   valStatus, deliveryPct, asOf
 */

const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const NodeCache    = require('node-cache');
const logger       = require('../config/logger');
const FundamentalsSnapshot = require('../models/FundamentalsSnapshot');

// In-memory hot layer — avoids repeated Mongo queries for same symbol within same process
const memCache = new NodeCache({ stdTTL: 6 * 60 * 60, checkperiod: 30 * 60 });

// How old a DB snapshot can be before we consider it stale (default 24 h)
const DB_STALE_HOURS = Number(process.env.FUNDAMENTALS_STALE_HOURS || 24);

const CRYPTO_SYMBOLS = new Set([
    'BTC','ETH','SOL','XRP','BNB','ADA','DOT','DOGE','MATIC','LINK',
    'AVAX','ATOM','LTC','UNI','SHIB','TRX','ETC','FIL','NEAR','APT',
    'ARB','OP','INJ','SUI','SEI','PEPE','WIF','TON','FLOKI','BONK',
]);

const isCryptoSymbol = (symbol) => {
    const s = String(symbol || '').toUpperCase().replace(/USDT$/i, '').replace(/\.(NS|BO)$/i, '');
    return CRYPTO_SYMBOLS.has(s) || String(symbol).toUpperCase().endsWith('USDT');
};

const normalizeSymbol = (symbol) => {
    const s = String(symbol || '').trim().toUpperCase();
    if (isCryptoSymbol(s)) return s;
    if (s.endsWith('.NS') || s.endsWith('.BO')) return s;
    return `${s}.NS`;
};

const classifyValuation = (pe) => {
    if (pe == null || isNaN(pe)) return 'fair';
    if (pe < 15) return 'undervalued';
    if (pe > 35) return 'overvalued';
    return 'fair';
};

const pct = (v) => (v != null ? parseFloat((v * 100).toFixed(2)) : null);
const num = (v, dp = 2) => (v != null && Number.isFinite(Number(v)) ? parseFloat(Number(v).toFixed(dp)) : null);

// ── Crypto null-safe object ───────────────────────────────────────────────────
const CRYPTO_SNAPSHOT = (changePercent = 0) => ({
    pe: null, forwardPe: null, pb: null, ps: null, evEbitda: null, peg: null,
    roe: null, roa: null, profitMargins: null, operatingMargins: null, grossMargins: null,
    revenueGrowth: null, earningsGrowth: null, earningsQuarterlyGrowth: null,
    debtToEquity: null, currentRatio: null, quickRatio: null,
    marketCap: null, beta: null, dividendYield: null, payoutRatio: null,
    fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null,
    volumeRatio: 1, averageVolume: null,
    sector: 'Cryptocurrency', industry: 'Digital Assets', country: null,
    longBusinessSummary: null, fullTimeEmployees: null, website: null,
    valStatus: 'fair', deliveryPct: null,
    momentum: changePercent,
    asOf: new Date(),
    source: 'yahoo',
});

// ── Fetch fresh data from Yahoo Finance ──────────────────────────────────────
async function fetchFromYahoo(yahooSym, changePercent = 0) {
    const summary = await yahooFinance.quoteSummary(yahooSym, {
        modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile'],
    });

    const sd = summary?.summaryDetail        || {};
    const ks = summary?.defaultKeyStatistics || {};
    const fd = summary?.financialData        || {};
    const ap = summary?.assetProfile         || {};

    const shortPct = ks.shortPercentOfFloat;
    const deliveryPct = shortPct != null ? parseFloat((Math.max(0, (1 - shortPct) * 100)).toFixed(1)) : null;

    const price = sd.regularMarketPrice;
    const ma50  = sd.fiftyDayAverage;
    const momentum = price && ma50 && ma50 !== 0
        ? parseFloat(((price - ma50) / ma50 * 100).toFixed(2))
        : changePercent;

    return {
        pe:              num(sd.trailingPE ?? ks.trailingPE, 1),
        forwardPe:       num(sd.forwardPE  ?? ks.forwardPE, 1),
        pb:              num(sd.priceToBook ?? ks.priceToBook, 2),
        ps:              num(ks.priceToSalesTrailing12Months, 2),
        evEbitda:        num(ks.enterpriseToEbitda, 2),
        peg:             num(ks.pegRatio, 2),

        roe:             pct(fd.returnOnEquity),
        roa:             pct(fd.returnOnAssets),
        profitMargins:   pct(fd.profitMargins),
        operatingMargins: pct(fd.operatingMargins),
        grossMargins:    pct(fd.grossMargins),

        revenueGrowth:   pct(fd.revenueGrowth),
        earningsGrowth:  pct(fd.earningsGrowth),
        earningsQuarterlyGrowth: pct(ks.earningsQuarterlyGrowth),

        debtToEquity:    fd.debtToEquity != null ? parseFloat((fd.debtToEquity / 100).toFixed(2)) : null,
        currentRatio:    num(fd.currentRatio, 2),
        quickRatio:      num(fd.quickRatio, 2),

        marketCap:       num(sd.marketCap ?? ks.marketCap, 0),
        beta:            num(sd.beta, 2),
        dividendYield:   sd.dividendYield != null ? parseFloat((sd.dividendYield * 100).toFixed(2)) : null,
        payoutRatio:     pct(sd.payoutRatio),
        fiftyTwoWeekHigh: num(sd.fiftyTwoWeekHigh, 2),
        fiftyTwoWeekLow:  num(sd.fiftyTwoWeekLow, 2),

        volumeRatio:     sd.averageVolume10days > 0 && sd.averageVolume > 0
            ? parseFloat((sd.averageVolume10days / sd.averageVolume).toFixed(2))
            : 1,
        averageVolume:   num(sd.averageVolume, 0),

        sector:          ap.sector   || null,
        industry:        ap.industry || null,
        country:         ap.country  || null,
        longBusinessSummary: ap.longBusinessSummary || null,
        fullTimeEmployees: ap.fullTimeEmployees || null,
        website:         ap.website  || null,

        valStatus:       classifyValuation(sd.trailingPE ?? ks.trailingPE),
        deliveryPct,
        momentum,
        asOf:            new Date(),
        source:          'yahoo',
    };
}

// ── Persist to MongoDB ────────────────────────────────────────────────────────
async function persistToDb(symbol, data) {
    try {
        await FundamentalsSnapshot.findOneAndUpdate(
            { symbol: String(symbol).toUpperCase() },
            { ...data, symbol: String(symbol).toUpperCase() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        logger.debug(`[Fundamentals] Persisted ${symbol} to MongoDB`);
    } catch (err) {
        logger.warn(`[Fundamentals] DB persist failed for ${symbol}: ${err.message}`);
    }
}

// ── Main public function ──────────────────────────────────────────────────────
async function getFundamentals(symbol, changePercent = 0, { forceRefresh = false } = {}) {
    const yahooSym = normalizeSymbol(symbol);
    const dbKey    = String(symbol).toUpperCase().replace(/\.(NS|BO)$/i, '');
    const memKey   = `fund:${yahooSym}`;

    // Crypto: no fundamental data from Yahoo — return null-safe object
    if (isCryptoSymbol(symbol)) return CRYPTO_SNAPSHOT(changePercent);

    // ── Layer 1: In-memory (hot path) ─────────────────────────────────────
    if (!forceRefresh) {
        const hot = memCache.get(memKey);
        if (hot) return hot;
    }

    // ── Layer 2: MongoDB (warm path) ──────────────────────────────────────
    if (!forceRefresh) {
        try {
            const doc = await FundamentalsSnapshot.findOne({ symbol: dbKey }).lean();
            if (doc) {
                const ageHours = (Date.now() - new Date(doc.updatedAt || doc.asOf).getTime()) / 3_600_000;
                if (ageHours < DB_STALE_HOURS) {
                    const result = { ...doc, _id: undefined, __v: undefined };
                    memCache.set(memKey, result);
                    logger.debug(`[Fundamentals] DB hit for ${dbKey} (${ageHours.toFixed(1)}h old)`);
                    return result;
                }
                logger.info(`[Fundamentals] DB stale for ${dbKey} (${ageHours.toFixed(1)}h) — refreshing`);
            }
        } catch (err) {
            logger.warn(`[Fundamentals] DB lookup failed for ${dbKey}: ${err.message}`);
        }
    }

    // ── Layer 3: Yahoo Finance (cold path) ────────────────────────────────
    try {
        logger.info(`[Fundamentals] Fetching from Yahoo Finance for ${yahooSym}`);
        const result = await fetchFromYahoo(yahooSym, changePercent);
        memCache.set(memKey, result);
        await persistToDb(dbKey, result); // fire-and-forget persist
        logger.info(`[Fundamentals] ✅ ${yahooSym}: PE=${result.pe}, ROE=${result.roe}%, MktCap=${result.marketCap}`);
        return result;
    } catch (err) {
        logger.warn(`[Fundamentals] Yahoo failed for ${yahooSym}: ${err.message}`);
        // Try returning stale DB data as last resort
        try {
            const stale = await FundamentalsSnapshot.findOne({ symbol: dbKey }).lean();
            if (stale) {
                logger.info(`[Fundamentals] Serving stale DB snapshot for ${dbKey}`);
                return stale;
            }
        } catch (_) {}
        // Hard null-safe fallback
        return {
            pe: null, forwardPe: null, pb: null, roe: null, debtToEquity: null,
            revenueGrowth: null, profitMargins: null, marketCap: null,
            beta: null, dividendYield: null, sector: 'Equity', industry: '',
            valStatus: 'fair', deliveryPct: null, momentum: changePercent,
            volumeRatio: 1, asOf: new Date(), source: 'fallback',
        };
    }
}

// ── Batch enrichment ─────────────────────────────────────────────────────────
async function getBatchFundamentals(items, concurrency = 3) {
    const results = new Map();
    const queue   = [...items];
    const worker  = async () => {
        let item;
        while ((item = queue.shift())) {
            const sym = item.symbol || item;
            const chg = item.changePercent || 0;
            results.set(sym, await getFundamentals(sym, chg));
        }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    return results;
}

module.exports = { getFundamentals, getBatchFundamentals, normalizeSymbol };
