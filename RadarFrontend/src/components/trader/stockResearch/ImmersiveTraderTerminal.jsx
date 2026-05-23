import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  BarChart2, 
  ArrowLeft,
  Settings,
  Shield,
  Zap,
  Plus,
  Search,
  X,
  Pencil,
  Ruler,
  Eraser,
  Layers,
  MousePointer2,
  Moon,
  Sun,
  Layout,
  Clock,
  Maximize2,
  Eye,
  BookOpen,
  Briefcase,
  TrendingUp,
  Square,
  Bell,
  Type,
  Smile,
  Magnet,
  Lock,
  EyeOff,
  Trash2,
  Brush,
  Maximize,
  Newspaper,
  Calendar,
  Flame,
  ArrowUpRight,
  Minus,
  GripVertical
} from 'lucide-react';
import { createChart, ColorType, AreaSeries, CandlestickSeries, LineSeries, CrosshairMode } from 'lightweight-charts';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchOHLCData } from '../../../api/ohlcApi';
import { fetchMarketData, fetchMarketNews } from '../../../api/marketApi';

// ── Configuration ──
const TF_CONFIG = {
  '10m': { stepSec: 600, points: 600, label: '10 minutes' },
  '15m': { stepSec: 900, points: 600, label: '15 minutes' },
  '30m': { stepSec: 1800, points: 600, label: '30 minutes' },
  '1H': { stepSec: 3600, points: 600, label: '1 hour' },
  '4H': { stepSec: 14400, points: 600, label: '4 hours' },
  '1D': { stepSec: 86400, points: 600, label: '1 day' },
  '1W': { stepSec: 604800, points: 600, label: '1 week' },
};

const buildOhlcv = async (symbol, timeframe) => {
  try {
    const config = TF_CONFIG[timeframe] || TF_CONFIG['10m'];
    const limit = config.points || 600;
    
    const response = await fetchOHLCData(symbol, {
      timeframe: timeframe.includes('m') ? timeframe : timeframe === '1D' ? '1d' : timeframe === '1W' ? '1wk' : '1mo',
      limit
    });

    if (!response.data || response.data.length === 0) {
      return [];
    }

    return response.data.map(d => ({
      time: d.timestamp / 1000,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      value: d.close
    })).sort((a, b) => a.time - b.time);
  } catch (error) {
    console.error('Error building OHLCV:', error);
    return [];
  }
};

const buildHeikinAshi = (data) => {
  const ha = [];
  let prevOpen = data[0].open;
  let prevClose = data[0].close;
  data.forEach((d) => {
    const close = (d.open + d.high + d.low + d.close) / 4;
    const open = (prevOpen + prevClose) / 2;
    ha.push({ time: d.time, open, high: Math.max(d.high, open, close), low: Math.min(d.low, open, close), close });
    prevOpen = open; prevClose = close;
  });
  return ha;
};

// ── Shared UI Components ──
const Dropdown = ({ label, icon: Icon, children, isOpen, onToggle, align = "left", badge = false }) => (
  <div className="relative">
    <button 
      onClick={onToggle}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all relative ${isOpen ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
    >
      {Icon && <Icon size={16} />}
      {badge && <div className="absolute top-2 right-3 w-1.5 h-1.5 bg-rose-500 rounded-full border border-[#020617] shadow-[0_0_8px_rgba(244,63,94,0.6)]" />}
      {label && <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>}
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className={`absolute top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'} bg-[#111827] border border-white/10 rounded-3xl p-5 z-[200] shadow-2xl backdrop-blur-3xl`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const GlassPanel = ({ children, className = "" }) => (
  <div className={`bg-black/30 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-2xl ${className}`}>
    {children}
  </div>
);

// ── Chart Pane Component ──
const ChartPane = ({ symbol, timeframe, chartType, indicators, basePrice, activeTool, drawingsHidden, isMaster = false, onTimeRangeChange, onQuoteUpdate }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const [currentQuote, setCurrentQuote] = useState({ o: basePrice, h: basePrice, l: basePrice, c: basePrice });
  const [isCrypto, setIsCrypto] = useState(false);

  useEffect(() => {
    const knownCryptos = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOGE', 'DOT', 'BNB', 'MATIC', 'AVAX', 'LINK', 'LTC'];
    const bareSymbol = symbol.replace(/\.(NS|BO)$/i, '').replace(/-USD$/i, '');
    setIsCrypto(knownCryptos.includes(bareSymbol.toUpperCase()));
    
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: 'rgba(255,255,255,0.4)', fontSize: 10 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.01)' }, horzLines: { color: 'rgba(255,255,255,0.01)' } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { borderVisible: false, timeVisible: true },
      handleScroll: activeTool === 'cursor',
      handleScale: activeTool === 'cursor',
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight
    });

    let series;
    if (chartType === 'candles' || chartType === 'heikin') {
      series = chart.addSeries(CandlestickSeries, { upColor: '#10b981', downColor: '#f43f5e', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#f43f5e' });
    } else if (chartType === 'hollow') {
      series = chart.addSeries(CandlestickSeries, { upColor: 'transparent', downColor: '#f43f5e', borderUpColor: '#10b981', borderDownColor: '#f43f5e', wickUpColor: '#10b981', wickDownColor: '#f43f5e' });
    } else if (chartType === 'area') {
      series = chart.addSeries(AreaSeries, { lineColor: '#06b6d4', topColor: 'rgba(6, 182, 212, 0.2)', bottomColor: 'rgba(6, 182, 212, 0.01)', lineWidth: 3 });
    } else {
      series = chart.addSeries(LineSeries, { color: '#06b6d4', lineWidth: 3 });
    }
    mainSeriesRef.current = series;

    const loadData = async () => {
      const rawData = await buildOhlcv(symbol, timeframe);
      if (rawData.length === 0) return;

      const last = rawData[rawData.length - 1];
      if (last) {
        setCurrentQuote({ o: last.open, h: last.high, l: last.low, c: last.close });
        if (onQuoteUpdate && isMaster) {
            const prev = rawData[rawData.length - 2];
            const changePercent = prev ? ((last.close / prev.close) - 1) * 100 : 0;
            onQuoteUpdate({ price: last.close, changePercent });
        }
      }

      const lineData = rawData.map(({ time, close }) => ({ time, value: close }));
      const chartData =
        chartType === 'heikin'
          ? buildHeikinAshi(rawData)
          : chartType === 'area' || chartType === 'line'
            ? lineData
            : rawData;
      series.setData(chartData);
      chart.timeScale().fitContent();

      if (indicators.ema) {
        const emaSeries = chart.addSeries(LineSeries, { color: '#fbbf24', lineWidth: 1.5, title: 'EMA 20' });
        const emaData = rawData.map((d, i) => {
          const period = 20;
          if (i < period) return { time: d.time, value: d.close };
          const prevValue = rawData[i-1].close;
          const val = (d.close - prevValue) * (2 / (period + 1)) + prevValue;
          return { time: d.time, value: val };
        });
        emaSeries.setData(emaData);
      }

      if (indicators.vwap) {
        const vwapSeries = chart.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1.5, title: 'VWAP', lineStyle: 2 });
        // VWAP should ideally come from backend, using EMA-style fallback for now instead of random
        vwapSeries.setData(lineData);
      }

      indicators.compare?.forEach(async (s) => {
        const COMP_COLORS = ['#fbbf24', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
        const color = COMP_COLORS[indicators.compare.indexOf(s) % COMP_COLORS.length];
        const comp = chart.addSeries(LineSeries, { color, lineWidth: 2, title: s });
        const compData = await buildOhlcv(s, timeframe);
        if (compData.length > 0) {
          comp.setData(compData.map(d => ({ time: d.time, value: d.value })));
        }
      });
    };

    loadData();

    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
        chart.timeScale().setVisibleLogicalRange({
          from: 0,
          to: Math.max(chartData.length - 1, 1),
        });
        chart.timeScale().fitContent();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
  }, [symbol, timeframe, chartType, basePrice, indicators, activeTool]);

  const [drawings, setDrawings] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLine, setCurrentLine] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editPoint, setEditPoint] = useState(null); // 'p1' or 'p2' or index
  const [undoStack, setUndoStack] = useState([]);

  const handleMouseDown = (e) => {
    const chart = chartRef.current;
    if (!chart) return;
    const timeScale = chart.timeScale();
    const ser = mainSeriesRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = timeScale.coordinateToTime(x);
    const price = ser?.coordinateToPrice(y);

    if (!time || price === null) return;

    // ── Selection & Editing Logic ──
    if (activeTool === 'cursor') {
      const hitRadius = 15;
      const hit = screenDrawings.find(d => {
        if (d.type === 'brush') return false;
        const d1 = Math.sqrt((x - d.x1)**2 + (y - d.y1)**2);
        const d2 = Math.sqrt((x - d.x2)**2 + (y - d.y2)**2);
        return d1 < hitRadius || d2 < hitRadius;
      });

      if (hit) {
        setSelectedId(hit.id);
        const d1 = Math.sqrt((x - hit.x1)**2 + (y - hit.y1)**2);
        if (d1 < hitRadius) { setEditPoint('p1'); setIsEditing(true); }
        else { setEditPoint('p2'); setIsEditing(true); }
        return;
      }
      setSelectedId(null);
      return;
    }

    if (activeTool === 'eraser') return;

    setUndoStack([...undoStack, drawings]);
    setIsDrawing(true);
    const newId = Date.now();
    if (['trend', 'rect', 'horz', 'vert', 'ray', 'fib'].includes(activeTool)) {
      setCurrentLine({ id: newId, type: activeTool, t1: time, p1: price, t2: time, p2: price });
    } else if (activeTool === 'brush') {
      setDrawings([...drawings, { id: newId, type: 'brush', points: [{ t: time, p: price }], color: '#06b6d4' }]);
    }
  };

  const handleMouseMove = (e) => {
    const chart = chartRef.current;
    if (!chart) return;
    const timeScale = chart.timeScale();
    const ser = mainSeriesRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = timeScale.coordinateToTime(x);
    const price = ser?.coordinateToPrice(y);
    if (!time || price === null) return;

    if (isEditing && selectedId) {
      setDrawings(prev => prev.map(d => {
        if (d.id !== selectedId) return d;
        if (editPoint === 'p1') return { ...d, t1: time, p1: price };
        if (editPoint === 'p2') return { ...d, t2: time, p2: price };
        return d;
      }));
    } else if (isDrawing) {
      if (currentLine) {
        setCurrentLine({ ...currentLine, t2: time, p2: price });
      } else if (activeTool === 'brush') {
        const last = drawings[drawings.length - 1];
        const updatedLast = { ...last, points: [...last.points, { t: time, p: price }] };
        setDrawings([...drawings.slice(0, -1), updatedLast]);
      }
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && currentLine) {
      setDrawings([...drawings, { ...currentLine, color: '#06b6d4' }]);
      setCurrentLine(null);
    }
    setIsDrawing(false);
    setIsEditing(false);
    setEditPoint(null);
  };

  const clearDrawings = () => {
    setUndoStack([...undoStack, drawings]);
    setDrawings([]);
  };

  useEffect(() => {
    if (activeTool === 'eraser') {
      clearDrawings();
      setTimeout(() => setActiveTool('cursor'), 50);
    }
  }, [activeTool]);

  // ── Sync Drawings to Screen ──
  const [screenDrawings, setScreenDrawings] = useState([]);
  const [screenCurrentLine, setScreenCurrentLine] = useState(null);

  useEffect(() => {
    const sync = () => {
      if (!chartRef.current) return;
      const chart = chartRef.current;
      const ts = chart.timeScale();
      const ser = mainSeriesRef.current;
      if (!ser) return;

      const mapped = drawings.map(d => {
        if (['trend', 'rect', 'horz', 'vert', 'ray', 'fib'].includes(d.type)) {
          return { ...d, x1: ts.timeToCoordinate(d.t1), y1: ser.priceToCoordinate(d.p1), x2: ts.timeToCoordinate(d.t2), y2: ser.priceToCoordinate(d.p2) };
        } else {
          return { ...d, points: d.points.map(p => ({ x: ts.timeToCoordinate(p.t), y: ser.priceToCoordinate(p.p) })) };
        }
      });
      setScreenDrawings(mapped);

      if (currentLine) {
        setScreenCurrentLine({
          x1: ts.timeToCoordinate(currentLine.t1), y1: ser.priceToCoordinate(currentLine.p1),
          x2: ts.timeToCoordinate(currentLine.t2), y2: ser.priceToCoordinate(currentLine.p2)
        });
      } else {
        setScreenCurrentLine(null);
      }
    };

    const chart = chartRef.current;
    if (chart) {
      const ts = chart.timeScale();
      ts.subscribeVisibleLogicalRangeChange(sync);
      sync();
      return () => ts.unsubscribeVisibleLogicalRangeChange(sync);
    }
  }, [drawings, currentLine, chartRef.current]);

  useEffect(() => {
    if (activeTool === 'eraser') {
      setDrawings([]);
    }
  }, [activeTool]);

  return (
    <div className="w-full h-full relative group">
      <div ref={containerRef} className="w-full h-full" />
      <svg 
        className={`absolute inset-0 z-50 transition-opacity ${drawingsHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'} ${activeTool !== 'cursor' && activeTool !== 'eraser' ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <g 
          className="w-full h-full cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <rect width="100%" height="100%" fill="transparent" className="pointer-events-auto" />
          {screenDrawings.map((d, i) => (
            <g key={d.id || i} className={selectedId === d.id ? 'opacity-100' : 'opacity-80'}>
              {d.type === 'trend' && (
                <g>
                  <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke={d.color} strokeWidth="1.5" className="drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
                  <circle cx={d.x1} cy={d.y1} r="3" fill="#06b6d4" stroke="#020617" strokeWidth="1" />
                  <circle cx={d.x2} cy={d.y2} r="3" fill="#06b6d4" stroke="#020617" strokeWidth="1" />
                </g>
              )}
              {d.type === 'fib' && (
                <g>
                  <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="#06b6d4" strokeWidth="0.5" strokeDasharray="4" />
                  {[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map(lvl => {
                    const py = d.y1 + (d.y2 - d.y1) * lvl;
                    const price = d.p1 + (d.p2 - d.p1) * lvl;
                    return (
                      <g key={lvl}>
                        <line x1="0" y1={py} x2="100%" y2={py} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                        <text x="10" y={py - 4} fill="rgba(255,255,255,0.4)" fontSize="8" fontWeight="bold">{lvl.toFixed(3)} ({price.toFixed(2)})</text>
                      </g>
                    );
                  })}
                  <circle cx={d.x1} cy={d.y1} r="3" fill="#06b6d4" />
                  <circle cx={d.x2} cy={d.y2} r="3" fill="#06b6d4" />
                </g>
              )}
              {d.type === 'rect' && (
                <g>
                  <rect x={Math.min(d.x1, d.x2)} y={Math.min(d.y1, d.y2)} width={Math.abs(d.x2 - d.x1)} height={Math.abs(d.y2 - d.y1)} fill="rgba(6,182,212,0.05)" stroke={d.color} strokeWidth="1.5" className="drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
                  <rect x={d.x1-2.5} y={d.y1-2.5} width="5" height="5" fill="#06b6d4" />
                  <rect x={d.x2-2.5} y={d.y2-2.5} width="5" height="5" fill="#06b6d4" />
                </g>
              )}
              {d.type === 'horz' && (
                <g>
                  <line x1="0" y1={d.y1} x2="100%" y2={d.y1} stroke={d.color} strokeWidth="1.5" />
                  <text x="10" y={d.y1 - 6} fill={d.color} fontSize="9" fontWeight="black">{d.p1.toFixed(2)}</text>
                </g>
              )}
              {d.type === 'vert' && (
                <g>
                  <line x1={d.x1} y1="0" x2={d.x1} y2="100%" stroke={d.color} strokeWidth="1.5" />
                </g>
              )}
              {d.type === 'brush' && (
                <polyline points={d.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={d.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </g>
          ))}
          {screenCurrentLine && (
            <g>
              {activeTool === 'fib' ? (
                <g>
                   <line x1={screenCurrentLine.x1} y1={screenCurrentLine.y1} x2={screenCurrentLine.x2} y2={screenCurrentLine.y2} stroke="#06b6d4" strokeWidth="1" strokeDasharray="4" />
                   {[0, 0.5, 1].map(lvl => {
                     const py = screenCurrentLine.y1 + (screenCurrentLine.y2 - screenCurrentLine.y1) * lvl;
                     return <line key={lvl} x1="0" y1={py} x2="100%" y2={py} stroke="rgba(6,182,212,0.3)" strokeWidth="1" />;
                   })}
                </g>
              ) : activeTool === 'rect' ? (
                <rect x={Math.min(screenCurrentLine.x1, screenCurrentLine.x2)} y={Math.min(screenCurrentLine.y1, screenCurrentLine.y2)} width={Math.abs(screenCurrentLine.x2 - screenCurrentLine.x1)} height={Math.abs(screenCurrentLine.y2 - screenCurrentLine.y1)} fill="rgba(6,182,212,0.1)" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="4" />
              ) : (
                <line x1={screenCurrentLine.x1} y1={screenCurrentLine.y1} x2={screenCurrentLine.x2} y2={screenCurrentLine.y2} stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="4" />
              )}
              <g className="filter drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">
                <circle cx={screenCurrentLine.x1} cy={screenCurrentLine.y1} r="3" fill="#06b6d4" />
                <circle cx={screenCurrentLine.x2} cy={screenCurrentLine.y2} r="3" fill="#06b6d4" />
              </g>
              {/* Drawing HUD */}
              <foreignObject x={screenCurrentLine.x2 + 15} y={screenCurrentLine.y2 + 15} width="140" height="50" style={{ pointerEvents: 'none' }}>
                <div className="bg-[#020617]/90 backdrop-blur-xl border border-cyan-500/40 p-2 rounded-xl shadow-2xl flex flex-col gap-1">
                  <div className="flex justify-between items-center border-b border-white/5 pb-1 mb-1">
                    <span className="text-[7px] font-black text-slate-500 uppercase">Analysis HUD</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                  </div>
                  <div className="text-[9px] font-mono font-black text-white flex justify-between">
                    <span className="text-slate-500">PRC:</span>
                    <span>{currentLine?.p2?.toFixed(2)}</span>
                  </div>
                  <div className="text-[9px] font-mono font-black flex justify-between">
                    <span className="text-slate-500">Δ:</span>
                    <span className={currentLine?.p2 >= currentLine?.p1 ? 'text-emerald-400' : 'text-rose-400'}>
                      {((currentLine?.p2 / currentLine?.p1 - 1) * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </foreignObject>
            </g>
          )}
        </g>
      </svg>
      <div className="absolute top-4 left-5 z-20 pointer-events-none flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-black text-white uppercase tracking-[0.1em]">{symbol.replace(/\.(NS|BO)$/i, '').replace(/-USD$/i, '')}</span>
          <span className="text-[9px] font-bold text-slate-500 tracking-wider">{isCrypto ? 'CRYPTO' : 'NSE'} • {timeframe}</span>
        </div>
        <div className="flex items-center gap-5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/5">
          <div className="flex gap-1.5 items-baseline"><span className="text-[8px] font-black text-slate-500 uppercase">O</span><span className="text-[10px] font-mono font-bold text-emerald-400">{(currentQuote.o || 0).toFixed(2)}</span></div>
          <div className="flex gap-1.5 items-baseline"><span className="text-[8px] font-black text-slate-500 uppercase">H</span><span className="text-[10px] font-mono font-bold text-rose-400">{(currentQuote.h || 0).toFixed(2)}</span></div>
          <div className="flex gap-1.5 items-baseline"><span className="text-[8px] font-black text-slate-500 uppercase">L</span><span className="text-[10px] font-mono font-bold text-emerald-400">{(currentQuote.l || 0).toFixed(2)}</span></div>
          <div className="flex gap-1.5 items-baseline"><span className="text-[8px] font-black text-slate-500 uppercase">C</span><span className="text-[10px] font-mono font-bold text-white">{(currentQuote.c || 0).toFixed(2)}</span></div>
        </div>
      </div>
    </div>
  );
};

const ImmersiveTraderTerminal = ({ symbol: initialSymbol = "RELIANCE", basePrice = 2870.15 }) => {
  const navigate = useNavigate();
  const [symbol, setSymbol] = useState(initialSymbol);
  const [globalPrice, setGlobalPrice] = useState({ price: basePrice, changePercent: 1.83 });

  useEffect(() => { setSymbol(initialSymbol); }, [initialSymbol]);
  
  const [timeframe, setTimeframe] = useState('10m');
  const [chartType, setChartType] = useState('candles');
  const [activeIndicators, setActiveIndicators] = useState({ rsi: false, macd: false });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('watchlist');
  const [activeTool, setActiveTool] = useState('cursor');
  const [magnetEnabled, setMagnetEnabled] = useState(false);
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  const [drawingsHidden, setDrawingsHidden] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [news, setNews] = useState([]);

  useEffect(() => {
    let active = true;
    const fetchSidebarData = async () => {
      try {
        const [mktData, newsData] = await Promise.all([
          fetchMarketData({ limit: 10 }),
          fetchMarketNews({ limit: 10 })
        ]);
        if (active) {
          setWatchlist(mktData || []);
          setNews(newsData || []);
        }
      } catch (err) {
        console.error('Error fetching sidebar data:', err);
      }
    };
    fetchSidebarData();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (activeTool === 'eraser') {
      setTimeout(() => setActiveTool('cursor'), 100);
    }
  }, [activeTool]);
  const [showSettings, setShowSettings] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [compareList, setCompareList] = useState([]);
  const [activeDropdown, setActiveDropdown] = useState(null); 
  const [layout, setLayout] = useState('1'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const getLayoutGrid = () => {
    if (layout.startsWith('1')) return 'grid-cols-1 grid-rows-1';
    if (layout.startsWith('2-v')) return 'grid-cols-2 grid-rows-1';
    if (layout.startsWith('2-h')) return 'grid-cols-1 grid-rows-2';
    if (layout.startsWith('3-v')) return 'grid-cols-3 grid-rows-1';
    if (layout.startsWith('3-h')) return 'grid-cols-1 grid-rows-3';
    if (layout.startsWith('3-mix')) return 'grid-cols-2 grid-rows-2'; // 3 in 2x2
    if (layout.startsWith('4-g')) return 'grid-cols-2 grid-rows-2';
    if (layout.startsWith('4-v')) return 'grid-cols-4 grid-rows-1';
    if (layout.startsWith('4-h')) return 'grid-cols-1 grid-rows-4';
    if (layout.startsWith('6-g')) return 'grid-cols-3 grid-rows-2';
    if (layout.startsWith('6-v')) return 'grid-cols-6 grid-rows-1';
    if (layout.startsWith('8-g')) return 'grid-cols-4 grid-rows-2';
    if (layout.startsWith('8-v')) return 'grid-cols-8 grid-rows-1';
    return 'grid-cols-1 grid-rows-1';
  };

  const getChartCount = () => {
    if (layout === '1') return 1;
    if (layout.startsWith('2')) return 2;
    if (layout.startsWith('3')) return 3;
    if (layout.startsWith('4')) return 4;
    if (layout.startsWith('6')) return 6;
    if (layout.startsWith('8')) return 8;
    return 1;
  };

  return (
    <div className="fixed inset-0 overflow-hidden flex flex-col bg-[#020617] text-slate-300 font-sans">
      {/* ── Header ── */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/40 backdrop-blur-3xl z-[200]">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/40 transition-all text-slate-500 hover:text-cyan-400">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-black text-white tracking-tighter uppercase">{symbol.replace(/\.(NS|BO)$/i, '').replace(/-USD$/i, '')}</h1>
            <div className={`flex items-center gap-2 px-2 py-1 rounded border ${globalPrice.changePercent >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
              <span className={`text-[14px] font-mono font-black ${globalPrice.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{(globalPrice.price || 0).toFixed(2)}</span>
              <span className={`text-[10px] font-bold ${globalPrice.changePercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{globalPrice.changePercent >= 0 ? '+' : ''}{(globalPrice.changePercent || 0).toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Dropdown label={timeframe} isOpen={activeDropdown === 'tf'} onToggle={() => setActiveDropdown(activeDropdown === 'tf' ? null : 'tf')}>
            <div className="space-y-1">
              <div className="text-[8px] font-black text-slate-500 px-3 py-1 uppercase">Minutes</div>
              {['10m', '15m', '30m'].map(tf => (
                <button key={tf} onClick={() => { setTimeframe(tf); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 text-[10px] font-bold text-slate-300 hover:bg-white/5 hover:text-white rounded-lg">{TF_CONFIG[tf].label}</button>
              ))}
              <div className="text-[8px] font-black text-slate-500 px-3 py-1 mt-2 border-t border-white/5 uppercase">Hours</div>
              {['1H', '4H'].map(tf => (
                <button key={tf} onClick={() => { setTimeframe(tf); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 text-[10px] font-bold text-slate-300 hover:bg-white/5 hover:text-white rounded-lg">{TF_CONFIG[tf].label}</button>
              ))}
            </div>
          </Dropdown>

          <div className="h-6 w-px bg-white/10 mx-1" />

          <Dropdown label="" icon={chartType === 'candles' ? BarChart2 : (chartType === 'line' ? Activity : TrendingUp)} isOpen={activeDropdown === 'type'} onToggle={() => setActiveDropdown(activeDropdown === 'type' ? null : 'type')}>
            <div className="space-y-1">
              {[
                { id: 'candles', label: 'Candles', icon: BarChart2 },
                { id: 'heikin', label: 'Heikin Ashi', icon: Layers },
                { id: 'hollow', label: 'Hollow Candles', icon: BarChart2 },
                { id: 'bars', label: 'OHLC Bars', icon: Activity },
                { id: 'line', label: 'Line', icon: Activity },
                { id: 'area', label: 'Area', icon: TrendingUp }
              ].map(type => (
                <button key={type.id} onClick={() => { setChartType(type.id); setActiveDropdown(null); }} className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold text-slate-300 hover:bg-white/5 hover:text-white rounded-lg">
                  <type.icon size={14}/> {type.label}
                </button>
              ))}
            </div>
          </Dropdown>

          <div className="h-6 w-px bg-white/10 mx-1" />

          <Dropdown label="Indicators" icon={Zap} isOpen={activeDropdown === 'indicators'} onToggle={() => setActiveDropdown(activeDropdown === 'indicators' ? null : 'indicators')}>
            <div className="space-y-1">
              {['rsi', 'macd', 'ema', 'vwap'].map(id => (
                <button key={id} onClick={() => setActiveIndicators(p => ({ ...p, [id]: !p[id] }))} className={`w-full text-left px-3 py-2 text-[10px] font-bold rounded-lg transition-all ${activeIndicators[id] ? 'bg-violet-500/20 text-violet-300' : 'text-slate-300 hover:bg-white/5'}`}>{id.toUpperCase()}</button>
              ))}
            </div>
          </Dropdown>
        </div>

        <div className="flex items-center gap-4">
          <Dropdown 
            label="" 
            icon={Plus} 
            isOpen={activeDropdown === 'compare'} 
            onToggle={() => setActiveDropdown(activeDropdown === 'compare' ? null : 'compare')}
          >
            <div className="w-64 space-y-4">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Compare Symbols</div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search to add..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-[10px] focus:outline-none focus:border-cyan-500/50 transition-all"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                {(watchlist.length > 0 ? watchlist.map(s => s.symbol || s) : [symbol])
                  .filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(s => (
                    <button 
                      key={s} 
                      onClick={() => {
                        setCompareList(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
                        setSearchQuery(''); 
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${compareList.includes(s) ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      {s}
                      {compareList.includes(s) && <X size={12} />}
                    </button>
                  ))}
              </div>
            </div>
          </Dropdown>
          <Dropdown 
            label="" 
            icon={Layout}
            align="right"
            isOpen={activeDropdown === 'layout'} 
            onToggle={() => setActiveDropdown(activeDropdown === 'layout' ? null : 'layout')}
          >
            <div className="flex flex-col w-64 max-h-[450px] overflow-y-auto custom-scrollbar">
              {[
                { count: 1, layouts: [{ id: '1', r: 1, c: 1 }] },
                { count: 2, layouts: [{ id: '2-v', r: 1, c: 2 }, { id: '2-h', r: 2, c: 1 }] },
                { count: 3, layouts: [{ id: '3-v', r: 1, c: 3 }, { id: '3-h', r: 3, c: 1 }, { id: '3-mix', r: 2, c: 2 }] },
                { count: 4, layouts: [{ id: '4-g', r: 2, c: 2 }, { id: '4-v', r: 1, c: 4 }, { id: '4-h', r: 4, c: 1 }] },
                { count: 6, layouts: [{ id: '6-g', r: 2, c: 3 }, { id: '6-v', r: 1, c: 6 }] },
                { count: 8, layouts: [{ id: '8-g', r: 2, c: 4 }, { id: '8-v', r: 1, c: 8 }] }
              ].map((row, idx) => (
                <div key={row.count} className={`flex items-center gap-4 py-3 px-1 ${idx !== 0 ? 'border-t border-white/5' : ''}`}>
                  <div className="w-4 text-[10px] font-black text-slate-500">{row.count}</div>
                  <div className="flex gap-3">
                    {row.layouts.map(l => (
                      <button 
                        key={l.id} 
                        onClick={() => { setLayout(l.id); setActiveDropdown(null); }} 
                        className={`w-10 h-10 rounded-lg border-2 transition-all flex flex-col p-1 gap-0.5 ${layout === l.id ? 'bg-cyan-500/10 border-cyan-500' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                      >
                        {Array.from({ length: l.r }).map((_, ri) => (
                          <div key={ri} className="flex-1 flex gap-0.5">
                            {Array.from({ length: l.c }).map((_, ci) => (
                              <div key={ci} className={`flex-1 border rounded-[1px] ${layout === l.id ? 'border-cyan-500/60' : 'border-white/20'}`} />
                            ))}
                          </div>
                        ))}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Dropdown>

          <button 
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:border-cyan-500/40 transition-all"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Maximize size={18} className="rotate-180" /> : <Maximize2 size={18} />}
          </button>

        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Center Workspace (Dynamic Grid) */}
        <div className={`flex-1 grid gap-1 p-1 bg-black/40 overflow-hidden ${getLayoutGrid()}`}>
          {Array.from({ length: getChartCount() }).map((_, i) => (
            <div key={i} className="relative border border-white/5 bg-black/20 rounded-lg overflow-hidden group">
              <ChartPane 
                symbol={symbol} 
                timeframe={timeframe} 
                chartType={chartType} 
                indicators={{ ...activeIndicators, compare: compareList }} 
                basePrice={basePrice} 
                activeTool={activeTool}
                drawingsHidden={drawingsHidden}
                isMaster={i === 0}
                onQuoteUpdate={setGlobalPrice}
              />
            </div>
          ))}
        </div>

        {/* Right Sidebar */}
        <aside className="w-14 border-l border-white/5 bg-black/40 backdrop-blur-3xl flex flex-col items-center py-6 gap-6 z-[100]">
          {[
            { id: 'watchlist', icon: Eye, label: 'Watchlist' },
            { id: 'news', icon: Newspaper, label: 'Market News' },
            { id: 'calendar', icon: Calendar, label: 'Economic Calendar' },
            { id: 'settings', icon: Settings, label: 'Settings' }
          ].map(item => (
            <button key={item.id} onClick={() => { setSidebarTab(item.id); setSidebarOpen(true); }} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative ${sidebarTab === item.id && sidebarOpen ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
              <item.icon size={20} /><div className="absolute right-full mr-4 px-2 py-1 rounded bg-black text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[110] border border-white/10">{item.label}</div>
            </button>
          ))}
        </aside>

        {/* Sliding Sidebar Drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute right-14 top-0 bottom-0 w-80 bg-black/60 backdrop-blur-[80px] border-l border-white/10 p-6 z-[150] shadow-2xl flex flex-col">
              <div className="flex justify-between items-center mb-8"><h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{sidebarTab}</h3><button onClick={() => setSidebarOpen(false)}><X size={16}/></button></div>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                {sidebarTab === 'watchlist' && watchlist.map(s => (
                  <div key={s.symbol} onClick={() => { setSymbol(s.symbol); setSidebarOpen(false); }} className={`p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-cyan-500/30 transition-all flex justify-between cursor-pointer group ${symbol === s.symbol ? 'border-cyan-500/50 bg-cyan-500/5' : ''}`}>
                    <div><div className="text-[11px] font-black text-white group-hover:text-cyan-400 transition-colors">{s.symbol}</div><div className="text-[8px] text-slate-500 uppercase font-bold">NSE • STOCKS</div></div>
                    <div className="text-right">
                      <div className="text-[10px] font-mono text-slate-300">{Number(s.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      <div className={`text-[8px] font-black ${Number(s.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {Number(s.changePercent || 0) >= 0 ? '+' : ''}{Number(s.changePercent || 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
                {sidebarTab === 'news' && news.map((n, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer">
                    <div className="text-[8px] font-black text-emerald-400 mb-2 uppercase tracking-widest">{n.source || 'Market News'} • {n.time || 'Recently'}</div>
                    <div className="text-[11px] font-bold text-white leading-relaxed mb-2">{n.title || n.headline}</div>
                    <div className="text-[8px] text-slate-500 font-bold uppercase">{n.source || 'Reuters'}</div>
                  </div>
                ))}
                
                {sidebarTab === 'calendar' && (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                    <Calendar size={32} className="mb-4 text-slate-600" />
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">No Events Scheduled</div>
                    <p className="text-[8px] font-bold mt-2 text-slate-600">Events for {symbol} will appear here.</p>
                  </div>
                )}

                {sidebarTab === 'settings' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Chart Configuration</div>
                      {[
                        { label: 'Auto-save drawings', active: true },
                        { label: 'High-performance mode', active: false },
                        { label: 'Show trade labels', active: true }
                      ].map((s, i) => (
                        <div key={i} className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5">
                          <div className="text-[11px] font-bold text-slate-300">{s.label}</div>
                          <div className={`w-8 h-4 rounded-full relative ${s.active ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white ${s.active ? 'right-0.5' : 'left-0.5'}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Footer ── */}
      <footer className="h-10 border-t border-white/5 px-8 flex items-center justify-between bg-black/20 backdrop-blur-2xl text-[9px] font-black uppercase tracking-widest">
        <div className="flex gap-8 items-center"><div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"/> Network Secure</div><div className="flex items-center gap-2"><Clock size={12} className="text-slate-600"/> Market Open</div></div>
        <div className="text-slate-500">Latency: 12ms <span className="ml-4">Terminal v4.2.0</span></div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;700;900&display=swap');
        * { font-family: 'Outfit', sans-serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}} />
    </div>
  );
};

export default ImmersiveTraderTerminal;
