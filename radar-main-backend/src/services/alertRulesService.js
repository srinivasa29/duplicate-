const AlertRule = require('../models/AlertRule');
const { fetchStockData } = require('./stockService');
const { getTechnicalIndicators, getTechnicalIndicatorsFromOHLC } = require('./indicatorService');
const Notification = require('../models/Notification');

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase();
const toNumber = (value, fallback = NaN) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const evaluateCondition = (actual, operator, expected) => {
    switch (operator) {
        case 'gt': return actual > expected;
        case 'gte': return actual >= expected;
        case 'lt': return actual < expected;
        case 'lte': return actual <= expected;
        case 'eq': return actual === expected;
        case 'neq': return actual !== expected;
        case 'contains': return String(actual || '').toLowerCase().includes(String(expected || '').toLowerCase());
        default: return false;
    }
};

/**
 * Build field map for rule evaluation using OHLC-backed indicators (primary)
 * Falls back to live API if OHLC data insufficient
 */
const buildFieldMap = async (symbol) => {
    const stocks = await fetchStockData();
    const stock = (Array.isArray(stocks) ? stocks : []).find((row) => normalizeSymbol(row.symbol) === normalizeSymbol(symbol));
    
    if (!stock) {
        return {
            price: NaN,
            change: NaN,
            pe: NaN,
            marketCap: '',
            sector: '',
            rsi: NaN,
            volumeStatus: '',
            ema20: NaN,
            support: NaN,
            resistance: NaN,
            atr: NaN,
        };
    }
    
    // Try OHLC first (faster, no API calls)
    let indicators = null;
    let source = 'api';
    
    try {
        const ohlcIndicators = await getTechnicalIndicatorsFromOHLC(stock.symbol, 'NSE', '1d', 365);
        if (ohlcIndicators.status === 'success' && ohlcIndicators.dataPoints >= 26) {
            indicators = ohlcIndicators;
            source = 'ohlc_db';
        } else {
            // Fall back to live API
            indicators = await getTechnicalIndicators('stock', stock.symbol, '1D').catch(() => null);
        }
    } catch (err) {
        // Fall back to live API on error
        indicators = await getTechnicalIndicators('stock', stock.symbol, '1D').catch(() => null);
    }
    
    return {
        price: toNumber(stock?.price, NaN),
        change: toNumber(stock?.change, NaN),
        pe: toNumber(stock?.details?.pe_ratio, NaN),
        marketCap: stock?.details?.market_cap || '',
        sector: stock?.details?.sector || '',
        rsi: toNumber(indicators?.rsi, NaN),
        volumeStatus: indicators?.volumeStatus || '',
        ema20: toNumber(indicators?.ema20, NaN),
        support: toNumber(indicators?.support, NaN),
        resistance: toNumber(indicators?.resistance, NaN),
        atr: toNumber(indicators?.atr, NaN),
        indicatorSource: source,
    };
};

const createRule = async (userId, payload = {}) => {
    const name = String(payload.name || '').trim();
    const symbol = normalizeSymbol(payload.symbol || '');
    const conditions = Array.isArray(payload.conditions) ? payload.conditions : [];

    if (!name || !symbol || conditions.length === 0) {
        const error = new Error('name, symbol and conditions are required');
        error.statusCode = 400;
        throw error;
    }

    return AlertRule.create({
        user: userId,
        name,
        symbol,
        assetType: String(payload.assetType || 'STOCK').toUpperCase(),
        logic: String(payload.logic || 'ALL').toUpperCase() === 'ANY' ? 'ANY' : 'ALL',
        conditions: conditions.map((condition) => ({
            field: String(condition.field || ''),
            operator: String(condition.operator || 'eq'),
            value: condition.value,
        })),
        severity: ['low', 'medium', 'high'].includes(String(payload.severity || '').toLowerCase())
            ? String(payload.severity).toLowerCase()
            : 'medium',
        active: payload.active !== false,
    });
};

const listRules = async (userId) => {
    return AlertRule.find({ user: userId }).sort({ createdAt: -1 });
};

const evaluateRules = async (userId) => {
    const rules = await AlertRule.find({ user: userId, active: true });
    const triggered = [];

    for (const rule of rules) {
        const fieldMap = await buildFieldMap(rule.symbol);
        const evaluations = rule.conditions.map((condition) => {
            const actual = fieldMap[condition.field];
            return evaluateCondition(actual, condition.operator, condition.value);
        });
        const isTriggered = rule.logic === 'ANY'
            ? evaluations.some(Boolean)
            : evaluations.every(Boolean);

        if (isTriggered) {
            rule.lastTriggeredAt = new Date();
            await rule.save();

            await Notification.create({
                user: userId,
                type: 'PRICE_ALERT',
                title: `Rule triggered: ${rule.name}`,
                message: `${rule.symbol} matched ${rule.logic} conditions.`,
                metadata: new Map([
                    ['ruleId', String(rule._id)],
                    ['symbol', rule.symbol],
                ]),
            });

            triggered.push({
                ruleId: String(rule._id),
                name: rule.name,
                symbol: rule.symbol,
                triggeredAt: rule.lastTriggeredAt,
            });
        }
    }

    return {
        evaluated: rules.length,
        triggeredCount: triggered.length,
        triggered,
    };
};

module.exports = {
    createRule,
    listRules,
    evaluateRules,
};
