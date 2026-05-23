const TradeLog = require('../models/TradeLog');
const profileCache = require('./profileCache');

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase();

const recordTrade = async ({
    userId,
    symbol,
    side,
    quantity,
    price,
    assetType = 'STOCK',
    entryPrice = null,
    executedAt = null,
    source = 'portfolio',
}) => {
    const normalizedSymbol = normalizeSymbol(symbol);
    if (!userId || !normalizedSymbol || !side) {
        return null;
    }

    const qty = Number(quantity);
    const px = Number(price);
    const entry = Number.isFinite(Number(entryPrice)) ? Number(entryPrice) : null;

    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(px) || px <= 0) {
        return null;
    }

    const realizedPnl = side === 'SELL' && Number.isFinite(entry)
        ? (px - entry) * qty
        : null;

    return TradeLog.create({
        user: userId,
        symbol: normalizedSymbol,
        side,
        quantity: qty,
        price: px,
        entryPrice: entry,
        realizedPnl,
        positionValue: px * qty,
        assetType: String(assetType || 'STOCK').toUpperCase(),
        source,
        executedAt: executedAt ? new Date(executedAt) : new Date(),
    })
    .then(async (doc) => {
        try { await profileCache.invalidate(userId); } catch (_) {}
        return doc;
    });
};

module.exports = { recordTrade };
