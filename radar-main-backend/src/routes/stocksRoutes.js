const express = require('express');
const router = express.Router();
const {
    getFundamentals,
    getEarningsCalendar,
    getNewsSentiment,
    getSignals,
} = require('../controllers/stockInsightsController');
const { getHistoricalData, getCompareData, getAvailableSymbols, getLatestCandle, getChartData } = require('../controllers/ohlcController');

const { authMiddleware } = require('../middleware/authMiddleware');
const { validateRequest, validateSymbolParam } = require('../middleware/validationMiddleware');

router.get('/:symbol/fundamentals', validateSymbolParam, validateRequest, getFundamentals);
router.get('/financials', async (req, res) => {
    const symbol = req.query.symbol;
    if (!symbol) return res.status(400).json({ success: false, message: 'Symbol required' });
    req.params.symbol = symbol;
    return getFundamentals(req, res);
});

router.get('/:symbol/earnings-calendar', validateSymbolParam, validateRequest, getEarningsCalendar);
router.get('/:symbol/news-sentiment', validateSymbolParam, validateRequest, getNewsSentiment);
router.get('/news', async (req, res) => {
    const symbol = req.query.symbol;
    if (!symbol) return res.status(400).json({ success: false, message: 'Symbol required' });
    req.params.symbol = symbol;
    return getNewsSentiment(req, res);
});

router.get('/:symbol/signals', validateSymbolParam, validateRequest, getSignals);
router.get('/:symbol/history', validateSymbolParam, validateRequest, getHistoricalData);
router.get('/:symbol/chart', validateSymbolParam, validateRequest, getChartData);
router.get('/:symbol/live', validateSymbolParam, validateRequest, getLatestCandle);
router.post('/compare', authMiddleware, getCompareData);
router.get('/search', authMiddleware, getAvailableSymbols);

module.exports = router;
