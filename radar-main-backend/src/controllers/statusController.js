const { getMarketStatus } = require('../utils/marketStatus');
const { getProviderMetrics } = require('../services/priceRouter');

const getStatus = (req, res) => {
    const status = getMarketStatus();
    res.json(status);
};

const getProviderHealth = (req, res) => {
    try {
        const metrics = getProviderMetrics();
        const allHealthy = metrics.every(m => m.healthy);
        const overallHealth = allHealthy ? 'healthy' : 'degraded';
        res.json({
            success: true,
            overallHealth,
            providers: metrics,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

module.exports = { getStatus, getProviderHealth };
