const asyncHandler = require('express-async-handler');
const ohlcService = require('../services/ohlcService');
const logger = require('../config/logger');


const getHistoricalData = asyncHandler(async (req, res) => {
    const { symbol } = req.params;
    const {
        exchange = 'NSE',
        timeframe = '1d',
        startDate,
        endDate,
        from,
        to,
        limit = 365,
    } = req.query;

    const actualStartDate = from || startDate;
    const actualEndDate = to || endDate;

    if (!symbol) {
        res.status(400);
        throw new Error('Symbol is required');
    }

    let result = await ohlcService.getOHLCData({
        symbol,
        exchange,
        timeframe,
        startDate: actualStartDate,
        endDate: actualEndDate,
        limit: parseInt(limit),
    });

    if (result.count === 0) {
        // Fallback to live data if DB is empty (e.g. crypto symbols)
        const { fetchCryptoHistory } = require('../services/cryptoService');
        const { fetchStockHistory } = require('../services/stockService');
        try {
            let fallbackData = [];
            const knownCryptos = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOGE', 'DOT', 'BNB', 'MATIC', 'AVAX', 'LINK', 'LTC'];
            const bare = symbol.replace(/\.(NS|BO)$/i, '').replace(/-USD$/i, '');
            if (knownCryptos.includes(bare)) {
                fallbackData = await fetchCryptoHistory(bare, timeframe);
            } else {
                fallbackData = await fetchStockHistory(symbol, timeframe, { allowSynthetic: true });
            }
            if (fallbackData && fallbackData.length > 0) {
                result = {
                    success: true,
                    count: fallbackData.length,
                    data: fallbackData
                };
            }
        } catch (e) {
            console.error('OHLC Fallback failed:', e.message);
        }
    }

    if (!result.success) {
        res.status(500);
        throw new Error(result.message || 'Failed to fetch OHLC data');
    }

    res.json({
        success: true,
        symbol,
        exchange,
        timeframe,
        count: result.count,
        data: result.data,
    });
});


const getLatestCandle = asyncHandler(async (req, res) => {
    const { symbol } = req.params;
    const { exchange = 'NSE', timeframe = '1d' } = req.query;

    if (!symbol) {
        res.status(400);
        throw new Error('Symbol is required');
    }

    const result = await ohlcService.getLatestOHLC(symbol, exchange, timeframe);

    if (!result.success) {
        res.status(500);
        throw new Error('Failed to fetch latest OHLC data');
    }

    if (!result.data) {
        res.status(404);
        throw new Error('No data found for this symbol');
    }

    res.json({
        success: true,
        symbol,
        exchange,
        timeframe,
        data: result.data,
    });
});


const getAvailableSymbols = asyncHandler(async (req, res) => {
    const { exchange } = req.query;
    const result = await ohlcService.getAvailableSymbols(exchange);
    if (!result.success) {
        res.status(500);
        throw new Error('Failed to fetch available symbols');
    }

    res.json({
        success: true,
        count: result.count,
        exchange: exchange || 'all',
        symbols: result.symbols,
    });
});

const getCompareData = asyncHandler(async (req, res) => {
    const { symbols, from, to, timeframe = '1d' } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
        res.status(400);
        throw new Error('Symbols array is required');
    }

    const results = {};
    const promises = symbols.map(async (sym) => {
        const result = await ohlcService.getOHLCData({
            symbol: sym,
            startDate: from,
            endDate: to,
            timeframe
        });
        if (result.success) {
            results[sym] = result.data;
        }
    });

    await Promise.all(promises);
    res.json(results);
});

module.exports = {
    getHistoricalData,
    getLatestCandle,
    getAvailableSymbols,
    getCompareData
};
