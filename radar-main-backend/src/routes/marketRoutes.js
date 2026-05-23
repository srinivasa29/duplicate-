const express = require('express');
const router = express.Router();
const {
    getMarketData,
    getCryptoBySymbol,
    getTrendingSearches,
    getSearchHistory,
    logSearchEndpoint,
    searchUniversalSymbols,
    syncUniversalSymbols,
} = require('../controllers/marketController');
const { getHistory } = require('../controllers/historyController');
const { getOrderBook } = require('../controllers/depthController');
const { getStatus, getProviderHealth } = require('../controllers/statusController');
const { getMarketNews } = require('../controllers/newsController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getMarketData: getUnifiedData } = require('../services/marketDataService');
const { validateRequest, validateSymbolParam } = require('../middleware/validationMiddleware');
const freeApiAggregator = require('../services/freeApiAggregator');
const { fetchQuotesWithFallback } = require('../services/priceRouter');
const { getFundamentals } = require('../services/fundamentalsEnrichmentService');
const logger = require('../config/logger');

const { getActiveSymbols } = require('../utils/symbolRegistry');

router.get('/', getMarketData);
router.get('/health', getProviderHealth);

// GET /api/market/universe
// Returns the active symbol universe (bare tickers, no suffix).
// Used by the frontend universeService to seed the local cache on startup.
router.get('/universe', async (req, res) => {
    try {
        const symbols = await getActiveSymbols();
        return res.json({ success: true, data: { universe: symbols } });
    } catch (err) {
        logger.error('[/market/universe] Error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to fetch universe' });
    }
});


router.get('/search/trending', getTrendingSearches);
router.post('/search/log', logSearchEndpoint);
router.get('/search/history', authMiddleware, getSearchHistory);
router.get('/search', searchUniversalSymbols);
router.post('/search/sync', syncUniversalSymbols);

router.get('/history', getHistory);
router.get('/depth', getOrderBook);
router.get('/status', getStatus);
router.get('/news', getMarketNews);

router.get('/crypto/:symbol', validateSymbolParam, validateRequest, getCryptoBySymbol);

router.get('/forex/:symbol', validateSymbolParam, validateRequest, async (req, res) => {
    try {
        const data = await getUnifiedData('forex', req.params.symbol);
        res.json({ success: true, data });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
});

router.get('/stock/:symbol', validateSymbolParam, validateRequest, async (req, res) => {
    try {
        const data = await getUnifiedData('stock', req.params.symbol);
        res.json({ success: true, data });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/market/quotes?symbols=HDFCBANK.NS,RELIANCE.NS,...
 *
 * Returns price quote + enriched fundamentals (PE, beta, ROE, delivery %,
 * 1M momentum, sector) for each requested symbol.
 *
 * Price: freeApiAggregator (Twelve Data / Finnhub / Yahoo cache)
 * Fundamentals: yahoo-finance2 quoteSummary (cached 6h)
 */
router.get('/quotes', async (req, res) => {
    try {
        const symbolsParam = String(req.query.symbols || '').trim();
        if (!symbolsParam) {
            return res.status(400).json({ success: false, message: 'symbols query param is required' });
        }

        const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
        if (symbols.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid symbols provided' });
        }

        logger.info(`[/market/quotes] Requested: ${symbols.join(', ')}`);

        // Try the primary price router first (TwelveData → Marketstack → Tiingo)
        let priceMap = new Map();
        let providerName = 'freeApiAggregator';
        try {
            const priceFetch = await fetchQuotesWithFallback(symbols);
            providerName = priceFetch.provider || 'unknown';
            const priceArray = Array.isArray(priceFetch.data) ? priceFetch.data : [];
            priceArray.forEach(p => {
                const key = String(p.symbol || '').toUpperCase().replace(/\.(NS|BO)$/i, '');
                priceMap.set(key, p);
            });
        } catch (priceErr) {
            logger.warn('[/market/quotes] Primary price router failed, using per-symbol aggregator:', priceErr.message);
        }

        // Build enriched responses, falling back to freeApiAggregator per-symbol for Indian stocks
        const enriched = await Promise.all(
            symbols.map(async (sym) => {
                const key = String(sym).toUpperCase().replace(/\.(NS|BO)$/i, '');
                let priceDataRaw = priceMap.get(key) || {};
                let priceData = priceDataRaw.raw || priceDataRaw;
                let priceValue = Number(priceDataRaw.price ?? priceData?.price ?? priceData?.close ?? priceData?.ltp ?? 0);
                let changePercent = Number(priceData?.changePercent ?? priceData?.change ?? 0);

                // Fallback to freeApiAggregator for Indian symbols when price is missing/zero.
                // Handles both HDFCBANK.NS (with suffix) and HDFCBANK (bare, stored by DB without suffix).
                const isIndian = /\.(NS|BO)$/i.test(sym);
                const isBareIndian = !isIndian && /^[A-Z0-9&-]{2,20}$/.test(sym.trim());
                if ((!priceValue || priceValue === 0) && (isIndian || isBareIndian)) {
                    // Try with .NS suffix if bare symbol (DB stores without suffix)
                    const querySymbol = isIndian ? sym : `${sym}.NS`;
                    try {
                        const aggResult = await freeApiAggregator.getQuote(querySymbol);
                        if (aggResult?.success && aggResult.data) {
                            const d = aggResult.data;
                            priceValue    = Number(d.current ?? d.price ?? d.close ?? 0);
                            changePercent = Number(d.changePercent ?? d.change ?? 0);
                            priceData     = d;
                            providerName  = aggResult.source || 'aggregator';
                            logger.info(`[/market/quotes] Aggregator fallback succeeded for ${querySymbol}: ₹${priceValue}`);
                        }
                        // If .NS failed, try .BO
                        if (!priceValue && isBareIndian) {
                            const bseSymbol = `${sym}.BO`;
                            const bseResult = await freeApiAggregator.getQuote(bseSymbol);
                            if (bseResult?.success && bseResult.data) {
                                const d = bseResult.data;
                                priceValue    = Number(d.current ?? d.price ?? d.close ?? 0);
                                changePercent = Number(d.changePercent ?? d.change ?? 0);
                                priceData     = d;
                                providerName  = bseResult.source || 'aggregator';
                                logger.info(`[/market/quotes] BSE fallback succeeded for ${bseSymbol}: ₹${priceValue}`);
                            }
                        }
                    } catch (aggErr) {
                        logger.warn(`[/market/quotes] Aggregator fallback failed for ${querySymbol}:`, aggErr.message);
                    }
                }

                const fundamentals = await getFundamentals(sym, changePercent);

                return {
                    symbol:        sym,
                    price:         priceValue,
                    changePercent,
                    change:        changePercent,
                    high:          priceData?.high  ?? null,
                    low:           priceData?.low   ?? null,
                    open:          priceData?.open  ?? null,
                    volume:        priceData?.volume ?? null,
                    // Fundamentals
                    pe:            fundamentals.pe,
                    beta:          fundamentals.beta,
                    roe:           fundamentals.roe,
                    debtToEquity:  fundamentals.debtToEquity,
                    revenueGrowth: fundamentals.revenueGrowth,
                    profitMargins: fundamentals.profitMargins,
                    deliveryPct:   fundamentals.deliveryPct,
                    momentum:      fundamentals.momentum,
                    volumeRatio:   fundamentals.volumeRatio,
                    sector:        fundamentals.sector,
                    industry:      fundamentals.industry,
                    marketCap:     fundamentals.marketCap,
                    valStatus:     fundamentals.valStatus,
                    // Crypto-native fields
                    category:      priceData?.category || fundamentals.sector,
                    layer:         priceData?.layer || null,
                    consensus:     priceData?.consensus || null,
                    tradeCount:    priceData?.tradeCount || null,
                    // Source metadata
                    priceSource:   providerName,
                    fundamentalSource: 'yahoo-finance2',
                    timestamp:     new Date().toISOString(),
                };
            })
        );

        return res.json({ success: true, data: enriched });
    } catch (err) {
        logger.error('[/market/quotes] Error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to fetch quotes', error: err.message });
    }
});

module.exports = router;
