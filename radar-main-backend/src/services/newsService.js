const axios = require('axios');
const logger = require('../utils/logger');
const redisClient = require('./redisClient');

// ─── In-memory fallback cache (used when Redis is not available) ──────────────
const memCache = new Map(); // key → { data, expiresAt }

const cacheGet = async (key) => {
    // 1. Try Redis first
    const redisVal = await redisClient.get(key);
    if (redisVal !== null) return redisVal;
    // 2. Fall back to in-memory
    const entry = memCache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.data;
    if (entry) memCache.delete(key); // expired
    return null;
};

const cacheSet = async (key, value, ttlMs) => {
    // 1. Try Redis
    await redisClient.set(key, value, ttlMs);
    // 2. Always write memory fallback too
    memCache.set(key, { data: value, expiresAt: Date.now() + ttlMs });
    // Prevent memory leak — cap at 200 entries
    if (memCache.size > 200) {
        const firstKey = memCache.keys().next().value;
        memCache.delete(firstKey);
    }
};

// TTLs
const TTL_GENERAL_MS  = 30 * 60 * 1000;  // 30 minutes for general/regional news
const TTL_SYMBOL_MS   = 15 * 60 * 1000;  // 15 minutes for symbol-specific news
const TTL_CRYPTO_MS   = 10 * 60 * 1000;  // 10 minutes for crypto (more volatile)

const DEFAULT_MARKET_REGION = String(process.env.DEFAULT_MARKET_REGION || 'IN').toUpperCase();
const NEWS_COUNTRY = String(process.env.NEWS_COUNTRY || (DEFAULT_MARKET_REGION === 'US' ? 'us' : 'in')).toLowerCase();
const IS_INDIA_REGION = DEFAULT_MARKET_REGION === 'IN';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const MARKETAUX_BASE_URL = 'https://api.marketaux.com/v1/news/all';
const DEFAULT_LIMIT = Number.parseInt(process.env.NEWS_PAGE_SIZE || '15', 10);

// Keywords to identify India-related news articles
const INDIA_KEYWORDS = [
    'india', 'indian', 'nse', 'bse', 'sensex', 'nifty', 'sebi', 'rbi',
    'rupee', 'inr', 'mumbai', 'dalal street', 'tata', 'reliance', 'infosys',
    'hdfc', 'icici', 'wipro', 'bajaj', 'adani', 'birla', 'mahindra'
];

const isIndiaArticle = (text = '') => {
    const lower = text.toLowerCase();
    return INDIA_KEYWORDS.some(kw => lower.includes(kw));
};

const FINNHUB_CATEGORY_MAP = {
    general: 'general',
    business: 'general',
    market: 'general',
    forex: 'forex',
    crypto: 'crypto',
    merger: 'merger',
};

const normalizeSymbol = (value = '') => String(value || '').trim().toUpperCase().replace(/\.(NS|BO)$/i, '');
const normalizeCategory = (value = 'general') => String(value || 'general').trim().toLowerCase();
const toIso = (value) => {
    const date = new Date(value || Date.now());
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};
const toDisplayTime = (value) => new Date(toIso(value)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Keyword maps for auto-tagging articles by category
const CATEGORY_KEYWORDS = {
    Earnings:  ['earnings', 'profit', 'revenue', 'quarterly', 'results', 'eps', 'net income', 'q1', 'q2', 'q3', 'q4', 'guidance', 'forecast', 'beat', 'miss'],
    IPO:       ['ipo', 'initial public offering', 'listing', 'debut', 'public offer', 'grey market', 'gmp', 'oversubscribed'],
    Deals:     ['merger', 'acquisition', 'takeover', 'deal', 'buyout', 'stake', 'investment', 'funding', 'partnership', 'joint venture', 'agreement'],
    Policy:    ['rbi', 'fed', 'rate', 'repo', 'interest rate', 'monetary policy', 'sebi', 'regulation', 'budget', 'fiscal', 'tax', 'inflation target', 'central bank'],
    Macro:     ['gdp', 'inflation', 'cpi', 'unemployment', 'trade deficit', 'current account', 'economic growth', 'recession', 'stimulus', 'crude', 'oil price', 'global market', 'sensex', 'nifty'],
    Crypto:    ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'defi', 'nft', 'altcoin', 'stablecoin', 'binance', 'coinbase', 'solana', 'token'],
};

const classifyCategory = (title = '', summary = '') => {
    const text = `${title} ${summary}`.toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(kw => text.includes(kw))) {
            return cat;
        }
    }
    return 'General';
};

const mapArticle = (article) => ({
    id: article?.id || article?.uuid || article?.url,
    source: article?.source?.name || article?.source || 'Unknown',
    title: article?.title || 'Untitled',
    summary: article?.summary || article?.description || article?.snippet || '',
    description: article?.description || article?.summary || article?.snippet || '',
    time: toDisplayTime(article?.publishedAt || article?.published_at || article?.datetime),
    publishedAt: toIso(article?.publishedAt || article?.published_at || article?.datetime),
    url: article?.url || '#',
    sentiment: 'Neutral',
    category: article?.category || classifyCategory(
        article?.title || '',
        article?.summary || article?.description || article?.snippet || ''
    ),
});

// ─── Source: Finnhub ─────────────────────────────────────────────────────────
const fetchFinnhubNews = async ({ category, symbol, limit }) => {
    if (!process.env.FINNHUB_API_KEY) return [];
    const token = process.env.FINNHUB_API_KEY;
    const normalizedSymbol = normalizeSymbol(symbol);
    const normalizedCategory = normalizeCategory(category);

    if (normalizedSymbol && normalizedCategory !== 'crypto') {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 10);
        try {
            const response = await axios.get(`${FINNHUB_BASE_URL}/company-news`, {
                params: { symbol: normalizedSymbol, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), token },
                timeout: 7000,
            });
            const rows = Array.isArray(response.data) ? response.data : [];
            return rows.slice(0, limit).map((item) => mapArticle({
                id: item.id || item.url,
                source: item.source,
                title: item.headline || item.title,
                summary: item.summary,
                description: item.summary,
                publishedAt: item.datetime ? new Date(Number(item.datetime) * 1000).toISOString() : new Date().toISOString(),
                url: item.url,
            }));
        } catch (e) {
            logger.warn(`Finnhub company-news failed for ${normalizedSymbol}`, { error: e.message });
        }
    }

    try {
        const response = await axios.get(`${FINNHUB_BASE_URL}/news`, {
            params: { category: FINNHUB_CATEGORY_MAP[normalizedCategory] || 'general', token },
            timeout: 7000,
        });
        const rows = Array.isArray(response.data) ? response.data : [];
        let filtered = rows;
        if (normalizedSymbol) {
            const sym = normalizedSymbol.toUpperCase();
            filtered = rows.filter(item => `${item.headline} ${item.summary}`.toUpperCase().includes(sym));
        }
        const base = filtered.length > 0 ? filtered : rows;
        let final = base;
        if (IS_INDIA_REGION && !normalizedSymbol) {
            const indiaFiltered = base.filter(item => isIndiaArticle(`${item.headline || ''} ${item.summary || ''}`));
            if (indiaFiltered.length >= Math.min(3, limit)) final = indiaFiltered;
        }
        return final.slice(0, limit).map((item) => mapArticle({
            id: item.id || item.url,
            source: item.source,
            title: item.headline || item.title,
            summary: item.summary,
            description: item.summary,
            publishedAt: item.datetime ? new Date(Number(item.datetime) * 1000).toISOString() : new Date().toISOString(),
            url: item.url,
        }));
    } catch (e) {
        logger.warn('Finnhub general news failed', { error: e.message });
        return [];
    }
};

// ─── Source: MarketAux ───────────────────────────────────────────────────────
const fetchMarketAuxNews = async ({ category, symbol, limit }) => {
    if (!process.env.MARKETAUX_API_KEY) return [];
    const params = { api_token: process.env.MARKETAUX_API_KEY, language: 'en', limit };
    if (symbol) params.symbols = normalizeSymbol(symbol);
    if (category && category !== 'general') params.filter_entities = true;
    if (IS_INDIA_REGION && !symbol) params.exchanges = 'NSE,BSE';
    const response = await axios.get(MARKETAUX_BASE_URL, { params, timeout: 7000 });
    const rows = Array.isArray(response.data?.data) ? response.data.data : [];
    return rows.slice(0, limit).map((item) => mapArticle({
        id: item.uuid || item.url,
        source: item.source,
        title: item.title,
        summary: item.snippet || item.description,
        description: item.description || item.snippet,
        publishedAt: item.published_at,
        url: item.url,
    }));
};

// ─── Source: Tiingo ──────────────────────────────────────────────────────────
// Covers Reuters, Bloomberg, Barron's, Seeking Alpha, Business Insider, CNBC, etc.
const fetchTiingoNews = async ({ symbol, limit, assetClass }) => {
    if (!process.env.TIINGO_API_KEY) return [];
    const isCrypto = assetClass === 'crypto';
    const params = {
        token: process.env.TIINGO_API_KEY,
        limit: Math.min(limit * 2, 50), // fetch more and we'll trim after merge
        sortBy: 'publishedDate',
    };

    let url;
    if (isCrypto) {
        url = 'https://api.tiingo.com/tiingo/crypto/news';
    } else if (symbol) {
        url = `https://api.tiingo.com/tiingo/news`;
        params.tickers = normalizeSymbol(symbol).toLowerCase();
    } else {
        url = 'https://api.tiingo.com/tiingo/news';
        // Use broad tags for India or global business news
        if (IS_INDIA_REGION) {
            params.tags = 'India,NSE,BSE,Sensex,Nifty,RBI';
        } else {
            params.tags = 'stocks,markets,economy,earnings,finance';
        }
    }

    try {
        const response = await axios.get(url, { params, timeout: 8000 });
        const rows = Array.isArray(response.data) ? response.data : [];
        return rows.slice(0, limit).map((item) => mapArticle({
            id: item.id || item.url,
            source: item.source || 'Tiingo',
            title: item.title,
            summary: item.description,
            description: item.description,
            publishedAt: item.publishedDate,
            url: item.url,
        }));
    } catch (e) {
        logger.warn('Tiingo news fetch failed', { error: e.message });
        return [];
    }
};

// ─── Source: FMP (Financial Modeling Prep) ───────────────────────────────────
// Covers MarketWatch, AP, The Guardian, Yahoo Finance, Fox Business, Forbes, etc.
const fetchFmpNews = async ({ symbol, limit, assetClass }) => {
    if (!process.env.FMP_API_KEY) return [];
    const isCrypto = assetClass === 'crypto';
    const apikey = process.env.FMP_API_KEY;

    try {
        let url;
        const params = { apikey, limit: Math.min(limit * 2, 50) };

        if (isCrypto) {
            url = 'https://financialmodelingprep.com/api/v4/crypto_news';
        } else if (symbol) {
            url = 'https://financialmodelingprep.com/api/v3/stock_news';
            params.tickers = normalizeSymbol(symbol);
        } else {
            url = 'https://financialmodelingprep.com/api/v4/general_news';
        }

        const response = await axios.get(url, { params, timeout: 8000 });
        const rows = Array.isArray(response.data) ? response.data : [];
        return rows.slice(0, limit).map((item) => mapArticle({
            id: item.url || item.title,
            source: item.site || item.publisher || 'FMP News',
            title: item.title,
            summary: item.text || item.snippet,
            description: item.text || item.snippet,
            publishedAt: item.publishedDate || item.date,
            url: item.url,
        }));
    } catch (e) {
        logger.warn('FMP news fetch failed', { error: e.message });
        return [];
    }
};

// ─── Source: Polygon.io ───────────────────────────────────────────────────────
// Covers Benzinga, Globe Newswire, PR Newswire, Motley Fool, Seeking Alpha, etc.
const fetchPolygonNews = async ({ symbol, limit, assetClass }) => {
    if (!process.env.POLYGON_API_KEY) return [];
    const isCrypto = assetClass === 'crypto';
    if (isCrypto) return []; // Polygon news is equity-focused

    try {
        const params = {
            apiKey: process.env.POLYGON_API_KEY,
            limit: Math.min(limit * 2, 50),
            order: 'desc',
            sort: 'published_utc',
        };
        if (symbol) params.ticker = normalizeSymbol(symbol);
        // Polygon reference/news endpoint
        const response = await axios.get('https://api.polygon.io/v2/reference/news', { params, timeout: 8000 });
        const rows = Array.isArray(response.data?.results) ? response.data.results : [];
        return rows.slice(0, limit).map((item) => mapArticle({
            id: item.id || item.article_url,
            source: item.publisher?.name || item.author || 'Polygon News',
            title: item.title,
            summary: item.description,
            description: item.description,
            publishedAt: item.published_utc,
            url: item.article_url,
        }));
    } catch (e) {
        logger.warn('Polygon news fetch failed', { error: e.message });
        return [];
    }
};

// ─── Source: GNews ────────────────────────────────────────────────────────────
const fetchGNews = async ({ limit, assetClass }) => {
    if (!process.env.GNEWS_API_KEY) return [];
    const isCrypto = assetClass === 'crypto';
    const url = isCrypto ? 'https://gnews.io/api/v4/search' : 'https://gnews.io/api/v4/top-headlines';
    const params = isCrypto
        ? { q: 'cryptocurrency bitcoin ethereum crypto market', lang: 'en', apikey: process.env.GNEWS_API_KEY, max: limit }
        : { category: 'business', lang: 'en', country: NEWS_COUNTRY, apikey: process.env.GNEWS_API_KEY, max: limit };
    const response = await axios.get(url, { params, timeout: 7000 });
    const rows = Array.isArray(response.data?.articles) ? response.data.articles : [];
    return rows.map(mapArticle);
};

// ─── Source: NewsAPI ──────────────────────────────────────────────────────────
const fetchNewsApi = async ({ limit, assetClass }) => {
    if (!process.env.NEWS_API_KEY) return [];
    const isCrypto = assetClass === 'crypto';
    const url = isCrypto ? 'https://newsapi.org/v2/everything' : 'https://newsapi.org/v2/top-headlines';
    const params = isCrypto
        ? { q: 'cryptocurrency OR bitcoin OR ethereum OR crypto market', language: 'en', sortBy: 'publishedAt', apiKey: process.env.NEWS_API_KEY, pageSize: limit }
        : { category: 'business', language: 'en', country: NEWS_COUNTRY, apiKey: process.env.NEWS_API_KEY, pageSize: limit };
    const response = await axios.get(url, { params, timeout: 7000 });
    const rows = Array.isArray(response.data?.articles) ? response.data.articles : [];
    return rows.map(mapArticle);
};

// ─── Dedup & merge helper ─────────────────────────────────────────────────────
const mergeAndDedup = (arrays, limit) => {
    const seen = new Set();
    const merged = [];
    // Interleave arrays so we get diverse sources, not all of one source first
    const maxLen = Math.max(...arrays.map(a => a.length));
    for (let i = 0; i < maxLen; i++) {
        for (const arr of arrays) {
            if (i < arr.length) {
                const article = arr[i];
                const key = (article.title || '').toLowerCase().trim().slice(0, 80);
                if (key && !seen.has(key)) {
                    seen.add(key);
                    merged.push(article);
                }
            }
        }
    }
    // Sort by date desc then return top N
    return merged
        .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
        .slice(0, limit);
};

// ─── Main orchestrator ────────────────────────────────────────────────────────
const fetchMarketNews = async (category = 'general', options = {}) => {
    const normalizedCategory = normalizeCategory(category);
    const symbol = options?.symbol ? normalizeSymbol(options.symbol) : '';
    const limit = Number.isFinite(Number(options?.limit)) ? Number(options.limit) : DEFAULT_LIMIT;
    const assetClass = String(options?.assetClass || '').toLowerCase().trim();

    const requestedRegion = options?.region ?? null;
    const effectiveIsIndia = requestedRegion === 'IN' ? true
        : requestedRegion === 'GLOBAL' ? false
        : IS_INDIA_REGION;

    const isCrypto = normalizedCategory === 'crypto' || assetClass === 'crypto';
    const preferIndiaFirst = effectiveIsIndia && !symbol && !isCrypto;

    // ── Cache key & TTL ──────────────────────────────────────────────────────
    const cacheKey = `news:${normalizedCategory}:${symbol || 'all'}:${requestedRegion || 'default'}:${assetClass || 'stocks'}:${limit}`;
    const ttlMs = isCrypto ? TTL_CRYPTO_MS : symbol ? TTL_SYMBOL_MS : TTL_GENERAL_MS;

    const cached = await cacheGet(cacheKey);
    if (cached) {
        logger.info(`[newsService] CACHE HIT — ${cacheKey}`);
        return cached;
    }
    logger.info(`[newsService] CACHE MISS — fetching from APIs (region=${requestedRegion ?? 'default(' + DEFAULT_MARKET_REGION + ')'} assetClass=${assetClass || 'stocks'} preferIndiaFirst=${preferIndiaFirst} symbol=${symbol || 'none'})`);

    // Run all available sources in parallel, collect results
    const fetchArgs = { category: normalizedCategory, symbol, limit, assetClass };

    const [finnhubRows, marketAuxRows, tiingoRows, fmpRows, polygonRows, gnewsRows, newsApiRows] = await Promise.allSettled([
        fetchFinnhubNews(fetchArgs).catch(() => []),
        fetchMarketAuxNews(fetchArgs).catch(() => []),
        fetchTiingoNews(fetchArgs).catch(() => []),
        fetchFmpNews(fetchArgs).catch(() => []),
        fetchPolygonNews(fetchArgs).catch(() => []),
        fetchGNews(fetchArgs).catch(() => []),
        fetchNewsApi(fetchArgs).catch(() => []),
    ]).then(results => results.map(r => (r.status === 'fulfilled' ? r.value : [])));

    logger.info(`[newsService] source counts — Finnhub:${finnhubRows.length} MarketAux:${marketAuxRows.length} Tiingo:${tiingoRows.length} FMP:${fmpRows.length} Polygon:${polygonRows.length} GNews:${gnewsRows.length} NewsAPI:${newsApiRows.length}`);

    // India-first: prioritise sources that returned India-relevant content
    let sourceBuckets;
    if (preferIndiaFirst) {
        // For India, GNews/NewsAPI with country=in and Tiingo with India tags are most relevant
        // Put them first, then the global sources as supplement
        sourceBuckets = [gnewsRows, newsApiRows, tiingoRows, finnhubRows, fmpRows, polygonRows, marketAuxRows];
    } else {
        // Global / crypto / symbol-specific: interleave all equally
        sourceBuckets = [finnhubRows, tiingoRows, fmpRows, polygonRows, marketAuxRows, gnewsRows, newsApiRows];
    }

    const merged = mergeAndDedup(sourceBuckets.filter(b => b.length > 0), limit * 2);

    if (merged.length >= Math.min(3, limit)) {
        const result = merged.slice(0, limit);
        // ── Write to cache before returning ─────────────────────────────────
        await cacheSet(cacheKey, result, ttlMs);
        logger.info(`[newsService] Cached ${result.length} articles → ${cacheKey} (TTL ${ttlMs / 60000}min)`);
        return result;
    }

    // Hard fallback
    logger.warn('[newsService] All sources returned 0 articles — returning static fallback');
    return [
        {
            id: 'f-1',
            source: 'Market Pulse',
            title: 'Global markets stabilize as economic data suggests resilience',
            summary: 'Investors are closely monitoring central bank signals and corporate earnings for direction.',
            description: 'Investors are closely monitoring central bank signals and corporate earnings for direction.',
            time: 'Recently',
            publishedAt: new Date().toISOString(),
            sentiment: 'Neutral',
            category: 'Macro',
            url: '#',
        },
        {
            id: 'f-2',
            source: 'Financial Times',
            title: 'Energy sector shows momentum amid shifting demand patterns',
            summary: 'Renewable and traditional energy providers are seeing increased institutional interest.',
            description: 'Renewable and traditional energy providers are seeing increased institutional interest.',
            time: '1h ago',
            publishedAt: new Date().toISOString(),
            sentiment: 'Bullish',
            category: 'Macro',
            url: '#',
        },
        {
            id: 'f-3',
            source: 'Global News',
            title: 'Inflation targets remain in focus for major economies',
            summary: 'Recent policy reports highlight the ongoing efforts to balance growth and stability.',
            description: 'Recent policy reports highlight the ongoing efforts to balance growth and stability.',
            time: '3h ago',
            publishedAt: new Date().toISOString(),
            sentiment: 'Neutral',
            category: 'Policy',
            url: '#',
        },
    ];
};

module.exports = { fetchMarketNews };

