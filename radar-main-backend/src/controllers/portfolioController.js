const mongoose = require('mongoose');
const Portfolio = require('../models/Portfolio');
const logger = require('../utils/logger');
const { recordTrade } = require('../services/tradeLogService');
const UserSettings = require('../models/UserSettings');

const getPortfolio = async (req, res) => {
    const userId = req.user._id;

    try {
        const portfolio = await Portfolio.findOneAndUpdate(
            { user: userId },
            { $setOnInsert: { user: userId } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.json(portfolio);
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
};

const executeTrade = async (req, res) => {
    const userId = req.user._id;
    const { symbol, action, quantity, price, assetType } = req.body;

    if (!symbol || quantity == null || price == null || !action) {
        return res.status(400).json({ error: "Missing trade details" });
    }

    

    const qty = Number(quantity);
    const px = Number(price);

    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(px) || px <= 0) {
        return res.status(400).json({ error: "Quantity and price must be positive numbers" });
    }

    const normalizedAction = String(action).toUpperCase();
    if (normalizedAction !== 'BUY' && normalizedAction !== 'SELL') {
        return res.status(400).json({ error: "Action must be BUY or SELL" });
    }

    const normalizedSymbol = String(symbol).trim().toUpperCase();
    if (!normalizedSymbol) {
        return res.status(400).json({ error: "Symbol is required" });
    }

    // fetch user settings (use defaults when missing)
    let userSettings = null;
    try {
        userSettings = await UserSettings.findOne({ user: userId }).lean();
    } catch (e) {
        // proceed with defaults if settings read fails
        userSettings = null;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    let entryPrice = px;

    try {
        const portfolio = await Portfolio.findOneAndUpdate(
            { user: userId },
            { $setOnInsert: { user: userId } },
            { new: true, upsert: true, setDefaultsOnInsert: true, session }
        );

        const totalCost = qty * px;

        if (normalizedAction === 'BUY') {
            if (portfolio.cashBalance < totalCost) {
                await session.abortTransaction();
                return res.status(400).json({ error: "Insufficient Funds" });
            }

            portfolio.cashBalance -= totalCost;

            const holdingIndex = portfolio.holdings.findIndex((p) => p.symbol === normalizedSymbol);

            if (holdingIndex > -1) {
                const existing = portfolio.holdings[holdingIndex];
                const existingQty = Number(existing.quantity) || 0;
                const existingAvg = Number(existing.avgBuyPrice) || 0;

                const totalValueOld = existingQty * existingAvg;
                const totalValueNew = totalValueOld + totalCost;
                const totalQty = existingQty + qty;

                portfolio.holdings[holdingIndex].quantity = totalQty;
                portfolio.holdings[holdingIndex].avgBuyPrice = totalQty > 0 ? (totalValueNew / totalQty) : 0;
            } else {
                portfolio.holdings.push({
                    symbol: normalizedSymbol,
                    quantity: qty,
                    avgBuyPrice: px,
                    assetType: assetType || 'STOCK'
                });
            }
        } else if (normalizedAction === 'SELL') {
            const holdingIndex = portfolio.holdings.findIndex((p) => p.symbol === normalizedSymbol);

            if (holdingIndex === -1) {
                await session.abortTransaction();
                return res.status(400).json({ error: "Not enough shares to sell" });
            }

            const existingQty = Number(portfolio.holdings[holdingIndex].quantity) || 0;
            entryPrice = Number(portfolio.holdings[holdingIndex].avgBuyPrice || px);
            if (existingQty < qty) {
                await session.abortTransaction();
                return res.status(400).json({ error: "Not enough shares to sell" });
            }

            portfolio.cashBalance += totalCost;
            portfolio.holdings[holdingIndex].quantity = existingQty - qty;

            if (portfolio.holdings[holdingIndex].quantity <= 0) {
                portfolio.holdings.splice(holdingIndex, 1);
            }
        }

        portfolio.totalTrades += 1;
        await portfolio.save({ session });

        // compute bracket defaults from settings if available
        const stopLossPct = (userSettings && userSettings.risk && typeof userSettings.risk.defaultStopLossPct === 'number')
            ? userSettings.risk.defaultStopLossPct : 2;
        const takeProfitPct = (userSettings && userSettings.risk && typeof userSettings.risk.defaultTakeProfitPct === 'number')
            ? userSettings.risk.defaultTakeProfitPct : 5;

        const stopLossPrice = +(px * (1 - stopLossPct / 100));
        const takeProfitPrice = +(px * (1 + takeProfitPct / 100));

        recordTrade({
            userId,
            symbol: normalizedSymbol,
            side: normalizedAction,
            quantity: qty,
            price: px,
            assetType: assetType || 'STOCK',
            entryPrice,
            executedAt: new Date(),
            source: 'portfolio/execute',
            meta: {
                stopLossPrice,
                takeProfitPrice,
                stopLossPct,
                takeProfitPct
            }
        }).catch(() => null);

        await session.commitTransaction();
        res.json(portfolio);
    } catch (error) {
        await session.abortTransaction();
        logger.error("Trade Execution Error", { error: error.message });
        res.status(500).json({ error: "Trade Failed" });
    } finally {
        session.endSession();
    }
};

module.exports = { getPortfolio, executeTrade };
