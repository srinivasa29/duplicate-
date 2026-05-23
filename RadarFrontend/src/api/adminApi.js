import api from './api';





export const fetchMarketStatus = async () => {
    try {
        const response = await api.get('/admin/updates/market-status');
        return response.data;
    } catch (error) {
        console.error('Error fetching market status:', error);
        return null;
    }
};


export const fetchUpdateStatus = async () => {
    try {
        const response = await api.get('/admin/updates/update-status');
        return response.data;
    } catch (error) {
        console.error('Error fetching update status:', error);
        return null;
    }
};


export const fetchUpdateStats = async () => {
    try {
        const response = await api.get('/admin/updates/update-stats');
        return response.data;
    } catch (error) {
        console.error('Error fetching update stats:', error);
        return null;
    }
};


export const triggerManualUpdate = async () => {
    try {
        const response = await api.post('/admin/updates/trigger-update');
        return response.data;
    } catch (error) {
        console.error('Error triggering update:', error);
        throw error;
    }
};


export const updateSymbol = async (symbol) => {
    try {
        const response = await api.post('/admin/updates/update-symbol', { symbol });
        return response.data;
    } catch (error) {
        console.error(`Error updating symbol ${symbol}:`, error);
        throw error;
    }
};


export const startUpdateCron = async () => {
    try {
        const response = await api.post('/admin/updates/start-cron');
        return response.data;
    } catch (error) {
        console.error('Error starting cron:', error);
        throw error;
    }
};


export const stopUpdateCron = async () => {
    try {
        const response = await api.post('/admin/updates/stop-cron');
        return response.data;
    } catch (error) {
        console.error('Error stopping cron:', error);
        throw error;
    }
};


export const resetUpdateStats = async () => {
    try {
        const response = await api.post('/admin/updates/reset-stats');
        return response.data;
    } catch (error) {
        console.error('Error resetting stats:', error);
        throw error;
    }
};



export const fetchRefreshStatus = async () => {
    try {
        const response = await api.get('/admin/refresh/status');
        return response.data;
    } catch (error) {
        console.error('Error fetching refresh status:', error);
        return null;
    }
};


export const fetchRefreshStats = async () => {
    try {
        const response = await api.get('/admin/refresh/stats');
        return response.data;
    } catch (error) {
        console.error('Error fetching refresh stats:', error);
        return null;
    }
};


export const startSmartRefresh = async () => {
    try {
        const response = await api.post('/admin/refresh/start');
        return response.data;
    } catch (error) {
        console.error('Error starting refresh:', error);
        throw error;
    }
};


export const stopSmartRefresh = async () => {
    try {
        const response = await api.post('/admin/refresh/stop');
        return response.data;
    } catch (error) {
        console.error('Error stopping refresh:', error);
        throw error;
    }
};


export const addSymbolToTier = async (symbol, tier) => {
    try {
        const response = await api.post('/admin/refresh/add-symbol', { symbol, tier });
        return response.data;
    } catch (error) {
        console.error(`Error adding ${symbol} to tier ${tier}:`, error);
        throw error;
    }
};


export const addSymbolsToTier = async (symbols, tier) => {
    try {
        const response = await api.post('/admin/refresh/add-symbols', { symbols, tier });
        return response.data;
    } catch (error) {
        console.error(`Error adding symbols to tier ${tier}:`, error);
        throw error;
    }
};


export const removeSymbolFromTier = async (symbol) => {
    try {
        const response = await api.post('/admin/refresh/remove-symbol', { symbol });
        return response.data;
    } catch (error) {
        console.error(`Error removing ${symbol}:`, error);
        throw error;
    }
};


export const getSymbolTier = async (symbol) => {
    try {
        const response = await api.get(`/admin/refresh/symbol/${symbol}`);
        return response.data;
    } catch (error) {
        console.error(`Error checking tier for ${symbol}:`, error);
        return null;
    }
};



export const fetchCacheStats = async () => {
    try {
        const response = await api.get('/admin/cache/stats');
        return response.data;
    } catch (error) {
        console.error('Error fetching cache stats:', error);
        return null;
    }
};


export const fetchCacheKeys = async (type) => {
    try {
        const response = await api.get(`/admin/cache/keys/${type}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${type} cache keys:`, error);
        return null;
    }
};


export const clearCache = async () => {
    try {
        const response = await api.post('/admin/cache/clear');
        return response.data;
    } catch (error) {
        console.error('Error clearing cache:', error);
        throw error;
    }
};


export const warmCache = async (symbols = null) => {
    try {
        const body = symbols ? { symbols } : {};
        const response = await api.post('/admin/cache/warm', body);
        return response.data;
    } catch (error) {
        console.error('Error warming cache:', error);
        throw error;
    }
};


export const resetCacheStats = async () => {
    try {
        const response = await api.post('/admin/cache/reset-stats');
        return response.data;
    } catch (error) {
        console.error('Error resetting cache stats:', error);
        throw error;
    }
};


export const fetchOfflineStatus = async () => {
    try {
        const response = await api.get('/admin/offline/status');
        return response.data;
    } catch (error) {
        console.error('Error fetching offline status:', error);
        return null;
    }
};


export const forceOnline = async () => {
    try {
        const response = await api.post('/admin/offline/force-online');
        return response.data;
    } catch (error) {
        console.error('Error forcing online:', error);
        throw error;
    }
};


export const forceOffline = async () => {
    try {
        const response = await api.post('/admin/offline/force-offline');
        return response.data;
    } catch (error) {
        console.error('Error forcing offline:', error);
        throw error;
    }
};

export const getProviderHealth = async () => {
    try {
        const response = await api.get('/market/health');
        return response.data;
    } catch (error) {
        console.error('Error fetching provider health:', error);
        throw error;
    }
};

export default {
    fetchMarketStatus,
    fetchUpdateStatus,
    fetchUpdateStats,
    triggerManualUpdate,
    updateSymbol,
    startUpdateCron,
    stopUpdateCron,
    resetUpdateStats,
    
    fetchRefreshStatus,
    fetchRefreshStats,
    startSmartRefresh,
    stopSmartRefresh,
    addSymbolToTier,
    addSymbolsToTier,
    removeSymbolFromTier,
    getSymbolTier,
    
    fetchCacheStats,
    fetchCacheKeys,
    clearCache,
    warmCache,
    resetCacheStats,
    fetchOfflineStatus,
    forceOnline,
    forceOffline,
};
