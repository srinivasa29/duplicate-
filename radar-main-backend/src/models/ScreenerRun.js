const mongoose = require('mongoose');

const ScreenerRunSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        filters: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        resultCount: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

ScreenerRunSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ScreenerRun', ScreenerRunSchema);
