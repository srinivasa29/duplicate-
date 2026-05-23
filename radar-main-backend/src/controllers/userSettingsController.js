const UserSettings = require('../models/UserSettings');
const logger = require('../utils/logger');

/**
 * Validate settings payload
 */
const validateSettings = (payload) => {
    const errors = [];

    // Validate display settings
    if (payload.display) {
        const validChartTypes = ['candlestick', 'line', 'area'];
        if (payload.display.chartType && !validChartTypes.includes(payload.display.chartType.toLowerCase())) {
            errors.push('Invalid chart type');
        }
        const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1D', '1W', '1M'];
        if (payload.display.defaultTimeframe && !validTimeframes.includes(payload.display.defaultTimeframe)) {
            errors.push('Invalid timeframe');
        }
        const validThemes = ['dark', 'light'];
        if (payload.display.theme && !validThemes.includes(payload.display.theme.toLowerCase())) {
            errors.push('Invalid theme');
        }
    }

    // Validate alerts settings
    if (payload.alerts) {
        const validMethods = ['in-app', 'email', 'both'];
        if (payload.alerts.method && !validMethods.includes(payload.alerts.method.toLowerCase())) {
            errors.push('Invalid alert method');
        }
    }

    // Validate risk settings
    if (payload.risk) {
        const { defaultStopLossPct, defaultTakeProfitPct, positionSizeLimitPct, maxDrawdownTolerancePct } = payload.risk;
        
        if (defaultStopLossPct !== undefined && (defaultStopLossPct < 0.1 || defaultStopLossPct > 50)) {
            errors.push('Stop loss percentage must be between 0.1% and 50%');
        }
        if (defaultTakeProfitPct !== undefined && (defaultTakeProfitPct < 0.1 || defaultTakeProfitPct > 500)) {
            errors.push('Take profit percentage must be between 0.1% and 500%');
        }
        if (positionSizeLimitPct !== undefined && (positionSizeLimitPct < 1 || positionSizeLimitPct > 100)) {
            errors.push('Position size limit must be between 1% and 100%');
        }
        if (maxDrawdownTolerancePct !== undefined && (maxDrawdownTolerancePct < 1 || maxDrawdownTolerancePct > 100)) {
            errors.push('Max drawdown tolerance must be between 1% and 100%');
        }
    }

    // Validate data settings
    if (payload.data) {
        const validRefreshRates = ['1s', '5s', '10s'];
        if (payload.data.realtimeRefreshRate && !validRefreshRates.includes(payload.data.realtimeRefreshRate)) {
            errors.push('Invalid realtime refresh rate');
        }
        if (payload.data.quoteUpdateFreq && !validRefreshRates.includes(payload.data.quoteUpdateFreq)) {
            errors.push('Invalid quote update frequency');
        }
        const validIntervals = ['1m', '5m', '10m', '30m', '1h'];
        if (payload.data.refreshInterval && !validIntervals.includes(payload.data.refreshInterval)) {
            errors.push('Invalid refresh interval');
        }
    }

    return errors;
};

const getUserSettings = async (req, res) => {
    const userId = req.user._id;
    try {
        let settings = await UserSettings.findOne({ user: userId }).lean();
        if (!settings) {
            // create defaults
            settings = await UserSettings.create({ user: userId });
        }
        res.json(settings);
    } catch (error) {
        logger.error('getUserSettings error', { error: error.message, userId });
        res.status(500).json({ error: 'Failed to load settings' });
    }
};

const updateUserSettings = async (req, res) => {
    const userId = req.user._id;
    const payload = req.body || {};

    try {
        // Validate payload
        const validationErrors = validateSettings(payload);
        if (validationErrors.length > 0) {
            logger.warn('Invalid settings update attempted', { userId, errors: validationErrors });
            return res.status(400).json({ error: 'Validation failed', details: validationErrors });
        }

        // Only allow specific nested updates
        const allowedUpdates = {};
        if (payload.display) allowedUpdates.display = payload.display;
        if (payload.alerts) allowedUpdates.alerts = payload.alerts;
        if (payload.risk) allowedUpdates.risk = payload.risk;
        if (payload.data) allowedUpdates.data = payload.data;

        const updated = await UserSettings.findOneAndUpdate(
            { user: userId },
            { $set: allowedUpdates },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).lean();

        logger.info('User settings updated', { userId, updatedFields: Object.keys(allowedUpdates) });
        res.json(updated);
    } catch (error) {
        logger.error('updateUserSettings error', { error: error.message, userId });
        res.status(500).json({ error: 'Failed to update settings' });
    }
};

module.exports = { getUserSettings, updateUserSettings, validateSettings };
