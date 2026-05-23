const axios = require('axios');

async function testYahoo() {
    try {
        const symbol = 'WIPRO.NS';
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=incomeStatementHistory,incomeStatementHistoryQuarterly`;
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error(e.message);
    }
}

testYahoo();
