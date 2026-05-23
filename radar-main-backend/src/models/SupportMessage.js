const mongoose = require('mongoose');

const SupportMessageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 180,
    },
    subject: {
        type: String,
        required: true,
        trim: true,
        maxlength: 180,
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 5000,
    },
    page: {
        type: String,
        default: 'support',
        trim: true,
        maxlength: 120,
    },
    status: {
        type: String,
        enum: ['new', 'read', 'closed'],
        default: 'new',
    },
}, {
    timestamps: true,
});

SupportMessageSchema.index({ createdAt: -1 });
SupportMessageSchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model('SupportMessage', SupportMessageSchema);
