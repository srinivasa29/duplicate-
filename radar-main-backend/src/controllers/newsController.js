const { fetchMarketNews } = require('../services/newsService');
const logger = require('../utils/logger');

const getMarketNews = async (req, res) => {
    try {
        const symbol = String(req.query.symbol || '').trim();
        const limit = Number.parseInt(req.query.limit || '15', 10);

        // Accept region from frontend: 'india' → IN, 'global' → GLOBAL
        const regionRaw = String(req.query.region || '').toLowerCase().trim();
        const region = regionRaw === 'global' ? 'GLOBAL' : (regionRaw === 'india' ? 'IN' : null);

        // Accept assetClass from frontend: 'crypto' → crypto news, 'stocks' → business/equity news
        const assetClass = String(req.query.assetClass || '').toLowerCase().trim();
        let category;
        if (assetClass === 'crypto') {
            category = 'crypto';                  // Finnhub crypto feed
        } else if (req.query.category && req.query.category !== 'all') {
            category = String(req.query.category); // explicit category override
        } else {
            category = 'business';                // default: equity/business news
        }

        const news = await fetchMarketNews(category, {
            symbol: symbol || undefined,
            limit: Number.isFinite(limit) ? limit : 6,
            region,    // null = use server env default
            assetClass,
        });
        res.json(news);

    } catch (error) {
        logger.error('Market news fetch failed', {
            error: error.message,
            code: error.code,
        });
        res.status(500).json({ error: "Failed to fetch news" });
    }
};

module.exports = { getMarketNews };
