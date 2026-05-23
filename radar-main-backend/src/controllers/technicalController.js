const Watchlist = require('../models/Watchlist');
const { fetchStockData } = require('../services/stockService');
const { getTechnicalIndicators, getTrendMatrix } = require('../services/indicatorService');
const { getInstrumentScore } = require('../services/scoringService');
const { detectPatterns } = require('../services/patternService');

// Ensure Indian stock symbols get .NS suffix so external providers resolve them correctly.
// Symbols stored without a dot (e.g. "RELIANCE") are treated as NSE equities.
const normalizeSym = (sym) => {
    let s = String(sym || '').trim().toUpperCase();
    if (!s) return s;
    
    // Known Cryptos -> append -USD for Yahoo Finance, and clean up accidental .NS
    const knownCryptos = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOGE', 'DOT', 'BNB', 'MATIC', 'AVAX', 'LINK', 'LTC'];
    const bareSymbol = s.replace(/\.(NS|BO)$/i, '');
    if (knownCryptos.includes(bareSymbol) || bareSymbol.endsWith('-USD')) {
        return bareSymbol.endsWith('-USD') ? bareSymbol : `${bareSymbol}-USD`;
    }

    // Already has an exchange suffix — leave as-is
    if (s.includes('.')) return s;
    // Indices (start with ^ or contain NIFTY/SENSEX) — leave as-is
    if (s.startsWith('^') || s.includes('NIFTY') || s.includes('SENSEX')) return s;
    // Plain Indian equity ticker → append .NS
    return `${s}.NS`;
};

const getWatchlistData = async (req, res) => {
    try {
        let rawSymbols = [];
        if (req.user && req.user._id) {
            // Filter by mode if provided (?mode=trader or ?mode=investor)
            const modeFilter = req.query.mode
                ? { userId: req.user._id, mode: String(req.query.mode).toLowerCase() }
                : { userId: req.user._id };

            const watchlists = await Watchlist.find(modeFilter);
            if (watchlists && watchlists.length > 0) {
                const allSymbols = new Set();
                watchlists.forEach(wl => {
                    if (wl.items && Array.isArray(wl.items)) {
                        wl.items.forEach(item => {
                            if (item.symbol) allSymbols.add(item.symbol);
                        });
                    }
                });
                if (allSymbols.size > 0) {
                    rawSymbols = Array.from(allSymbols);
                }
            }
        }

        if (rawSymbols.length === 0) {
            return res.json([]);
        }

        // Normalize symbols before hitting external data providers
        const customSymbols = rawSymbols.map(normalizeSym);

        const stocks = await fetchStockData(customSymbols);
        const technicalWatchlist = stocks.map(stock => {
            const currentPrice = stock.price;
            const vwap = (currentPrice * 0.98).toFixed(2);
            const changePercent = Number(stock.change ?? 0);
            return {
                ...stock,
                changePercent,
                ltp: currentPrice,
                technicals: {
                    vwap: vwap,
                    status: currentPrice > vwap ? "Above VWAP" : "Below VWAP",
                    sparkline: [
                        currentPrice - 2, currentPrice - 1, currentPrice - 1.5, currentPrice + 0.5, currentPrice
                    ]
                }
            };
        });
        res.json(technicalWatchlist);
    } catch (error) {
        console.error('Error in getWatchlistData:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

const getBreakoutAlerts = async (req, res) => {
    try {
        // Fetch user's watchlist symbols
        let rawSymbols = [];
        if (req.user?._id) {
            const watchlists = await Watchlist.find({ userId: req.user._id });
            watchlists.forEach(wl => {
                (wl.items || []).forEach(item => { if (item.symbol) rawSymbols.push(item.symbol); });
            });
        }

        // Fall back to a small default universe if watchlist is empty
        if (rawSymbols.length === 0) {
            rawSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'];
        }

        const symbols = [...new Set(rawSymbols)].slice(0, 15).map(normalizeSym);
        const stocks  = await fetchStockData(symbols).catch(() => []);
        const priceMap = {};
        (Array.isArray(stocks) ? stocks : []).forEach(s => {
            const key = String(s.symbol || '').replace('.NS', '').toUpperCase();
            priceMap[key] = Number(s.price || 0);
        });

        const alerts = [];
        await Promise.allSettled(
            symbols.map(async (sym) => {
                try {
                    const patterns = await detectPatterns('stock', sym, {});
                    const cleanSym = sym.replace('.NS', '');
                    const price    = priceMap[cleanSym] || null;
                    const now      = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

                    (Array.isArray(patterns) ? patterns : []).forEach(p => {
                        const name = String(p.pattern || p.name || '').trim();
                        if (!name) return;
                        alerts.push({ symbol: cleanSym, type: name, price, time: now });
                    });
                } catch (_) { /* skip failed symbols */ }
            })
        );

        // Sort so the most recently detected (higher price change) appear first
        alerts.sort((a, b) => (b.price || 0) - (a.price || 0));
        res.json(alerts.slice(0, 20));
    } catch (error) {
        console.error('Error in getBreakoutAlerts:', error);
        res.status(500).json({ error: 'Failed to fetch breakout alerts' });
    }
};

const getIndicatorSignals = async (req, res) => {
    try {
        let rawSymbols = [];
        if (req.user?._id) {
            const watchlists = await Watchlist.find({ userId: req.user._id });
            watchlists.forEach(wl => {
                (wl.items || []).forEach(item => { if (item.symbol) rawSymbols.push(item.symbol); });
            });
        }

        if (rawSymbols.length === 0) {
            rawSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'];
        }

        const symbols = [...new Set(rawSymbols)].slice(0, 12).map(normalizeSym);
        const signals = [];

        await Promise.allSettled(
            symbols.map(async (sym) => {
                try {
                    const ind      = await getTechnicalIndicators('stock', sym, '1D', {});
                    const cleanSym = sym.replace('.NS', '');
                    const rsi      = Number(ind?.rsi ?? 0);
                    const macd     = ind?.macd || {};
                    const ema20    = Number(ind?.ema20 ?? 0);
                    const ema50    = Number(ind?.ema50 ?? 0);

                    if (rsi > 0 && rsi < 35) {
                        signals.push({ symbol: cleanSym, value: `RSI Oversold (${rsi.toFixed(1)})`, stocks: [cleanSym], signal: 'BULLISH', strength: rsi < 25 ? 'High' : 'Medium' });
                    } else if (rsi > 65) {
                        signals.push({ symbol: cleanSym, value: `RSI Overbought (${rsi.toFixed(1)})`, stocks: [cleanSym], signal: 'BEARISH', strength: rsi > 75 ? 'High' : 'Medium' });
                    }

                    if (macd?.histogram > 0 && macd?.signal < 0) {
                        signals.push({ symbol: cleanSym, value: 'MACD Bullish Cross', stocks: [cleanSym], signal: 'BULLISH', strength: 'Medium' });
                    } else if (macd?.histogram < 0 && macd?.signal > 0) {
                        signals.push({ symbol: cleanSym, value: 'MACD Bearish Cross', stocks: [cleanSym], signal: 'BEARISH', strength: 'Medium' });
                    }

                    if (ema20 > 0 && ema50 > 0) {
                        if (ema20 > ema50) {
                            signals.push({ symbol: cleanSym, value: 'Golden Cross (EMA20 > EMA50)', stocks: [cleanSym], signal: 'BULLISH', strength: 'High' });
                        } else {
                            signals.push({ symbol: cleanSym, value: 'Death Cross (EMA20 < EMA50)', stocks: [cleanSym], signal: 'BEARISH', strength: 'High' });
                        }
                    }
                } catch (_) { /* skip */ }
            })
        );

        res.json(signals.slice(0, 20));
    } catch (error) {
        console.error('Error in getIndicatorSignals:', error);
        res.status(500).json({ error: 'Failed to fetch indicator signals' });
    }
};

const getQuickOrderData = (req, res) => {
    res.json({
        availableBalance: 25420.50,
        buyingPower: 101682.00,
        marginUsed: 0.00
    });
};

const strictLiveEnabled = (req) => String(req.query.strictLive || '').toLowerCase() === 'true';

const getIndicators = async (req, res) => {
    try {
        const { assetType, symbol } = req.params;
        const { interval = '1D' } = req.query;
        const data = await getTechnicalIndicators(assetType, symbol, interval, { strictLive: strictLiveEnabled(req) });
        res.json({ success: true, symbol, assetType, interval, ...data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getTrend = async (req, res) => {
    try {
        const { assetType, symbol } = req.params;
        const matrix = await getTrendMatrix(assetType, symbol, { strictLive: strictLiveEnabled(req) });
        res.json({ success: true, symbol, assetType, trendMatrix: matrix });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getScore = async (req, res) => {
    try {
        const { assetType, symbol } = req.params;
        const result = await getInstrumentScore(assetType, symbol, { strictLive: strictLiveEnabled(req) });
        res.json({ success: true, symbol, assetType, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getPatterns = async (req, res) => {
    try {
        const { assetType, symbol } = req.params;
        const patterns = await detectPatterns(assetType, symbol, { strictLive: strictLiveEnabled(req) });
        res.json({ success: true, symbol, assetType, patterns });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getSummary = async (req, res) => {
    try {
        const { assetType, symbol } = req.params;
        const options = { strictLive: strictLiveEnabled(req) };
        const [indicators, trendMatrix, scoreResult, patterns] = await Promise.allSettled([
            getTechnicalIndicators(assetType, symbol, '1D', options),
            getTrendMatrix(assetType, symbol, options),
            getInstrumentScore(assetType, symbol, options),
            detectPatterns(assetType, symbol, options)
        ]);

        res.json({
            success: true,
            symbol,
            assetType,
            indicators: indicators.status === 'fulfilled' ? indicators.value : null,
            trendMatrix: trendMatrix.status === 'fulfilled' ? trendMatrix.value : null,
            score: scoreResult.status === 'fulfilled' ? scoreResult.value : null,
            patterns: patterns.status === 'fulfilled' ? patterns.value : []
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getWatchlistData,
    getBreakoutAlerts,
    getIndicatorSignals,
    getQuickOrderData,
    getIndicators,
    getTrend,
    getScore,
    getPatterns,
    getSummary
};
