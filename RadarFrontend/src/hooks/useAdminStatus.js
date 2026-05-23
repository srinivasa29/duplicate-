import { useMemo, useState, useEffect, useCallback } from 'react';
import {
    fetchMarketStatus,
    fetchUpdateStatus,
    fetchUpdateStats,
    fetchRefreshStatus,
    fetchRefreshStats,
    fetchCacheStats,
    fetchOfflineStatus,
    getProviderHealth,
} from '../api/adminApi';

export const useProviderHealth = (refreshInterval = 15000) => {
    const [health, setHealth] = useState({ providers: [], overallHealth: 'unknown' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchHealth = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getProviderHealth();
            setHealth(data);
        } catch (err) {
            setError(err.message || 'Failed to fetch provider health');
            setHealth({ providers: [], overallHealth: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHealth();
        if (refreshInterval && refreshInterval > 0) {
            const intervalId = setInterval(fetchHealth, refreshInterval);
            return () => clearInterval(intervalId);
        }
    }, [refreshInterval, fetchHealth]);

    return { health, loading, error, refetch: fetchHealth };
};

export const useAutoUpdateStatus = (refreshInterval = 10000) => {
    const [status, setStatus] = useState(null);
    const [stats, setStats] = useState(null);
    const [marketStatus, setMarketStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const [statusData, statsData, marketData] = await Promise.all([
                fetchUpdateStatus(),
                fetchUpdateStats(),
                fetchMarketStatus(),
            ]);

            setStatus(statusData);
            setStats(statsData);
            setMarketStatus(marketData);
        } catch (err) {
            setError(err.message || 'Failed to fetch update status');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        if (refreshInterval && refreshInterval > 0) {
            const intervalId = setInterval(fetchData, refreshInterval);
            return () => clearInterval(intervalId);
        }
    }, [refreshInterval, fetchData]);

    return {
        status,
        stats,
        marketStatus,
        loading,
        error,
        refetch: fetchData,
        isRunning: status?.cronRunning || false,
        isMarketOpen: marketStatus?.isOpen || false,
        lastUpdate: status?.lastUpdate || null,
    };
};


export const useSmartRefreshStatus = (refreshInterval = 15000) => {
    const [status, setStatus] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const [statusData, statsData] = await Promise.all([
                fetchRefreshStatus(),
                fetchRefreshStats(),
            ]);

            setStatus(statusData);
            setStats(statsData);
        } catch (err) {
            setError(err.message || 'Failed to fetch refresh status');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        if (refreshInterval && refreshInterval > 0) {
            const intervalId = setInterval(fetchData, refreshInterval);
            return () => clearInterval(intervalId);
        }
    }, [refreshInterval, fetchData]);

    return {
        status,
        stats,
        loading,
        error,
        refetch: fetchData,
        isRunning: status?.running || false,
        tiers: status?.tiers || {},
    };
};


export const useCacheStatus = (refreshInterval = 10000) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const statsData = await fetchCacheStats();
            setStats(statsData);
        } catch (err) {
            setError(err.message || 'Failed to fetch cache stats');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        if (refreshInterval && refreshInterval > 0) {
            const intervalId = setInterval(fetchData, refreshInterval);
            return () => clearInterval(intervalId);
        }
    }, [refreshInterval, fetchData]);

    return {
        stats,
        loading,
        error,
        refetch: fetchData,
        hitRate: stats?.overall?.hitRate || 0,
        totalKeys: stats?.overall?.totalKeys || 0,
    };
};


export const useOfflineStatus = (refreshInterval = 5000) => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const statusData = await fetchOfflineStatus();
            setStatus(statusData);
        } catch (err) {
            setError(err.message || 'Failed to fetch offline status');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        if (refreshInterval && refreshInterval > 0) {
            const intervalId = setInterval(fetchData, refreshInterval);
            return () => clearInterval(intervalId);
        }
    }, [refreshInterval, fetchData]);

    return {
        status,
        loading,
        error,
        refetch: fetchData,
        isOnline: status?.isOnline || false,
        failureCount: status?.consecutiveFailures || 0,
        lastFailure: status?.lastFailure || null,
    };
};


export const useSystemStatus = (refreshInterval = 15000) => {
    const autoUpdate = useAutoUpdateStatus(refreshInterval);
    const smartRefresh = useSmartRefreshStatus(refreshInterval);
    const cache = useCacheStatus(refreshInterval);
    const offline = useOfflineStatus(5000); // More frequent for offline checks

    const overallHealth = useMemo(() => {
        if (autoUpdate.loading || smartRefresh.loading || cache.loading || offline.loading) {
            return 'loading';
        }

        if (autoUpdate.error || smartRefresh.error || cache.error || offline.error) {
            return 'error';
        }

        const criticalSystemsUp = 
            offline.isOnline &&
            autoUpdate.isRunning &&
            smartRefresh.isRunning;

        if (criticalSystemsUp) {
            const cacheHealthy = cache.hitRate >= 0.7; // 70% threshold
            return cacheHealthy ? 'healthy' : 'degraded';
        }

        return 'critical';
    }, [
        autoUpdate.loading, autoUpdate.error, autoUpdate.isRunning,
        smartRefresh.loading, smartRefresh.error, smartRefresh.isRunning,
        cache.loading, cache.error, cache.hitRate,
        offline.loading, offline.error, offline.isOnline,
    ]);

    return {
        autoUpdate,
        smartRefresh,
        cache,
        offline,
        overallHealth,
        allSystemsOperational: overallHealth === 'healthy',
        hasErrors: autoUpdate.error || smartRefresh.error || cache.error || offline.error,
    };
};

export default {
    useAutoUpdateStatus,
    useSmartRefreshStatus,
    useCacheStatus,
    useOfflineStatus,
    useSystemStatus,
};
