const mapSymbol = require('../utils/symbolMapper');

const YahooFinance = require('yahoo-finance2').default;

const yahooFinance = new YahooFinance();

const getChartData = async (
    symbol,
    interval = '1d',
    period1 = null,
    period2 = null,
    daysBack = 365
) => {

    const yahooSymbol = mapSymbol(symbol);

    let effectiveDaysBack = Number(daysBack);
    // Fetch extra days to account for weekends/holidays
    if (!period1) {
        if (effectiveDaysBack === 1) effectiveDaysBack = 4;
        else if (effectiveDaysBack === 5) effectiveDaysBack = 7;
        else if (effectiveDaysBack < 30) effectiveDaysBack += 5;
    }

    // Enforce Yahoo Finance strict limits to prevent API crashes
    if (interval === '1m' && effectiveDaysBack > 7) {
        effectiveDaysBack = 7;
    } else if (['2m', '5m', '15m', '30m', '90m'].includes(interval) && effectiveDaysBack > 60) {
        effectiveDaysBack = 60;
    } else if (interval === '1h' && effectiveDaysBack > 730) {
        effectiveDaysBack = 730;
    }

    const p1 = period1 ? new Date(Number(period1) * 1000) : new Date(Date.now() - effectiveDaysBack * 24 * 60 * 60 * 1000);
    const p2 = period2 ? new Date(Number(period2) * 1000) : new Date();

    const result = await yahooFinance.chart(yahooSymbol, {
        period1: p1,
        period2: p2,
        interval
    });

    if (!result?.quotes || result.quotes.length === 0) {
        return [];
    }

    const mappedQuotes = result.quotes.map((candle) => ({
        time: Math.floor(new Date(candle.date).getTime() / 1000) + (5.5 * 60 * 60),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0,
        // Store date string for grouping
        dateStr: new Date(candle.date).toISOString().split('T')[0]
    }));

    // If period1 was not provided, we fetched extra data to cover weekends.
    // Now we must filter down to the actual requested `daysBack` number of trading days.
    if (!period1 && Number(daysBack) < 30) {
        // Find all unique trading dates in the results, sorted descending
        const uniqueDates = [...new Set(mappedQuotes.map(q => q.dateStr))].sort((a, b) => b.localeCompare(a));
        
        // Take only the requested number of recent trading days
        const requestedDates = new Set(uniqueDates.slice(0, Number(daysBack)));
        
        return mappedQuotes.filter(q => requestedDates.has(q.dateStr)).map(({ dateStr, ...rest }) => rest);
    }

    return mappedQuotes.map(({ dateStr, ...rest }) => rest);
};

module.exports = {
    getChartData
};