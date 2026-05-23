const express = require('express');
const router = express.Router();
const { getMarketNews } = require('../controllers/newsController');

// GET /api/news  — primary news endpoint called by frontend
// Supports query params: category, symbol, limit, region (india|global)
router.get('/', getMarketNews);

module.exports = router;
