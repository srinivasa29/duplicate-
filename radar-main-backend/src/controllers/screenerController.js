const { runScreener } = require('../services/screenerService');
const ScreenerRun = require('../models/ScreenerRun');
const profileCache = require('../services/profileCache');

const runScreenerScan = async (req, res) => {
    try {
        const payload = (req.body && typeof req.body === 'object') ? req.body : {};
        const data = await runScreener(payload);

        if (req.user?._id) {
            ScreenerRun.create({
                user: req.user._id,
                filters: payload,
                resultCount: Number(data?.returned || data?.results?.length || 0),
            }).then(async () => {
                try { await profileCache.invalidate(req.user._id); } catch (_) {}
            }).catch(() => null);
        }
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to run screener',
        });
    }
};

module.exports = {
    runScreenerScan,
};
