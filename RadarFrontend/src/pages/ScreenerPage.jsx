import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter,
  Zap,
  AlertTriangle,
  RefreshCw,
  Download,
  BarChart3,
  Activity,
} from 'lucide-react';
import ScreenerFilterPanel from '../components/screener/ScreenerFilterPanel';
import ScreenerStockCard from '../components/screener/ScreenerStockCard';
import ScreenerResultsTable from '../components/screener/ScreenerResultsTable';
import './ScreenerPage.css';
import { runScreenerScan } from '../api/screenerApi';

const ScreenerPage = () => {
  const navigate = useNavigate();
  const SETTINGS_STORAGE_KEY = 'radar_screener_settings';
  const [filterOpen, setFilterOpen] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [filters, setFilters] = useState({
    search: '',
    sector: 'All',
    signals: [],
    minPriceChange: 0,
    maxPriceChange: null,
    minRsi: 0,
    maxRsi: 100,
    minPrice: '',
    maxPrice: '',
    minVolume: '',
    showOnlySignals: true,
    trendType: 'all', // 'bullish', 'bearish', 'neutral', 'all'
  });

  const [stocks, setStocks] = useState([]);
  const [filteredStocks, setFilteredStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [activeSignalTab, setActiveSignalTab] = useState('all');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [actionNotice, setActionNotice] = useState('');
  const contentRef = useRef(null);
  const noticeTimerRef = useRef(null);

  const MOCK_STOCKS = [
    {
      id: 1,
      symbol: 'INFY',
      name: 'Infosys',
      price: 1556.15,
      change: 2.21,
      changePercent: 2.21,
      volume: 8500000,
      sector: 'IT',
      signal: 'BREAKOUT',
      signalStrength: 'Strong',
      signalType: 'SMA, EMA, GO',
      rsi: 55,
      pe: 25.3,
      trend: 'bullish',
      sentiment: 65,
      strength: 'Confidence 85%',
      entry: 1548.2,
      target: 1602.6,
      stopLoss: 1528.9,
      rvol: 2.1,
      timeframe: '5m',
      chart: [1500, 1510, 1505, 1520, 1535, 1540, 1545, 1550, 1556],
    },
    {
      id: 2,
      symbol: 'HDFCBANK',
      name: 'HDFC Bank',
      price: 1689.20,
      change: 1.48,
      changePercent: 1.48,
      volume: 7600000,
      sector: 'Banking',
      signal: 'MOMENTUM',
      signalStrength: 'Strong',
      signalType: 'MACD bullish crossover',
      rsi: 65,
      pe: 22.1,
      trend: 'bullish',
      sentiment: 72,
      strength: 'Confidence 78%',
      entry: 1680.4,
      target: 1725.8,
      stopLoss: 1662.7,
      rvol: 1.8,
      timeframe: '5m',
      chart: [1650, 1660, 1670, 1675, 1680, 1685, 1687, 1689],
    },
    {
      id: 3,
      symbol: 'TCS',
      name: 'Tata Consultancy Services',
      price: 3627.55,
      change: 1.16,
      changePercent: 1.16,
      volume: 3100000,
      sector: 'IT',
      signal: 'MOMENTUM',
      signalStrength: 'Strong',
      signalType: 'Momentum building with MACD crossover',
      rsi: 68,
      pe: 28.5,
      trend: 'bullish',
      sentiment: 68,
      strength: 'Confidence 82%',
      entry: 3605.2,
      target: 3715.6,
      stopLoss: 3558.4,
      rvol: 1.6,
      timeframe: '1D',
      chart: [3500, 3520, 3540, 3580, 3600, 3615, 3620, 3628],
    },
    {
      id: 4,
      symbol: 'RELIANCE',
      name: 'Reliance Industries',
      price: 2845.00,
      change: 1.40,
      changePercent: 1.40,
      volume: 9900000,
      sector: 'Energy',
      signal: 'BREAKOUT',
      signalStrength: 'Strong',
      signalType: 'Range breakout, +2% volume',
      rsi: 58,
      pe: 20.2,
      trend: 'bullish',
      sentiment: 75,
      strength: 'Confidence 88%',
      entry: 2830.4,
      target: 2898.1,
      stopLoss: 2796.2,
      rvol: 2.3,
      timeframe: '5m',
      chart: [2800, 2810, 2820, 2830, 2835, 2840, 2843, 2845],
    },
    {
      id: 5,
      symbol: 'KOTANBANK',
      name: 'Kotak Mahindra Bank',
      price: 1850.50,
      change: -4.70,
      changePercent: -4.70,
      volume: 2200000,
      sector: 'Banking',
      signal: 'PULLBACK',
      signalStrength: 'Medium',
      signalType: 'Pullback rebounding with strong volume shock',
      rsi: 42,
      pe: 19.8,
      trend: 'bearish',
      sentiment: -35,
      strength: 'Confidence 64%',
      entry: 1862.2,
      target: 1910.4,
      stopLoss: 1822.6,
      rvol: 1.4,
      timeframe: '1D',
      chart: [1950, 1930, 1910, 1890, 1870, 1860, 1855, 1850],
    },
    {
      id: 6,
      symbol: 'SBIN',
      name: 'State Bank of India',
      price: 826.50,
      change: -1.55,
      changePercent: -1.55,
      volume: 11200000,
      sector: 'Banking',
      signal: 'MOMENTUM',
      signalStrength: 'Medium',
      signalType: 'MACD showing weakness',
      rsi: 35,
      pe: 18.4,
      trend: 'bearish',
      sentiment: -45,
      strength: 'Confidence 61%',
      entry: 832.6,
      target: 856.2,
      stopLoss: 812.4,
      rvol: 1.9,
      timeframe: '1D',
      chart: [840, 835, 833, 831, 830, 829, 828, 826],
    },
    {
      id: 7,
      symbol: 'BAJAJ AUTO',
      name: 'Bajaj Auto',
      price: 9250.75,
      change: 3.21,
      changePercent: 3.21,
      volume: 1800000,
      sector: 'Auto',
      signal: 'BREAKOUT',
      signalStrength: 'Strong',
      signalType: 'Range Breakout',
      rsi: 72,
      pe: 24.6,
      trend: 'bullish',
      sentiment: 82,
      strength: 'Confidence 91%',
      entry: 9202.4,
      target: 9495.8,
      stopLoss: 9068.3,
      rvol: 2.6,
      timeframe: '5m',
      chart: [8900, 8950, 9000, 9100, 9150, 9200, 9230, 9251],
    },
    {
      id: 8,
      symbol: 'ITC',
      name: 'ITC Limited',
      price: 468.25,
      change: 0.54,
      changePercent: 0.54,
      volume: 8400000,
      sector: 'FMCG',
      signal: 'MOMENTUM',
      signalStrength: 'Low',
      signalType: 'Consolidation zone',
      rsi: 48,
      pe: 21.3,
      trend: 'neutral',
      sentiment: 12,
      strength: 'Confidence 53%',
      entry: 465.8,
      target: 478.4,
      stopLoss: 458.3,
      rvol: 1.2,
      timeframe: '1D',
      chart: [460, 462, 464, 466, 467, 467, 468, 468],
    },
  ];

  // Live load on mount — replaces MOCK_STOCKS
  const fetchAndSet = useCallback(async () => {
    setLoading(true);
    try {
      const res = await runScreenerScan({ limit: 50 });
      // Backend wraps: { success, data: { results: [...] } }
      const inner = res?.data ?? res;
      const raw = inner?.results ?? inner?.stocks ?? (Array.isArray(inner) ? inner : []);
      
      const normalized = raw.map((s, i) => ({
        id: s._id || s.id || s.displaySymbol || s.symbol || i,
        symbol: String(s.displaySymbol || s.symbol || '').replace(/\.(NS|BO)$/i, ''),
        name: s.name || s.displaySymbol || s.symbol || '',
        price: Number(s.price ?? 0),
        change: Number(s.changePercent ?? s.change ?? 0),
        changePercent: Number(s.changePercent ?? s.change ?? 0),
        volume: Number(s.volume ?? 0),
        sector: s.sector || 'Equity',
        signal: s.signal || (Number(s.changePercent ?? s.change ?? 0) > 1.5
          ? 'BREAKOUT'
          : s.bias === 'bearish' ? 'PULLBACK' : 'MOMENTUM'),
        signalStrength: s.signalStrength || (Number(s.confidence ?? s.score ?? 70) > 80 ? 'Strong' : 'Medium'),
        signalType: s.signalType || s.why || '',
        rsi: Number(s.rsi ?? 50),
        pe: Number(s.pe ?? 0),
        trend: s.trend || s.bias || (Number(s.changePercent ?? s.change ?? 0) >= 0 ? 'bullish' : 'bearish'),
        sentiment: Number(s.sentiment ?? (Number(s.changePercent ?? s.change ?? 0) * 10)),
        strength: s.strength || `Confidence ${Number(s.confidence ?? s.score ?? 72)}%`,
        entry: Number(s.entry ?? s.price ?? 0),
        target: Number(s.target ?? (s.price ?? 0) * 1.04),
        stopLoss: Number(s.stopLoss ?? s.sl ?? (s.price ?? 0) * 0.985),
        rvol: Number(s.volumeRatio ?? s.rvol ?? 1.2),
        timeframe: s.timeframe || '1D',
        chart: s.chart || s.history || [],
      }));

      // If API returned stocks, use them — otherwise fall back to demo data
      if (normalized.length > 0) {
        setStocks(normalized);
        setFilteredStocks(normalized);
      } else {
        setStocks(MOCK_STOCKS);
        setFilteredStocks(MOCK_STOCKS);
      }
    } catch (err) {
      console.warn('ScreenerPage load failed, using demo data:', err.message);
      setStocks(MOCK_STOCKS);
      setFilteredStocks(MOCK_STOCKS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if (parsed.filters && typeof parsed.filters === 'object') setFilters((prev) => ({ ...prev, ...parsed.filters }));
          if (typeof parsed.activeSignalTab === 'string') setActiveSignalTab(parsed.activeSignalTab);
          if (typeof parsed.viewMode === 'string') setViewMode(parsed.viewMode);
          if (typeof parsed.filterOpen === 'boolean') setFilterOpen(parsed.filterOpen);
        }
      }
    } catch (error) {
      console.error('Failed to restore screener settings:', error);
    }
    fetchAndSet();
  }, [fetchAndSet]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let result = stocks;

    if (filters.search) {
      result = result.filter(
        (stock) =>
          stock.symbol.toLowerCase().includes(filters.search.toLowerCase()) ||
          stock.name.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.sector !== 'All') {
      result = result.filter((stock) => stock.sector === filters.sector);
    }

    if (filters.signals.length > 0) {
      result = result.filter((stock) => filters.signals.includes(stock.signal));
    }

    if (filters.minPriceChange !== null) {
      result = result.filter((stock) => stock.change >= filters.minPriceChange);
    }
    if (filters.maxPriceChange !== null) {
      result = result.filter((stock) => stock.change <= filters.maxPriceChange);
    }

    result = result.filter((stock) => stock.rsi >= filters.minRsi && stock.rsi <= filters.maxRsi);

    if (filters.minPrice) {
      result = result.filter((stock) => stock.price >= parseFloat(filters.minPrice));
    }
    if (filters.maxPrice) {
      result = result.filter((stock) => stock.price <= parseFloat(filters.maxPrice));
    }

    if (filters.minVolume) {
      result = result.filter((stock) => stock.volume >= parseFloat(filters.minVolume));
    }

    if (filters.trendType !== 'all') {
      result = result.filter((stock) => stock.trend === filters.trendType);
    }

    if (filters.showOnlySignals && activeSignalTab !== 'all') {
      result = result.filter((stock) => stock.signal.toLowerCase() === activeSignalTab.toLowerCase());
    }

    setFilteredStocks(result);
  }, [filters, stocks, activeSignalTab]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const pushNotice = (text) => {
    setActionNotice(text);
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = setTimeout(() => setActionNotice(''), 2400);
  };

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      await fetchAndSet();
      setLastUpdated(new Date());
      pushNotice('Scanner refreshed with live data.');
    } finally {
      setLoading(false);
    }
  }, [fetchAndSet]);

  const toggleStockSelection = (stockId) => {
    setSelectedStocks((prev) =>
      prev.includes(stockId) ? prev.filter((id) => id !== stockId) : [...prev, stockId]
    );
  };

  const openResearch = (symbol) => {
    navigate(`/stocks/${encodeURIComponent(symbol)}`);
  };

  const handleExport = () => {
    if (!filteredStocks.length) {
      pushNotice('No results to export.');
      return;
    }

    const data = filteredStocks
      .map((stock) => ({
        Symbol: stock.symbol,
        Name: stock.name,
        Price: stock.price,
        Change: stock.change,
        RSI: stock.rsi,
        Signal: stock.signal,
        Sector: stock.sector,
      }))
      .sort((a, b) => parseFloat(b.Change) - parseFloat(a.Change));

    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map((row) => Object.values(row).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screener-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    pushNotice('Excel export completed.');
  };

  const handlePublishSettings = () => {
    try {
      const payload = {
        filters,
        activeSignalTab,
        viewMode,
        filterOpen,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
      pushNotice('Settings published and saved.');
    } catch (error) {
      console.error('Failed to publish settings:', error);
      pushNotice('Unable to publish settings.');
    }
  };

  const SIGNAL_TABS = [
    { id: 'all', label: 'Market Opportunities', count: filteredStocks.length },
    { id: 'breakout', label: 'Breakout', count: filteredStocks.filter((s) => s.signal === 'BREAKOUT').length },
    { id: 'momentum', label: 'Momentum', count: filteredStocks.filter((s) => s.signal === 'MOMENTUM').length },
    { id: 'pullback', label: 'Pullback', count: filteredStocks.filter((s) => s.signal === 'PULLBACK').length },
  ];
  const scansActive = Math.max(12, filteredStocks.length * 8 + 2);

  const SECTOR_OPTIONS = ['All', ...new Set(stocks.map((s) => s.sector))];

  return (
    <div className="screener-page h-screen flex overflow-hidden">
      {}
      <AnimatePresence>
        {filterOpen && (
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-80 bg-slate-900/95 border-r border-slate-700 overflow-y-auto"
          >
            <ScreenerFilterPanel
              sectors={SECTOR_OPTIONS}
              filters={filters}
              onFilterChange={handleFilterChange}
              onActivateScan={handleRefresh}
              onClose={() => setFilterOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {}
      <div className="flex-1 flex flex-col overflow-hidden">
        {}
        <div className="h-20 border-b border-slate-700/50 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!filterOpen && (
              <button
                onClick={() => setFilterOpen(true)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Filter className="w-5 h-5 text-slate-300" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Zap className="w-6 h-6 text-cyan-400" />
                Screener Dashboard
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Discover actionable market opportunities with research-first scans.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={handleExport}
              className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Excel
            </button>

            <button
              onClick={handlePublishSettings}
              className="px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 rounded-lg transition-colors"
            >
              Publish Settings
            </button>

            <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-cyan-500/30 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 rounded transition-colors ${
                  viewMode === 'table'
                    ? 'bg-cyan-500/30 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Activity className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {}
        <div className="h-16 border-b border-slate-700/50 px-6 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-2 overflow-x-auto">
          {SIGNAL_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSignalTab(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-2 ${
                activeSignalTab === tab.id
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  activeSignalTab === tab.id ? 'bg-cyan-500/40' : 'bg-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-amber-300 whitespace-nowrap">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-semibold">{scansActive} Scans Active</span>
          </div>
        </div>

        {}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="mb-4"
                >
                  <Zap className="w-12 h-12 text-cyan-400" />
                </motion.div>
                <p className="text-slate-400">Scanning market universe...</p>
              </motion.div>
            ) : filteredStocks.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full"
              >
                <AlertTriangle className="w-12 h-12 text-slate-500 mb-4" />
                <p className="text-slate-400 text-lg">No stocks match your filters</p>
                <p className="text-slate-500 text-sm mt-2">Try adjusting your search criteria</p>
              </motion.div>
            ) : viewMode === 'grid' ? (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"
              >
                {filteredStocks.map((stock, index) => (
                  <ScreenerStockCard
                    key={stock.id}
                    stock={stock}
                    isSelected={selectedStocks.includes(stock.id)}
                    onSelect={() => toggleStockSelection(stock.id)}
                    onOpenResearch={openResearch}
                    index={index}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="table"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ScreenerResultsTable stocks={filteredStocks} onOpenResearch={openResearch} />
              </motion.div>
            )}
          </AnimatePresence>

          {}
          {!loading && filteredStocks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50"
            >
              <p className="text-sm text-slate-400">
                Showing <span className="text-cyan-300 font-semibold">{filteredStocks.length}</span> results
                {filters.search && ` for "${filters.search}"`}
              </p>
            </motion.div>
          )}

          {actionNotice && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100"
            >
              {actionNotice}
            </motion.div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span>Last Updated: {lastUpdated.toLocaleDateString()} {lastUpdated.toLocaleTimeString()}</span>
            <span>Data provided by Market Terminal 2.0.4 | prices delayed by 16 seconds</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenerPage;
