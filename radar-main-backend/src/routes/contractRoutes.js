const express = require('express');
const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const Notification = require('../models/Notification');
const Portfolio = require('../models/Portfolio');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getDbStatus } = require('../config/db');
const { getMarketStatus } = require('../utils/marketStatus');
const { fetchStockData } = require('../services/stockService');
const { fetchCryptoData } = require('../services/cryptoService');
const { fetchForexData } = require('../services/forexService');
const { searchSymbolRegistry } = require('../services/symbolRegistryService');
const { runScreener } = require('../services/screenerService');
const { getFilingsForSymbol } = require('../services/secService');
const { getMacroIndicators } = require('../services/macroService');
const { fetchMarketNews } = require('../services/newsService');
const {
    getTechnicalIndicators,
    getTrendMatrix,
} = require('../services/indicatorService');
const { getInstrumentScore } = require('../services/scoringService');
const { detectPatterns } = require('../services/patternService');
const { getSectorPerformance } = require('../services/sectorService');
const {
    registerUser,
    loginUser,
} = require('../controllers/userController');
const { getDataQuality } = require('../controllers/dataQualityController');
const { issueStreamToken } = require('../controllers/signalsController');
const { getEconomicEvents } = require('../controllers/calendarController');
const {
    getStockEarningsCalendar,
    getStockNewsSentiment,
} = require('../services/stockInsightsService');
const { recordTrade } = require('../services/tradeLogService');

const router = express.Router();

const toNumber = (value, fallback = NaN) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase();
const stripSymbolSuffix = (value) => normalizeSymbol(value).replace(/\.(NS|BO)$/i, '');
const nowIso = () => new Date().toISOString();
const safeObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const parseMaybeDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const sendError = (res, status, message) => {
    return res.status(status).json({ success: false, message });
};

const ensureAuth = (handler) => [authMiddleware, handler];

const buildTransactionFromHolding = (holding, index = 0) => ({
    id: String(holding._id || `${holding.symbol}-${index}`),
    symbol: String(holding.symbol || '').toUpperCase(),
    quantity: Number(holding.quantity || 0),
    price: Number(holding.avgBuyPrice || 0),
    side: Number(holding.quantity || 0) >= 0 ? 'BUY' : 'SELL',
    assetType: String(holding.assetType || 'STOCK').toUpperCase(),
    createdAt: holding.addedAt || nowIso(),
});

const summarizePortfolio = async (portfolio) => {
    const rows = Array.isArray(portfolio?.holdings) ? portfolio.holdings : [];
    const symbols = rows.map((item) => normalizeSymbol(item.symbol));
    let marketRows = [];
    try {
        marketRows = await fetchStockData();
    } catch (_error) {
    }

    const priceMap = new Map((Array.isArray(marketRows) ? marketRows : []).map((row) => [
        stripSymbolSuffix(row.symbol),
        toNumber(row.price, 0),
    ]));

    const holdings = rows.map((item) => {
        const symbol = normalizeSymbol(item.symbol);
        const qty = toNumber(item.quantity, 0);
        const avgPrice = toNumber(item.avgBuyPrice, 0);
        const currentPrice = priceMap.get(stripSymbolSuffix(symbol)) || avgPrice || 0;
        const marketValue = qty * currentPrice;
        const investedValue = qty * avgPrice;
        return {
            symbol,
            quantity: qty,
            avgBuyPrice: avgPrice,
            currentPrice,
            marketValue: Number(marketValue.toFixed(2)),
            unrealizedPnL: Number((marketValue - investedValue).toFixed(2)),
            assetType: String(item.assetType || 'STOCK').toUpperCase(),
        };
    });

    const holdingsValue = holdings.reduce((sum, row) => sum + Number(row.marketValue || 0), 0);
    const cash = Number(portfolio?.cashBalance || 0);
    return {
        cashBalance: Number(cash.toFixed(2)),
        holdings,
        holdingsValue: Number(holdingsValue.toFixed(2)),
        totalValue: Number((cash + holdingsValue).toFixed(2)),
        totalTrades: Number(portfolio?.totalTrades || 0),
        symbols,
    };
};

router.post('/auth/register', registerUser);
router.post('/auth/login', loginUser);
router.post('/auth/logout', ...ensureAuth(async (_req, res) => {
    return res.json({ success: true, message: 'Logged out' });
}));
router.get('/auth/me', ...ensureAuth(async (req, res) => {
    return res.json({
        success: true,
        data: {
            id: req.user._id,
            username: req.user.username,
            email: req.user.email || null,
            preferredMode: req.user.preferredMode,
            settings: req.user.settings || {},
        },
    });
}));
router.post('/auth/forgot-password', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
        return sendError(res, 400, 'email is required');
    }

    return res.json({
        success: true,
        message: 'If the email exists, a reset instruction has been issued.',
    });
});
router.post('/auth/reset-password', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const nextPassword = String(req.body?.password || '');

    if (!email || !nextPassword) {
        return sendError(res, 400, 'email and password are required');
    }

    const user = await User.findOne({ email });
    if (!user) {
        return sendError(res, 404, 'User not found');
    }

    user.password = nextPassword;
    await user.save();
    return res.json({ success: true, message: 'Password reset successful' });
});

router.put('/user/profile', ...ensureAuth(async (req, res) => {
    const username = String(req.body?.username || req.user.username || '').trim();
    const email = String(req.body?.email || req.user.email || '').trim().toLowerCase();

    if (!username) {
        return sendError(res, 400, 'username is required');
    }

    if (email) {
        const existing = await User.findOne({ email, _id: { $ne: req.user._id } });
        if (existing) {
            return sendError(res, 400, 'Email already in use');
        }
    }

    req.user.username = username;
    if (email) {
        req.user.email = email;
    }
    await req.user.save();

    return res.json({
        success: true,
        data: {
            id: req.user._id,
            username: req.user.username,
            email: req.user.email || null,
            preferredMode: req.user.preferredMode,
            settings: req.user.settings || {},
        },
    });
}));

router.put('/user/settings', ...ensureAuth(async (req, res) => {
    const incoming = (req.body && typeof req.body === 'object') ? req.body : {};
    const settings = {
        ...(req.user.settings || {}),
        ...incoming,
    };
    req.user.settings = settings;
    await req.user.save();
    return res.json({ success: true, data: settings });
}));

router.put('/user/persona', ...ensureAuth(async (req, res) => {
    const persona = String(req.body?.persona || req.body?.mode || '').toUpperCase();
    if (!['TRADER', 'INVESTOR'].includes(persona)) {
        return sendError(res, 400, 'persona must be TRADER or INVESTOR');
    }

    req.user.preferredMode = persona;
    await req.user.save();
    return res.json({ success: true, data: { preferredMode: persona } });
}));

router.get('/user/portfolio', ...ensureAuth(async (req, res) => {
    const portfolio = await Portfolio.findOneAndUpdate(
        { user: req.user._id },
        { $setOnInsert: { user: req.user._id } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const summary = await summarizePortfolio(portfolio);
    const transactions = (Array.isArray(portfolio.holdings) ? portfolio.holdings : []).map(buildTransactionFromHolding);
    return res.json({ success: true, data: { ...summary, transactions } });
}));

router.put('/user/portfolio', ...ensureAuth(async (req, res) => {
    const incoming = (req.body && typeof req.body === 'object') ? req.body : {};
    const cashBalance = toNumber(incoming.cashBalance, NaN);
    const holdings = Array.isArray(incoming.holdings) ? incoming.holdings : null;

    const portfolio = await Portfolio.findOneAndUpdate(
        { user: req.user._id },
        { $setOnInsert: { user: req.user._id } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (Number.isFinite(cashBalance) && cashBalance >= 0) {
        portfolio.cashBalance = cashBalance;
    }

    if (holdings) {
        portfolio.holdings = holdings.map((item) => ({
            symbol: normalizeSymbol(item.symbol),
            quantity: toNumber(item.quantity, 0),
            avgBuyPrice: toNumber(item.avgBuyPrice ?? item.price, 0),
            assetType: String(item.assetType || 'STOCK').toUpperCase(),
        }));
    }

    await portfolio.save();
    const summary = await summarizePortfolio(portfolio);
    return res.json({ success: true, data: summary });
}));

router.post('/user/portfolio/transactions', ...ensureAuth(async (req, res) => {
    const side = String(req.body?.side || req.body?.action || '').toUpperCase();
    const symbol = normalizeSymbol(req.body?.symbol);
    const quantity = toNumber(req.body?.quantity, NaN);
    const price = toNumber(req.body?.price, NaN);
    const assetType = String(req.body?.assetType || 'STOCK').toUpperCase();

    if (!symbol || !['BUY', 'SELL'].includes(side) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
        return sendError(res, 400, 'Invalid transaction payload');
    }

    const portfolio = await Portfolio.findOneAndUpdate(
        { user: req.user._id },
        { $setOnInsert: { user: req.user._id } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const total = quantity * price;
    const idx = portfolio.holdings.findIndex((row) => normalizeSymbol(row.symbol) === symbol);

    let entryPrice = price;

    if (side === 'BUY') {
        if (Number(portfolio.cashBalance || 0) < total) {
            return sendError(res, 400, 'Insufficient funds');
        }
        portfolio.cashBalance = Number(portfolio.cashBalance || 0) - total;

        if (idx >= 0) {
            const current = portfolio.holdings[idx];
            const existingQty = Number(current.quantity || 0);
            const existingAvg = Number(current.avgBuyPrice || 0);
            const nextQty = existingQty + quantity;
            const nextAvg = nextQty > 0 ? ((existingQty * existingAvg) + total) / nextQty : 0;
            portfolio.holdings[idx].quantity = nextQty;
            portfolio.holdings[idx].avgBuyPrice = nextAvg;
        } else {
            portfolio.holdings.push({
                symbol,
                quantity,
                avgBuyPrice: price,
                assetType,
            });
        }
    } else {
        if (idx < 0) {
            return sendError(res, 400, 'Holding not found');
        }
        const current = portfolio.holdings[idx];
        entryPrice = Number(current.avgBuyPrice || price);
        const existingQty = Number(current.quantity || 0);
        if (existingQty < quantity) {
            return sendError(res, 400, 'Not enough quantity to sell');
        }
        portfolio.cashBalance = Number(portfolio.cashBalance || 0) + total;
        portfolio.holdings[idx].quantity = existingQty - quantity;
        if (portfolio.holdings[idx].quantity <= 0) {
            portfolio.holdings.splice(idx, 1);
        }
    }

    portfolio.totalTrades = Number(portfolio.totalTrades || 0) + 1;
    await portfolio.save();

    return res.status(201).json({
        success: true,
        data: {
            id: `${symbol}-${Date.now()}`,
            symbol,
            quantity,
            price,
            side,
            assetType,
            createdAt: nowIso(),
        },
    });
}));

router.delete('/user/portfolio/transactions/:id', ...ensureAuth(async (req, res) => {
    return res.json({
        success: true,
        data: { id: String(req.params.id), status: 'deleted' },
        note: 'Transaction-level delete is compatibility-only with aggregate portfolio holdings.',
    });
}));

router.get('/user/portfolio/analytics', ...ensureAuth(async (req, res) => {
    const portfolio = await Portfolio.findOneAndUpdate(
        { user: req.user._id },
        { $setOnInsert: { user: req.user._id } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const summary = await summarizePortfolio(portfolio);
    return res.json({
        success: true,
        data: {
            totalValue: summary.totalValue,
            cashBalance: summary.cashBalance,
            holdingsValue: summary.holdingsValue,
            holdingsCount: summary.holdings.length,
            totalTrades: summary.totalTrades,
            topHoldings: [...summary.holdings]
                .sort((a, b) => Number(b.marketValue || 0) - Number(a.marketValue || 0))
                .slice(0, 5),
        },
    });
            recordTrade({
                userId: req.user._id,
                symbol,
                side,
                quantity,
                price,
                assetType,
                entryPrice,
                executedAt: nowIso(),
                source: 'contract/portfolio',
            }).catch(() => null);
}));

router.get('/user/watchlists', ...ensureAuth(async (req, res) => {
    const list = Array.isArray(req.user.watchlist) ? req.user.watchlist : [];
    return res.json({
        success: true,
        data: [{
            id: 'default',
            name: 'Default',
            symbols: list.map((item) => normalizeSymbol(item.symbol)),
            items: list,
        }],
    });
}));

router.post('/user/watchlists', ...ensureAuth(async (req, res) => {
    const name = String(req.body?.name || 'Default').trim() || 'Default';
    return res.status(201).json({
        success: true,
        data: { id: 'default', name },
        note: 'Single default watchlist is currently supported.',
    });
}));

router.delete('/user/watchlists/:id', ...ensureAuth(async (_req, res) => {
    return res.json({
        success: true,
        note: 'Delete watchlist is compatibility-only; default watchlist cannot be removed.',
    });
}));

router.post('/user/watchlists/:id/symbols', ...ensureAuth(async (req, res) => {
    const symbol = normalizeSymbol(req.body?.symbol);
    const assetType = String(req.body?.assetType || 'STOCK').toUpperCase();
    const name = String(req.body?.name || symbol);

    if (!symbol) {
        return sendError(res, 400, 'symbol is required');
    }

    const exists = (req.user.watchlist || []).find((item) => normalizeSymbol(item.symbol) === symbol);
    if (exists) {
        return sendError(res, 400, 'Symbol already in watchlist');
    }

    req.user.watchlist.push({ symbol, assetType, name });
    await req.user.save();
    return res.status(201).json({ success: true, data: req.user.watchlist });
}));

router.delete('/user/watchlists/:id/symbols/:symbol', ...ensureAuth(async (req, res) => {
    const symbol = normalizeSymbol(req.params.symbol);
    req.user.watchlist = (req.user.watchlist || []).filter((item) => normalizeSymbol(item.symbol) !== symbol);
    await req.user.save();
    return res.json({ success: true, data: req.user.watchlist });
}));

router.get('/user/notifications', ...ensureAuth(async (req, res) => {
    const rows = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, data: rows });
}));

router.put('/user/notifications/:id', ...ensureAuth(async (req, res) => {
    const id = String(req.params.id || '');
    if (!safeObjectId(id)) {
        return sendError(res, 400, 'Invalid notification id');
    }

    const notification = await Notification.findOne({ _id: id, user: req.user._id });
    if (!notification) {
        return sendError(res, 404, 'Notification not found');
    }

    if (typeof req.body?.read === 'boolean') {
        notification.read = req.body.read;
    } else {
        notification.read = true;
    }
    await notification.save();
    return res.json({ success: true, data: notification });
}));

router.post('/user/notifications/mark-all-read', ...ensureAuth(async (req, res) => {
    const result = await Notification.updateMany(
        { user: req.user._id, read: false },
        { $set: { read: true } }
    );
    return res.json({
        success: true,
        data: { modified: Number(result.modifiedCount || 0) },
    });
}));

router.get('/alerts', ...ensureAuth(async (req, res) => {
    const rows = await Alert.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, data: rows });
}));

router.post('/alerts', ...ensureAuth(async (req, res) => {
    const symbol = normalizeSymbol(req.body?.symbol);
    const type = String(req.body?.type || 'TRADER').toUpperCase();
    const condition = String(req.body?.condition || '').toUpperCase();
    const threshold = toNumber(req.body?.threshold, NaN);
    const expiresAt = parseMaybeDate(req.body?.expiresAt) || new Date(Date.now() + (24 * 60 * 60 * 1000));

    if (!symbol || !type || !condition || !Number.isFinite(threshold)) {
        return sendError(res, 400, 'symbol, type, condition and threshold are required');
    }

    const alert = await Alert.create({
        user: req.user._id,
        symbol,
        type,
        condition,
        threshold,
        expiresAt,
    });

    return res.status(201).json({ success: true, data: alert });
}));

router.put('/alerts/:id', ...ensureAuth(async (req, res) => {
    const id = String(req.params.id || '');
    if (!safeObjectId(id)) {
        return sendError(res, 400, 'Invalid alert id');
    }

    const alert = await Alert.findOne({ _id: id, user: req.user._id });
    if (!alert) {
        return sendError(res, 404, 'Alert not found');
    }

    const updates = {};
    if (req.body?.symbol) updates.symbol = normalizeSymbol(req.body.symbol);
    if (req.body?.type) updates.type = String(req.body.type).toUpperCase();
    if (req.body?.condition) updates.condition = String(req.body.condition).toUpperCase();
    if (req.body?.threshold !== undefined) updates.threshold = toNumber(req.body.threshold, alert.threshold);
    if (req.body?.status) updates.status = String(req.body.status).toUpperCase();
    if (req.body?.expiresAt) {
        const parsedDate = parseMaybeDate(req.body.expiresAt);
        if (parsedDate) updates.expiresAt = parsedDate;
    }

    Object.assign(alert, updates);
    await alert.save();
    return res.json({ success: true, data: alert });
}));

router.delete('/alerts/:id', ...ensureAuth(async (req, res) => {
    const id = String(req.params.id || '');
    if (!safeObjectId(id)) {
        return sendError(res, 400, 'Invalid alert id');
    }

    const alert = await Alert.findOne({ _id: id, user: req.user._id });
    if (!alert) {
        return sendError(res, 404, 'Alert not found');
    }

    await alert.deleteOne();
    return res.json({ success: true, data: { id } });
}));

router.get('/alerts/history', ...ensureAuth(async (req, res) => {
    const rows = await Alert.find({
        user: req.user._id,
        status: { $in: ['TRIGGERED', 'EXPIRED'] },
    }).sort({ updatedAt: -1 });
    return res.json({ success: true, data: rows });
}));

router.get('/market/summary', async (_req, res) => {
    const [stocks, crypto, forex] = await Promise.all([
        fetchStockData().catch(() => []),
        fetchCryptoData().catch(() => []),
        fetchForexData().catch(() => []),
    ]);

    const topStocks = (Array.isArray(stocks) ? stocks : [])
        .slice(0, 10)
        .map((row) => ({
            symbol: normalizeSymbol(row.symbol),
            name: row.name || row.symbol,
            price: toNumber(row.price, 0),
            change: toNumber(row.change, 0),
            type: 'STOCK',
        }));

    const topCrypto = (Array.isArray(crypto) ? crypto : [])
        .slice(0, 8)
        .map((row) => ({
            symbol: normalizeSymbol(row.symbol || row.id),
            name: row.name || row.symbol || row.id,
            price: toNumber(row.price, 0),
            change: toNumber(row.change_24h ?? row.change, 0),
            type: 'CRYPTO',
        }));

    const topForex = (Array.isArray(forex) ? forex : [])
        .slice(0, 8)
        .map((row) => ({
            symbol: normalizeSymbol(row.symbol),
            name: row.name || row.symbol,
            price: toNumber(row.price, 0),
            change: toNumber(row.change_24h ?? row.change, 0),
            type: 'FOREX',
        }));

    return res.json({
        success: true,
        data: {
            generatedAt: nowIso(),
            counts: {
                stocks: topStocks.length,
                crypto: topCrypto.length,
                forex: topForex.length,
            },
            stocks: topStocks,
            crypto: topCrypto,
            forex: topForex,
        },
    });
});

router.get('/search', async (req, res) => {
    const q = String(req.query?.q || '').trim();
    if (!q) {
        return res.json({ success: true, data: [] });
    }

    const data = await searchSymbolRegistry({ q, limit: 25 });
    return res.json({ success: true, data });
});

router.get('/market/stocks/:symbol', async (req, res) => {
    const symbol = stripSymbolSuffix(req.params.symbol);
    const rows = await fetchStockData().catch(() => []);
    const found = (Array.isArray(rows) ? rows : []).find((row) => stripSymbolSuffix(row.symbol) === symbol);
    if (!found) {
        return sendError(res, 404, `Stock symbol '${symbol}' not found`);
    }

    return res.json({ success: true, data: found });
});

router.get('/market/crypto/:symbol', async (req, res) => {
    const symbol = normalizeSymbol(req.params.symbol);
    const rows = await fetchCryptoData().catch(() => []);
    const found = (Array.isArray(rows) ? rows : []).find((row) => {
        const rowSymbol = normalizeSymbol(row.symbol || row.id);
        return rowSymbol === symbol;
    });
    if (!found) {
        return sendError(res, 404, `Crypto symbol '${symbol}' not found`);
    }

    return res.json({ success: true, data: found });
});

router.get('/market/forex/:symbol', async (req, res) => {
    const symbol = normalizeSymbol(req.params.symbol);
    const rows = await fetchForexData().catch(() => []);
    const found = (Array.isArray(rows) ? rows : []).find((row) => normalizeSymbol(row.symbol) === symbol);
    if (!found) {
        return sendError(res, 404, `Forex symbol '${symbol}' not found`);
    }

    return res.json({ success: true, data: found });
});

router.get('/market/sectors', async (_req, res) => {
    const data = await getSectorPerformance('1d').catch(() => []);
    return res.json({ success: true, data });
});

router.get('/market/sector-rotation', async (_req, res) => {
    const [daily, monthly] = await Promise.all([
        getSectorPerformance('1d').catch(() => []),
        getSectorPerformance('1m').catch(() => []),
    ]);

    const map = new Map((Array.isArray(monthly) ? monthly : []).map((row) => [row.sector, row]));
    const rows = (Array.isArray(daily) ? daily : []).map((row) => {
        const monthRow = map.get(row.sector);
        return {
            sector: row.sector,
            shortTerm: toNumber(row.return, 0),
            mediumTerm: toNumber(monthRow?.return, 0),
            rotation: toNumber(row.return, 0) - toNumber(monthRow?.return, 0),
        };
    });

    return res.json({ success: true, data: rows });
});

router.get('/market/sector-performance', async (req, res) => {
    const period = String(req.query?.period || '1y').toLowerCase();
    const data = await getSectorPerformance(period).catch(() => []);
    return res.json({ success: true, period, data });
});

router.get('/market/sentiment', async (_req, res) => {
    const rows = await fetchStockData().catch(() => []);
    const changes = (Array.isArray(rows) ? rows : [])
        .map((row) => toNumber(row.change, NaN))
        .filter((value) => Number.isFinite(value));
    const advancers = changes.filter((value) => value > 0).length;
    const decliners = changes.filter((value) => value < 0).length;
    const neutral = changes.length - advancers - decliners;
    const score = changes.length ? Number((((advancers - decliners) / changes.length) * 100).toFixed(2)) : 0;

    return res.json({
        success: true,
        data: {
            score,
            status: score > 15 ? 'bullish' : score < -15 ? 'bearish' : 'neutral',
            advancers,
            decliners,
            neutral,
            sampleSize: changes.length,
        },
    });
});

router.get('/market/breadth', async (_req, res) => {
    const rows = await fetchStockData().catch(() => []);
    const changes = (Array.isArray(rows) ? rows : [])
        .map((row) => toNumber(row.change, NaN))
        .filter((value) => Number.isFinite(value));
    const advancers = changes.filter((value) => value > 0).length;
    const decliners = changes.filter((value) => value < 0).length;
    const total = changes.length;

    return res.json({
        success: true,
        data: {
            advancers,
            decliners,
            unchanged: Math.max(0, total - advancers - decliners),
            advanceDeclineRatio: decliners > 0 ? Number((advancers / decliners).toFixed(3)) : null,
            total,
        },
    });
});

router.get('/market/momentum', async (_req, res) => {
    const rows = await fetchStockData().catch(() => []);
    const sorted = [...(Array.isArray(rows) ? rows : [])]
        .sort((a, b) => toNumber(b.change, 0) - toNumber(a.change, 0));
    return res.json({
        success: true,
        data: {
            gainers: sorted.slice(0, 10),
            losers: sorted.slice(-10).reverse(),
        },
    });
});

router.get('/technical/:symbol/indicators', async (req, res) => {
    try {
        const data = await getTechnicalIndicators('stock', normalizeSymbol(req.params.symbol), '1D', {});
        return res.json({ success: true, symbol: normalizeSymbol(req.params.symbol), data });
    } catch (error) {
        return sendError(res, 500, error.message || 'Failed to fetch indicators');
    }
});

router.get('/technical/:symbol/trend-matrix', async (req, res) => {
    try {
        const data = await getTrendMatrix('stock', normalizeSymbol(req.params.symbol), {});
        return res.json({ success: true, symbol: normalizeSymbol(req.params.symbol), data });
    } catch (error) {
        return sendError(res, 500, error.message || 'Failed to fetch trend matrix');
    }
});

router.get('/technical/:symbol/composite-score', async (req, res) => {
    try {
        const data = await getInstrumentScore('stock', normalizeSymbol(req.params.symbol), {});
        return res.json({ success: true, symbol: normalizeSymbol(req.params.symbol), data });
    } catch (error) {
        return sendError(res, 500, error.message || 'Failed to fetch composite score');
    }
});

router.get('/technical/:symbol/patterns', async (req, res) => {
    try {
        const data = await detectPatterns('stock', normalizeSymbol(req.params.symbol), {});
        return res.json({ success: true, symbol: normalizeSymbol(req.params.symbol), data });
    } catch (error) {
        return sendError(res, 500, error.message || 'Failed to fetch patterns');
    }
});

router.get('/technical/:symbol/rsi', async (req, res) => {
    try {
        const indicators = await getTechnicalIndicators('stock', normalizeSymbol(req.params.symbol), '1D', {});
        return res.json({ success: true, symbol: normalizeSymbol(req.params.symbol), data: { rsi: indicators.rsi ?? null } });
    } catch (error) {
        return sendError(res, 500, error.message || 'Failed to fetch RSI');
    }
});

router.get('/technical/:symbol/macd', async (req, res) => {
    try {
        const indicators = await getTechnicalIndicators('stock', normalizeSymbol(req.params.symbol), '1D', {});
        return res.json({ success: true, symbol: normalizeSymbol(req.params.symbol), data: { macd: indicators.macd ?? null } });
    } catch (error) {
        return sendError(res, 500, error.message || 'Failed to fetch MACD');
    }
});

router.get('/technical/:symbol/ema', async (req, res) => {
    try {
        const indicators = await getTechnicalIndicators('stock', normalizeSymbol(req.params.symbol), '1D', {});
        return res.json({ success: true, symbol: normalizeSymbol(req.params.symbol), data: { ema20: indicators.ema20 ?? null } });
    } catch (error) {
        return sendError(res, 500, error.message || 'Failed to fetch EMA');
    }
});

router.get('/technical/:symbol/volume', async (req, res) => {
    try {
        const indicators = await getTechnicalIndicators('stock', normalizeSymbol(req.params.symbol), '1D', {});
        return res.json({ success: true, symbol: normalizeSymbol(req.params.symbol), data: { volumeStatus: indicators.volumeStatus || null } });
    } catch (error) {
        return sendError(res, 500, error.message || 'Failed to fetch volume metrics');
    }
});

router.get('/discovery/patterns/bull-flag', async (_req, res) => {
    const rows = await fetchStockData().catch(() => []);
    const sample = (Array.isArray(rows) ? rows : []).slice(0, 20);
    const detected = [];
    for (const row of sample) {
        try {
            const patterns = await detectPatterns('stock', normalizeSymbol(row.symbol), {});
            if (patterns.some((item) => String(item.pattern || '').toLowerCase().includes('bull flag'))) {
                detected.push({
                    symbol: normalizeSymbol(row.symbol),
                    name: row.name || row.symbol,
                    patterns,
                });
            }
        } catch (_error) {
        }
    }
    return res.json({ success: true, data: detected });
});

router.get('/discovery/patterns/double-bottom', async (_req, res) => {
    const rows = await fetchStockData().catch(() => []);
    const sample = (Array.isArray(rows) ? rows : []).slice(0, 20);
    const detected = [];
    for (const row of sample) {
        try {
            const patterns = await detectPatterns('stock', normalizeSymbol(row.symbol), {});
            if (patterns.some((item) => String(item.pattern || '').toLowerCase().includes('double bottom'))) {
                detected.push({
                    symbol: normalizeSymbol(row.symbol),
                    name: row.name || row.symbol,
                    patterns,
                });
            }
        } catch (_error) {
        }
    }
    return res.json({ success: true, data: detected });
});

router.get('/fundamental/:symbol/valuation', async (req, res) => {
    const symbol = normalizeSymbol(req.params.symbol);
    const rows = await fetchStockData().catch(() => []);
    const found = (Array.isArray(rows) ? rows : []).find((row) => stripSymbolSuffix(row.symbol) === stripSymbolSuffix(symbol));
    if (!found) {
        return sendError(res, 404, 'Symbol not found');
    }

    return res.json({
        success: true,
        symbol,
        data: {
            peRatio: toNumber(found?.details?.pe_ratio, null),
            pbRatio: toNumber(found?.details?.pb_ratio, null),
            dividendYield: toNumber(found?.details?.dividend_yield, null),
            sector: found?.details?.sector || null,
            marketCap: found?.details?.market_cap || null,
        },
    });
});

router.get('/fundamental/:symbol/filings', async (req, res) => {
    const symbol = stripSymbolSuffix(req.params.symbol);
    const filings = await getFilingsForSymbol(symbol);
    return res.json({
        success: true,
        symbol,
        count: Array.isArray(filings) ? filings.length : 0,
        data: Array.isArray(filings) ? filings : [],
    });
});

router.get('/fundamental/:symbol/sec-edgar', async (req, res) => {
    const symbol = stripSymbolSuffix(req.params.symbol);
    const filings = await getFilingsForSymbol(symbol);
    return res.json({
        success: true,
        symbol,
        provider: 'SEC',
        data: Array.isArray(filings) ? filings : [],
    });
});

router.get('/fundamental/:symbol/earnings', async (req, res) => {
    try {
        const data = await getStockEarningsCalendar(normalizeSymbol(req.params.symbol));
        return res.json({ success: true, data });
    } catch (error) {
        return sendError(res, error.statusCode || 500, error.message || 'Failed to fetch earnings');
    }
});

router.post('/fundamental/screener', async (req, res) => {
    try {
        const payload = (req.body && typeof req.body === 'object') ? req.body : {};
        const data = await runScreener(payload);
        return res.json({ success: true, data });
    } catch (error) {
        return sendError(res, error.statusCode || 500, error.message || 'Failed to run screener');
    }
});

router.get('/macro/indicators', async (_req, res) => {
    const data = await getMacroIndicators();
    return res.json({ success: true, data });
});

router.get('/macro/calendar', async (req, res) => {
    return getEconomicEvents(req, res);
});

router.get('/calendar/events', async (req, res) => {
    return getEconomicEvents(req, res);
});

router.get('/macro/cpi', async (_req, res) => {
    const indicators = await getMacroIndicators();
    return res.json({
        success: true,
        data: { cpi: indicators.inflation_rate || null },
    });
});

router.get('/macro/gdp', async (_req, res) => {
    const indicators = await getMacroIndicators();
    return res.json({
        success: true,
        data: { gdp: indicators.gdp_growth || null },
    });
});

router.get('/macro/fred/:indicator', async (req, res) => {
    const key = String(req.params.indicator || '').trim();
    const indicators = await getMacroIndicators();
    return res.json({
        success: true,
        provider: 'FRED (mapped)',
        indicator: key,
        data: indicators,
    });
});

router.get('/macro/worldbank/:indicator', async (req, res) => {
    const key = String(req.params.indicator || '').trim();
    const indicators = await getMacroIndicators();
    return res.json({
        success: true,
        provider: 'WorldBank (mapped)',
        indicator: key,
        data: indicators,
    });
});

router.get('/news/general', async (_req, res) => {
    const rows = await fetchMarketNews('general');
    return res.json({ success: true, data: rows });
});

router.get('/news/asset/:symbol', async (req, res) => {
    const symbol = stripSymbolSuffix(req.params.symbol);
    try {
        const data = await getStockNewsSentiment(symbol);
        return res.json({ success: true, data });
    } catch (_error) {
        const all = await fetchMarketNews('general');
        const filtered = (Array.isArray(all) ? all : []).filter((item) => {
            const text = `${item?.title || ''} ${item?.source || ''}`.toUpperCase();
            return text.includes(symbol);
        });
        return res.json({ success: true, data: { symbol, count: filtered.length, articles: filtered } });
    }
});

router.get('/health', async (_req, res) => {
    return res.json({
        success: true,
        status: 'ok',
        timestamp: nowIso(),
        db: getDbStatus() ? 'connected' : 'disconnected',
        marketStatus: getMarketStatus(),
    });
});

router.get('/admin/metrics', async (_req, res) => {
    const dataQuality = await new Promise((resolve) => {
        const fakeReq = {};
        const fakeRes = {
            json: (payload) => resolve(payload),
            status: () => fakeRes,
        };
        getDataQuality(fakeReq, fakeRes);
    });

    const users = await User.countDocuments().catch(() => 0);
    const alerts = await Alert.countDocuments({ status: 'ACTIVE' }).catch(() => 0);
    const notifications = await Notification.countDocuments().catch(() => 0);
    const portfolios = await Portfolio.countDocuments().catch(() => 0);

    return res.json({
        success: true,
        data: {
            users,
            activeAlerts: alerts,
            notifications,
            portfolios,
            dataQuality: dataQuality?.data || dataQuality || null,
        },
    });
});

router.post('/admin/cache/clear', async (_req, res) => {
    return res.json({
        success: true,
        message: 'Cache clear requested',
    });
});

router.get('/reports/pdf', ...ensureAuth(async (req, res) => {
    const portfolio = await Portfolio.findOne({ user: req.user._id });
    const summary = await summarizePortfolio(portfolio || {});
    return res.json({
        success: true,
        format: 'pdf',
        data: {
            generatedAt: nowIso(),
            user: req.user.username,
            portfolio: summary,
        },
    });
}));

router.get('/reports/csv', ...ensureAuth(async (req, res) => {
    const portfolio = await Portfolio.findOne({ user: req.user._id });
    const summary = await summarizePortfolio(portfolio || {});
    const rows = ['symbol,quantity,avgBuyPrice,currentPrice,marketValue,unrealizedPnL']
        .concat(summary.holdings.map((item) => [
            item.symbol,
            item.quantity,
            item.avgBuyPrice,
            item.currentPrice,
            item.marketValue,
            item.unrealizedPnL,
        ].join(',')));

    return res.json({
        success: true,
        format: 'csv',
        data: rows.join('\n'),
    });
}));

router.post('/ws/ticket', ...ensureAuth(async (req, res) => {
    const query = {
        scope: req.body?.scope || req.query?.scope || 'signals:read',
    };

    const fakeReq = { ...req, query };
    return issueStreamToken(fakeReq, res);
}));

module.exports = router;
