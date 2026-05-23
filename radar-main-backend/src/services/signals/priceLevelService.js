/**
 * Price Level Service
 * Identifies Support, Resistance, Pivots, and Breakout Zones.
 */
const getPriceLevels = (history) => {
    if (!history || history.length < 50) return null;

    const prices = history.map(h => h.price);
    const highs = history.map(h => h.high || h.price);
    const lows = history.map(h => h.low || h.price);
    
    const lastPrice = prices[prices.length - 1];

    // Pivot Points (Standard)
    // P = (H + L + C) / 3
    const prevH = Math.max(...highs.slice(-21, -1));
    const prevL = Math.min(...lows.slice(-21, -1));
    const prevC = prices[prices.length - 2];

    const pivot = (prevH + prevL + prevC) / 3;
    const r1 = (2 * pivot) - prevL;
    const s1 = (2 * pivot) - prevH;
    const r2 = pivot + (prevH - prevL);
    const s2 = pivot - (prevH - prevL);

    // Breakout Zone Detection
    const recentHigh = Math.max(...highs.slice(-10, -1));
    const breakoutZone = {
        upper: parseFloat((recentHigh * 1.01).toFixed(2)),
        lower: parseFloat((recentHigh * 0.99).toFixed(2))
    };

    return {
        supportLevels: [parseFloat(s1.toFixed(2)), parseFloat(s2.toFixed(2))],
        resistanceLevels: [parseFloat(r1.toFixed(2)), parseFloat(r2.toFixed(2))],
        pivotLevels: {
            p: parseFloat(pivot.toFixed(2)),
            r1: parseFloat(r1.toFixed(2)),
            s1: parseFloat(s1.toFixed(2))
        },
        breakoutZone: lastPrice > recentHigh ? 'Breaking Out' : lastPrice > breakoutZone.lower ? 'Testing Breakout' : 'Below Resistance'
    };
};

module.exports = { getPriceLevels };
