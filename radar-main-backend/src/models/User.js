const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    authProvider: {
        type: String,
        enum: ['email', 'google'],
        default: 'email'
    },
    preferredMode: {
        type: String,
        enum: ['TRADER', 'INVESTOR'],
        default: 'INVESTOR'
    },
    watchlist: [{
        symbol: String,
        name: String,
        assetType: {
            type: String,
            enum: ['STOCK', 'CRYPTO', 'FOREX']
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    settings: {
        theme: {
            type: String,
            enum: ['light', 'dark'],
            default: 'dark'
        },
        notifications: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            priceAlerts: { type: Boolean, default: true }
        }
    },
    pinnedCharts: [{
        symbol: String,
        label: String,
        type: {
            type: String,
            enum: ['INDEX', 'STOCK', 'CRYPTO'],
            default: 'INDEX'
        }
    }],

    // Investor Identity — saved after onboarding assessment
    investorDNA: {
        dominant:            { type: String, enum: ['TRADER', 'INVESTOR'], default: null },
        personaName:         { type: String, default: null },
        personaDescription:  { type: String, default: null },
        investorPercent:     { type: Number, default: null },
        traderPercent:       { type: Number, default: null },
        traits:              [{ type: String }],
        hybridLine:          { type: String, default: null },
        confidence:          { type: String, default: null },
        metrics: {
            speed:       { type: Number, default: null },
            risk:        { type: Number, default: null },
            patience:    { type: Number, default: null },
            volatility:  { type: Number, default: null },
            discipline:  { type: Number, default: null }
        },
        completedAt: { type: Date, default: null }
    },

    // Notification preferences — persisted per user
    notificationPreferences: {
        priceAlerts:     { type: Boolean, default: true },
        earningsUpdates: { type: Boolean, default: true },
        importantNews:   { type: Boolean, default: true }
    },

    resetPasswordToken: String,
    resetPasswordExpire: Date
});

UserSchema.methods.getResetPasswordToken = function () {
    // Generate token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to resetPasswordToken field
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Set expire
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    return resetToken;
};

UserSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
