const axios = require('axios');
const logger = require('../config/logger');



class YahooFinanceService {
    constructor() {
        this.baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart';
    }

    
    async fetchHistoricalData(symbol, interval = '1d', range = '1y') {
        try {
            const url = `${this.baseUrl}/${symbol}`;
            const params = {
                interval,
                range,
                events: 'history',
            };

            logger.info(`Fetching ${interval} data for ${symbol} (range: ${range})`);

            const response = await axios.get(url, {
                params,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                },
                timeout: 30000,
            });

            if (!response.data || !response.data.chart || !response.data.chart.result) {
                throw new Error('Invalid response from Yahoo Finance');
            }

            const result = response.data.chart.result[0];
            
            if (!result || !result.indicators || !result.indicators.quote || result.indicators.quote.length === 0) {
                throw new Error('No data available for this symbol');
            }

            const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
            const quote = result.indicators.quote[0] || { open: [], high: [], low: [], close: [], volume: [] };
            const adjClose = result.indicators.adjclose?.[0]?.adjclose || [];

            if (timestamps.length === 0) {
                throw new Error('No timestamp data available for this symbol');
            }

            const ohlcData = timestamps.map((timestamp, index) => ({
                timestamp: new Date(timestamp * 1000), // Convert Unix timestamp to Date
                open: quote.open?.[index],
                high: quote.high?.[index],
                low: quote.low?.[index],
                close: quote.close?.[index],
                volume: quote.volume?.[index] || 0,
                adjustedClose: adjClose[index] || quote.close?.[index],
            })).filter(candle => 
                candle.open !== null && candle.open !== undefined &&
                candle.high !== null && candle.high !== undefined &&
                candle.low !== null && candle.low !== undefined &&
                candle.close !== null && candle.close !== undefined
            );

            logger.info(`âœ… Fetched ${ohlcData.length} candles for ${symbol}`);

            return {
                success: true,
                count: ohlcData.length,
                data: ohlcData,
                symbol,
                interval,
                range,
            };
        } catch (error) {
            if (error.response?.status === 404) {
                logger.warn(`Symbol ${symbol} not found on Yahoo Finance`);
                return {
                    success: false,
                    message: 'Symbol not found',
                    data: [],
                };
            }

            logger.error(`Error fetching Yahoo Finance data for ${symbol}: ${error.message}`);
            return {
                success: false,
                message: error.message,
                data: [],
            };
        }
    }

    
    async fetchCustomRange(symbol, startDate, endDate, interval = '1d') {
        try {
            const url = `${this.baseUrl}/${symbol}`;
            const params = {
                interval,
                period1: Math.floor(startDate.getTime() / 1000), // Unix timestamp
                period2: Math.floor(endDate.getTime() / 1000),
                events: 'history',
            };

            logger.info(`Fetching ${interval} data for ${symbol} from ${startDate.toDateString()} to ${endDate.toDateString()}`);

            const response = await axios.get(url, {
                params,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                },
                timeout: 30000,
            });

            if (!response.data?.chart?.result) {
                throw new Error('Invalid response from Yahoo Finance');
            }

            const result = response.data.chart.result[0];
            
            if (!result || !result.indicators || !result.indicators?.quote?.[0]) {
                throw new Error('No data available');
            }

            const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
            const quote = result.indicators.quote[0] || { open: [], high: [], low: [], close: [], volume: [] };
            const adjClose = result.indicators.adjclose?.[0]?.adjclose || [];

            if (timestamps.length === 0) {
                throw new Error('No timestamp data available for custom range');
            }

            const ohlcData = timestamps.map((timestamp, index) => ({
                timestamp: new Date(timestamp * 1000),
                open: quote.open?.[index],
                high: quote.high?.[index],
                low: quote.low?.[index],
                close: quote.close?.[index],
                volume: quote.volume?.[index] || 0,
                adjustedClose: adjClose[index] || quote.close?.[index],
            })).filter(candle => 
                candle.open !== null && candle.open !== undefined &&
                candle.high !== null && candle.high !== undefined &&
                candle.low !== null && candle.low !== undefined &&
                candle.close !== null && candle.close !== undefined
            );

            logger.info(`âœ… Fetched ${ohlcData.length} candles for ${symbol}`);

            return {
                success: true,
                count: ohlcData.length,
                data: ohlcData,
            };
        } catch (error) {
            logger.error(`Error fetching custom range for ${symbol}: ${error.message}`);
            return {
                success: false,
                message: error.message,
                data: [],
            };
        }
    }

    
    async batchFetch(symbols, interval = '1d', range = '1y') {
        const results = {
            success: [],
            failed: [],
        };

        for (const symbol of symbols) {
            try {
                const result = await this.fetchHistoricalData(symbol, interval, range);
                
                if (result.success && result.data.length > 0) {
                    results.success.push({
                        symbol,
                        count: result.count,
                        data: result.data,
                    });
                } else {
                    results.failed.push({
                        symbol,
                        reason: result.message || 'No data available',
                    });
                }

                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                results.failed.push({
                    symbol,
                    reason: error.message,
                });
            }
        }

        logger.info(`Batch fetch complete: ${results.success.length} success, ${results.failed.length} failed`);

        return results;
    }
}

module.exports = new YahooFinanceService();
