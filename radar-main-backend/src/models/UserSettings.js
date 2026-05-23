const mongoose = require('mongoose');

const UserSettingsSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    display: {
        chartType: { type: String, default: 'candlestick' },
        defaultTimeframe: { type: String, default: '5m' },
        theme: { type: String, default: 'dark' },
        showGridLines: { type: Boolean, default: true },
        showCrosshair: { type: Boolean, default: true }
    },
    alerts: {
        priceAlerts: { type: Boolean, default: true },
        volumeSpikes: { type: Boolean, default: true },
        technicalSignals: { type: Boolean, default: true },
        method: { type: String, enum: ['in-app','email','both'], default: 'in-app' },
        soundEnabled: { type: Boolean, default: true }
    },
    risk: {
        defaultStopLossPct: { type: Number, default: 2 },
        defaultTakeProfitPct: { type: Number, default: 5 },
        positionSizeLimitPct: { type: Number, default: 10 },
        maxDrawdownTolerancePct: { type: Number, default: 15 }
    },
    data: {
        realtimeRefreshRate: { type: String, default: '1s' },
        quoteUpdateFreq: { type: String, default: '5s' },
        autoRefreshWatchlist: { type: Boolean, default: true },
        refreshInterval: { type: String, default: '1m' }
    }
}, { timestamps: true });

module.exports = mongoose.model('UserSettings', UserSettingsSchema);

