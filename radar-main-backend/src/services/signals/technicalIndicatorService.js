const { 
    calculateEMA, 
    calculateSMA, 
    calculateRSI, 
    calculateMACD, 
    calculateStochRSI, 
    calculateROC 
} = require('../../utils/indicators');

/**
 * Trend Signals Service
 * Calculates EMA alignment, 200 DMA position, and Trend Score.
 */
const getTrendSignals = (history) => {
    if (!history || history.length < 200) return null;

    const prices = history.map(h => h.price);
    const ema20Raw = calculateEMA(prices, 20);
    const ema50Raw = calculateEMA(prices, 50);
    const ema200Raw = calculateEMA(prices, 200);
    const sma200Raw = calculateSMA(history, 200);

    const ema20 = ema20Raw[ema20Raw.length - 1];
    const ema50 = ema50Raw[ema50Raw.length - 1];
    const ema200 = ema200Raw[ema200Raw.length - 1];
    const sma200 = sma200Raw[sma200Raw.length - 1]?.value;
    const lastPrice = prices[prices.length - 1];

    // EMA Alignment: Bullish if 20 > 50 > 200
    const emaAlignment = (ema20 > ema50 && ema50 > ema200) ? 'Bullish' : (ema20 < ema50 && ema50 < ema200) ? 'Bearish' : 'Neutral';
    const priceVs200DMA = lastPrice > sma200 ? 'Above' : 'Below';

    // Structure Detection (Higher Highs / Higher Lows) - Basic implementation
    const recent = history.slice(-20);
    const highs = recent.map(h => h.high || h.price);
    const lows = recent.map(h => h.low || h.price);
    const isHigherHigh = highs[highs.length - 1] > Math.max(...highs.slice(-10, -1));
    const isHigherLow = lows[lows.length - 1] > Math.min(...lows.slice(-10, -1));
    const structureStatus = (isHigherHigh && isHigherLow) ? 'Breakout' : (isHigherHigh) ? 'Testing Resistance' : 'Consolidating';

    // Weighted Trend Score (0-100)
    let trendScore = 0;
    if (emaAlignment === 'Bullish') trendScore += 40;
    if (priceVs200DMA === 'Above') trendScore += 30;
    if (isHigherHigh) trendScore += 20;
    if (isHigherLow) trendScore += 10;

    return {
        trendSignal: emaAlignment === 'Bullish' ? 'Strong Buy' : emaAlignment === 'Bearish' ? 'Strong Sell' : 'Neutral',
        emaAlignment,
        trendScore,
        priceVs200DMA,
        structureStatus
    };
};

/**
 * Momentum Signals Service
 * Calculates RSI, MACD, StochRSI, ROC and Momentum Score.
 */
const getMomentumSignals = (history) => {
    if (!history || history.length < 30) return null;

    const rsiRaw = calculateRSI(history, 14);
    const macdRaw = calculateMACD(history);
    const stochRsiRaw = calculateStochRSI(history, 14);
    const rocRaw = calculateROC(history, 12);

    const rsiValue = rsiRaw[rsiRaw.length - 1]?.value || 50;
    const macd = macdRaw[macdRaw.length - 1];
    const stochRsi = stochRsiRaw[stochRsiRaw.length - 1]?.value || 0.5;
    const roc = rocRaw[rocRaw.length - 1]?.value || 0;

    const macdSignal = macd ? (macd.value > macd.signal ? 'Bullish Crossover' : 'Bearish Crossover') : 'Neutral';
    const stochasticSignal = stochRsi > 0.8 ? 'Overbought' : stochRsi < 0.2 ? 'Oversold' : 'Neutral';
    
    // Momentum Score Calculation
    let momentumScore = 50;
    if (rsiValue > 60) momentumScore += 15;
    if (rsiValue < 40) momentumScore -= 15;
    if (macdSignal === 'Bullish Crossover') momentumScore += 20;
    if (macdSignal === 'Bearish Crossover') momentumScore -= 20;
    if (roc > 0) momentumScore += 10;
    if (roc < 0) momentumScore -= 10;
    
    momentumScore = Math.max(0, Math.min(100, momentumScore));

    return {
        rsiValue,
        macdSignal,
        stochasticSignal: stochRsi, // Sending raw value for frontend processing
        momentumScore,
        momentumStrength: momentumScore > 70 ? 'High' : momentumScore < 30 ? 'Low' : 'Moderate'
    };
};

module.exports = { getTrendSignals, getMomentumSignals };
