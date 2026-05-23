const Watchlist = require('../models/Watchlist');

const profileCache = require('../services/profileCache');

// Normalizes a raw symbol to include an exchange suffix for Indian equities.
// Symbols from search results (e.g. "RELIANCE") get .NS appended so they work
// in Yahoo Finance / Tiingo / etc. Suffixed symbols and indices are left unchanged.
const normalizeSymbolForStorage = (sym) => {
    let s = String(sym || '').trim().toUpperCase();
    if (!s) return s;
    
    // Known Cryptos -> append -USD for Yahoo Finance, and clean up accidental .NS
    const knownCryptos = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOGE', 'DOT', 'BNB', 'MATIC', 'AVAX', 'LINK', 'LTC'];
    const bareSymbol = s.replace(/\.(NS|BO)$/i, '');
    if (knownCryptos.includes(bareSymbol) || bareSymbol.endsWith('-USD')) {
        return bareSymbol.endsWith('-USD') ? bareSymbol : `${bareSymbol}-USD`;
    }

    if (s.includes('.')) return s; // already has a suffix
    if (s.startsWith('^') || s.includes('NIFTY') || s.includes('SENSEX')) return s;
    return `${s}.NS`;
};

const getWatchlists = async (req, res) => {
    try {
        // Optional ?mode=trader|investor query param.
        // If omitted, return ALL watchlists for the user (backward compat).
        const query = { userId: req.user._id };
        if (req.query.mode) {
            query.mode = String(req.query.mode).toLowerCase();
        }
        const watchlists = await Watchlist.find(query).sort({ createdAt: 1 });
        res.json(watchlists);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch watchlists" });
    }
};

const createWatchlist = async (req, res) => {
    const { name, mode } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const validMode = ['trader', 'investor'].includes(String(mode || '').toLowerCase())
        ? String(mode).toLowerCase()
        : null;

    try {
        const watchlist = new Watchlist({
            userId: req.user._id,
            name,
            mode: validMode,
            items: []
        });
        await watchlist.save();
        try { await profileCache.invalidate(req.user._id); } catch (_) {}
        res.status(201).json(watchlist);
    } catch (error) {
        if (error.code === 11000) {
            // Already exists — return the existing one instead of erroring
            try {
                const existing = await Watchlist.findOne({
                    userId: req.user._id,
                    name,
                    mode: validMode ?? null,
                });
                if (existing) return res.status(200).json(existing);
            } catch (_) {}
            return res.status(400).json({ error: "Watchlist with this name already exists" });
        }
        res.status(500).json({ error: "Failed to create watchlist" });
    }
};

const addToWatchlist = async (req, res) => {
    const { id } = req.params;
    const { symbol: rawSymbol } = req.body;

    if (!rawSymbol) return res.status(400).json({ error: "Symbol is required" });

    // Normalize: plain tickers (e.g. "RELIANCE") → "RELIANCE.NS"
    const symbol = normalizeSymbolForStorage(rawSymbol);

    try {
        const watchlist = await Watchlist.findOne({ _id: id, userId: req.user._id });
        if (!watchlist) return res.status(404).json({ error: "Watchlist not found" });

        const exists = watchlist.items.some(item => item.symbol === symbol);
        if (exists) return res.status(400).json({ error: "Stock already in watchlist" });

        watchlist.items.push({ symbol });
        await watchlist.save();
        try { await profileCache.invalidate(req.user._id); } catch (_) {}
        res.json(watchlist);
    } catch (error) {
        res.status(500).json({ error: "Failed to add to watchlist" });
    }
};

const removeFromWatchlist = async (req, res) => {
    const { id, symbol: rawSymbol } = req.params;
    // Accept either "RELIANCE" or "RELIANCE.NS" from the frontend
    const normalized = normalizeSymbolForStorage(rawSymbol);
    const plain = String(rawSymbol || '').trim().toUpperCase();

    try {
        const watchlist = await Watchlist.findOne({ _id: id, userId: req.user._id });
        if (!watchlist) return res.status(404).json({ error: "Watchlist not found" });

        watchlist.items = watchlist.items.filter(item =>
            item.symbol !== normalized && item.symbol !== plain
        );
        await watchlist.save();
        try { await profileCache.invalidate(req.user._id); } catch (_) {}
        res.json(watchlist);
    } catch (error) {
        res.status(500).json({ error: "Failed to remove from watchlist" });
    }
};

module.exports = { getWatchlists, createWatchlist, addToWatchlist, removeFromWatchlist };
