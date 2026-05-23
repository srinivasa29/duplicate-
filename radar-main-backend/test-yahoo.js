require('dotenv').config();

const YahooFinance = require('yahoo-finance2').default;

const yahooFinance = new YahooFinance();

async function inspect() {

    const result = await yahooFinance.quoteSummary('INFY.NS', {
        modules: [
            'price',
            'summaryDetail',
            'defaultKeyStatistics',
            'financialData',
            'assetProfile'
        ]
    });

    console.dir(result, { depth: null });
}

inspect();