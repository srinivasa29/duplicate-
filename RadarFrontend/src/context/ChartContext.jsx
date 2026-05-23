import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import api from '../api/api';

const ChartContext = createContext(null);

export const useChartContext = () => {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error('useChartContext must be inside ChartProvider');
  return ctx;
};

const DEFAULT_SETTINGS = {
  theme: 'light',
  showVolume: true,
  showGrid: true,
  showCrosshair: true,
  syncCrosshair: false,
  syncTimeframe: false,
  syncSymbol: false,
  syncZoom: false,
  autoRefresh: false,
  refreshInterval: '30s',
  defaultExchange: 'NSE',
  timezone: 'Asia/Kolkata',
  precision: '2',
  chartType: 'candlestick',
  indicators: {
    sma: false, ema: false, bb: false, vwap: false,
    rsi: false, macd: false, stoch: false, obv: false, atr: false,
  },
};

const LAYOUT_CONFIGS = {
  single:  { cols: 1, rows: 1, count: 1 },
  vsplit:  { cols: 2, rows: 1, count: 2 },
  hsplit:  { cols: 1, rows: 2, count: 2 },
  '2x2':   { cols: 2, rows: 2, count: 4 },
  '3grid': { cols: 3, rows: 1, count: 3 },
  '4grid': { cols: 2, rows: 2, count: 4 },
  '6grid': { cols: 3, rows: 2, count: 6 },
  '8grid': { cols: 4, rows: 2, count: 8 },
};

const makePanel = (id, symbol, overrides = {}) => ({
  id,
  symbol,
  timeframe: '1Y',
  chartType: 'candlestick',
  indicators: {
    sma: false, ema: false, bb: false, vwap: false,
    rsi: false, macd: false, stoch: false, obv: false, atr: false,
  },
  showVolume: true,
  ...overrides,
});

export const ChartProvider = ({ children, initialSymbol = 'RELIANCE' }) => {
  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS);
  
  useEffect(() => {
    api.get('/auth/me')
      .then(res => {
        if (res.data?.success && res.data?.data?.settings) {
          setSettingsState(prev => ({ ...prev, ...res.data.data.settings }));
        }
      })
      .catch(err => console.error("Failed to load settings", err));
  }, []);

  const setSettings = useCallback((newSettings) => {
    setSettingsState(prev => {
      const updated = typeof newSettings === 'function' ? newSettings(prev) : { ...prev, ...newSettings };
      api.put('/user/settings', updated).catch(err => console.error("Failed to save settings:", err));
      return updated;
    });
  }, []);

  const [layout, setLayout] = useState('single');
  const [panels, setPanels] = useState([makePanel(0, initialSymbol)]);
  const [activePanelId, setActivePanelId] = useState(0);
  const [crosshairSync, setCrosshairSync] = useState(null);
  const [rangeSync, setRangeSync] = useState(null);
  const [activeDrawer, setActiveDrawer] = useState(null); // 'watchlist'|'news'|'alerts'|'notes'|'fundamentals'
  const [compareSymbols, setCompareSymbols] = useState([]);
  const dataCache = useRef({});

  const applyLayout = useCallback((layoutKey, symbols = []) => {
    const config = LAYOUT_CONFIGS[layoutKey] || LAYOUT_CONFIGS.single;
    const baseSymbol = panels[0]?.symbol || initialSymbol;
    const newPanels = Array.from({ length: config.count }, (_, i) => {
      const existing = panels[i];
      const overrides = {};
      if (existing) {
        if (existing.timeframe) overrides.timeframe = existing.timeframe;
        if (existing.chartType) overrides.chartType = existing.chartType;
        if (existing.indicators) overrides.indicators = { ...existing.indicators };
      }
      return makePanel(i, symbols[i] || existing?.symbol || baseSymbol, overrides);
    });
    setLayout(layoutKey);
    setPanels(newPanels);
    setActivePanelId(0);
  }, [panels, initialSymbol]);

  const updatePanel = useCallback((id, updates) => {
    setPanels(prev => prev.map(p => {
      if (p.id !== id) return p;
      return { ...p, ...updates };
    }));
  }, []);

  const updateActivePanel = useCallback((updates) => {
    updatePanel(activePanelId, updates);
    // sync if enabled
    if (updates.timeframe && settings.syncTimeframe) {
      setPanels(prev => prev.map(p => ({ ...p, timeframe: updates.timeframe })));
    }
  }, [activePanelId, settings.syncTimeframe, updatePanel]);

  const toggleDrawer = useCallback((drawer) => {
    setActiveDrawer(prev => prev === drawer ? null : drawer);
  }, []);

  const getActivePanel = useCallback(() => {
    return panels.find(p => p.id === activePanelId) || panels[0];
  }, [panels, activePanelId]);

  const getCacheKey = (symbol, timeframe) => `${symbol}__${timeframe}`;
  const setCache = (symbol, timeframe, data) => {
    dataCache.current[getCacheKey(symbol, timeframe)] = data;
  };
  const getCache = (symbol, timeframe) => {
    return dataCache.current[getCacheKey(symbol, timeframe)] || null;
  };

  return (
    <ChartContext.Provider value={{
      // Settings
      settings, setSettings,
      // Layout
      layout, panels, activePanelId, setActivePanelId,
      applyLayout, updatePanel, updateActivePanel, getActivePanel,
      LAYOUT_CONFIGS,
      // Drawer
      activeDrawer, toggleDrawer, setActiveDrawer,
      // Compare
      compareSymbols, setCompareSymbols,
      // Sync
      crosshairSync, setCrosshairSync,
      rangeSync, setRangeSync,
      // Cache
      setCache, getCache,
    }}>
      {children}
    </ChartContext.Provider>
  );
};

export default ChartContext;
