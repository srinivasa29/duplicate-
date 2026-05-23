import api from './api';

const stripStockSuffix = (value) => String(value || '').replace(/\.(NS|BO)$/i, '');

const sanitizeMarketRow = (row) => {
    if (!row || typeof row !== 'object') {
        return row;
    }

    const isStock = String(row.type || '').toUpperCase() === 'STOCK';
    if (!isStock) {
        return row;
    }

    return {
        ...row,
        symbol: stripStockSuffix(row.symbol),
        id: stripStockSuffix(row.id),
    };
};

export const fetchSectorPerformance = async (period = '1y') => {
    try {
        const response = await api.get(`/market/sector-performance?period=${period}`);
        return response.data;
    } catch (error) {
        console.warn('Sector performance unavailable, using UI fallback themes:', error?.message || error);
        return {
            success: false,
            period,
            data: [],
        };
    }
};

export const fetchMarketData = async (params = {}) => {
    try {
        const response = await api.get('/market', { params });
        const payload = response.data?.data ?? response.data;
        const results = Array.isArray(payload) ? payload.map(sanitizeMarketRow) : [];
        
        // Cache successful results for offline/instant reload
        if (results.length > 0 && !params.symbol) {
            localStorage.setItem(`radar_market_cache_${params.type || 'ALL'}`, JSON.stringify(results));
        }
        
        return results;
    } catch (error) {
        console.error("Error fetching market data:", error);
        
        // Fallback to cache if available
        const cached = localStorage.getItem(`radar_market_cache_${params.type || 'ALL'}`);
        if (cached && !params.symbol) {
            console.log("Using cached market data fallback");
            return JSON.parse(cached);
        }
        
        throw error;
    }
};

export const fetchMarketHistory = async (symbol, type = 'STOCK', interval = '1D', options = {}) => {
    try {
        const { strictLive = false } = options;
        const params = { symbol, type, interval };
        if (strictLive) {
            params.strictLive = true;
        }

        const response = await api.get('/market/history', {
            params
        });

        const payload = response.data?.data ?? response.data;
        const prices = Array.isArray(payload?.prices)
            ? payload.prices
            : Array.isArray(payload)
                ? payload
                : [];

        const normalized = prices
            .map((point, index, array) => {
                const close = Number(point?.close ?? point?.price ?? point?.value ?? 0);
                if (!Number.isFinite(close) || close <= 0) {
                    return null;
                }

                const prevPoint = array[Math.max(0, index - 1)] || point;
                const prevClose = Number(prevPoint?.close ?? prevPoint?.price ?? close);
                const open = Number(point?.open ?? prevClose ?? close);
                const high = Number(point?.high ?? Math.max(open, close));
                const low = Number(point?.low ?? Math.min(open, close));
                const timestamp = point?.timestamp ?? point?.time ?? point?.date ?? new Date().toISOString();

                return {
                    timestamp,
                    open: Number.isFinite(open) ? open : close,
                    high: Number.isFinite(high) ? high : close,
                    low: Number.isFinite(low) ? low : close,
                    close,
                };
            })
            .filter(Boolean);

        return {
            data: normalized,
            indicators: payload?.indicators ?? null,
        };
    } catch (error) {
        console.error("Error fetching market history:", error);
        throw error;
    }
};

export const fetchMarketNews = async (params = {}) => {
    try {
        const response = await api.get('/news', { params });
        const data = response.data?.data ?? response.data;
        if (data && data.length > 0) {
            localStorage.setItem('radar_news_cache', JSON.stringify(data));
        }
        return data;
    } catch (error) {
        console.warn("Intelligent news API failed, falling back to basic news:", error.message);
        try {
            const response = await api.get('/market/news', { params });
            const data = response.data;
            if (data && data.length > 0) {
                localStorage.setItem('radar_news_cache', JSON.stringify(data));
            }
            return data;
        } catch (fallbackError) {
            console.error("All news fetch attempts failed:", fallbackError);
            
            // Final fallback to cache
            const cached = localStorage.getItem('radar_news_cache');
            if (cached) {
                console.log("Using cached news fallback");
                return JSON.parse(cached);
            }
            
            throw fallbackError;
        }
    }
};

export const fetchNewsInsight = async (title, summary) => {
    try {
        const response = await api.post('/market/news/insight', { title, summary });
        return response.data;
    } catch (error) {
        console.error("Failed to fetch news insight:", error.message);
        throw error;
    }
};

export const fetchTrendingSearches = async () => {
    try {
        const response = await api.get('/market/search/trending');
        const payload = response.data?.trending ?? response.data?.data ?? [];
        return Array.isArray(payload) ? payload.map(stripStockSuffix) : [];
    } catch (error) {
        console.error('Error fetching trending searches:', error);
        return [];
    }
};

export const fetchUniversalSymbolSearch = async (query, limit = 8) => {
    try {
        const q = String(query || '').trim();
        if (!q) {
            return [];
        }

        const response = await api.get('/market/search', {
            params: { q, limit },
        });

        const payload = response.data?.data ?? [];
        if (!Array.isArray(payload)) {
            return [];
        }

        return payload.map((item) => ({
            ...item,
            symbol: stripStockSuffix(item?.symbol),
        }));
    } catch (error) {
        console.error('Error searching universal symbols:', error);
        return [];
    }
};

export const logSearchQuery = async (query) => {
    try {
        await api.post('/market/search/log', { query });
    } catch (error) {
        console.error('Error logging search query:', error);
    }
};
