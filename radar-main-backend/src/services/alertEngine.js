const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const Notification = require('../models/Notification');
const { fetchStockData } = require('./stockService');
const logger = require('../config/logger');

const User = require('../models/User');
const UserSettings = require('../models/UserSettings');
const AlertRule = require('../models/AlertRule');
const { evaluateRules } = require('./alertRulesService');

let alertInterval = null;
let alertEventEmitter = null;
const userCheckTimestamps = new Map(); // Track last check per user

/**
 * Parse refresh rate string to milliseconds
 * Supports: '1s', '5s', '1m', '5m', '15m', '30m', '1h'
 */
const parseRefreshRate = (rate = '5s') => {
    const str = String(rate).toLowerCase().trim();
    const match = str.match(/^(\d+)([smh])$/);
    if (!match) return 5000; // Default 5s
    
    const [, value, unit] = match;
    const num = parseInt(value, 10);
    
    switch (unit) {
        case 's': return num * 1000;
        case 'm': return num * 60 * 1000;
        case 'h': return num * 60 * 60 * 1000;
        default: return 5000;
    }
};

const isDatabaseReady = () => mongoose.connection.readyState === 1;


const emitAlertTriggered = (payload) => {
    if (typeof alertEventEmitter === 'function') {
        alertEventEmitter('alert_triggered', {
            ...payload,
            timestamp: new Date().toISOString(),
        });
    }
};

/**
 * Evaluate all rules for a specific user with their alert frequency settings
 */
const evaluateUserRules = async (userId) => {
    try {
        const result = await evaluateRules(userId);
        return result;
    } catch (error) {
        logger.warn(`Error evaluating rules for user ${userId}:`, error.message);
        return { evaluated: 0, triggeredCount: 0, triggered: [] };
    }
};

/**
 * Main alert checking function - evaluates all active users' rules
 * respecting their individual refresh rate settings
 */
const checkAlerts = async () => {
    if (!isDatabaseReady()) return;

    try {
        // Fetch only users who have at least one active alert rule
        const activeRules = await AlertRule.find({ active: true }).distinct('user').lean();
        if (!activeRules.length) return;
        const users = activeRules.map(id => ({ _id: id }));
        
        // For each user, check if it's time to evaluate their rules
        for (const user of users) {
            const userId = String(user._id);
            const userSettings = await UserSettings.findOne({ user: user._id }).lean();
            
            // Get user's alert refresh rate from settings (default: 5s)
            const alertRefreshRate = userSettings?.data?.quoteUpdateFreq || '5s';
            const checkIntervalMs = parseRefreshRate(alertRefreshRate);
            
            // Track last check time for this user
            const lastCheckTime = userCheckTimestamps.get(userId) || 0;
            const timeSinceLastCheck = Date.now() - lastCheckTime;
            
            // Only evaluate if enough time has passed
            if (timeSinceLastCheck < checkIntervalMs) {
                continue;
            }
            
            // Evaluate this user's rules
            const result = await evaluateUserRules(user._id);
            if (result.triggeredCount > 0) {
                logger.info(`User ${userId}: ${result.triggeredCount} rule(s) triggered (${result.evaluated} evaluated)`);
                
                // Emit event for each triggered rule
                result.triggered.forEach(trigger => {
                    emitAlertTriggered({
                        userId: user._id,
                        ruleId: trigger.ruleId,
                        ruleName: trigger.name,
                        symbol: trigger.symbol,
                        triggeredAt: trigger.triggeredAt,
                    });
                });
            }
            
            // Update last check timestamp
            userCheckTimestamps.set(userId, Date.now());
        }
    } catch (error) {
        logger.error(`Error in Alert Engine: ${error.message}`);
    }
};


const startAlertEngine = () => {
    if (alertInterval) return;
    logger.info("Starting Advanced Alert Engine...");
    // Check alerts every 5 seconds (respect individual user refresh rates)
    alertInterval = setInterval(checkAlerts, 5000);
};

const stopAlertEngine = () => {
    if (alertInterval) {
        clearInterval(alertInterval);
        alertInterval = null;
    }
    logger.info('Alert Engine stopped');
};

const setAlertEventEmitter = (emitter) => {
    alertEventEmitter = emitter;
};

module.exports = { 
    startAlertEngine, 
    stopAlertEngine, 
    setAlertEventEmitter,
    evaluateUserRules,
    parseRefreshRate,
};
