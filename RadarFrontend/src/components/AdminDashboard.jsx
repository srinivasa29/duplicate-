import { useState } from 'react';
import { useSystemStatus, useProviderHealth } from '../hooks/useAdminStatus';
import { useQuoteStats, useRateLimits } from '../hooks/useRealtimeQuote';
import {
    triggerManualUpdate,
    startUpdateCron,
    stopUpdateCron,
    startSmartRefresh,
    stopSmartRefresh,
    clearCache,
    warmCache,
    forceOnline,
} from '../api/adminApi';


const AdminDashboard = () => {
    const {
        autoUpdate,
        smartRefresh,
        cache,
        offline,
        overallHealth,
        allSystemsOperational,
    } = useSystemStatus(10000); // 10s refresh

    const { health: providerHealth, loading: providerLoading } = useProviderHealth(15000); // 15s refresh

    const { stats: quoteStats } = useQuoteStats(30000); // 30s refresh
    const { limits: rateLimits } = useRateLimits(60000); // 60s refresh

    const [actionLoading, setActionLoading] = useState(false);
    const [actionMessage, setActionMessage] = useState('');

    const handleTriggerUpdate = async () => {
        setActionLoading(true);
        try {
            const result = await triggerManualUpdate();
            setActionMessage(`âœ… Update triggered: ${result.message}`);
        } catch (error) {
            setActionMessage(`âŒ Error: ${error.message}`);
        }
        setActionLoading(false);
    };

    const handleStartCron = async () => {
        setActionLoading(true);
        try {
            const result = await startUpdateCron();
            setActionMessage(`âœ… ${result.message}`);
            autoUpdate.refetch();
        } catch (error) {
            setActionMessage(`âŒ Error: ${error.message}`);
        }
        setActionLoading(false);
    };

    const handleStopCron = async () => {
        setActionLoading(true);
        try {
            const result = await stopUpdateCron();
            setActionMessage(`âœ… ${result.message}`);
            autoUpdate.refetch();
        } catch (error) {
            setActionMessage(`âŒ Error: ${error.message}`);
        }
        setActionLoading(false);
    };

    const handleStartRefresh = async () => {
        setActionLoading(true);
        try {
            const result = await startSmartRefresh();
            setActionMessage(`âœ… ${result.message}`);
            smartRefresh.refetch();
        } catch (error) {
            setActionMessage(`âŒ Error: ${error.message}`);
        }
        setActionLoading(false);
    };

    const handleStopRefresh = async () => {
        setActionLoading(true);
        try {
            const result = await stopSmartRefresh();
            setActionMessage(`âœ… ${result.message}`);
            smartRefresh.refetch();
        } catch (error) {
            setActionMessage(`âŒ Error: ${error.message}`);
        }
        setActionLoading(false);
    };

    const handleClearCache = async () => {
        setActionLoading(true);
        try {
            const result = await clearCache();
            setActionMessage(`âœ… ${result.message}`);
            cache.refetch();
        } catch (error) {
            setActionMessage(`âŒ Error: ${error.message}`);
        }
        setActionLoading(false);
    };

    const handleWarmCache = async () => {
        setActionLoading(true);
        try {
            const result = await warmCache();
            setActionMessage(`âœ… Cache warmed: ${result.warmed} symbols`);
            cache.refetch();
        } catch (error) {
            setActionMessage(`âŒ Error: ${error.message}`);
        }
        setActionLoading(false);
    };

    const handleForceOnline = async () => {
        setActionLoading(true);
        try {
            const result = await forceOnline();
            setActionMessage(`âœ… ${result.message}`);
            offline.refetch();
        } catch (error) {
            setActionMessage(`âŒ Error: ${error.message}`);
        }
        setActionLoading(false);
    };

    const healthColors = {
        healthy: 'bg-green-500',
        degraded: 'bg-yellow-500',
        critical: 'bg-red-500',
        loading: 'bg-gray-400',
        unknown: 'bg-gray-300',
        error: 'bg-red-600',
    };

    const healthLabels = {
        healthy: 'âœ… All Systems Operational',
        degraded: 'âš ï¸ Degraded Performance',
        critical: 'ðŸš¨ Critical Issues',
        loading: 'â³ Loading...',
        unknown: 'â“ Unknown',
        error: 'âŒ System Error',
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-gray-600">Phase 2 System Monitoring & Control</p>
            </div>

            {}
            <div className={`mb-6 p-6 rounded-lg ${healthColors[overallHealth]} text-white`}>
                <h2 className="text-2xl font-bold mb-2">{healthLabels[overallHealth]}</h2>
                <p className="text-sm opacity-90">
                    {allSystemsOperational
                        ? 'All systems are running smoothly'
                        : 'Some systems require attention'}
                </p>
            </div>

            {}
            {actionMessage && (
                <div className="mb-6 p-4 bg-blue-100 border border-blue-300 rounded-lg">
                    <p className="text-blue-900">{actionMessage}</p>
                    <button
                        onClick={() => setActionMessage('')}
                        className="text-blue-600 text-sm underline mt-2"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-bold mb-4 flex items-center">
                        <span className={`w-3 h-3 rounded-full mr-2 ${autoUpdate.isRunning ? 'bg-green-500' : 'bg-red-500'}`} />
                        Auto-Update System
                    </h3>
                    {autoUpdate.loading ? (
                        <p>Loading...</p>
                    ) : (
                        <>
                            <div className="space-y-2 mb-4">
                                <p><strong>Status:</strong> {autoUpdate.isRunning ? 'ðŸŸ¢ Running' : 'ðŸ”´ Stopped'}</p>
                                <p><strong>Market:</strong> {autoUpdate.isMarketOpen ? 'ðŸŸ¢ Open' : 'ðŸ”´ Closed'}</p>
                                <p><strong>Last Update:</strong> {autoUpdate.lastUpdate || 'Never'}</p>
                                <p><strong>Success Rate:</strong> {autoUpdate.stats?.successRate?.toFixed(1) || 0}%</p>
                                <p><strong>Total Updates:</strong> {autoUpdate.stats?.totalUpdates || 0}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleTriggerUpdate}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                                >
                                    Trigger Update
                                </button>
                                {autoUpdate.isRunning ? (
                                    <button
                                        onClick={handleStopCron}
                                        disabled={actionLoading}
                                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                                    >
                                        Stop Cron
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleStartCron}
                                        disabled={actionLoading}
                                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                                    >
                                        Start Cron
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-bold mb-4 flex items-center">
                        <span className={`w-3 h-3 rounded-full mr-2 ${smartRefresh.isRunning ? 'bg-green-500' : 'bg-red-500'}`} />
                        Smart Refresh Tiers
                    </h3>
                    {smartRefresh.loading ? (
                        <p>Loading...</p>
                    ) : (
                        <>
                            <div className="space-y-2 mb-4">
                                <p><strong>Status:</strong> {smartRefresh.isRunning ? 'ðŸŸ¢ Running' : 'ðŸ”´ Stopped'}</p>
                                <div className="mt-3">
                                    <p className="font-semibold">Tier Symbols:</p>
                                    <p className="text-sm">Tier 1 (1-min): {smartRefresh.tiers?.tier1?.length || 0} symbols</p>
                                    <p className="text-sm">Tier 2 (5-min): {smartRefresh.tiers?.tier2?.length || 0} symbols</p>
                                    <p className="text-sm">Tier 3 (15-min): {smartRefresh.tiers?.tier3?.length || 0} symbols</p>
                                </div>
                                {smartRefresh.stats && (
                                    <p><strong>Success Rate:</strong> {smartRefresh.stats.successRate?.toFixed(1) || 0}%</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {smartRefresh.isRunning ? (
                                    <button
                                        onClick={handleStopRefresh}
                                        disabled={actionLoading}
                                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                                    >
                                        Stop Refresh
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleStartRefresh}
                                        disabled={actionLoading}
                                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                                    >
                                        Start Refresh
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-bold mb-4">ðŸ“¦ Cache Performance</h3>
                    {cache.loading ? (
                        <p>Loading...</p>
                    ) : (
                        <>
                            <div className="space-y-2 mb-4">
                                <p><strong>Hit Rate:</strong> {(cache.hitRate * 100).toFixed(1)}%</p>
                                <p><strong>Total Keys:</strong> {cache.totalKeys}</p>
                                {cache.stats?.tiers && (
                                    <>
                                        <p className="text-sm mt-2">Quotes: {cache.stats.tiers.quotes?.hits || 0} hits / {cache.stats.tiers.quotes?.misses || 0} misses</p>
                                        <p className="text-sm">OHLC: {cache.stats.tiers.ohlc?.hits || 0} hits / {cache.stats.tiers.ohlc?.misses || 0} misses</p>
                                        <p className="text-sm">Company: {cache.stats.tiers.company?.hits || 0} hits / {cache.stats.tiers.company?.misses || 0} misses</p>
                                    </>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleWarmCache}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                                >
                                    Warm Cache
                                </button>
                                <button
                                    onClick={handleClearCache}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                                >
                                    Clear Cache
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-bold mb-4 flex items-center">
                        <span className={`w-3 h-3 rounded-full mr-2 ${offline.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                        Offline Mode Status
                    </h3>
                    {offline.loading ? (
                        <p>Loading...</p>
                    ) : (
                        <>
                            <div className="space-y-2 mb-4">
                                <p><strong>Status:</strong> {offline.isOnline ? 'ðŸŸ¢ Online' : 'ðŸ”´ Offline'}</p>
                                <p><strong>Failure Count:</strong> {offline.failureCount}</p>
                                <p><strong>Last Failure:</strong> {offline.lastFailure || 'None'}</p>
                                {!offline.isOnline && (
                                    <p className="text-red-600 font-semibold">
                                        âš ï¸ System in offline mode - using cached data
                                    </p>
                                )}
                            </div>
                            {!offline.isOnline && (
                                <button
                                    onClick={handleForceOnline}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                                >
                                    Force Online
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Price Provider Health */}
                <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
                    <h3 className="text-xl font-bold mb-4 flex items-center">
                        <span className={`w-3 h-3 rounded-full mr-2 ${providerHealth?.overallHealth === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        Price Provider Waterfall Status
                    </h3>
                    {providerLoading ? (
                        <p>Loading...</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {providerHealth?.providers?.map((provider) => (
                                <div key={provider.name} className="border p-4 rounded">
                                    <h4 className="font-semibold mb-2 capitalize flex items-center">
                                        <span className={`w-2 h-2 rounded-full mr-2 ${provider.healthy ? 'bg-green-500' : 'bg-red-500'}`} />
                                        {provider.name}
                                    </h4>
                                    <p className="text-sm">Status: {provider.healthy ? '✅ Healthy' : '❌ Cooldown'}</p>
                                    <p className="text-sm">Requests: {provider.requests}</p>
                                    <p className="text-sm">Success Rate: {provider.successRate}%</p>
                                    <p className="text-sm">Avg Response: {provider.avgResponseTime}ms</p>
                                    <p className="text-sm">Last Used: {provider.lastUsed ? new Date(provider.lastUsed).toLocaleTimeString() : 'Never'}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Real-Time API Usage */}
                <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
                    {!quoteStats ? (
                        <p>Loading...</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {}
                            <div className="border p-4 rounded">
                                <h4 className="font-semibold mb-2">Finnhub (US Stocks)</h4>
                                <p className="text-sm">Calls: {quoteStats.finnhub?.calls || 0}</p>
                                <p className="text-sm">Success: {quoteStats.finnhub?.success || 0}</p>
                                <p className="text-sm">Failed: {quoteStats.finnhub?.failed || 0}</p>
                                <p className="text-sm">Limit: {rateLimits?.finnhub?.remaining || 0} / {rateLimits?.finnhub?.limit || 60} per min</p>
                            </div>

                            {}
                            <div className="border p-4 rounded">
                                <h4 className="font-semibold mb-2">Twelve Data (Indian Stocks)</h4>
                                <p className="text-sm">Calls: {quoteStats.twelveData?.calls || 0}</p>
                                <p className="text-sm">Success: {quoteStats.twelveData?.success || 0}</p>
                                <p className="text-sm">Failed: {quoteStats.twelveData?.failed || 0}</p>
                                <p className="text-sm">Limit: {rateLimits?.twelveData?.remaining || 0} / 800 per day</p>
                            </div>

                            {}
                            <div className="border p-4 rounded">
                                <h4 className="font-semibold mb-2">Yahoo Finance (Fallback)</h4>
                                <p className="text-sm">Calls: {quoteStats.yahoo?.calls || 0}</p>
                                <p className="text-sm">Success: {quoteStats.yahoo?.success || 0}</p>
                                <p className="text-sm">Failed: {quoteStats.yahoo?.failed || 0}</p>
                                <p className="text-sm">Limit: Unlimited â™¾ï¸</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
