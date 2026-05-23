const express = require('express');
const router = express.Router();

const {
    getHistoricalData,
    getLatestCandle,
    getAvailableSymbols,
    getCompareData,
    getChartData,
    getStockDetails
} = require('../controllers/ohlcController');

const { protect } = require('../middleware/authMiddleware');

router.get('/symbols/list', getAvailableSymbols);

router.get('/:symbol/latest', getLatestCandle);

router.get('/:symbol/chart', getChartData);

router.get('/:symbol/details', getStockDetails);

router.get('/:symbol', getHistoricalData);

module.exports = router;