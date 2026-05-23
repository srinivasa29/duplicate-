const mongoose = require('mongoose');

const SignalStreamTokenSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        scope: {
            type: [String],
            default: ['signals:read'],
        },
        revoked: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

SignalStreamTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('SignalStreamToken', SignalStreamTokenSchema);
