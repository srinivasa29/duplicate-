const Alert = require('../models/Alert');
const AlertRule = require('../models/AlertRule');
const Portfolio = require('../models/Portfolio');
const ScreenerRun = require('../models/ScreenerRun');
const TradeLog = require('../models/TradeLog');

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const toPercent = (value) => (Number.isFinite(value) ? Math.round(value) : 0);

const toMinutes = (date) => {
    const dt = new Date(date);
    return dt.getHours() * 60 + dt.getMinutes();
};

const getSessionKey = (date) => {
    const minutes = toMinutes(date);
    if (minutes >= 570 && minutes < 660) return 'opening';
    if (minutes >= 660 && minutes < 840) return 'midDay';
    if (minutes >= 840 && minutes <= 930) return 'closing';
    return 'offHours';
};

const formatTimelineTime = (value) => {
    try {
        const date = new Date(value);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_error) {
        return '';
    }
};

const summarizeSessionPerformance = (trades) => {
    const buckets = {
        opening: { wins: 0, total: 0 },
        midDay: { wins: 0, total: 0 },
        closing: { wins: 0, total: 0 },
    };

    trades.forEach((trade) => {
        const session = getSessionKey(trade.executedAt);
        if (!buckets[session]) return;
        buckets[session].total += 1;
        if (trade.pnl > 0) {
            buckets[session].wins += 1;
        }
    });

    const opening = buckets.opening.total
        ? toPercent((buckets.opening.wins / buckets.opening.total) * 100)
        : 0;
    const midDay = buckets.midDay.total
        ? toPercent((buckets.midDay.wins / buckets.midDay.total) * 100)
        : 0;
    const closing = buckets.closing.total
        ? toPercent((buckets.closing.wins / buckets.closing.total) * 100)
        : 0;

    const scores = [
        { key: 'Opening', value: opening },
        { key: 'Mid-day', value: midDay },
        { key: 'Closing', value: closing },
    ];
    const bestSession = scores.reduce((best, current) => (current.value > best.value ? current : best), scores[0]);

    return {
        opening,
        midDay,
        closing,
        bestSession: bestSession ? bestSession.key : 'Opening',
    };
};

const computeHoldingMinutes = (trades) => {
    const buyQueues = new Map();
    const holdingMinutes = [];

    trades.forEach((trade) => {
        if (trade.side === 'BUY') {
            const queue = buyQueues.get(trade.symbol) || [];
            queue.push({ qty: trade.quantity, time: new Date(trade.executedAt).getTime() });
            buyQueues.set(trade.symbol, queue);
            return;
        }

        if (trade.side !== 'SELL') return;

        let remaining = trade.quantity;
        const queue = buyQueues.get(trade.symbol) || [];
        let weightedEntryTime = 0;
        let matchedQty = 0;

        while (remaining > 0 && queue.length > 0) {
            const entry = queue[0];
            const used = Math.min(entry.qty, remaining);
            weightedEntryTime += entry.time * used;
            matchedQty += used;
            remaining -= used;
            entry.qty -= used;
            if (entry.qty <= 0) {
                queue.shift();
            }
        }

        if (matchedQty > 0) {
            const avgEntryTime = weightedEntryTime / matchedQty;
            const holding = (new Date(trade.executedAt).getTime() - avgEntryTime) / 60000;
            if (Number.isFinite(holding)) {
                holdingMinutes.push(holding);
            }
        }

        buyQueues.set(trade.symbol, queue);
    });

    if (holdingMinutes.length === 0) {
        return null;
    }

    const total = holdingMinutes.reduce((sum, value) => sum + value, 0);
    return total / holdingMinutes.length;
};

const deriveTradingStyle = ({ dna, avgHoldingMinutes }) => {
    if (dna && Number.isFinite(dna.metrics?.patience)) {
        const patience = dna.metrics.patience;
        if (patience >= 70) return 'Swing';
        if (patience >= 40) return 'Intraday';
        return 'Scalping';
    }

    if (!Number.isFinite(avgHoldingMinutes)) {
        return 'Intraday';
    }

    if (avgHoldingMinutes < 30) return 'Scalping';
    if (avgHoldingMinutes < 240) return 'Intraday';
    if (avgHoldingMinutes < 1440) return 'Swing';
    return 'Position';
};

const deriveRiskType = ({ dna, riskScore }) => {
    if (dna && Number.isFinite(dna.metrics?.risk)) {
        const risk = dna.metrics.risk;
        if (risk >= 70) return 'Aggressive';
        if (risk >= 40) return 'Balanced';
        return 'Conservative';
    }

    if (riskScore >= 70) return 'Aggressive';
    if (riskScore >= 40) return 'Balanced';
    return 'Conservative';
};

const buildRiskInsight = ({ afterLossMultiplier, lossRate }) => {
    if (Number.isFinite(afterLossMultiplier) && afterLossMultiplier > 1.15) {
        return 'Sizing up after losses. Consider tightening risk until momentum resets.';
    }
    if (Number.isFinite(lossRate) && lossRate > 0.55) {
        return 'Loss rate is elevated. Reduce position size and wait for higher conviction setups.';
    }
    return 'Risk behavior is balanced across recent sessions.';
};

const buildStrengthsWeaknesses = ({ accuracy, avgHoldingMinutes, bestSession, tradesPerDay, lossRate }) => {
    const strengths = [];
    const weaknesses = [];

    if (accuracy >= 60) strengths.push('High win-rate setups');
    if (bestSession) strengths.push(`${bestSession} session edge`);
    if (Number.isFinite(avgHoldingMinutes) && avgHoldingMinutes < 60) strengths.push('Fast execution cadence');

    if (accuracy < 45) weaknesses.push('Signal quality needs refinement');
    if (Number.isFinite(lossRate) && lossRate > 0.55) weaknesses.push('Stops triggered too often');
    if (Number.isFinite(tradesPerDay) && tradesPerDay > 8) weaknesses.push('Overtrading risk');

    if (strengths.length === 0) strengths.push('Build more trade history to surface strengths');
    if (weaknesses.length === 0) weaknesses.push('No recurring weaknesses detected yet');

    return { strengths, weaknesses };
};

const buildActivityTimeline = ({ trades, watchlist, alertRules, alerts }) => {
    const entries = [];

    trades.slice(-6).forEach((trade) => {
        entries.push({
            symbol: trade.symbol,
            pattern: trade.side === 'BUY' ? 'Executed Buy' : 'Executed Sell',
            description: `${trade.side} ${trade.quantity} @ ${trade.price.toFixed(2)}`,
            time: formatTimelineTime(trade.executedAt),
            timestamp: new Date(trade.executedAt).getTime(),
        });
    });

    (watchlist || []).forEach((item) => {
        if (!item?.addedAt) return;
        entries.push({
            symbol: String(item.symbol || '').toUpperCase(),
            pattern: 'Watchlist Add',
            description: `${item.symbol} added to watchlist`,
            time: formatTimelineTime(item.addedAt),
            timestamp: new Date(item.addedAt).getTime(),
        });
    });

    (alertRules || []).forEach((rule) => {
        if (!rule?.lastTriggeredAt) return;
        entries.push({
            symbol: String(rule.symbol || '').toUpperCase(),
            pattern: 'Alert Triggered',
            description: rule.name || 'Alert rule triggered',
            time: formatTimelineTime(rule.lastTriggeredAt),
            timestamp: new Date(rule.lastTriggeredAt).getTime(),
        });
    });

    (alerts || []).forEach((alert) => {
        entries.push({
            symbol: String(alert.symbol || '').toUpperCase(),
            pattern: 'Alert Created',
            description: `${alert.symbol} alert created`,
            time: formatTimelineTime(alert.createdAt),
            timestamp: new Date(alert.createdAt).getTime(),
        });
    });

    return entries
        .filter((entry) => Number.isFinite(entry.timestamp))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 8)
        .map(({ timestamp, ...rest }) => rest);
};

const buildTraderProfileSummary = async (user) => {
    const userId = user._id;
    const [tradeLogs, alertRules, alerts, screenerRuns, portfolio] = await Promise.all([
        TradeLog.find({ user: userId }).sort({ executedAt: 1 }).lean(),
        AlertRule.find({ user: userId }).sort({ updatedAt: -1 }).lean(),
        Alert.find({ userId }).sort({ createdAt: -1 }).lean(),
        ScreenerRun.find({ user: userId }).sort({ createdAt: -1 }).lean(),
        Portfolio.findOne({ user: userId }).lean(),
    ]);

    const realizedTrades = [];
    tradeLogs.forEach((trade) => {
        if (trade.side !== 'SELL') return;
        const entryPrice = Number.isFinite(trade.entryPrice) ? trade.entryPrice : null;
        const fallbackPnl = entryPrice !== null
            ? (trade.price - entryPrice) * trade.quantity
            : null;
        const pnl = Number.isFinite(trade.realizedPnl) ? trade.realizedPnl : fallbackPnl;
        if (!Number.isFinite(pnl)) return;

        realizedTrades.push({
            symbol: trade.symbol,
            pnl,
            executedAt: trade.executedAt,
            positionValue: Number.isFinite(trade.positionValue)
                ? trade.positionValue
                : trade.price * trade.quantity,
        });
    });

    const totalClosed = realizedTrades.length;
    const wins = realizedTrades.filter((trade) => trade.pnl > 0).length;
    const accuracy = totalClosed ? toPercent((wins / totalClosed) * 100) : 0;

    const recent = realizedTrades.slice(-20);
    const recentWins = recent.filter((trade) => trade.pnl > 0).length;
    const consistency = recent.length ? toPercent((recentWins / recent.length) * 100) : accuracy;

    const holdingAvg = computeHoldingMinutes(tradeLogs);

    const lossRate = totalClosed ? (totalClosed - wins) / totalClosed : 0;
    const avgPositionValue = realizedTrades.length
        ? realizedTrades.reduce((sum, trade) => sum + trade.positionValue, 0) / realizedTrades.length
        : 0;

    let afterLossMultiplier = null;
    if (avgPositionValue > 0 && tradeLogs.length > 1) {
        let afterLossTotal = 0;
        let afterLossCount = 0;
        let lastWasLoss = false;

        tradeLogs.forEach((trade) => {
            if (lastWasLoss && Number.isFinite(trade.positionValue)) {
                afterLossTotal += trade.positionValue;
                afterLossCount += 1;
            }

            if (trade.side === 'SELL') {
                const entryPrice = Number.isFinite(trade.entryPrice) ? trade.entryPrice : null;
                const fallbackPnl = entryPrice !== null
                    ? (trade.price - entryPrice) * trade.quantity
                    : null;
                const pnl = Number.isFinite(trade.realizedPnl) ? trade.realizedPnl : fallbackPnl;
                lastWasLoss = Number.isFinite(pnl) ? pnl < 0 : false;
            }
        });

        if (afterLossCount > 0) {
            afterLossMultiplier = (afterLossTotal / afterLossCount) / avgPositionValue;
        }
    }

    const riskScoreBase = 50
        + (Number.isFinite(holdingAvg) && holdingAvg < 60 ? 12 : 0)
        + (Number.isFinite(holdingAvg) && holdingAvg < 30 ? 8 : 0)
        + (Number.isFinite(afterLossMultiplier) && afterLossMultiplier > 1.15 ? 12 : 0)
        + (lossRate > 0.5 ? 10 : 0);

    const riskScore = clamp(Math.round(riskScoreBase), 10, 95);

    const sessionPerformance = summarizeSessionPerformance(realizedTrades);
    const tradingStyle = deriveTradingStyle({ dna: user.investorDNA, avgHoldingMinutes: holdingAvg });
    const riskType = deriveRiskType({ dna: user.investorDNA, riskScore });
    const riskInsight = buildRiskInsight({ afterLossMultiplier, lossRate });

    const tradesByDay = new Map();
    tradeLogs.forEach((trade) => {
        const day = new Date(trade.executedAt).toISOString().slice(0, 10);
        tradesByDay.set(day, (tradesByDay.get(day) || 0) + 1);
    });
    const tradesPerDay = tradesByDay.size ? tradeLogs.length / tradesByDay.size : 0;

    const { strengths, weaknesses } = buildStrengthsWeaknesses({
        accuracy,
        avgHoldingMinutes: holdingAvg,
        bestSession: sessionPerformance.bestSession,
        tradesPerDay,
        lossRate,
    });

    const totalSignals = Math.max(alertRules.length + alerts.length, totalClosed);
    const screensAnalyzed = screenerRuns.length;

    const personalityDescription = `Primarily ${tradingStyle} with a ${riskType.toLowerCase()} risk profile.`;

    return {
        profile: {
            name: user.username,
            email: user.email,
            status: 'Active',
        },
        personality: {
            tradingStyle,
            riskType,
            description: personalityDescription,
            bestPattern: 'No pattern data yet',
        },
        metrics: {
            totalSignals,
            accuracy,
            consistency,
            screensAnalyzed,
        },
        risk: {
            score: riskScore,
            label: riskType === 'Aggressive' ? 'High' : riskType === 'Balanced' ? 'Moderate' : 'Low',
            insight: riskInsight,
        },
        sessionPerformance,
        strengths,
        weaknesses,
        activityTimeline: buildActivityTimeline({
            trades: tradeLogs.slice(-10).map((trade) => ({
                symbol: trade.symbol,
                side: trade.side,
                quantity: trade.quantity,
                price: trade.price,
                executedAt: trade.executedAt,
            })),
            watchlist: user.watchlist || [],
            alertRules,
            alerts,
        }),
        totals: {
            totalTrades: totalClosed,
            avgHoldingMinutes: holdingAvg,
            portfolioValue: portfolio ? Number(portfolio.cashBalance || 0) : 0,
        },
    };
};

module.exports = { buildTraderProfileSummary };
