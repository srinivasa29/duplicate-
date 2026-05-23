/**
 * FundamentalsSnapshot — persisted fundamentals cache
 *
 * One document per symbol, upserted on every refresh.
 * The `asOf` field lets the frontend show data freshness.
 * TTL index auto-deletes docs older than 3 days (safety net).
 */
const mongoose = require('mongoose');

const FundamentalsSnapshotSchema = new mongoose.Schema(
    {
        symbol: { type: String, required: true, uppercase: true, trim: true },

        // ── Core valuation ─────────────────────────────────────────────────
        pe:             { type: Number, default: null },
        forwardPe:      { type: Number, default: null },
        pb:             { type: Number, default: null },
        ps:             { type: Number, default: null },
        evEbitda:       { type: Number, default: null },
        peg:            { type: Number, default: null },

        // ── Profitability ──────────────────────────────────────────────────
        roe:            { type: Number, default: null },   // %
        roa:            { type: Number, default: null },   // %
        profitMargins:  { type: Number, default: null },   // %
        operatingMargins: { type: Number, default: null }, // %
        grossMargins:   { type: Number, default: null },   // %

        // ── Growth ─────────────────────────────────────────────────────────
        revenueGrowth:  { type: Number, default: null },   // %
        earningsGrowth: { type: Number, default: null },   // %
        earningsQuarterlyGrowth: { type: Number, default: null },

        // ── Balance sheet ──────────────────────────────────────────────────
        debtToEquity:   { type: Number, default: null },
        currentRatio:   { type: Number, default: null },
        quickRatio:     { type: Number, default: null },

        // ── Market data ────────────────────────────────────────────────────
        marketCap:      { type: Number, default: null },   // raw number (INR or USD)
        beta:           { type: Number, default: null },
        dividendYield:  { type: Number, default: null },   // %
        payoutRatio:    { type: Number, default: null },   // %
        fiftyTwoWeekHigh: { type: Number, default: null },
        fiftyTwoWeekLow:  { type: Number, default: null },

        // ── Volume ─────────────────────────────────────────────────────────
        volumeRatio:    { type: Number, default: 1 },
        averageVolume:  { type: Number, default: null },

        // ── Description ────────────────────────────────────────────────────
        sector:         { type: String, default: null },
        industry:       { type: String, default: null },
        country:        { type: String, default: null },
        longBusinessSummary: { type: String, default: null },
        fullTimeEmployees: { type: Number, default: null },
        website:        { type: String, default: null },

        // ── Derived ────────────────────────────────────────────────────────
        valStatus:      { type: String, enum: ['undervalued', 'fair', 'overvalued'], default: 'fair' },
        deliveryPct:    { type: Number, default: null },

        // ── Metadata ───────────────────────────────────────────────────────
        asOf:           { type: Date, default: Date.now },
        source:         { type: String, default: 'yahoo' },
    },
    { timestamps: true }
);

// One doc per symbol — unique index for upsert efficiency
FundamentalsSnapshotSchema.index({ symbol: 1 }, { unique: true });

// Auto-delete stale docs after 4 days (safety net in case cron fails)
FundamentalsSnapshotSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 4 * 24 * 60 * 60 });

module.exports = mongoose.model('FundamentalsSnapshot', FundamentalsSnapshotSchema);
