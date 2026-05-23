const mongoose = require('mongoose');



const ohlcSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        required: true,
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
    },
    exchange: {
        type: String,
        required: true,
        uppercase: true,
        enum: ['NSE', 'BSE', 'NYSE', 'NASDAQ', 'CRYPTO', 'FOREX'],
        default: 'NSE',
    },
    timeframe: {
        type: String,
        required: true,
        enum: ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'],
        default: '1d',
    },
    open: {
        type: Number,
        required: true,
    },
    high: {
        type: Number,
        required: true,
    },
    low: {
        type: Number,
        required: true,
    },
    close: {
        type: Number,
        required: true,
    },
    volume: {
        type: Number,
        default: 0,
    },
    adjustedClose: {
        type: Number,
    },
    source: {
        type: String,
        enum: ['yahoo', 'nse', 'twelvedata', 'alphavantage', 'manual'],
        default: 'yahoo',
    },
}, {
    timeseries: {
        timeField: 'timestamp',
        metaField: 'symbol',
        granularity: 'hours', // Optimize for hourly/daily data
    },
});

ohlcSchema.index({ symbol: 1, exchange: 1, timeframe: 1, timestamp: -1 });

const OHLC = mongoose.model('OHLC', ohlcSchema);

module.exports = OHLC;
