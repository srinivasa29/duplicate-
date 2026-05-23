const mongoose = require('mongoose');

const TradeLogSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        symbol: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },
        side: {
            type: String,
            enum: ['BUY', 'SELL'],
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
        },
        price: {
            type: Number,
            required: true,
        },
        entryPrice: {
            type: Number,
            default: null,
        },
        realizedPnl: {
            type: Number,
            default: null,
        },
        positionValue: {
            type: Number,
            default: null,
        },
        assetType: {
            type: String,
            enum: ['STOCK', 'CRYPTO', 'FOREX'],
            default: 'STOCK',
        },
        source: {
            type: String,
            default: 'portfolio',
        },
        executedAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    { timestamps: true }
);

TradeLogSchema.index({ user: 1, executedAt: -1 });

module.exports = mongoose.model('TradeLog', TradeLogSchema);
