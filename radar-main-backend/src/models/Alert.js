const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    targetPrice: {
        type: Number,
        required: false
    },
    threshold: {
        type: Number,
        required: false
    },
    type: {
        type: String,
        default: 'price'
    },
    condition: {
        type: String,
        required: false
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: false
    },
    delivery: {
        type: String,
        default: 'app'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        default: 'ACTIVE'
    },
    proximityPercent: {
        type: Number,
        default: 0
    },
    intelligentMessage: {
        type: String,
        default: ''
    },
    priorityLevel: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    lastEvaluatedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: false
    }
}, {
    timestamps: true,
    strict: false
});

AlertSchema.index({ userId: 1, symbol: 1 });
AlertSchema.index({ user: 1, symbol: 1 });
AlertSchema.index({ isActive: 1 });
AlertSchema.index({ status: 1 });

module.exports = mongoose.model('Alert', AlertSchema);
