const asyncHandler = require('express-async-handler');
const Alert = require('../models/Alert');
const profileCache = require('../services/profileCache');

const createAlert = asyncHandler(async (req, res) => {
    const { symbol, targetPrice, type, delivery } = req.body;
    
    if (!symbol || !targetPrice) {
        res.status(400);
        throw new Error('Symbol and target price are required');
    }

    const alert = await Alert.create({
        userId: req.user._id,
        symbol: symbol.toUpperCase(),
        targetPrice,
        type: type || 'price',
        delivery: delivery || 'app',
        isActive: true
    });

    try { await profileCache.invalidate(req.user._id); } catch (_) {}
    res.status(201).json(alert);
});

const getAlerts = asyncHandler(async (req, res) => {
    const { symbol } = req.query;
    const filter = { userId: req.user._id };
    if (symbol) filter.symbol = symbol.toUpperCase();

    const alerts = await Alert.find(filter).sort('-createdAt');
    res.json(alerts);
});

const deleteAlert = asyncHandler(async (req, res) => {
    const alert = await Alert.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!alert) {
        res.status(404);
        throw new Error('Alert not found');
    }

    await alert.deleteOne();
    try { await profileCache.invalidate(req.user._id); } catch (_) {}
    res.json({ id: req.params.id, message: "Alert deleted" });
});

module.exports = { createAlert, getAlerts, deleteAlert };
