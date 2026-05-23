import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Settings, Maximize2, Minimize2,
  Layout as LayoutIcon, ArrowLeftRight, Star, Newspaper,
  Bell, Edit3, BarChart2, X, Calendar,
} from 'lucide-react';

// Context
import { ChartProvider, useChartContext } from '../context/ChartContext';

// Chart components
import ChartWorkspace from '../components/investor/charts/ChartWorkspace';
import IndicatorDropdown from '../components/investor/charts/IndicatorDropdown';
import LayoutPicker from '../components/investor/charts/LayoutPicker';
import CompareModal from '../components/investor/charts/CompareModal';
import SettingsDrawer from '../components/investor/charts/SettingsDrawer';
import {
  NewsDrawer, FundamentalsDrawer, AlertsDrawer, NotesDrawer, WatchlistDrawer,
} from '../components/investor/charts/SidebarDrawers';
import BottomAnalyticalPanel from '../components/investor/charts/BottomAnalyticalPanel';
import useStockDetails from '../hooks/useStockDetails';

import './InvestorDashboard.css';

// ── Timeframes ─────────────────────────────────────────────────────────────────
const HISTORY_RANGES = [
  '1D',
  '5D',
  '1M',
  '3M',
  '6M',
  '1Y',
  '5Y',
  'ALL'
];

const INTERVALS = [
  '1m',
  '5m',
  '15m',
  '1h',
  '1d',
  '1wk',
  '1mo'
];

// ── Custom Date Picker Modal ──────────────────────────────────────────────────
const DateRangeModal = ({ onApply, onClose, isDark }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const base = isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-900';
  const inp = `w-full rounded-xl border px-3 py-2 text-sm outline-none transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
    }`;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-80 rounded-2xl border shadow-2xl p-6 ${base}`}>
        <h3 className="text-sm font-black mb-4">Custom Date Range</h3>
        <div className="space-y-3">
          <div>
            <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inp} />
          </div>
          <div>
            <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inp} />
          </div>
          <button
            onClick={() => { if (from && to) { onApply(from, to); onClose(); } }}
            disabled={!from || !to}
            className="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-black transition-all"
          >
            Apply Range
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Inner Component (uses context) ────────────────────────────────────────
const AdvancedChartsInner = ({ initialSymbol }) => {
  const navigate = useNavigate();
  const {
    settings, setSettings,
    layout, panels, activePanelId, setActivePanelId,
    applyLayout, updatePanel, updateActivePanel, getActivePanel,
    LAYOUT_CONFIGS,
    activeDrawer, toggleDrawer,
    crosshairSync, setCrosshairSync,
    rangeSync, setRangeSync,
  } = useChartContext();

  const [activeRange, setActiveRange] = useState('1Y');

  const [activeInterval, setActiveInterval] = useState('1d');
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showLayoutPicker, setShowLayoutPicker] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMarketOpen, setIsMarketOpen] = useState(false);

  useEffect(() => {
    const checkMarket = () => {
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const day = now.getDay();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      const isWeekend = day === 0 || day === 6;
      const timeInMinutes = hours * 60 + minutes;
      const isOpen = !isWeekend && timeInMinutes >= (9 * 60 + 15) && timeInMinutes < (15 * 60 + 30);
      setIsMarketOpen(isOpen);
    };
    checkMarket();
    const interval = setInterval(checkMarket, 60000);
    return () => clearInterval(interval);
  }, []);

  const isDark = false; // Workstation UI stays light as per request
  const activePanel = getActivePanel();
  
  // Track the actively selected chart's symbol to fetch corresponding analytical data
  const currentSymbol = activePanel?.symbol || initialSymbol || 'RELIANCE';
  const stockDetails = useStockDetails(currentSymbol);

  // ── Timeframe change ─────────────────────────────────────────────────────────
  const handleRange = (range, from = null, to = null) => {
    let newInterval = activeInterval;

    // Intelligent auto-adjust interval based on range selection to prevent API data limits
    if (range === '1D') newInterval = '1m';
    else if (range === '5D') newInterval = '5m';
    else if (range === '1M') newInterval = '1h';
    else if (range === '3M' || range === '6M' || range === '1Y') newInterval = '1d';
    else if (range === '5Y' || range === 'ALL') newInterval = '1wk';

    setActiveRange(range);
    setActiveInterval(newInterval);
    setCustomFrom(from);
    setCustomTo(to);

    if (settings.syncTimeframe) {
      const updated = panels.map(p => ({
        ...p,
        historyRange: range,
        interval: newInterval,
        customFrom: from,
        customTo: to
      }));

      updated.forEach(p =>
        updatePanel(p.id, {
          historyRange: range,
          interval: newInterval,
          customFrom: from,
          customTo: to
        })
      );
    } else {
      updateActivePanel({
        historyRange: range,
        interval: newInterval,
        customFrom: from,
        customTo: to
      });
    }
  };
  const handleInterval = (interval) => {
    let newRange = activeRange;

    // Auto-adjust range to valid boundaries for short intervals to avoid empty/clamped data
    if (interval === '1m' && !['1D', '5D'].includes(activeRange)) newRange = '1D';
    else if (['5m', '15m'].includes(interval) && !['1D', '5D', '1M'].includes(activeRange)) newRange = '5D';
    else if (interval === '1h' && !['1D', '5D', '1M', '3M', '6M'].includes(activeRange)) newRange = '1M';

    setActiveInterval(interval);
    if (newRange !== activeRange) {
        setActiveRange(newRange);
    }

    if (settings.syncTimeframe) {
      const updated = panels.map(p => ({
        ...p,
        interval,
        historyRange: newRange
      }));

      updated.forEach(p =>
        updatePanel(p.id, {
          interval,
          historyRange: newRange
        })
      );
    } else {
      updateActivePanel({
        interval,
        historyRange: newRange
      });
    }
  };

  // ── Crosshair / Range sync ────────────────────────────────────────────────────
  const handleCrosshairMove = useCallback((panelId, param) => {
    if (settings.syncCrosshair && panelId === activePanelId) {
      setCrosshairSync({ time: param.time, price: param.point?.y });
    }
  }, [settings.syncCrosshair, activePanelId, setCrosshairSync]);

  const handleRangeChange = useCallback((panelId, range) => {
    if (settings.syncZoom && panelId === activePanelId) {
      setRangeSync(range);
    }
  }, [settings.syncZoom, activePanelId, setRangeSync]);

  // ── Compare ───────────────────────────────────────────────────────────────────
  const handleCompare = (symbols) => {
    const count = Math.min(symbols.length, 8);
    const layoutKey = count === 1 ? 'single' : count === 2 ? 'vsplit' : count <= 4 ? '4grid' : '6grid';
    applyLayout(layoutKey, symbols);
  };

  // ── Fullscreen ────────────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // ── Sidebar drawer ─────────────────────────────────────────────────────────────
  const DRAWER_ITEMS = [
    { id: 'watchlist', icon: Star, label: 'Watchlist' },
    { id: 'compare', icon: ArrowLeftRight, label: 'Compare' },
    { id: 'news', icon: Newspaper, label: 'News' },
    { id: 'alerts', icon: Bell, label: 'Alerts' },
    { id: 'notes', icon: Edit3, label: 'Notes' },
  ];

  const DRAWER_CONTENT = {
    watchlist: <WatchlistDrawer symbol={activePanel?.symbol || 'RELIANCE'} isDark={isDark} />,
    news: <NewsDrawer symbol={activePanel?.symbol || 'RELIANCE'} isDark={isDark} />,
    alerts: <AlertsDrawer symbol={activePanel?.symbol || 'RELIANCE'} isDark={isDark} />,
    notes: <NotesDrawer symbol={activePanel?.symbol || 'RELIANCE'} isDark={isDark} />,
  };

  // ── Theme classes ──────────────────────────────────────────────────────────────
  const bg = isDark ? 'bg-[#0b1120]' : 'bg-[#f1f5f9]';
  const header = isDark ? 'bg-slate-900/95 border-slate-700/60' : 'bg-white border-slate-200/80';
  const drawer = isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200/80';
  const sidebar = isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200/80';

  return (
    <div className={`h-screen w-screen flex flex-col font-sans overflow-hidden ${bg} transition-colors duration-300`}>

      {/* ── TOP COMMAND BAR ─────────────────────────────────────────────────── */}
      {/* ── TOP COMMAND BAR ─────────────────────────────────────────────────── */}
      <header className={`flex items-center gap-3 px-4 py-2 m-2 rounded-[16px] shadow-sm z-[100] border ${header}`}>

        {/* Back + Logo */}
        <button
          onClick={() => navigate(-1)}
          className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2 shrink-0 mr-2">
          <img src="/radar-logo-final.jpg" alt="Radar" className="w-7 h-7 rounded-lg object-cover" />
          <span className="text-sm font-black tracking-tight" style={{ color: '#3E84F6' }}>RADAR</span>
        </div>
        <div className={`w-px h-5 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

        {/* Active symbol badge */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white font-black text-xs shadow-lg overflow-hidden shrink-0 relative">
            <img 
              src={`https://assets-netstorage.groww.in/stock-assets/logos/NSE_${activePanel?.symbol || 'RELIANCE'}.png`}
              alt={activePanel?.symbol || 'RELIANCE'}
              className="w-full h-full object-contain bg-white"
              data-fallback-index="0"
              onError={(e) => {
                const symbol = activePanel?.symbol || 'RELIANCE';
                const fallbacks = [
                  `https://s3-symbol-logo.tradingview.com/${symbol.toLowerCase()}--big.svg`,
                  `https://s3-symbol-logo.tradingview.com/${symbol.toLowerCase()}-ltd--big.svg`,
                  `https://s3-symbol-logo.tradingview.com/${symbol.toLowerCase()}-company--big.svg`,
                  `https://logo.clearbit.com/${symbol.toLowerCase()}.com`,
                  `https://logo.clearbit.com/${symbol.toLowerCase()}.co.in`
                ];
                let index = parseInt(e.target.getAttribute('data-fallback-index') || '0', 10);
                if (index < fallbacks.length) {
                  e.target.src = fallbacks[index];
                  e.target.setAttribute('data-fallback-index', index + 1);
                } else {
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) {
                    e.target.nextSibling.style.display = 'flex';
                  }
                }
              }}
            />
            <div className="absolute inset-0 items-center justify-center hidden w-full h-full bg-gradient-to-br from-blue-600 to-blue-400">
              {activePanel?.symbol?.[0] || 'R'}
            </div>
          </div>
          <div>
            <p className={`text-xs font-black leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {activePanel?.symbol || 'RELIANCE'}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className={`text-[8px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {isMarketOpen ? 'Live' : 'Closed'}
              </span>
            </div>
          </div>
        </div>
        <div className={`w-px h-5 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

        {/* Timeframe buttons */}
        <div className="flex items-center gap-4">

          {/* INTERVAL */}

          <div className={`flex items-center gap-1 rounded-xl p-1 ${isDark ? 'bg-slate-800' : 'bg-slate-100'
            }`}>

            <span className={`px-2 text-[10px] font-black opacity-60 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              INTERVAL
            </span>

            {INTERVALS.map(interval => (

              <button
                key={interval}
                onClick={() => handleInterval(interval)}
                className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${(activePanel?.interval || activeInterval) === interval
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-slate-700'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white'
                  }`}
              >
                {interval}
              </button>

            ))}

          </div>

          {/* HISTORY */}

          <div className={`flex items-center gap-1 rounded-xl p-1 ${isDark ? 'bg-slate-800' : 'bg-slate-100'
            }`}>

            <span className={`px-2 text-[10px] font-black opacity-60 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              HISTORY
            </span>

            {HISTORY_RANGES.map(range => (

              <button
                key={range}
                onClick={() => handleRange(range)}
                className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${(activePanel?.historyRange || activeRange) === range && !customFrom
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-slate-700'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white'
                  }`}
              >
                {range}
              </button>

            ))}

            {/* CUSTOM RANGE */}

            <button
              onClick={() => setShowDatePicker(true)}
              className={`p-1.5 rounded-lg transition-all ${customFrom
                ? 'bg-blue-600 text-white'
                : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-700'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white'
                }`}
            >
              <Calendar size={13} />
            </button>

          </div>

        </div>
        <div className={`w-px h-5 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

        {/* Chart type + Indicators */}
        <IndicatorDropdown
          indicators={activePanel?.indicators || {}}
          onToggle={(id) => updateActivePanel({
            indicators: { ...activePanel.indicators, [id]: !activePanel.indicators[id] },
          })}
          chartType={activePanel?.chartType || 'candlestick'}
          onChartTypeChange={(type) => updateActivePanel({ chartType: type })}
          isDark={isDark}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Layout picker */}
        <div className="relative">
          <button
            onClick={() => setShowLayoutPicker(o => !o)}
            className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <LayoutIcon size={18} />
          </button>
          <LayoutPicker
            isOpen={showLayoutPicker}
            onClose={() => setShowLayoutPicker(false)}
            currentLayout={layout}
            onSelect={(l) => applyLayout(l)}
            isDark={isDark}
          />
        </div>

        {/* Settings */}
        <div className="relative">
          <button
            onClick={() => setShowSettings(o => !o)}
            className={`p-2 rounded-xl transition-all ${showSettings ? 'bg-blue-600 text-white' : isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <Settings size={18} />
          </button>
          <SettingsDrawer
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            settings={settings}
            setSettings={setSettings}
          />
        </div>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'}`}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </header>

      {/* ── MAIN BODY ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ── Left icon sidebar ────────────────────────────────────────────── */}
        <aside className={`w-20 flex flex-col items-center py-4 gap-4 shrink-0 m-2 rounded-[16px] z-[50] border ${isDark ? 'shadow-[0_10px_30px_rgba(0,0,0,0.5)]' : 'shadow-[0_10px_30px_rgba(0,0,0,0.1)]'
          } ${sidebar}`}>
          {DRAWER_ITEMS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              title={label}
              onClick={() => {
                if (id === 'compare') { setShowCompare(true); return; }
                toggleDrawer(id);
              }}
              className={`relative group flex flex-col items-center gap-1 p-3 rounded-xl transition-all w-12 ${activeDrawer === id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200/40'
                : isDark
                  ? 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
            >
              <Icon size={18} className="shrink-0" />
              <span className="text-[7px] font-black uppercase tracking-tight leading-none">{label.split(' ')[0]}</span>

              {/* Tooltip */}
              <div className={`absolute left-full ml-2 px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-all z-50 shadow-lg ${isDark ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-slate-900 text-white'
                }`}>
                {label}
              </div>
            </button>
          ))}
        </aside>

        {/* Left drawer (slides in) */}
        {activeDrawer && activeDrawer !== 'compare' && (
          <aside className={`w-80 border-r flex flex-col shrink-0 ${drawer}`} style={{ transition: 'width 0.2s' }}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
              <p className={`text-sm font-black capitalize ${isDark ? 'text-white' : 'text-slate-900'}`}>{activeDrawer}</p>
              <button onClick={() => toggleDrawer(null)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
                <X size={16} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
              {DRAWER_CONTENT[activeDrawer]}
            </div>
          </aside>
        )}

        {/* ── Chart workspace ──────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto custom-scrollbar">
          <div className="h-[70vh] shrink-0 p-2">
            <ChartWorkspace
              interval={activeInterval}
              historyRange={activeRange}
              layout={layout}
              panels={panels}
              activePanelId={activePanelId}
              onSelectPanel={setActivePanelId}
              settings={settings}
              crosshairSync={crosshairSync}
              onCrosshairMove={handleCrosshairMove}
              rangeSync={rangeSync}
              onRangeChange={handleRangeChange}
              customFrom={customFrom}
              customTo={customTo}
            />
          </div>

          {/* ── Bottom panel (Fundamentals/Overview/Signals) ──────────────────────── */}
          <div className={`flex-1 border-t ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
            <BottomAnalyticalPanel symbol={activePanel?.symbol || 'RELIANCE'} isDark={isDark} stockDetails={stockDetails} />
          </div>
        </main>


      </div>

      {/* ── Bottom panel (Fundamentals/Overview/Signals) ──────────────────────── */}

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}
      {showDatePicker && (
        <DateRangeModal
          isDark={isDark}
          onClose={() => setShowDatePicker(false)}
          onApply={(from, to) => {
            handleRange('CUSTOM', from, to);
          }}
        />
      )}

      {showCompare && (
        <CompareModal
          currentSymbol={activePanel?.symbol || 'RELIANCE'}
          isDark={isDark}
          onClose={() => setShowCompare(false)}
          onCompare={handleCompare}
        />
      )}
    </div>
  );
};

// ── Page export wrapped in Provider ───────────────────────────────────────────
const InvestorAdvancedCharts = () => {
  const [searchParams] = useSearchParams();
  const symbol = searchParams.get('symbol') || 'RELIANCE';

  return (
    <ChartProvider initialSymbol={symbol}>
      <AdvancedChartsInner initialSymbol={symbol} />
    </ChartProvider>
  );
};


export default InvestorAdvancedCharts;
