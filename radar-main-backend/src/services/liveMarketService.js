const YahooFinance = require('yahoo-finance2').default;

const yahooFinance = new YahooFinance();

const getLiveMarketData = async (symbol) => {
    try {
        const result = await yahooFinance.quote(symbol);

        return {
            success: true,
            data: {
                symbol: result.symbol,
                name: result.shortName,
                price: result.regularMarketPrice,
                change: result.regularMarketChange,
                changePercent: result.regularMarketChangePercent,
                open: result.regularMarketOpen,
                high: result.regularMarketDayHigh,
                low: result.regularMarketDayLow,
                previousClose: result.regularMarketPreviousClose,
                volume: result.regularMarketVolume,
                marketCap: result.marketCap,
                currency: result.currency,
                timestamp: result.regularMarketTime
            }
        };

    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
};

module.exports = {
    getLiveMarketData
};