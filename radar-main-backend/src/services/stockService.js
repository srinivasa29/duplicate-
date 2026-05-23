const axios = require('axios');
const { generateHistory } = require('../utils/mockGenerator');
const logger = require('../utils/logger');
const { getActiveSymbolsWithSuffix, SEED_SYMBOLS } = require('../utils/symbolRegistry');

const QUOTE_CACHE_TTL_MS = Number.parseInt(process.env.STOCK_QUOTES_CACHE_TTL_MS || '20000', 10);
// Reduced from 180s → 90s so blocked providers recover faster after transient failures
const PROVIDER_FAILURE_COOLDOWN_MS = Number.parseInt(process.env.STOCK_PROVIDER_FAILURE_COOLDOWN_MS || '90000', 10);
const WARNING_THROTTLE_MS = Number.parseInt(process.env.STOCK_WARNING_THROTTLE_MS || '60000', 10);
const WARNING_THROTTLE_MAX_KEYS = Number.parseInt(process.env.STOCK_WARNING_THROTTLE_MAX_KEYS || '500', 10);
const TIINGO_BASE_URL = 'https://api.tiingo.com/tiingo';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const MARKETSTACK_BASE_URL = 'https://api.marketstack.com/v1';

const DEFAULT_MARKET_REGION = String(process.env.DEFAULT_MARKET_REGION || 'IN').toUpperCase();

// These are last-resort fallbacks only (used when DB is empty and no env override)
// Keep them as a minimal sentinel — real symbols come from DB via getActiveSymbols()
const FALLBACK_SYMBOLS_BY_REGION = {
    IN: SEED_SYMBOLS.map(s => `${s}.NS`),
    US: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'JPM', 'XOM', 'UNH'],
    GLOBAL: SEED_SYMBOLS.slice(0, 5).map(s => `${s}.NS`),
};

// Cache for the DB-resolved list so we don't hit Mongo every request
let _resolvedSymbolsCache = null;
let _resolvedSymbolsExpiry = 0;
const SYMBOLS_CACHE_TTL_MS = 5 * 60 * 1000; // re-read DB every 5 minutes

const getDefaultSymbols = async () => {
    // 1. Env override (comma-separated)
    const fromEnv = process.env.STOCK_SYMBOLS;
    if (fromEnv) {
        const parsed = fromEnv.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        if (parsed.length) return parsed;
    }

    // 2. DB cache
    const now = Date.now();
    if (_resolvedSymbolsCache && now < _resolvedSymbolsExpiry) {
        return _resolvedSymbolsCache;
    }

    try {
        const symbols = await getActiveSymbolsWithSuffix();
        if (symbols.length > 0) {
            _resolvedSymbolsCache = symbols;
            _resolvedSymbolsExpiry = now + SYMBOLS_CACHE_TTL_MS;
            return symbols;
        }
    } catch (err) {
        logger.error(`stockService.getDefaultSymbols DB error: ${err.message}`);
    }

    // 3. Hardcoded fallback
    return FALLBACK_SYMBOLS_BY_REGION[DEFAULT_MARKET_REGION] || FALLBACK_SYMBOLS_BY_REGION.IN;
};

let quotesCache = {
    expiresAt: 0,
    data: null,
};

let quotesInFlightPromise = null;

// Stale-serve: keep the last known-good payload even after expiry
// so we can serve it when all live providers fail
let lastKnownGoodQuotes = null;

const providerState = {
    yahoo: { blockedUntil: 0, lastError: null },
    tiingo: { blockedUntil: 0, lastError: null },
    finnhub: { blockedUntil: 0, lastError: null },
    polygon: { blockedUntil: 0, lastError: null },
    marketstack: { blockedUntil: 0, lastError: null },
    stooq: { blockedUntil: 0, lastError: null },
};
const warningState = new Map();

const isProviderBlocked = (name) => Date.now() < (providerState[name]?.blockedUntil || 0);

const markProviderFailure = (name, errorMessage) => {
    if (!providerState[name]) return;
    providerState[name].blockedUntil = Date.now() + PROVIDER_FAILURE_COOLDOWN_MS;
    providerState[name].lastError = errorMessage;
};

const clearProviderFailure = (name) => {
    if (!providerState[name]) return;
    providerState[name].blockedUntil = 0;
    providerState[name].lastError = null;
};

const pruneWarningState = (now) => {
    if (warningState.size <= WARNING_THROTTLE_MAX_KEYS) {
        return;
    }

    for (const [key, blockedUntil] of warningState) {
        if (blockedUntil <= now) {
            warningState.delete(key);
        }
    }

    while (warningState.size > WARNING_THROTTLE_MAX_KEYS) {
        const oldestKey = warningState.keys().next().value;
        if (!oldestKey) break;
        warningState.delete(oldestKey);
    }
};

const warnThrottled = (key, message, meta = {}) => {
    const now = Date.now();
    pruneWarningState(now);

    const blockedUntil = warningState.get(key) || 0;
    if (now < blockedUntil) {
        return;
    }

    warningState.set(key, now + WARNING_THROTTLE_MS);
    logger.warn(message, meta);
};

const parseStockSymbols = async () => {
    // getDefaultSymbols already handles env override + DB + fallback
    return getDefaultSymbols();
};

const fallbackStockMeta = {
    'RELIANCE.NS': { name: 'Reliance Industries Ltd', sector: 'Energy', peRatio: 24.1, dividendYield: 0.34 },
    'TCS.NS': { name: 'Tata Consultancy Services Ltd', sector: 'Information Technology', peRatio: 30.6, dividendYield: 1.17 },
    'HDFCBANK.NS': { name: 'HDFC Bank Ltd', sector: 'Financial Services', peRatio: 18.9, dividendYield: 0.97 },
    'INFY.NS': { name: 'Infosys Ltd', sector: 'Information Technology', peRatio: 26.4, dividendYield: 2.11 },
    'ICICIBANK.NS': { name: 'ICICI Bank Ltd', sector: 'Financial Services', peRatio: 20.2, dividendYield: 0.72 },
    'SBIN.NS': { name: 'State Bank of India', sector: 'Financial Services', peRatio: 11.8, dividendYield: 1.62 },
    'LT.NS': { name: 'Larsen & Toubro Ltd', sector: 'Industrials', peRatio: 33.1, dividendYield: 0.91 },
    'ITC.NS': { name: 'ITC Ltd', sector: 'Consumer Defensive', peRatio: 28.3, dividendYield: 3.41 },
    'HINDUNILVR.NS': { name: 'Hindustan Unilever Ltd', sector: 'Consumer Defensive', peRatio: 56.7, dividendYield: 1.58 },
    'KOTAKBANK.NS': { name: 'Kotak Mahindra Bank Ltd', sector: 'Financial Services', peRatio: 22.8, dividendYield: 0.09 },
    'BHARTIARTL.NS': { name: 'Bharti Airtel Ltd', sector: 'Communication Services', peRatio: 64.4, dividendYield: 0.23 },
    'BAJFINANCE.NS': { name: 'Bajaj Finance Ltd', sector: 'Financial Services', peRatio: 35.7, dividendYield: 0.34 },
    // ── No-suffix versions (Yahoo Finance often strips .NS) ──────────────────
    RELIANCE:    { name: 'Reliance Industries Ltd',       sector: 'Energy',                  peRatio: 24.1,  dividendYield: 0.34 },
    TCS:         { name: 'Tata Consultancy Services Ltd', sector: 'Information Technology',   peRatio: 30.6,  dividendYield: 1.17 },
    HDFCBANK:    { name: 'HDFC Bank Ltd',                 sector: 'Financial Services',       peRatio: 18.9,  dividendYield: 0.97 },
    INFY:        { name: 'Infosys Ltd',                   sector: 'Information Technology',   peRatio: 26.4,  dividendYield: 2.11 },
    ICICIBANK:   { name: 'ICICI Bank Ltd',                sector: 'Financial Services',       peRatio: 20.2,  dividendYield: 0.72 },
    SBIN:        { name: 'State Bank of India',           sector: 'Financial Services',       peRatio: 11.8,  dividendYield: 1.62 },
    LT:          { name: 'Larsen & Toubro Ltd',           sector: 'Industrials',              peRatio: 33.1,  dividendYield: 0.91 },
    ITC:         { name: 'ITC Ltd',                       sector: 'Consumer Defensive',       peRatio: 28.3,  dividendYield: 3.41 },
    HINDUNILVR:  { name: 'Hindustan Unilever Ltd',        sector: 'Consumer Defensive',       peRatio: 56.7,  dividendYield: 1.58 },
    KOTAKBANK:   { name: 'Kotak Mahindra Bank Ltd',       sector: 'Financial Services',       peRatio: 22.8,  dividendYield: 0.09 },
    BHARTIARTL:  { name: 'Bharti Airtel Ltd',             sector: 'Communication Services',   peRatio: 64.4,  dividendYield: 0.23 },
    BAJFINANCE:  { name: 'Bajaj Finance Ltd',             sector: 'Financial Services',       peRatio: 35.7,  dividendYield: 0.34 },
    AXISBANK:    { name: 'Axis Bank Ltd',                 sector: 'Financial Services',       peRatio: 14.8,  dividendYield: 0.10 },
    HCLTECH:     { name: 'HCL Technologies Ltd',          sector: 'Information Technology',   peRatio: 24.5,  dividendYield: 3.20 },
    WIPRO:       { name: 'Wipro Ltd',                     sector: 'Information Technology',   peRatio: 22.1,  dividendYield: 0.09 },
    TECHM:       { name: 'Tech Mahindra Ltd',             sector: 'Information Technology',   peRatio: 28.3,  dividendYield: 2.50 },
    BAJAJFINSV:  { name: 'Bajaj Finserv Ltd',             sector: 'Financial Services',       peRatio: 16.5,  dividendYield: 0.07 },
    MARUTI:      { name: 'Maruti Suzuki India Ltd',       sector: 'Consumer Cyclical',        peRatio: 28.9,  dividendYield: 0.86 },
    TITAN:       { name: 'Titan Company Ltd',             sector: 'Consumer Cyclical',        peRatio: 89.2,  dividendYield: 0.27 },
    ASIANPAINT:  { name: 'Asian Paints Ltd',              sector: 'Consumer Cyclical',        peRatio: 56.3,  dividendYield: 0.99 },
    SUNPHARMA:   { name: 'Sun Pharmaceutical Industries', sector: 'Healthcare',               peRatio: 35.6,  dividendYield: 0.70 },
    DRREDDY:     { name: 'Dr Reddys Laboratories Ltd',   sector: 'Healthcare',               peRatio: 19.8,  dividendYield: 0.52 },
    CIPLA:       { name: 'Cipla Ltd',                     sector: 'Healthcare',               peRatio: 27.1,  dividendYield: 0.36 },
    ONGC:        { name: 'Oil & Natural Gas Corporation', sector: 'Energy',                  peRatio: 8.2,   dividendYield: 4.80 },
    NTPC:        { name: 'NTPC Ltd',                      sector: 'Utilities',                peRatio: 14.2,  dividendYield: 2.50 },
    POWERGRID:   { name: 'Power Grid Corporation',        sector: 'Utilities',                peRatio: 17.1,  dividendYield: 3.90 },
    COALINDIA:   { name: 'Coal India Ltd',                sector: 'Energy',                  peRatio: 7.4,   dividendYield: 6.20 },
    TATASTEEL:   { name: 'Tata Steel Ltd',                sector: 'Basic Materials',          peRatio: 14.3,  dividendYield: 1.20 },
    JSWSTEEL:    { name: 'JSW Steel Ltd',                 sector: 'Basic Materials',          peRatio: 18.6,  dividendYield: 0.95 },
    HINDALCO:    { name: 'Hindalco Industries Ltd',       sector: 'Basic Materials',          peRatio: 11.2,  dividendYield: 0.70 },
    ULTRACEMCO:  { name: 'UltraTech Cement Ltd',          sector: 'Basic Materials',          peRatio: 39.4,  dividendYield: 0.35 },
    GRASIM:      { name: 'Grasim Industries Ltd',         sector: 'Basic Materials',          peRatio: 18.7,  dividendYield: 0.48 },
    TATAMOTORS:  { name: 'Tata Motors Ltd',               sector: 'Consumer Cyclical',        peRatio: 9.1,   dividendYield: 0.40 },
    M_M:         { name: 'Mahindra & Mahindra Ltd',       sector: 'Consumer Cyclical',        peRatio: 27.3,  dividendYield: 0.75 },
    'M&M':       { name: 'Mahindra & Mahindra Ltd',       sector: 'Consumer Cyclical',        peRatio: 27.3,  dividendYield: 0.75 },
    EICHERMOT:   { name: 'Eicher Motors Ltd',             sector: 'Consumer Cyclical',        peRatio: 31.5,  dividendYield: 1.20 },
    HEROMOTOCO:  { name: 'Hero MotoCorp Ltd',             sector: 'Consumer Cyclical',        peRatio: 22.4,  dividendYield: 3.10 },
    BPCL:        { name: 'Bharat Petroleum Corporation',  sector: 'Energy',                  peRatio: 5.9,   dividendYield: 5.70 },
    IOC:         { name: 'Indian Oil Corporation Ltd',    sector: 'Energy',                  peRatio: 5.1,   dividendYield: 7.20 },
    ADANIENT:    { name: 'Adani Enterprises Ltd',         sector: 'Industrials',              peRatio: 85.2,  dividendYield: 0.05 },
    ADANIPORTS:  { name: 'Adani Ports & SEZ Ltd',         sector: 'Industrials',              peRatio: 28.4,  dividendYield: 0.60 },
    ADANIGREEN:  { name: 'Adani Green Energy Ltd',        sector: 'Utilities',                peRatio: 210.5, dividendYield: 0 },
    INDUSINDBK:  { name: 'IndusInd Bank Ltd',             sector: 'Financial Services',       peRatio: 10.2,  dividendYield: 1.40 },
    HDFCLIFE:    { name: 'HDFC Life Insurance',           sector: 'Financial Services',       peRatio: 88.3,  dividendYield: 0.30 },
    SBILIFE:     { name: 'SBI Life Insurance',            sector: 'Financial Services',       peRatio: 72.5,  dividendYield: 0.20 },
    // ── US stocks ────────────────────────────────────────────────────────────
    AAPL: { name: 'Apple Inc.', sector: 'Technology', peRatio: 29.4, dividendYield: 0.52 },
    MSFT: { name: 'Microsoft Corporation', sector: 'Technology', peRatio: 36.1, dividendYield: 0.74 },
    GOOGL: { name: 'Alphabet Inc.', sector: 'Communication Services', peRatio: 24.3, dividendYield: 0.42 },
    AMZN: { name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', peRatio: 52.8, dividendYield: 0 },
    META: { name: 'Meta Platforms Inc.', sector: 'Communication Services', peRatio: 28.9, dividendYield: 0.41 },
    NVDA: { name: 'NVIDIA Corporation', sector: 'Technology', peRatio: 64.2, dividendYield: 0.03 },
    TSLA: { name: 'Tesla Inc.', sector: 'Consumer Cyclical', peRatio: 62.5, dividendYield: 0 },
    JPM: { name: 'JPMorgan Chase & Co.', sector: 'Financial Services', peRatio: 13.7, dividendYield: 2.32 },
    XOM: { name: 'Exxon Mobil Corporation', sector: 'Energy', peRatio: 12.3, dividendYield: 3.41 },
    UNH: { name: 'UnitedHealth Group Incorporated', sector: 'Healthcare', peRatio: 21.1, dividendYield: 1.57 },
    WMT: { name: 'Walmart Inc.', sector: 'Consumer Defensive', peRatio: 31.8, dividendYield: 1.31 },
    BA: { name: 'The Boeing Company', sector: 'Industrials', peRatio: null, dividendYield: 0 },
    JINDRILL: { 
        name: 'Jindal Drilling & Industries Ltd', 
        sector: 'Energy', 
        peRatio: 9.21, 
        dividendYield: 0.85,
        details: {
            market_cap: '₹1,708 Cr',
            debt_to_equity: 0.12,
            pb_ratio: 1.45,
            ev_ebitda: 6.80,
            peg_ratio: 0.92,
            roe: '14.7%',
            roce: '18.2%',
            int_coverage: 14.2,
            current_ratio: 2.45,
            rev_growth: '12.4%',
            profit_growth: '8.9%',
            eps: 54.20,
            book_value: 388.15,
            face_value: 10.00
        }
    },
};

// Lookup sector for a symbol — checks both suffixed and plain versions
const resolveSectorForSymbol = (symbol) => {
    const s = String(symbol || '').toUpperCase();
    const meta = fallbackStockMeta[s]
        || fallbackStockMeta[s.replace(/\.(NS|BO)$/i, '')];
    return meta?.sector || null;
};

const fallbackPriceMap = {
    'RELIANCE.NS': 2968.5,
    'TCS.NS': 4098.2,
    'HDFCBANK.NS': 1638.6,
    'INFY.NS': 1672.9,
    'ICICIBANK.NS': 1124.4,
    'SBIN.NS': 825.1,
    'LT.NS': 3712.8,
    'ITC.NS': 427.3,
    'HINDUNILVR.NS': 2479.5,
    'KOTAKBANK.NS': 1820.2,
    'BHARTIARTL.NS': 1414.3,
    'BAJFINANCE.NS': 7248.7,
    AAPL: 212.4,
    MSFT: 438.2,
    GOOGL: 176.1,
    AMZN: 187.6,
    META: 509.8,
    NVDA: 924.5,
    TSLA: 196.3,
    JPM: 201.2,
    XOM: 118.4,
    UNH: 521.7,
    WMT: 68.3,
    BA: 177.9,
    JINDRILL: 562.9,
};

const buildFallbackQuotes = (symbols) => symbols.map((symbol, index) => {
    const seed = symbol.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const basePrice = fallbackPriceMap[symbol] || (50 + (seed % 200));
    const drift = ((seed % 9) - 4) * 0.22;
    const dailyChange = Number((drift + ((index % 3) * 0.08)).toFixed(2));

    return {
        symbol,
        name: fallbackStockMeta[symbol]?.name || symbol,
        price: Number(basePrice.toFixed(2)),
        change: dailyChange,
        type: 'STOCK',
        details: buildStockDetails(
            symbol,
            NaN,
            fallbackStockMeta[symbol]?.sector,
            fallbackStockMeta[symbol]?.name,
            fallbackStockMeta[symbol]?.peRatio,
            fallbackStockMeta[symbol]?.dividendYield,
        ),
        financials: null,
    };
});

const hasEnoughLiveData = (quotes, expectedCount = 0) => {
    if (!Array.isArray(quotes)) {
        return false;
    }

    const validPriced = quotes.filter((quote) => Number(quote.price) > 0).length;
    
    if (expectedCount > 0 && expectedCount < 6) {
        return validPriced >= Math.max(1, Math.floor(expectedCount * 0.5));
    }

    if (quotes.length < 6) {
        return false;
    }

    return validPriced >= Math.max(4, Math.floor(quotes.length * 0.5));
};

const buildStockDetails = (symbol, marketCap, sector, longName, peRatio, dividendYield) => {
    const resolvedSector = sector || resolveSectorForSymbol(symbol) || 'Unknown';
    const meta = fallbackStockMeta[symbol] || fallbackStockMeta[String(symbol || '').replace(/\.(NS|BO)$/i, '')] || {};
    return {
        pe_ratio: Number.isFinite(peRatio) ? peRatio : meta.peRatio ?? null,
        market_cap: Number.isFinite(marketCap) ? `$${(marketCap / 1e9).toFixed(2)}B` : 'N/A',
        dividend_yield: Number.isFinite(dividendYield)
            ? dividendYield.toFixed(2)
            : Number.isFinite(meta.dividendYield)
                ? Number(meta.dividendYield).toFixed(2)
                : 'N/A',
        sector: resolvedSector,
        about: `${longName || meta.name || symbol} market data sourced from live providers.`,
    };
};

const toStooqSymbol = (symbol) => {
    const normalized = String(symbol || '').toUpperCase();
    if (normalized.endsWith('.NS') || normalized.endsWith('.BO')) {
        return `${normalized.split('.')[0].toLowerCase()}.in`;
    }

    if (normalized.includes('.')) {
        const [base, market] = normalized.split('.');
        return `${base.toLowerCase()}.${String(market || 'US').toLowerCase()}`;
    }

    return `${normalized.toLowerCase()}.us`;
};

const normalizeStooqSymbol = (stooqSymbol) => {
    const upper = String(stooqSymbol || '').toUpperCase();
    if (upper.endsWith('.IN')) {
        return `${upper.replace('.IN', '')}.NS`;
    }
    if (upper.endsWith('.US')) {
        return upper.replace('.US', '');
    }

    return upper;
};

const toMarketstackSymbol = (symbol) => {
    const normalized = String(symbol || '').toUpperCase().trim();
    if (normalized.endsWith('.NS') || normalized.endsWith('.BO')) {
        return normalized;
    }
    if (normalized.includes('.')) {
        return normalized.split('.')[0];
    }
    return normalized;
};

const fetchYahooQuotes = async (symbols) => {
    const response = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote', {
        params: { symbols: symbols.join(',') },
        timeout: 5000,
        headers: {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json',
        },
    });

    const results = response.data?.quoteResponse?.result || [];
    return results
        .filter((item) => item?.symbol)
        .map((item) => ({
            symbol: item.symbol.toUpperCase(),
            name: item.longName || item.shortName || item.symbol,
            price: Number(item.regularMarketPrice) || 0,
            change: Number(item.regularMarketChangePercent) || 0,
            volume: Number(item.regularMarketVolume) || 0,
            dayLow: Number(item.regularMarketDayLow) || Number(item.regularMarketPrice) || 0,
            dayHigh: Number(item.regularMarketDayHigh) || Number(item.regularMarketPrice) || 0,
            type: 'STOCK',
            details: buildStockDetails(
                item.symbol.toUpperCase(),
                Number(item.marketCap),
                fallbackStockMeta[item.symbol.toUpperCase()]?.sector,
                item.longName || item.shortName,
                Number(item.trailingPE ?? item.forwardPE),
                Number(item.trailingAnnualDividendYield) * 100,
            ),
            financials: null,
        }));
};

const fetchYahooChartQuotes = async (symbols) => {
    const requests = symbols.map(async (symbol) => {
        const normalizedSymbol = String(symbol || '').toUpperCase();
        try {
            const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${normalizedSymbol}`, {
                params: {
                    range: '5d',
                    interval: '1d',
                    includePrePost: false,
                },
                timeout: 6000,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    Accept: 'application/json',
                },
            });

            const result = response.data?.chart?.result?.[0];
            const closes = result?.indicators?.quote?.[0]?.close || [];
            const volumes = result?.indicators?.quote?.[0]?.volume || [];
            const lows = result?.indicators?.quote?.[0]?.low || [];
            const highs = result?.indicators?.quote?.[0]?.high || [];
            const validCloses = closes.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);

            if (!validCloses.length) {
                return null;
            }

            const last = validCloses[validCloses.length - 1];
            const previous = validCloses.length > 1 ? validCloses[validCloses.length - 2] : last;
            const change = previous > 0 ? Number((((last - previous) / previous) * 100).toFixed(2)) : 0;
            const lastVol = volumes.length > 0 ? Number(volumes[volumes.length - 1]) : 0;
            const lastLow = lows.length > 0 ? Number(lows[lows.length - 1]) : Number(last);
            const lastHigh = highs.length > 0 ? Number(highs[highs.length - 1]) : Number(last);

            return {
                symbol: normalizedSymbol,
                name: result?.meta?.longName || result?.meta?.shortName || fallbackStockMeta[normalizedSymbol]?.name || normalizedSymbol,
                price: Number(last.toFixed(2)),
                change,
                volume: Number.isFinite(lastVol) ? lastVol : 0,
                dayLow: Number.isFinite(lastLow) ? Number(lastLow.toFixed(2)) : Number(last.toFixed(2)),
                dayHigh: Number.isFinite(lastHigh) ? Number(lastHigh.toFixed(2)) : Number(last.toFixed(2)),
                type: 'STOCK',
                details: buildStockDetails(
                    normalizedSymbol,
                    NaN,
                    fallbackStockMeta[normalizedSymbol]?.sector,
                    result?.meta?.longName || result?.meta?.shortName,
                    NaN,
                    NaN,
                ),
                financials: null,
            };
        } catch (_error) {
            return null;
        }
    });

    const rows = await Promise.all(requests);
    return rows.filter(Boolean);
};

const fetchTiingoQuotes = async (symbols) => {
    if (!process.env.TIINGO_API_KEY) {
        throw new Error('Missing TIINGO_API_KEY');
    }

    const normalizedSymbols = [...new Set((symbols || []).map((symbol) => String(symbol || '').toUpperCase()))];
    if (!normalizedSymbols.length) {
        return [];
    }

    const requests = normalizedSymbols.map(async (symbol) => {
        const ticker = symbol;

        try {
            const response = await axios.get(`${TIINGO_BASE_URL}/daily/${encodeURIComponent(ticker)}/prices`, {
                params: {
                    token: process.env.TIINGO_API_KEY,
                    resampleFreq: 'daily',
                    columns: 'date,close',
                },
                timeout: 7000,
            });

            const rows = Array.isArray(response.data) ? response.data : [];
            const valid = rows
                .map((row) => Number(row?.close))
                .filter((price) => Number.isFinite(price) && price > 0);

            if (!valid.length) {
                return null;
            }

            const last = valid[valid.length - 1];
            const prev = valid.length > 1 ? valid[valid.length - 2] : last;
            const change = prev > 0 ? Number((((last - prev) / prev) * 100).toFixed(2)) : 0;

            return {
                symbol,
                name: fallbackStockMeta[symbol]?.name || symbol,
                price: Number(last.toFixed(2)),
                change,
                type: 'STOCK',
                details: buildStockDetails(symbol, NaN, fallbackStockMeta[symbol]?.sector, fallbackStockMeta[symbol]?.name, NaN, NaN),
                financials: null,
            };
        } catch (_error) {
            return null;
        }
    });

    const rows = await Promise.all(requests);
    return rows.filter(Boolean);
};

const fetchTiingoHistory = async (symbol, interval = '1D') => {
    if (!process.env.TIINGO_API_KEY) {
        throw new Error('Missing TIINGO_API_KEY');
    }

    const normalized = String(symbol || '').toUpperCase();
    const ticker = normalized;

    const daysByInterval = {
        '5M': 5,
        '15M': 15,
        '1H': 30,
        '1D': 180,
        '1W': 365,
        '1M': 365,
        '3M': 540,
        '6M': 730,
        '1Y': 1095,
    };
    const lookbackDays = daysByInterval[String(interval || '1D').toUpperCase()] || 180;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - lookbackDays);

    const response = await axios.get(`${TIINGO_BASE_URL}/daily/${encodeURIComponent(ticker)}/prices`, {
        params: {
            token: process.env.TIINGO_API_KEY,
            startDate: start.toISOString().slice(0, 10),
            endDate: end.toISOString().slice(0, 10),
            resampleFreq: 'daily',
            columns: 'date,close',
        },
        timeout: 7000,
    });

    const rows = Array.isArray(response.data) ? response.data : [];
    return rows
        .map((row) => ({
            date: new Date(row?.date || row?.datetime || Date.now()).toLocaleString(),
            price: Number(row?.close),
        }))
        .filter((item) => Number.isFinite(item.price));
};

const fetchFinnhubQuotes = async (symbols) => {
    if (!process.env.FINNHUB_API_KEY) {
        throw new Error('Missing FINNHUB_API_KEY');
    }

    const normalizedSymbols = [...new Set((symbols || []).map((symbol) => String(symbol || '').toUpperCase()))];
    if (!normalizedSymbols.length) {
        return [];
    }

    const requests = normalizedSymbols.map(async (symbol) => {
        const ticker = symbol;

        try {
            const response = await axios.get(`${FINNHUB_BASE_URL}/quote`, {
                params: {
                    symbol: ticker,
                    token: process.env.FINNHUB_API_KEY,
                },
                timeout: 6000,
            });

            const current = Number(response.data?.c);
            const previousClose = Number(response.data?.pc);
            if (!Number.isFinite(current) || current <= 0) {
                return null;
            }

            const change = Number.isFinite(response.data?.dp)
                ? Number(response.data.dp)
                : (Number.isFinite(previousClose) && previousClose > 0
                    ? Number((((current - previousClose) / previousClose) * 100).toFixed(2))
                    : 0);

            return {
                symbol,
                name: fallbackStockMeta[symbol]?.name || symbol,
                price: Number(current.toFixed(2)),
                change,
                type: 'STOCK',
                details: buildStockDetails(symbol, NaN, fallbackStockMeta[symbol]?.sector, fallbackStockMeta[symbol]?.name, NaN, NaN),
                financials: null,
            };
        } catch (_error) {
            return null;
        }
    });

    const rows = await Promise.all(requests);
    return rows.filter(Boolean);
};

const fetchFinnhubHistory = async (symbol, interval = '1D') => {
    if (!process.env.FINNHUB_API_KEY) {
        throw new Error('Missing FINNHUB_API_KEY');
    }

    const normalized = String(symbol || '').toUpperCase();
    const ticker = normalized;
    const resolutionMap = {
        '5M': { resolution: '5', days: 7 },
        '15M': { resolution: '15', days: 15 },
        '1H': { resolution: '60', days: 30 },
        '1D': { resolution: 'D', days: 180 },
        '1W': { resolution: 'W', days: 365 },
        '1M': { resolution: 'D', days: 365 },
        '3M': { resolution: 'D', days: 540 },
        '6M': { resolution: 'D', days: 730 },
        '1Y': { resolution: 'D', days: 1095 },
    };
    const config = resolutionMap[String(interval || '1D').toUpperCase()] || resolutionMap['1D'];
    const to = Math.floor(Date.now() / 1000);
    const from = to - (config.days * 24 * 60 * 60);

    const response = await axios.get(`${FINNHUB_BASE_URL}/stock/candle`, {
        params: {
            symbol: ticker,
            resolution: config.resolution,
            from,
            to,
            token: process.env.FINNHUB_API_KEY,
        },
        timeout: 7000,
    });

    const closes = Array.isArray(response.data?.c) ? response.data.c : [];
    const timestamps = Array.isArray(response.data?.t) ? response.data.t : [];
    return closes
        .map((close, index) => ({
            date: new Date(Number(timestamps[index]) * 1000).toLocaleString(),
            price: Number(close),
        }))
        .filter((item) => Number.isFinite(item.price));
};

const toPolygonTicker = (symbol) => {
    const normalized = String(symbol || '').toUpperCase();
    if (normalized.endsWith('.NS') || normalized.endsWith('.BO')) {
        return normalized;
    }

    if (normalized.includes('.')) {
        return normalized.split('.')[0];
    }

    return normalized;
};

const fetchPolygonQuotes = async (symbols) => {
    if (!process.env.POLYGON_API_KEY) {
        throw new Error('Missing POLYGON_API_KEY');
    }

    const polygonTickers = [...new Set(symbols.map(toPolygonTicker).filter(Boolean))];
    if (!polygonTickers.length) {
        return [];
    }

    const res = await axios.get('https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers', {
        params: {
            tickers: polygonTickers.join(','),
            apiKey: process.env.POLYGON_API_KEY,
        },
        timeout: 6000,
    });

    const rows = Array.isArray(res.data?.tickers) ? res.data.tickers : [];
    return rows.map((row) => {
        const ticker = String(row.ticker || '').toUpperCase();
        const price = Number(row?.day?.c);
        const prevClose = Number(row?.prevDay?.c);
        const change = Number.isFinite(price) && Number.isFinite(prevClose) && prevClose > 0
            ? Number((((price - prevClose) / prevClose) * 100).toFixed(2))
            : 0;

        return {
            symbol: ticker,
            name: fallbackStockMeta[ticker]?.name || ticker,
            price: Number.isFinite(price) ? price : 0,
            change,
            type: 'STOCK',
            details: buildStockDetails(ticker, NaN, fallbackStockMeta[ticker]?.sector, fallbackStockMeta[ticker]?.name, NaN, NaN),
            financials: null,
        };
    }).filter((item) => item.symbol);
};

const fetchPolygonHistory = async (symbol, interval = '1D') => {
    if (!process.env.POLYGON_API_KEY) {
        throw new Error('Missing POLYGON_API_KEY');
    }

    const ticker = toPolygonTicker(symbol);
    if (!ticker) {
        throw new Error(`Unsupported Polygon symbol: ${symbol}`);
    }

    const intervalMap = {
        '5M': { multiplier: 5, timespan: 'minute', days: 5 },
        '15M': { multiplier: 15, timespan: 'minute', days: 5 },
        '1H': { multiplier: 60, timespan: 'minute', days: 30 },
        '1D': { multiplier: 1, timespan: 'day', days: 120 },
        '1W': { multiplier: 1, timespan: 'day', days: 180 },
        '1M': { multiplier: 1, timespan: 'day', days: 90 },
        '3M': { multiplier: 1, timespan: 'day', days: 180 },
        '6M': { multiplier: 1, timespan: 'day', days: 365 },
        '1Y': { multiplier: 1, timespan: 'day', days: 730 },
    };
    const config = intervalMap[String(interval).toUpperCase()] || intervalMap['1M'];

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - config.days);
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);

    const res = await axios.get(`https://api.polygon.io/v2/aggs/ticker/${ticker}/range/${config.multiplier}/${config.timespan}/${from}/${to}`, {
        params: {
            adjusted: 'true',
            sort: 'asc',
            limit: 50000,
            apiKey: process.env.POLYGON_API_KEY,
        },
        timeout: 7000,
    });

    const rows = Array.isArray(res.data?.results) ? res.data.results : [];
    return rows
        .map((row) => ({
            date: new Date(row.t).toLocaleString(),
            price: Number(row.c),
        }))
        .filter((item) => Number.isFinite(item.price));
};

const fetchMarketstackQuotes = async (symbols) => {
    if (!process.env.MARKETSTACK_KEY) {
        throw new Error('Missing MARKETSTACK_KEY');
    }

    const normalizedSymbols = [...new Set((symbols || []).map((symbol) => toMarketstackSymbol(symbol)).filter(Boolean))];
    if (!normalizedSymbols.length) {
        return [];
    }

    const response = await axios.get(`${MARKETSTACK_BASE_URL}/eod/latest`, {
        params: {
            access_key: process.env.MARKETSTACK_KEY,
            symbols: normalizedSymbols.join(','),
            limit: Math.max(20, normalizedSymbols.length * 2),
        },
        timeout: 7000,
    });

    const rows = Array.isArray(response.data?.data) ? response.data.data : [];
    const latestBySymbol = new Map();
    for (const row of rows) {
        const ticker = String(row?.symbol || '').toUpperCase();
        const close = Number(row?.close ?? row?.adj_close);
        if (!ticker || !Number.isFinite(close) || close <= 0) {
            continue;
        }
        const timestamp = new Date(row?.date || 0).getTime();
        const existing = latestBySymbol.get(ticker);
        if (!existing || timestamp > existing.timestamp) {
            latestBySymbol.set(ticker, {
                timestamp: Number.isFinite(timestamp) ? timestamp : 0,
                close,
                open: Number(row?.open),
            });
        }
    }

    return (symbols || [])
        .map((originalSymbol) => {
            const normalized = String(originalSymbol || '').toUpperCase();
            const ticker = toMarketstackSymbol(normalized);
            const latest = latestBySymbol.get(ticker);
            if (!latest) {
                return null;
            }

            const change = Number.isFinite(latest.open) && latest.open > 0
                ? Number((((latest.close - latest.open) / latest.open) * 100).toFixed(2))
                : 0;

            return {
                symbol: normalized,
                name: fallbackStockMeta[normalized]?.name || normalized,
                price: Number(latest.close.toFixed(2)),
                change,
                type: 'STOCK',
                details: buildStockDetails(normalized, NaN, fallbackStockMeta[normalized]?.sector, fallbackStockMeta[normalized]?.name, NaN, NaN),
                financials: null,
            };
        })
        .filter(Boolean);
};

const fetchMarketstackHistory = async (symbol, interval = '1D') => {
    if (!process.env.MARKETSTACK_KEY) {
        throw new Error('Missing MARKETSTACK_KEY');
    }

    const normalized = String(symbol || '').toUpperCase();
    const ticker = toMarketstackSymbol(normalized);
    const daysByInterval = {
        '5M': 7,
        '15M': 15,
        '1H': 30,
        '1D': 180,
        '1W': 365,
        '1M': 365,
        '3M': 540,
        '6M': 730,
        '1Y': 1095,
    };
    const lookback = daysByInterval[String(interval || '1D').toUpperCase()] || 180;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - lookback);

    const response = await axios.get(`${MARKETSTACK_BASE_URL}/eod`, {
        params: {
            access_key: process.env.MARKETSTACK_KEY,
            symbols: ticker,
            date_from: start.toISOString().slice(0, 10),
            date_to: end.toISOString().slice(0, 10),
            sort: 'ASC',
            limit: 1000,
        },
        timeout: 7000,
    });

    const rows = Array.isArray(response.data?.data) ? response.data.data : [];
    return rows
        .map((row) => ({
            date: new Date(row?.date || Date.now()).toLocaleString(),
            price: Number(row?.close ?? row?.adj_close),
        }))
        .filter((item) => Number.isFinite(item.price) && item.price > 0);
};

const fetchStooqQuotes = async (symbols) => {
    const pairs = symbols.map((symbol) => toStooqSymbol(symbol)).join(',');
    const stooqUrl = `https://stooq.com/q/l/?s=${pairs}&f=sd2t2ohlcv&h&e=csv`;
    const stooqRes = await axios.get(stooqUrl, { timeout: 5000 });
    const lines = String(stooqRes.data || '').split('\n').slice(1);

    return lines
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const parts = line.split(',');
            if (parts.length < 7) {
                return null;
            }

            const stooqSymbol = (parts[0] || '').toUpperCase();
            const symbol = normalizeStooqSymbol(stooqSymbol);
            const close = Number(parts[6]);

            return {
                symbol,
                name: fallbackStockMeta[symbol]?.name || symbol,
                price: Number.isFinite(close) ? close : 0,
                change: 0,
                type: 'STOCK',
                details: buildStockDetails(symbol, NaN, fallbackStockMeta[symbol]?.sector, fallbackStockMeta[symbol]?.name, NaN, NaN),
                financials: null,
            };
        })
        .filter(Boolean);
};

const fetchYahooHistory = async (symbol, interval = '1D') => {
    const normalizedSymbol = String(symbol || '').toUpperCase();
    const intervalMap = {
        '5M': { range: '5d', interval: '5m' },
        '15M': { range: '5d', interval: '15m' },
        '1H': { range: '1mo', interval: '60m' },
        '1D': { range: '6mo', interval: '1d' },
        '1W': { range: '1y', interval: '1wk' },
        '1M': { range: '3mo', interval: '1d' },
        '3M': { range: '6mo', interval: '1d' },
        '6M': { range: '1y', interval: '1d' },
        '1Y': { range: '2y', interval: '1d' },
    };
    const config = intervalMap[String(interval).toUpperCase()] || { range: '3mo', interval: '1d' };

    const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${normalizedSymbol}`, {
        params: {
            range: config.range,
            interval: config.interval,
            includePrePost: false,
        },
        timeout: 6000,
        headers: {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json',
        },
    });

    const result = response.data?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const quote = result?.indicators?.quote?.[0] || {};
    const closes = quote.close || [];
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const volumes = quote.volume || [];

    return timestamps
        .map((timestamp, index) => {
            const close = Number(closes[index]);
            if (!Number.isFinite(close)) {
                return null;
            }

            return {
                timestamp: timestamp * 1000,
                date: new Date(timestamp * 1000).toISOString(),
                price: close,
                open: Number(opens[index]) || close,
                high: Number(highs[index]) || close,
                low: Number(lows[index]) || close,
                close: close,
                volume: Number(volumes[index]) || 0
            };
        })
        .filter(Boolean);
};

const fetchStockData = async (customSymbols = null) => {
    const now = Date.now();
    if (!customSymbols && quotesCache.data && now < quotesCache.expiresAt) {
        return quotesCache.data;
    }

    if (!customSymbols && quotesInFlightPromise) {
        return quotesInFlightPromise;
    }

    const symbols = customSymbols || await parseStockSymbols();

    const fetchPromise = (async () => {
        let data = null;

        if (!isProviderBlocked('yahoo')) {
            let yahooQuotes = [];
            let yahooError = null;
            try {
                yahooQuotes = await fetchYahooQuotes(symbols);
            } catch (error) {
                yahooError = error;
            }

            if (!hasEnoughLiveData(yahooQuotes, symbols.length)) {
                try {
                    const existingSymbols = new Set(yahooQuotes.map((item) => String(item.symbol || '').toUpperCase()));
                    const missingSymbols = symbols.filter((symbol) => !existingSymbols.has(String(symbol || '').toUpperCase()));
                    const chartQuotes = await fetchYahooChartQuotes(missingSymbols.length ? missingSymbols : symbols);
                    const mergedQuotes = [...yahooQuotes, ...chartQuotes].filter((item, index, array) => {
                        const symbol = String(item.symbol || '').toUpperCase();
                        return array.findIndex((row) => String(row.symbol || '').toUpperCase() === symbol) === index;
                    });

                    yahooQuotes = mergedQuotes;
                } catch (_error) {
                }
            }

            if (hasEnoughLiveData(yahooQuotes, symbols.length)) {
                clearProviderFailure('yahoo');
                data = yahooQuotes;
            } else {
                if (yahooError) {
                    warnThrottled(
                        `quotes:yahoo-failed:${yahooError.message}`,
                        'Yahoo Finance quote fetch failed, trying Tiingo...',
                        { error: yahooError.message },
                    );
                }
                markProviderFailure('yahoo', yahooError?.message || 'Sparse quote payload');
            }
        }

        if (!data && !isProviderBlocked('tiingo')) {
            try {
                const tiingoQuotes = await fetchTiingoQuotes(symbols);
                if (hasEnoughLiveData(tiingoQuotes, symbols.length)) {
                    clearProviderFailure('tiingo');
                    data = tiingoQuotes;
                } else {
                    markProviderFailure('tiingo', 'Sparse quote payload');
                }
            } catch (error) {
                markProviderFailure('tiingo', error.message);
                warnThrottled(
                    `quotes:tiingo-failed:${error.message}`,
                    'Tiingo quote fetch failed, trying Finnhub...',
                    { error: error.message },
                );
            }
        }

        if (!data && !isProviderBlocked('finnhub')) {
            try {
                const finnhubQuotes = await fetchFinnhubQuotes(symbols);
                if (hasEnoughLiveData(finnhubQuotes, symbols.length)) {
                    clearProviderFailure('finnhub');
                    data = finnhubQuotes;
                } else {
                    markProviderFailure('finnhub', 'Sparse quote payload');
                }
            } catch (error) {
                markProviderFailure('finnhub', error.message);
                warnThrottled(
                    `quotes:finnhub-failed:${error.message}`,
                    'Finnhub quote fetch failed, trying Polygon...',
                    { error: error.message },
                );
            }
        }

        if (!data && !isProviderBlocked('polygon')) {
            try {
                const polygonQuotes = await fetchPolygonQuotes(symbols);
                if (hasEnoughLiveData(polygonQuotes, symbols.length)) {
                    clearProviderFailure('polygon');
                    data = polygonQuotes;
                } else {
                    markProviderFailure('polygon', 'Sparse quote payload');
                }
            } catch (error) {
                markProviderFailure('polygon', error.message);
                warnThrottled(
                    `quotes:polygon-failed:${error.message}`,
                    'Polygon quote fetch failed, trying Stooq...',
                    { error: error.message },
                );
            }
        }

        if (!data && !isProviderBlocked('marketstack')) {
            try {
                const marketstackQuotes = await fetchMarketstackQuotes(symbols);
                if (hasEnoughLiveData(marketstackQuotes, symbols.length)) {
                    clearProviderFailure('marketstack');
                    data = marketstackQuotes;
                } else {
                    markProviderFailure('marketstack', 'Sparse quote payload');
                }
            } catch (error) {
                markProviderFailure('marketstack', error.message);
                warnThrottled(
                    `quotes:marketstack-failed:${error.message}`,
                    'Marketstack quote fetch failed, trying Stooq...',
                    { error: error.message },
                );
            }
        }

        if (!data && !isProviderBlocked('stooq')) {
            try {
                const stooqQuotes = await fetchStooqQuotes(symbols);
                if (hasEnoughLiveData(stooqQuotes, symbols.length)) {
                    clearProviderFailure('stooq');
                    data = stooqQuotes;
                } else {
                    markProviderFailure('stooq', 'Sparse quote payload');
                }
            } catch (error) {
                markProviderFailure('stooq', error.message);
                warnThrottled(
                    `quotes:stooq-failed:${error.message}`,
                    'Stooq quote fetch failed.',
                    { error: error.message },
                );
            }
        }

        // Persist the fresh payload as last-known-good
        if (data) {
            if (!customSymbols || !lastKnownGoodQuotes) {
                lastKnownGoodQuotes = data;
            } else {
                // Merge custom fetches into the existing fallback cache
                const incomingSet = new Set(data.map(q => String(q.symbol).toUpperCase()));
                lastKnownGoodQuotes = [
                    ...lastKnownGoodQuotes.filter(q => !incomingSet.has(String(q.symbol).toUpperCase())),
                    ...data
                ];
            }
        }

        if (!data) {
            if (lastKnownGoodQuotes) {
                logger.warn(`All live quote providers failed. Serving stale cache for ${symbols.length} symbols.`);
                if (customSymbols) {
                    const customSet = new Set(customSymbols.map(s => String(s).toUpperCase()));
                    const filtered = lastKnownGoodQuotes.filter(q => customSet.has(String(q.symbol).toUpperCase()));
                    if (filtered.length > 0) {
                        return filtered;
                    }
                    // If cache doesn't contain these symbols, fall through to mock fallback
                } else {
                    return lastKnownGoodQuotes;
                }
            }
            logger.error(`Live quotes unavailable for ${symbols.slice(0, 5).join(', ')}${symbols.length > 5 ? '...' : ''} — using mock fallback data.`);
            return buildFallbackQuotes(symbols);
        }

        if (!customSymbols) {
            quotesCache = {
                data,
                expiresAt: Date.now() + QUOTE_CACHE_TTL_MS,
            };
        }

        return data;
    })();

    if (customSymbols) {
        return fetchPromise;
    }

    quotesInFlightPromise = fetchPromise;
    try {
        return await quotesInFlightPromise;
    } finally {
        quotesInFlightPromise = null;
    }
};

const fetchStockHistory = async (symbol, interval = '1D', options = {}) => {
    const { allowSynthetic = false } = options;
    const normalizedSymbol = String(symbol || '').toUpperCase();
    const normalizedInterval = String(interval || '1D').toUpperCase();
    const requiresIntraday = ['5M', '15M', '1H'].includes(normalizedInterval);

    if (!isProviderBlocked('yahoo')) {
        try {
            const yahooHistory = await fetchYahooHistory(normalizedSymbol, normalizedInterval);
            if (yahooHistory.length > 0) {
                clearProviderFailure('yahoo');
                return yahooHistory;
            }

            markProviderFailure('yahoo', `Sparse history payload for ${normalizedSymbol}`);
        } catch (error) {
            markProviderFailure('yahoo', error.message);
            warnThrottled(
                `history:yahoo-failed:${error.message}`,
                'Yahoo Finance history fetch failed, trying Tiingo...',
                { error: error.message },
            );
        }
    }

    if (!isProviderBlocked('tiingo')) {
        try {
            const tiingoHistory = await fetchTiingoHistory(normalizedSymbol, normalizedInterval);
            if (tiingoHistory.length > 0) {
                clearProviderFailure('tiingo');
                return tiingoHistory;
            }

            markProviderFailure('tiingo', `Sparse history payload for ${normalizedSymbol}`);
        } catch (error) {
            markProviderFailure('tiingo', error.message);
            warnThrottled(
                `history:tiingo-failed:${error.message}`,
                'Tiingo history fetch failed, trying Finnhub...',
                { error: error.message },
            );
        }
    }

    if (!isProviderBlocked('finnhub')) {
        try {
            const finnhubHistory = await fetchFinnhubHistory(normalizedSymbol, normalizedInterval);
            if (finnhubHistory.length > 0) {
                clearProviderFailure('finnhub');
                return finnhubHistory;
            }

            markProviderFailure('finnhub', `Sparse history payload for ${normalizedSymbol}`);
        } catch (error) {
            markProviderFailure('finnhub', error.message);
            warnThrottled(
                `history:finnhub-failed:${error.message}`,
                'Finnhub history fetch failed, trying Polygon...',
                { error: error.message },
            );
        }
    }

    if (!isProviderBlocked('polygon')) {
        const polygonTicker = toPolygonTicker(normalizedSymbol);
        if (!polygonTicker) {
            warnThrottled(
                `history:polygon-unsupported:${normalizedInterval}`,
                'Skipping Polygon history for unsupported symbol.',
                { symbol: normalizedSymbol },
            );
        } else {
            try {
                const polygonHistory = await fetchPolygonHistory(normalizedSymbol, normalizedInterval);
                if (polygonHistory.length > 0) {
                    clearProviderFailure('polygon');
                    return polygonHistory;
                }

                markProviderFailure('polygon', `Sparse history payload for ${normalizedSymbol}`);
            } catch (error) {
                markProviderFailure('polygon', error.message);
                warnThrottled(
                    `history:polygon-failed:${error.message}`,
                    'Polygon history fetch failed, trying Stooq...',
                    { error: error.message },
                );
            }
        }
    }

    if (!isProviderBlocked('marketstack')) {
        try {
            const marketstackHistory = await fetchMarketstackHistory(normalizedSymbol, normalizedInterval);
            if (marketstackHistory.length > 0) {
                clearProviderFailure('marketstack');
                return marketstackHistory;
            }

            markProviderFailure('marketstack', `Sparse history payload for ${normalizedSymbol}`);
        } catch (error) {
            markProviderFailure('marketstack', error.message);
            warnThrottled(
                `history:marketstack-failed:${error.message}`,
                'Marketstack history fetch failed, trying Stooq...',
                { error: error.message },
            );
        }
    }

    if (!requiresIntraday && !isProviderBlocked('stooq')) {
        try {
            const stooqSymbol = toStooqSymbol(normalizedSymbol);
            const lookback = {
                '1D': 5,
                '1W': 30,
                '1M': 90,
                '3M': 180,
                '6M': 365,
                '1Y': 730,
            }[normalizedInterval] || 120;
            const stooqUrl = `https://stooq.com/q/d/l/?s=${stooqSymbol}&i=d`;

            const stooqRes = await axios.get(stooqUrl, { timeout: 5000 });
            const csvData = stooqRes.data;
            const lines = csvData.split('\n').slice(1, lookback + 1);

            const history = lines.map(line => {
                const parts = line.split(',');
                if (parts.length < 5) return null;
                const close = parseFloat(parts[4]);
                if (!Number.isFinite(close)) return null;
                const parsedDate = new Date(parts[0]);
                return {
                    timestamp: parsedDate.getTime(),
                    date: parsedDate.toISOString(),
                    price: close
                };
            }).filter(item => item !== null).reverse();

            if (history.length > 0) {
                clearProviderFailure('stooq');
                return history;
            }

            markProviderFailure('stooq', `Sparse history payload for ${normalizedSymbol}`);
        } catch (stooqError) {
            markProviderFailure('stooq', stooqError.message);
            warnThrottled(
                `history:stooq-failed:${stooqError.message}`,
                'Stooq history fetch failed.',
                { error: stooqError.message },
            );
        }
    }

    if (!allowSynthetic) {
        throw new Error(`Live history unavailable for ${normalizedSymbol}`);
    }

    warnThrottled(
        `history:synthetic-fallback:${normalizedInterval}`,
        'Using generated synthetic fallback history.',
        { symbol: normalizedSymbol, interval: normalizedInterval },
    );
    return generateHistory(150, 0.02, normalizedInterval);
};

module.exports = { fetchStockData, fetchStockHistory };
