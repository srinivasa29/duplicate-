const { calculateATR, calculateBeta, calculateBollinger, calculateRSI } = require('../../utils/indicators');

/**
 * Risk Engine Service
 * Calculates Volatility, Beta, and Intelligent Risk Alerts.
 */
const getRiskMetrics = (history, marketHistory = []) => {
    if (!history || history.length < 20) return null;

    const atrRaw = calculateATR(history, 14);
    const bollingerRaw = calculateBollinger(history, 20, 2);
    const betaValue = calculateBeta(history, marketHistory);
    const rsiRaw = calculateRSI(history, 14);

    const atrValue = atrRaw[atrRaw.length - 1]?.value || 0;
    const bb = bollingerRaw[bollingerRaw.length - 1];
    const lastPrice = history[history.length - 1].price;
    const rsiValue = rsiRaw[rsiRaw.length - 1]?.value || 50;

    // Bollinger %B Calculation
    const bollingerPercentB = bb ? (lastPrice - bb.lower) / (bb.upper - bb.lower) : 0.5;

    // Volatility Rank (Simplified)
    const recentAtr = atrRaw.slice(-10).map(a => a.value);
    const atrTrend = recentAtr[recentAtr.length - 1] > recentAtr[0] ? 'Expanding' : 'Contracting';
    const volatilityRank = atrTrend === 'Expanding' ? 'High' : 'Low';

    // Risk Alert Generation
    const riskAlerts = [];
    const warningSignals = [];

    if (rsiValue > 70) riskAlerts.push('RSI Overheating (Overbought)');
    if (rsiValue < 30) warningSignals.push('Oversold conditions detected');
    if (bollingerPercentB > 1) riskAlerts.push('Price above Upper Bollinger Band');
    if (bollingerPercentB < 0) riskAlerts.push('Price below Lower Bollinger Band');
    if (atrTrend === 'Expanding') warningSignals.push('ATR Expansion - Increasing Volatility');
    if (betaValue > 1.5) warningSignals.push('High Beta - Sensitive to Market Swings');

    // Volatility Spikes
    const volumes = history.map(h => h.volume || 0);
    const lastVol = volumes[volumes.length - 1];
    const avgVol = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
    if (lastVol > avgVol * 2.5) riskAlerts.push('Extremely High Volume Spike');

    // Determine Risk Level
    let riskLevel = 'Low';
    const alertCount = riskAlerts.length + (warningSignals.length * 0.5);
    if (alertCount >= 3) riskLevel = 'Extreme';
    else if (alertCount >= 2) riskLevel = 'High';
    else if (alertCount >= 1) riskLevel = 'Moderate';

    return {
        atrValue,
        atrTrend,
        betaValue,
        betaRiskLevel: betaValue > 1.2 ? 'High' : betaValue < 0.8 ? 'Low' : 'Market-Neutral',
        bollingerPercentB: parseFloat(bollingerPercentB.toFixed(2)),
        volatilityRank,
        riskLevel,
        riskAlerts,
        warningSignals,
        stabilityStatus: riskLevel === 'Low' ? 'Stable' : 'Volatile'
    };
};

module.exports = { getRiskMetrics };
