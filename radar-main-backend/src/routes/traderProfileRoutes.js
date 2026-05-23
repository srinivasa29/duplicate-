const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getTraderProfileSummary, getTraderMetrics, getTraderActivity, getTraderStrengths } = require('../controllers/traderProfileController');
const profileRateLimiter = require('../middleware/profileRateLimiter');

const router = express.Router();

router.get('/profile', authMiddleware, profileRateLimiter(), getTraderProfileSummary);
router.get('/metrics', authMiddleware, profileRateLimiter(), getTraderMetrics);
router.get('/activity', authMiddleware, profileRateLimiter(), getTraderActivity);
router.get('/strengths', authMiddleware, profileRateLimiter(), getTraderStrengths);

module.exports = router;

