const { buildTraderProfileSummary } = require('../services/traderAnalyticsService');
const profileCache = require('../services/profileCache');

const DEFAULT_TTL_MS = 30 * 1000; // 30 seconds

const getCachedSummary = async (user, ttl = DEFAULT_TTL_MS) => {
    const key = String(user._id);
    const cached = await profileCache.get(key);
    if (cached) return cached;
    const summary = await buildTraderProfileSummary(user);
    try { await profileCache.set(key, summary, ttl); } catch (_) {}
    return summary;
};

const getTraderProfileSummary = async (req, res) => {
    try {
        const ttl = Number(req.query?.ttl) || DEFAULT_TTL_MS;
        const summary = await getCachedSummary(req.user, ttl);
        return res.json({ success: true, data: summary });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to build trader profile summary',
        });
    }
};

const getTraderMetrics = async (req, res) => {
    try {
        const ttl = Number(req.query?.ttl) || DEFAULT_TTL_MS;
        const summary = await getCachedSummary(req.user, ttl);
        const metrics = {
            metrics: summary.metrics || {},
            risk: summary.risk || {},
            sessionPerformance: summary.sessionPerformance || {},
            totals: summary.totals || {},
        };
        return res.json({ success: true, data: metrics });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to fetch metrics' });
    }
};

const getTraderActivity = async (req, res) => {
    try {
        const ttl = Number(req.query?.ttl) || DEFAULT_TTL_MS;
        const summary = await getCachedSummary(req.user, ttl);
        return res.json({ success: true, data: { activity: summary.activityTimeline || [] } });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to fetch activity' });
    }
};

const getTraderStrengths = async (req, res) => {
    try {
        const ttl = Number(req.query?.ttl) || DEFAULT_TTL_MS;
        const summary = await getCachedSummary(req.user, ttl);
        return res.json({ success: true, data: { strengths: summary.strengths || [], weaknesses: summary.weaknesses || [] } });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to fetch strengths/weaknesses' });
    }
};

module.exports = {
    getTraderProfileSummary,
    getTraderMetrics,
    getTraderActivity,
    getTraderStrengths,
};
