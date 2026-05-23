/**
 * Market Participation Service
 * Estimates Institutional vs Retail activity based on volume and price action.
 */
const getParticipationAnalysis = (history, volumeData = {}) => {
    if (!history || history.length < 5) return null;

    const last = history[history.length - 1];
    const avgVol = history.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
    const relVol = last.volume / avgVol;

    // Delivery percentage is a strong indicator of institutional activity in Indian markets
    const deliveryPct = last.deliveryPercentage || 50; 

    // Institutional Participation Logic
    // High delivery + High relative volume = High institutional participation
    let institutionalParticipation = 'Moderate';
    if (deliveryPct > 60 && relVol > 1.2) institutionalParticipation = 'High (Accumulation)';
    if (deliveryPct < 30 && relVol > 2) institutionalParticipation = 'High (Speculative)';
    if (deliveryPct > 70 && relVol < 1) institutionalParticipation = 'High (Passive Holding)';

    // Retail Interest Logic
    // Unusual price action on average volume often indicates retail activity
    let retailInterest = 'Average';
    if (relVol < 0.8 && Math.abs((last.price - history[history.length-2].price)/last.price) > 0.02) retailInterest = 'High';
    if (relVol > 3) retailInterest = 'Very High (Momentum Chasing)';

    return {
        institutionalParticipation,
        retailInterest,
        participationStrength: relVol > 1.5 ? 'Strong' : relVol < 0.7 ? 'Weak' : 'Neutral'
    };
};

module.exports = { getParticipationAnalysis };
