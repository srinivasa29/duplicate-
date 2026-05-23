const mongoose = require('mongoose');

const WatchlistSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    // 'trader' | 'investor' — separates Trader and Investor watchlists per user.
    // Null means the watchlist was created before mode was introduced (legacy).
    mode: {
        type: String,
        enum: ['trader', 'investor', null],
        default: null,
    },
    items: [{
        symbol: {
            type: String,
            required: true,
            uppercase: true,
            trim: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Unique per user + name + mode (null counts as its own "bucket")
WatchlistSchema.index({ userId: 1, name: 1, mode: 1 }, { unique: true });

module.exports = mongoose.model('Watchlist', WatchlistSchema);

