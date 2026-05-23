const {
    getStockFundamentals,
    getStockEarningsCalendar,
    getStockNewsSentiment,
    getStockSignals,
} = require('../services/stockInsightsService');


const YahooFinance = require('yahoo-finance2').default;

const yahooFinance = new YahooFinance();
const getFundamentals = async (req, res) => {

    let yahooSymbol = '';
    try {

        const symbol = req.params.symbol || '';
        yahooSymbol = symbol.trim().toUpperCase();
        if (!yahooSymbol.includes('.') && !yahooSymbol.startsWith('^')) {
            yahooSymbol = `${yahooSymbol}.NS`;
        }

        const result = await yahooFinance.quoteSummary(yahooSymbol, {
            modules: [
                'price',
                'summaryDetail',
                'defaultKeyStatistics',
                'financialData',
                'assetProfile',
                'incomeStatementHistory',
                'incomeStatementHistoryQuarterly'
            ]
        });

        const formatIncomeData = (history, isQuarterly) => {
            if (!history || !history.incomeStatementHistory) return [];
            return history.incomeStatementHistory.map(item => {
                const date = new Date(item.endDate);
                const periodLabel = isQuarterly 
                    ? `Q${Math.floor(date.getMonth() / 3) + 1} '${date.getFullYear().toString().slice(-2)}`
                    : `'${date.getFullYear().toString().slice(-2)}`;
                return {
                    quarter: periodLabel,
                    revenue: (item.totalRevenue || 0) / 10000000,
                    profit: (item.netIncome || 0) / 10000000
                };
            }).reverse();
        };

        const fundamentals = {

            symbol,

            marketCap:
                result?.summaryDetail?.marketCap ||
                result?.price?.marketCap ||
                null,

            peRatio:
                result?.summaryDetail?.trailingPE ||
                null,

            eps:
                result?.defaultKeyStatistics?.trailingEps ||
                null,

            dividendYield:
                result?.summaryDetail?.dividendYield ||
                null,

            beta:
                result?.summaryDetail?.beta ||
                null,

            sector:
                result?.assetProfile?.sector ||
                null,

            industry:
                result?.assetProfile?.industry ||
                null,

            profitMargins:
                result?.financialData?.profitMargins ||
                null,

            operatingMargins:
                result?.financialData?.operatingMargins ||
                null,

            revenueGrowth:
                result?.financialData?.revenueGrowth ||
                null,

            bookValue:
                result?.defaultKeyStatistics?.bookValue ||
                null,

            priceToBook:
                result?.defaultKeyStatistics?.priceToBook ||
                null,

            fiftyTwoWeekHigh:
                result?.summaryDetail?.fiftyTwoWeekHigh ||
                null,

            fiftyTwoWeekLow:
                result?.summaryDetail?.fiftyTwoWeekLow ||
                null,
                
            financialPerformance: {
                quarterly: formatIncomeData(result?.incomeStatementHistoryQuarterly, true),
                yearly: formatIncomeData(result?.incomeStatementHistory, false)
            }
        };

        res.json({
            success: true,
            data: fundamentals
        });

    } catch (error) {

        console.error('FUNDAMENTALS ERROR:', error);

        res.status(500).json({
            success: false,
            message: error.message,
            yahooSymbol
        });
    }
};
const getEarningsCalendar = async (req, res) => {
    try {
        const data = await getStockEarningsCalendar(req.params.symbol);
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch earnings calendar',
        });
    }
};

const getNewsSentiment = async (req, res) => {
    try {
        const data = await getStockNewsSentiment(req.params.symbol);
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch news sentiment',
        });
    }
};

const getSignals = async (req, res) => {
    try {
        const { term = 'medium' } = req.query;
        const data = await getStockSignals(req.params.symbol, term);
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch signals',
        });
    }
};

module.exports = {
    getFundamentals,
    getEarningsCalendar,
    getNewsSentiment,
    getSignals,
};
