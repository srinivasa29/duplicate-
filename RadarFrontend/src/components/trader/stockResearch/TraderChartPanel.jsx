import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAssetMetadata } from '../../../utils/assetClassifier';
import { useMarketStatus } from '../../../hooks/useMarketStatus';
import { formatPrice as formatCurrency } from '../../../utils/currency';
import { fetchOHLCForChart } from '../../../api/ohlcApi';
import { fetchMarketHistory } from '../../../api/marketApi';
import {
  createChart,
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
} from 'lightweight-charts';
import {
  Activity,
  ArrowLeft,
  BarChart2,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Edit3,
  Eraser,
  Expand,
  GitCompare,
  Layout,
  LayoutGrid,
  Maximize2,
  Menu,
  Minus,
  Moon,
  MoreHorizontal,
  MousePointer2,
  Pause,
  Pencil,
  Plus,
  Play,
  RotateCcw,
  Ruler,
  Settings,
  Settings2,
  Square,
  StepForward,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';

const TF_CONFIG = {
  '10m': { stepSec: 600, points: 600, drift: 0.15, volatility: 0.85, waveSpan: 5.2, noiseSpan: 3.2, pulseEvery: 12, pulseScale: 0.28 },
  '15m': { stepSec: 900, points: 600, drift: 0.22, volatility: 1.15, waveSpan: 5.8, noiseSpan: 3.5, pulseEvery: 13, pulseScale: 0.31 },
  '30m': { stepSec: 1800, points: 600, drift: 0.28, volatility: 1.4, waveSpan: 6.6, noiseSpan: 3.9, pulseEvery: 14, pulseScale: 0.34 },
  '1H': { stepSec: 3600, points: 600, drift: 0.34, volatility: 1.75, waveSpan: 7.4, noiseSpan: 4.2, pulseEvery: 15, pulseScale: 0.38 },
  '4H': { stepSec: 14400, points: 600, drift: 0.46, volatility: 2.1, waveSpan: 8.6, noiseSpan: 4.8, pulseEvery: 16, pulseScale: 0.46 },
  '1D': { stepSec: 86400, points: 600, drift: 0.58, volatility: 2.5, waveSpan: 10.2, noiseSpan: 5.6, pulseEvery: 18, pulseScale: 0.58 },
  '1W': { stepSec: 604800, points: 600, drift: 0.72, volatility: 3.2, waveSpan: 12.4, noiseSpan: 6.8, pulseEvery: 20, pulseScale: 0.65 },
};

const TRADER_TIMEFRAMES = ['10m', '15m', '30m', '1H', '4H', '1D'];
const DRAW_TOOLS = ['trendline', 'rectangle', 'horizontal', 'measure'];
const TOOL_STYLES = {
  trendline: { stroke: '#94a3b8', fill: 'transparent' },
  rectangle: { stroke: '#38bdf8', fill: 'rgba(56,189,248,0.08)' },
  horizontal: { stroke: '#f1f5f9', fill: 'transparent' },
  measure: { stroke: '#fbbf24', fill: 'rgba(251,191,36,0.08)' },
};

const toSeed = (value = '') =>
  String(value).split('').reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 17);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const alignTimeToBucket = (timestampSec, stepSec) => {
  if (!stepSec) return timestampSec;
  return Math.floor(timestampSec / stepSec) * stepSec;
};

const formatAxisTime = (time, timeframe) => {
  if (!time) return '';
  const timestamp = typeof time === 'number' ? time : (time.timestamp || 0);
  if (timestamp === 0) return '';
  const date = new Date(timestamp * 1000);

  if (timeframe === '1W') {
    return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  }

  if (timeframe === '1D') {
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }

  if (timeframe === '1H' || timeframe === '4H') {
    return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
};

const buildOhlcv = (symbol, basePrice, timeframe) => {
  const config = TF_CONFIG[timeframe] ?? TF_CONFIG['1D'];
  const stepSec = Number(config.stepSec);
  const points = Number(config.points);
  const drift = Number(config.drift);
  const volatility = Number(config.volatility);
  const waveSpan = Number(config.waveSpan);
  const noiseSpan = Number(config.noiseSpan);
  const pulseEvery = Number(config.pulseEvery);
  const pulseScale = Number(config.pulseScale);

  const seed = toSeed(symbol) + toSeed(timeframe);
  const now = Math.floor(Date.now() / 1000);
  const alignedNowSec = Math.floor(now / stepSec) * stepSec;
  const startSec = alignedNowSec - (points - 1) * stepSec;
  
  const rows = [];
  let previous = Number(basePrice || 1000);

  for (let index = 0; index < points; index += 1) {
    const majorWave = Math.sin((index + seed) / waveSpan) * drift;
    const minorWave = Math.cos((index + seed * 0.37) / noiseSpan) * volatility * 0.28;
    const pulse = index % pulseEvery === 0 ? Math.sin(seed + index) * volatility * pulseScale : 0;
    const move = majorWave + minorWave + pulse;
    const open = previous;
    const close = Math.max(1, open + move);
    const high = Math.max(open, close) + Math.abs(Math.sin(index + seed) * volatility);
    const low = Math.min(open, close) - Math.abs(Math.cos(index + seed) * volatility * 0.9);
    const volume = Math.round(500000 + Math.abs(move) * 180000 + (index % 7) * 25000 + (seed % 7000));

    rows.push({
      time: Number(startSec + (index * stepSec)),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +Math.max(1, low).toFixed(2),
      close: +close.toFixed(2),
      volume,
    });

    previous = close;
  }
  return rows;
};

const extendHistory = (rows, timeframe, chunkSize = 80) => {
  if (!rows.length) return rows;
  const { stepSec, drift, volatility, waveSpan, noiseSpan, pulseEvery, pulseScale } = TF_CONFIG[timeframe] ?? TF_CONFIG['1D'];
  const seed = toSeed(`${timeframe}-history`);
  const firstRow = rows[0];
  const older = [];
  let nextClose = firstRow.open;

  for (let offset = chunkSize; offset >= 1; offset -= 1) {
    const index = rows.length + offset + seed;
    const majorWave = Math.sin(index / waveSpan) * drift;
    const minorWave = Math.cos(index / noiseSpan) * volatility * 0.24;
    const pulse = index % pulseEvery === 0 ? Math.sin(seed + index) * volatility * pulseScale * 0.8 : 0;
    const move = majorWave + minorWave + pulse;
    const close = Math.max(1, nextClose - move);
    const open = close - move * 0.85;
    const high = Math.max(open, close) + Math.abs(Math.sin(index) * volatility * 0.8);
    const low = Math.min(open, close) - Math.abs(Math.cos(index) * volatility * 0.72);

    older.push({
      time: firstRow.time - offset * stepSec,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +Math.max(1, low).toFixed(2),
      close: +close.toFixed(2),
      volume: Math.round(420000 + Math.abs(move) * 160000 + (index % 7) * 22000),
    });

    nextClose = open;
  }

  return [...older, ...rows];
};

const calcEma = (rows, period) => {
  const multiplier = 2 / (period + 1);
  let previous = rows[0]?.close ?? 0;

  return rows.map((row, index) => {
    const value = index === 0 ? previous : row.close * multiplier + previous * (1 - multiplier);
    previous = value;
    return { time: row.time, value: +value.toFixed(2) };
  });
};

const calcRsi = (rows, period = 14) => {
  if (!rows.length) return [];

  const output = [];
  let avgGain = 0;
  let avgLoss = 0;

  rows.forEach((row, index) => {
    if (index === 0) {
      output.push({ time: row.time, value: 50 });
      return;
    }

    const delta = row.close - rows[index - 1].close;
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);

    if (index <= period) {
      avgGain += gain;
      avgLoss += loss;
      const seedGain = avgGain / index;
      const seedLoss = avgLoss / index;
      const rs = seedLoss === 0 ? 100 : seedGain / seedLoss;
      output.push({ time: row.time, value: +(100 - 100 / (1 + rs)).toFixed(2) });
      return;
    }

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    output.push({ time: row.time, value: +(100 - 100 / (1 + rs)).toFixed(2) });
  });

  return output;
};

const calcMacd = (rows, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  if (!rows.length) return { macd: [], signal: [], histogram: [] };

  const fast = calcEma(rows, fastPeriod);
  const slow = calcEma(rows, slowPeriod);
  const macd = rows.map((row, index) => ({
    time: row.time,
    value: +((fast[index]?.value ?? row.close) - (slow[index]?.value ?? row.close)).toFixed(2),
  }));

  const signalSeedRows = macd.map((point) => ({ time: point.time, close: point.value }));
  const signal = calcEma(signalSeedRows, signalPeriod);
  const histogram = macd.map((point, index) => ({
    time: point.time,
    value: +(point.value - (signal[index]?.value ?? 0)).toFixed(2),
  }));

  return { macd, signal, histogram };
};

const chartOptions = (width, height, timeframe, showTime = true) => ({
  layout: {
    background: { type: ColorType.Solid, color: '#0f172a' },
    textColor: '#64748b',
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: 'rgba(255, 255, 255, 0.02)' },
    horzLines: { color: 'rgba(255, 255, 255, 0.02)' },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: {
      color: 'rgba(255, 255, 255, 0.2)',
      width: 1,
      style: LineStyle.Dashed,
      labelBackgroundColor: '#1e293b',
    },
    horzLine: {
      color: 'rgba(255, 255, 255, 0.2)',
      width: 1,
      style: LineStyle.Dashed,
      labelBackgroundColor: '#1e293b',
    },
  },
  rightPriceScale: {
    borderColor: 'rgba(255, 255, 255, 0.05)',
    autoScale: true,
    scaleMargins: { top: 0.1, bottom: 0.1 },
  },
  timeScale: {
    borderColor: 'rgba(255, 255, 255, 0.05)',
    timeVisible: showTime,
    secondsVisible: false,
    rightOffset: 0,
    fixLeftEdge: true,
    fixRightEdge: false,
    barSpacing: 6,
    minBarSpacing: 0.01,
    shiftVisibleRangeOnNewBar: true,
    lockVisibleTimeRangeOnResize: false,
    tickMarkFormatter: (time) => {
      const ts = typeof time === 'number' ? time : (time?.timestamp || 0);
      return formatAxisTime(ts, timeframe);
    },
  },
  handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
  handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true } },
  width,
  height,
});

const formatPrice = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatVolume = (value) => Number(value || 0).toLocaleString('en-IN');

const formatTimeLabel = (time, timeframe) => {
  if (!time) return '';
  const date = new Date(Number(time) * 1000);
  return timeframe === '1D'
    ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
};

const FloatingToolButton = ({ active = false, icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${active ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400 shadow-lg shadow-cyan-500/10' : 'border-white/5 bg-[#1e293b]/50 text-slate-400 hover:bg-[#1e293b] hover:text-white'}`}
  >
    <Icon size={18} />
  </button>
);

const toggleTool = (currentTool, nextTool) => (currentTool === nextTool ? null : nextTool);
const resolveChartType = (mode) => (mode === 'clean' ? 'line' : 'candles');


const getNearestIndex = (rows, targetTime) => {
  if (!rows.length) return 0;
  if (targetTime == null) return rows.length - 1;

  let bestIndex = 0;
  let bestDistance = Infinity;
  rows.forEach((row, index) => {
    const distance = Math.abs(row.time - targetTime);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
};

const normalizeChartTime = (rawTime, fallbackRows, fallbackIndex = 0) => {
  if (typeof rawTime === 'number') return rawTime;
  if (typeof rawTime?.timestamp === 'number') return rawTime.timestamp;
  return fallbackRows[clamp(fallbackIndex, 0, Math.max(fallbackRows.length - 1, 0))]?.time ?? null;
};

const renderDrawing = (drawing, chartApi, candleSeries, width) => {
  if (!chartApi || !candleSeries) return null;

  const style = TOOL_STYLES[drawing.type] ?? TOOL_STYLES.trendline;
  const x1 = chartApi.timeScale().timeToCoordinate(drawing.start.time);
  const y1 = candleSeries.priceToCoordinate(drawing.start.price);

  if (drawing.type === 'horizontal') {
    if (y1 == null) return null;
    return (
      <g key={drawing.id}>
        <line x1={0} y1={y1} x2={width} y2={y1} stroke={style.stroke} strokeWidth="1.5" strokeDasharray="5 4" />
        <text x={width - 8} y={y1 - 8} textAnchor="end" fill="#E2E8F0" fontSize="11">{formatPrice(drawing.start.price)}</text>
      </g>
    );
  }

  const x2 = chartApi.timeScale().timeToCoordinate(drawing.end.time);
  const y2 = candleSeries.priceToCoordinate(drawing.end.price);
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null;

  if (drawing.type === 'rectangle') {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const rectWidth = Math.abs(x2 - x1);
    const rectHeight = Math.abs(y2 - y1);
    return <rect key={drawing.id} x={left} y={top} width={rectWidth} height={rectHeight} fill={style.fill} stroke={style.stroke} strokeWidth="1.5" rx="4" />;
  }

  if (drawing.type === 'measure') {
    const delta = drawing.end.price - drawing.start.price;
    const percent = drawing.start.price ? (delta / drawing.start.price) * 100 : 0;
    return (
      <g key={drawing.id}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={style.stroke} strokeWidth="1.5" strokeDasharray="4 3" />
        <circle cx={x1} cy={y1} r="3" fill={style.stroke} />
        <circle cx={x2} cy={y2} r="3" fill={style.stroke} />
        <rect x={Math.min(x1, x2) + 8} y={Math.min(y1, y2) - 26} width="108" height="20" rx="6" fill="#102331" stroke="rgba(255,255,255,0.08)" />
        <text x={Math.min(x1, x2) + 16} y={Math.min(y1, y2) - 12} fill="#FACC15" fontSize="11">
          {`${delta >= 0 ? '+' : ''}${formatPrice(delta)} (${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%)`}
        </text>
      </g>
    );
  }

  return (
    <g key={drawing.id}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={style.stroke} strokeWidth="1.6" />
      <circle cx={x1} cy={y1} r="3" fill={style.stroke} />
      <circle cx={x2} cy={y2} r="3" fill={style.stroke} />
    </g>
  );
};

function ResearchChartViewport({
  panelId,
  timeframe,
  rows,
  drawings,
  draftDrawing,
  selectedTool,
  onDrawingStart,
  onDrawingUpdate,
  onDrawingEnd,
  height,
  showRsi = true,
  showMacd = true,
  showEma = true,
  showVolume = true,
  chartType = 'candles',
  settings = {},
  onRequestMoreHistory,
}) {
  const rootRef = useRef(null);
  const rsiRef = useRef(null);
  const macdRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const [renderTick, setRenderTick] = useState(0);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [overlayContext, setOverlayContext] = useState({ chart: null, candleSeries: null, width: 0 });

  useEffect(() => {
    if (!rootRef.current || !rows.length) return undefined;

    const chart = createChart(rootRef.current, chartOptions(rootRef.current.clientWidth, height, timeframe, true));
    chartRef.current = chart;

    const series = chartType === 'line'
      ? chart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 2, priceLineVisible: false })
      : chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        priceLineVisible: false,
      });
    candleSeriesRef.current = series;
    series.setData(chartType === 'candles' ? rows : rows.map(r => ({ time: r.time, value: r.close })));
    
    // Absolute 'Flush' Fit
    const forceFit = () => {
      if (chartRef.current && rows.length > 0) {
        const ts = chartRef.current.timeScale();
        ts.setVisibleLogicalRange({
          from: 0,
          to: Math.max(rows.length - 1, 10)
        });
        ts.fitContent();
      }
    };
    
    requestAnimationFrame(forceFit);
    setTimeout(forceFit, 50);
    setTimeout(forceFit, 200);


    setOverlayContext({ chart, candleSeries: series, width: rootRef.current.clientWidth });

    // ── Apply Settings ──
    chart.applyOptions({
      grid: {
        vertLines: { visible: settings.grid, color: 'rgba(255, 255, 255, 0.02)' },
        horzLines: { visible: settings.grid, color: 'rgba(255, 255, 255, 0.02)' },
      },
      watermark: {
        visible: settings.watermark,
        fontSize: 48,
        horzAlign: 'center',
        vertAlign: 'center',
        color: 'rgba(255, 255, 255, 0.03)',
        text: rows[0]?.symbol || 'RADAR',
      },
    });

    // Volume Histogram
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: '', // overlay
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volumeSeries.setData(rows.map(r => ({
        time: r.time,
        value: r.volume || 100,
        color: r.close >= r.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
      })));
    }

    // Indicators
    if (showEma) {
      const ema20 = calcEma(rows, 20);
      const ema50 = calcEma(rows, 50);
      chart.addSeries(LineSeries, { color: 'rgba(251, 191, 36, 0.8)', lineWidth: 1.5, lastValueVisible: false, priceLineVisible: false, title: 'EMA 20' }).setData(ema20);
      chart.addSeries(LineSeries, { color: 'rgba(96, 165, 250, 0.8)', lineWidth: 1.5, lastValueVisible: false, priceLineVisible: false, title: 'EMA 50' }).setData(ema50);
    }

    let rsiChart, macdChart;

    if (showRsi && rsiRef.current) {
      rsiChart = createChart(rsiRef.current, {
        ...chartOptions(rsiRef.current.clientWidth, 140, timeframe, false),
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#64748b' },
        grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255, 255, 255, 0.02)' } },
      });
      const rsiLine = rsiChart.addSeries(LineSeries, { color: '#818cf8', lineWidth: 1.5, priceLineVisible: false });
      rsiLine.setData(calcRsi(rows));
      rsiLine.createPriceLine({ price: 70, color: 'rgba(239, 68, 68, 0.2)', lineWidth: 1, lineStyle: 2 });
      rsiLine.createPriceLine({ price: 30, color: 'rgba(34, 197, 94, 0.2)', lineWidth: 1, lineStyle: 2 });
    }

    if (showMacd && macdRef.current) {
      macdChart = createChart(macdRef.current, {
        ...chartOptions(macdRef.current.clientWidth, 140, timeframe, false),
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#64748b' },
        grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255, 255, 255, 0.02)' } },
      });
      const { macd: m, signal: s, histogram: h } = calcMacd(rows);
      macdChart.addSeries(HistogramSeries, { color: 'rgba(148, 163, 184, 0.1)', priceLineVisible: false }).setData(h.map(d => ({ ...d, color: d.value >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)' })));
      macdChart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 1, priceLineVisible: false }).setData(m);
      macdChart.addSeries(LineSeries, { color: '#fb923c', lineWidth: 1, priceLineVisible: false }).setData(s);
    }

    const charts = [chart, rsiChart, macdChart].filter(Boolean);

    // ── Interaction Lock ──
    const isDrawing = DRAW_TOOLS.includes(selectedTool);
    charts.forEach(c => {
      c.applyOptions({
        handleScroll: isDrawing ? false : { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        handleScale: isDrawing ? false : { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true } },
      });
    });

    let syncing = false;
    charts.forEach(c => {
      c.timeScale().subscribeVisibleLogicalRangeChange(range => {
        setRenderTick(t => t + 1);
        if (syncing || !range) return;
        syncing = true;
        charts.forEach(t => { if (t !== c) t.timeScale().setVisibleLogicalRange(range); });
        syncing = false;
      });
    });

    chart.subscribeCrosshairMove(param => {
      if (!param.time) {
        setHoveredRow(null);
        return;
      }
      const row = rows[getNearestIndex(rows, normalizeChartTime(param.time, rows))] ?? null;
      setHoveredRow(row ? { ...row, x: param.point.x, y: param.point.y } : null);
    });

    const toPoint = (event) => {
      if (!rootRef.current || !chartRef.current || !candleSeriesRef.current || !rows.length) return null;
      const bounds = rootRef.current.getBoundingClientRect();
      const x = clamp(event.clientX - bounds.left, 0, bounds.width);
      const y = clamp(event.clientY - bounds.top, 0, bounds.height);
      const rawTime = chartRef.current.timeScale().coordinateToTime(x);
      const time = normalizeChartTime(rawTime, rows, Math.round((x / bounds.width) * (rows.length - 1)));
      const price = candleSeriesRef.current.coordinateToPrice(y);
      return (time != null && price != null) ? { panelId, time, price: +price.toFixed(2) } : null;
    };

    const handleMouseDown = (e) => {
      if (!DRAW_TOOLS.includes(selectedTool)) return;
      const p = toPoint(e);
      if (p) { e.preventDefault(); onDrawingStart(p); }
    };
    const handleMouseMove = (e) => {
      const p = toPoint(e);
      if (p) onDrawingUpdate(p);
    };
    const handleMouseUp = (e) => {
      const p = toPoint(e);
      onDrawingEnd(p);
    };

    const el = rootRef.current;
    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    const resizeObserver = new ResizeObserver(() => {
      if (rootRef.current && chartRef.current) {
        const w = rootRef.current.clientWidth;
        chartRef.current.applyOptions({ width: w });
        chartRef.current.timeScale().fitContent();
        if (rsiChart) rsiChart.applyOptions({ width: w });
        if (macdChart) macdChart.applyOptions({ width: w });
        setOverlayContext(c => ({ ...c, width: w }));
        setRenderTick(t => t + 1);
      }
    });
    resizeObserver.observe(rootRef.current);

    return () => {
      el.removeEventListener('mousedown', handleMouseDown);
      el.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      resizeObserver.disconnect();
      charts.forEach(c => c.remove());
      chartRef.current = candleSeriesRef.current = null;
    };
  }, [rows, height, timeframe, showRsi, showMacd, chartType, selectedTool, onDrawingStart, onDrawingUpdate, onDrawingEnd, panelId, settings]);

  const overlayItems = drawings
    .filter(d => d.panelId === panelId)
    .map(d => renderDrawing(d, overlayContext.chart, overlayContext.candleSeries, overlayContext.width));

  const draftItem = draftDrawing?.panelId === panelId
    ? renderDrawing({ ...draftDrawing, id: 'draft' }, overlayContext.chart, overlayContext.candleSeries, overlayContext.width)
    : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      <div
        ref={rootRef}
        className="flex-1 min-h-0 relative"
        style={{ cursor: DRAW_TOOLS.includes(selectedTool) ? 'crosshair' : 'default' }}
      />
      {showRsi && (
        <div className="h-[140px] relative border-t border-white/5 bg-[#0f172a]">
          <div ref={rsiRef} className="absolute inset-0" />
        </div>
      )}
      {showMacd && (
        <div className="h-[140px] relative border-t border-white/5 bg-[#0f172a]">
          <div ref={macdRef} className="absolute inset-0" />
        </div>
      )}
      <svg className="pointer-events-none absolute inset-0 z-10" width="100%" height="100%" data-render-tick={renderTick}>
        {overlayItems}
        {draftItem}
      </svg>

      {hoveredRow && (
        <div
          className="pointer-events-none absolute z-20 px-3 py-2 rounded-lg bg-[#1e293b]/90 border border-white/10 shadow-2xl backdrop-blur-md text-[11px] text-slate-200"
          style={{
            left: 12,
            top: 12,
          }}
        >
          <div className="flex justify-between gap-4 mb-1 border-b border-white/5 pb-1">
            <span className="font-bold text-cyan-400">{formatTimeLabel(hoveredRow.time, timeframe)}</span>
            <span className="text-slate-500">{timeframe}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
            <div className="flex justify-between gap-2"><span className="text-slate-500 font-bold">O</span><span className="font-mono">{formatPrice(hoveredRow.open)}</span></div>
            <div className="flex justify-between gap-2"><span className="text-slate-500 font-bold">H</span><span className="font-mono">{formatPrice(hoveredRow.high)}</span></div>
            <div className="flex justify-between gap-2"><span className="text-slate-500 font-bold">L</span><span className="font-mono">{formatPrice(hoveredRow.low)}</span></div>
            <div className="flex justify-between gap-2"><span className="text-slate-500 font-bold">C</span><span className="font-mono font-bold text-white">{formatPrice(hoveredRow.close)}</span></div>
            <div className="col-span-2 flex justify-between gap-2 mt-0.5 pt-0.5 border-t border-white/5"><span className="text-slate-500 font-bold uppercase text-[9px]">Vol</span><span className="font-mono text-cyan-500/80">{formatVolume(hoveredRow.volume)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TraderChartPanel({ symbol, price, assetType, variant = 'simple' }) {
  const advanced = variant === 'advanced';
  const assetMeta = getAssetMetadata(symbol);
  
  const { isOpen: mktOpen, isCrypto } = useMarketStatus(assetMeta.type);

  const navigate = useNavigate();

  const [timeframe, setTimeframe] = useState('10m');
  const [workspaceMode, setWorkspaceMode] = useState('analysis');
  const [selectedTool, setSelectedTool] = useState(null);
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [compareSymbol, setCompareSymbol] = useState('NIFTY');
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [replayOn, setReplayOn] = useState(false);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [indicators, setIndicators] = useState({ ema: true, rsi: true, macd: true, volume: true });
  const [chartType, setChartType] = useState('candles');
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [layout, setLayout] = useState('1'); // '1', '2-v', '2-h', '4'
  const [drawings, setDrawings] = useState([]);
  const [draftDrawing, setDraftDrawing] = useState(null);
  const [historyDepthByTimeframe, setHistoryDepthByTimeframe] = useState({});

  const [showTfMenu, setShowTfMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showIndMenu, setShowIndMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Advanced Chart Settings
  const [chartSettings, setChartSettings] = useState({
    theme: 'dark',
    grid: true,
    watermark: true,
    sessionBreaks: false,
    priceLabels: true,
  });

  const mainRef = useRef(null);
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const [showSettings, setShowSettings] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const activeTimeframes = TRADER_TIMEFRAMES;
  const chartTimeframes = useMemo(() => [timeframe], [timeframe]);

  const [rowsByTimeframe, setRowsByTimeframe] = useState({});
  const [compareRowsByTimeframe, setCompareRowsByTimeframe] = useState({});
  const [isChartLoading, setIsChartLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsChartLoading(true);
      let mainRes = [];
      let compRes = [];
      try {
        // ── Derive correct API symbol based on asset type ──────────────────
        const INDEX_MAP = {
          NIFTY: '^NSEI', BANKNIFTY: '^NSEBANK', SENSEX: '^BSESN',
          FINNIFTY: 'NIFTY_FIN_SERVICE.NS', MIDCPNIFTY: '^NSEMDCP50', INDIAVIX: '^INDIAVIX',
        };
        const upperSym = String(symbol || '').toUpperCase();
        let apiSymbol = upperSym;
        if (assetMeta.type === 'Index') {
          apiSymbol = INDEX_MAP[upperSym] || `^${upperSym}`;
        } else if (assetMeta.type === 'Crypto') {
          apiSymbol = upperSym.endsWith('USDT') ? upperSym : `${upperSym}USDT`;
        } else if (assetMeta.type === 'Equity' && !upperSym.endsWith('.NS') && !upperSym.endsWith('.BO')) {
          apiSymbol = `${upperSym}.NS`;
        } else if (assetMeta.type === 'Forex') {
          apiSymbol = `${upperSym}=X`;
        }
        // ──────────────────────────────────────────────────────────────────
        const [main, comp] = await Promise.all([
          fetchMarketHistory(apiSymbol, assetMeta.type.toUpperCase(), timeframe),
          compareEnabled ? fetchMarketHistory(compareSymbol || '^NSEI', 'INDEX', timeframe) : Promise.resolve({ data: [] })
        ]);
        mainRes = main;
        compRes = comp;
      } catch (err) {
        console.warn('TraderChartPanel API fallback triggered:', err);
      }

      if (!active) return;
      
      const formatRows = (res) => {
        const arr = Array.isArray(res) ? res : res?.data || [];
        return arr.map(d => {
          let timeVal = new Date(d.timestamp).getTime() / 1000;
          if (isNaN(timeVal)) timeVal = Number(d.time || d.timestamp);
          return {
            time: timeVal,
            open: Number(d.open),
            high: Number(d.high),
            low: Number(d.low),
            close: Number(d.close),
            volume: Number(d.volume || 0)
          };
        }).filter(d => !isNaN(d.time) && d.time > 0)
          .sort((a, b) => a.time - b.time)
          .filter((d, i, arr) => i === 0 || d.time !== arr[i - 1].time); // Lightweight charts requires strictly increasing time
      };

      const newRows = formatRows(mainRes);
      if (newRows.length > 0) {
        setRowsByTimeframe(prev => ({ ...prev, [timeframe]: newRows }));
      } else {
        // Fallback for empty data so UI doesn't completely break
        setRowsByTimeframe(prev => ({ ...prev, [timeframe]: buildOhlcv(symbol, price, timeframe) }));
      }

      if (compareEnabled) {
        const newComp = formatRows(compRes);
        if (newComp.length > 0) {
          setCompareRowsByTimeframe(prev => ({ ...prev, [timeframe]: newComp }));
        } else {
          setCompareRowsByTimeframe(prev => ({ ...prev, [timeframe]: buildOhlcv(compareSymbol || 'NIFTY', Number(price || 1000) * 0.82, timeframe) }));
        }
      }

      setIsChartLoading(false);
    };
    
    load();
    return () => { active = false; };
  }, [symbol, timeframe, assetType, compareEnabled, compareSymbol, price]);

  const baseReplayRows = rowsByTimeframe[timeframe] ?? [];

  useEffect(() => {
    setReplayIndex(baseReplayRows.length);
  }, [baseReplayRows.length, timeframe]);

  useEffect(() => {
    if (!replayOn || !replayPlaying) return undefined;
    if (replayIndex >= baseReplayRows.length) {
      setReplayPlaying(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setReplayIndex((current) => Math.min(baseReplayRows.length, current + 1));
    }, 450);

    return () => window.clearTimeout(timer);
  }, [baseReplayRows.length, replayIndex, replayOn, replayPlaying]);

  const displayedRowsByTimeframe = useMemo(() => {
    const progress = replayOn && baseReplayRows.length ? clamp(replayIndex / baseReplayRows.length, 0.12, 1) : 1;
    return Object.fromEntries(
      chartTimeframes.map((tf) => {
        const source = rowsByTimeframe[tf] ?? [];
        const count = replayOn ? Math.max(8, Math.round(source.length * progress)) : source.length;
        return [tf, source.slice(0, count)];
      }),
    );
  }, [baseReplayRows.length, chartTimeframes, replayIndex, replayOn, rowsByTimeframe]);

  const displayedCompareRowsByTimeframe = useMemo(() => {
    const progress = replayOn && baseReplayRows.length ? clamp(replayIndex / baseReplayRows.length, 0.12, 1) : 1;
    return Object.fromEntries(
      chartTimeframes.map((tf) => {
        const source = compareRowsByTimeframe[tf] ?? [];
        const count = replayOn ? Math.max(8, Math.round(source.length * progress)) : source.length;
        return [tf, source.slice(0, count)];
      }),
    );
  }, [baseReplayRows.length, chartTimeframes, compareRowsByTimeframe, replayIndex, replayOn]);

  const primaryRows = useMemo(() => displayedRowsByTimeframe[chartTimeframes[0]] ?? [], [displayedRowsByTimeframe, chartTimeframes]);
  const simpleRowWindow = useMemo(() => ({
    '10m': 72,
    '15m': 72,
    '30m': 84,
    '1H': 96,
    '4H': 90,
    '1D': 75,
    '1W': 52,
  }), []);
  const simpleRows = useMemo(() => {
    const windowSize = simpleRowWindow[timeframe] ?? 72;
    return primaryRows.slice(-windowSize);
  }, [primaryRows, simpleRowWindow, timeframe]);
  const ema20 = useMemo(() => calcEma(primaryRows, 20), [primaryRows]);
  const ema50 = useMemo(() => calcEma(primaryRows, 50), [primaryRows]);
  const rsi14 = useMemo(() => calcRsi(primaryRows, 14), [primaryRows]);
  const macd = useMemo(() => calcMacd(primaryRows), [primaryRows]);

  const latest = primaryRows[primaryRows.length - 1];
  const first = primaryRows[0];
  const latestClose = latest?.close ?? Number(price || 0);
  const latestVolume = latest?.volume ?? 0;
  const latestEma20 = ema20[ema20.length - 1]?.value ?? 0;
  const latestEma50 = ema50[ema50.length - 1]?.value ?? 0;
  const averageVolume = primaryRows.reduce((acc, row) => acc + row.volume, 0) / Math.max(primaryRows.length, 1);
  const averageRange = primaryRows.reduce((acc, row) => acc + (row.high - row.low), 0) / Math.max(primaryRows.length, 1);
  const priceChange = first?.close ? ((latestClose - first.close) / first.close) * 100 : 0;
  const trendLabel = latestEma20 > latestEma50 ? 'Bullish' : latestEma20 < latestEma50 ? 'Bearish' : 'Sideways';
  const momentumLabel = latestClose > latestEma20 ? 'Follow-through above EMA20' : 'Trading below EMA20';
  const volumeStatus = latestVolume > averageVolume * 1.25 ? 'Expansion' : latestVolume < averageVolume * 0.85 ? 'Muted' : 'Normal';
  const confidenceScore = Math.max(25, Math.min(94, Math.round(55 + (latestEma20 > latestEma50 ? 14 : -10) + (priceChange > 0 ? 8 : -6) + (latestVolume > averageVolume ? 6 : -4))));
  const latestRsi = rsi14[rsi14.length - 1]?.value ?? 50;
  const latestMacdHist = macd.histogram[macd.histogram.length - 1]?.value ?? 0;

  const tradePlan = useMemo(() => {
    const bias = trendLabel === 'Bearish' ? 'Short' : trendLabel === 'Sideways' ? 'Wait' : 'Long';
    if (!latest) {
      return { bias, entry: 0, stop: 0, target: 0, rr: 0 };
    }

    if (bias === 'Short') {
      const entry = +(latest.low - averageRange * 0.15).toFixed(2);
      const stop = +(Math.max(latestEma20, latest.high) + averageRange * 0.35).toFixed(2);
      const target = +(entry - (stop - entry) * 1.8).toFixed(2);
      return { bias, entry, stop, target, rr: 1.8 };
    }

    if (bias === 'Wait') {
      const trigger = +(Math.max(latest.high, latestEma20) + averageRange * 0.2).toFixed(2);
      const stop = +(Math.min(latest.low, latestEma50) - averageRange * 0.25).toFixed(2);
      const target = +(trigger + (trigger - stop) * 1.7).toFixed(2);
      return { bias, entry: trigger, stop, target, rr: 1.7 };
    }

    const entry = +(Math.max(latest.close, latestEma20) + averageRange * 0.12).toFixed(2);
    const stop = +(Math.min(latestEma50, latest.low) - averageRange * 0.3).toFixed(2);
    const target = +(entry + (entry - stop) * 1.9).toFixed(2);
    return { bias, entry, stop, target, rr: 1.9 };
  }, [averageRange, latest, latestEma20, latestEma50, trendLabel]);

  const trendReasoning = useMemo(() => {
    if (!latest) return '';
    const closeVsEma20 = latest.close >= latestEma20 ? 'holding above EMA20' : 'slipping below EMA20';
    const emaStack = latestEma20 >= latestEma50 ? 'EMA20 remains above EMA50' : 'EMA20 remains below EMA50';
    return `${emaStack}, price is ${closeVsEma20}, and the visible move is ${priceChange >= 0 ? 'up' : 'down'} ${Math.abs(priceChange).toFixed(2)}% over the active window.`;
  }, [latest, latestEma20, latestEma50, priceChange]);

  const signalReasoning = useMemo(() => {
    if (!latest) return '';
    const volumePhrase = latestVolume > averageVolume ? 'participation is above average' : 'participation is below average';
    const candlePhrase = latest.close >= latest.open ? 'buyers closed the latest bar near the top of range' : 'sellers controlled the latest bar into the close';
    return `${candlePhrase}, ${volumePhrase}, and the current setup ${trendLabel === 'Bullish' ? 'supports continuation if pullbacks stay above EMA20.' : trendLabel === 'Bearish' ? 'favors rallies failing back into EMA20/EMA50 supply.' : 'still needs a range break before conviction improves.'}`;
  }, [averageVolume, latest, latestVolume, trendLabel]);

  const drawInstruction = {
    trendline: 'Click and drag to anchor a trendline.',
    rectangle: 'Click and drag to mark a supply or demand zone.',
    horizontal: 'Click once on price to place a horizontal level.',
    measure: 'Click and drag to measure price change and percentage move.',
  }[selectedTool] ?? 'Pan the chart with drag, zoom with the mouse wheel, or pick a tool to draw.';
  const analysisMode = workspaceMode === 'analysis';

  const floatingTools = [
    { id: 'trendline', icon: Pencil, label: 'Trendline' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'horizontal', icon: Minus, label: 'Horizontal Line' },
    { id: 'measure', icon: Ruler, label: 'Measure' },
  ];

  const destroySimpleChart = () => {
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch {
        // ignore cleanup issues
      }
      chartRef.current = null;
    }
  };

  useEffect(() => {
    if (advanced || !mainRef.current) return undefined;

    destroySimpleChart();
    const mainChart = createChart(mainRef.current, chartOptions(mainRef.current.clientWidth, 360, timeframe, true));
    chartRef.current = mainChart;

    const lineSeries = mainChart.addSeries(AreaSeries, {
      lineColor: '#38BDF8',
      topColor: 'rgba(56,189,248,0.18)',
      bottomColor: 'rgba(56,189,248,0.02)',
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    });
    lineSeries.setData(simpleRows.map((row) => ({ time: row.time, value: row.close })));
    
    const performFit = () => {
      if (mainChart && simpleRows.length > 0) {
        const timeScale = mainChart.timeScale();
        timeScale.setVisibleLogicalRange({
          from: 0,
          to: Math.max(simpleRows.length - 1, 10)
        });
        timeScale.fitContent();
      }
    };

    // Sequential fitting to handle DOM stabilization
    performFit();
    setTimeout(performFit, 50);
    setTimeout(performFit, 200);
    setTimeout(performFit, 500);

    mainChart.subscribeCrosshairMove((param) => {
      if (!param?.time) {
        setHoveredPoint(null);
        return;
      }
      const row = simpleRows[getNearestIndex(simpleRows, normalizeChartTime(param.time, simpleRows))] ?? null;
      if (!row) return;
      setHoveredPoint({ panelId: 'simple', timeframe, row, x: param.point?.x ?? 12, y: param.point?.y ?? 12 });
    });

    const resizeObserver = new ResizeObserver(() => {
      if (mainRef.current && mainChart) {
        mainChart.applyOptions({ width: mainRef.current.clientWidth, height: 360 });
        performFit();
      }
    });
    resizeObserver.observe(mainRef.current);

    // Initial fit
    performFit();

    return () => {
      resizeObserver.disconnect();
      destroySimpleChart();
    };
  }, [advanced, simpleRows, timeframe, symbol]);

  // Secondary data-driven fitting effect
  useEffect(() => {
    if (!advanced && chartRef.current && simpleRows.length > 0) {
      const timeScale = chartRef.current.timeScale();
      timeScale.setVisibleLogicalRange({ from: 0, to: simpleRows.length - 1 });
      timeScale.fitContent();
      // Final backup fit
      setTimeout(() => {
        if (chartRef.current) chartRef.current.timeScale().fitContent();
      }, 500);
    }
  }, [simpleRows, advanced]);

  const requestMoreHistory = useCallback((tf) => {
    setHistoryDepthByTimeframe((current) => ({
      ...current,
      [tf]: Math.min((current[tf] ?? 2) + 1, 6),
    }));
  }, []);

  const handleDrawingStart = useCallback((point) => {
    if (!DRAW_TOOLS.includes(selectedTool) || !point) return;

    if (selectedTool === 'horizontal') {
      const drawing = {
        id: `${selectedTool}-${Date.now()}`,
        type: 'horizontal',
        panelId: point.panelId,
        start: point,
        end: point,
      };
      setDrawings((current) => [...current, drawing]);
      setDraftDrawing(null);
      return;
    }

    setDraftDrawing({
      id: `${selectedTool}-${Date.now()}`,
      type: selectedTool,
      panelId: point.panelId,
      start: point,
      end: point,
    });
  }, [selectedTool]);

  const handleDrawingUpdate = useCallback((point) => {
    setDraftDrawing((current) => {
      if (!current || !point || current.panelId !== point.panelId) return current;
      return { ...current, end: point };
    });
  }, []);

  const handleDrawingEnd = useCallback((point) => {
    setDraftDrawing((current) => {
      if (!current) return null;
      const completed = point && current.panelId === point.panelId ? { ...current, end: point } : current;
      const sameAnchor = Math.abs(completed.start.time - completed.end.time) < 1 && Math.abs(completed.start.price - completed.end.price) < 0.01;
      if (completed.type !== 'horizontal' && sameAnchor) return null;
      setDrawings((existing) => [...existing, completed]);
      return null;
    });
  }, []);


  return (
    <div ref={containerRef} className="flex flex-col h-full bg-[#0f172a] text-slate-300 font-sans selection:bg-cyan-500/30 relative">
      {/* ── Fullscreen Exit Message ── */}
      {isFullscreen && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full text-[10px] font-black text-white/80 uppercase tracking-widest animate-in fade-in slide-in-from-top-4 duration-700">
          Press <span className="text-cyan-400">ESC</span> to exit full screen
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 h-12 border-b border-white/5 bg-[#111827]/80 backdrop-blur-md z-40">
        <div className="flex items-center">
          {advanced && (
            <button
              onClick={() => navigate(`/stocks/${symbol}`)}
              className="flex items-center gap-2 pr-4 border-r border-white/5 text-slate-400 hover:text-white transition-colors mr-6"
            >
              <ArrowLeft size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
              <span className="text-lg">{assetMeta.icon}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-black text-white tracking-tight">{symbol}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {assetMeta.exchange} · {assetMeta.currency}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 ml-6">
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-3 ml-2">
              <div className="text-lg font-black text-white leading-none">
                {formatCurrency(price, assetType, symbol)}
              </div>
              <div className={`text-xs font-bold px-2 py-0.5 rounded ${priceChange >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </div>
            </div>
          </div>

          {!advanced && (
            <div className="flex items-center ml-6">
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-2 ml-4">
                {['10m', '15m', '30m', '1H', '1D', '1W'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-4 py-1.5 text-[10px] font-black rounded-full transition-all duration-300 uppercase tracking-widest ${
                      timeframe === tf 
                      ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                      : 'text-slate-500 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          )}

          {advanced && (
            <>
              {/* ── Timeframe Dropdown ── */}
              <div className="relative border-l border-white/5 pl-6 ml-4">
                <button
                  onClick={() => { setShowTfMenu(!showTfMenu); setShowTypeMenu(false); setShowIndMenu(false); }}
                  className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-black rounded-lg transition-all ${showTfMenu ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-200 hover:bg-white/5'}`}
                >
                  {timeframe}
                  <ChevronDown size={14} className={`transition-transform duration-300 ${showTfMenu ? 'rotate-180' : ''}`} />
                </button>
                {showTfMenu && (
                  <div className="absolute top-10 left-6 w-40 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-2 animate-in fade-in slide-in-from-top-2">
                    <div className="px-3 py-1 text-[9px] font-black text-slate-500 uppercase tracking-widest">Minutes</div>
                    {['10m', '15m', '30m'].map(tf => (
                      <button key={tf} onClick={() => { setTimeframe(tf); setShowTfMenu(false); }} className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-cyan-500/10 transition-colors ${timeframe === tf ? 'text-cyan-400 bg-cyan-500/5' : 'text-slate-300'}`}>{tf === '10m' ? '10 minutes' : tf === '15m' ? '15 minutes' : '30 minutes'}</button>
                    ))}
                    <div className="h-px bg-white/5 my-1 mx-2" />
                    <div className="px-3 py-1 text-[9px] font-black text-slate-500 uppercase tracking-widest">Hours</div>
                    {['1H', '4H'].map(tf => (
                      <button key={tf} onClick={() => { setTimeframe(tf); setShowTfMenu(false); }} className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-cyan-500/10 transition-colors ${timeframe === tf ? 'text-cyan-400 bg-cyan-500/5' : 'text-slate-300'}`}>{tf === '1H' ? '1 hour' : '4 hours'}</button>
                    ))}
                    <div className="h-px bg-white/5 my-1 mx-2" />
                    <div className="px-3 py-1 text-[9px] font-black text-slate-500 uppercase tracking-widest">Days</div>
                    {['1D', '1W'].map(tf => (
                      <button key={tf} onClick={() => { setTimeframe(tf); setShowTfMenu(false); }} className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-cyan-500/10 transition-colors ${timeframe === tf ? 'text-cyan-400 bg-cyan-500/5' : 'text-slate-300'}`}>{tf === '1D' ? '1 day' : '1 week'}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Chart Type Dropdown ── */}
              <div className="relative border-l border-white/5 pl-4 ml-4">
                <button
                  onClick={() => { setShowTypeMenu(!showTypeMenu); setShowTfMenu(false); setShowIndMenu(false); }}
                  className={`p-1.5 rounded-lg transition-all ${showTypeMenu ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <BarChart2 size={18} />
                </button>
                {showTypeMenu && (
                  <div className="absolute top-10 left-4 w-44 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-2 animate-in fade-in slide-in-from-top-2">
                    {[
                      { id: 'candles', label: 'Candles', icon: Square },
                      { id: 'hollow', label: 'Hollow Candles', icon: Square },
                      { id: 'heikin', label: 'Heikin Ashi', icon: TrendingUp },
                      { id: 'line', label: 'Line', icon: Activity },
                      { id: 'area', label: 'Area', icon: Activity },
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => { setChartType(type.id); setShowTypeMenu(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center gap-3 hover:bg-white/5 transition-colors ${chartType === type.id ? 'text-cyan-400 bg-cyan-500/5' : 'text-slate-300'}`}
                      >
                        <type.icon size={14} className="opacity-50" />
                        {type.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Indicators Menu ── */}
              <div className="relative border-l border-white/5 pl-4 ml-4">
                <button
                  onClick={() => { setShowIndMenu(!showIndMenu); setShowTfMenu(false); setShowTypeMenu(false); }}
                  className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-black rounded-lg transition-all ${showIndMenu ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Activity size={14} />
                  <span className="uppercase tracking-widest text-[10px]">Indicators</span>
                </button>
                {showIndMenu && (
                  <div className="absolute top-10 left-4 w-48 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-3 px-2 animate-in fade-in slide-in-from-top-2">
                    <div className="px-2 pb-2">
                      <input type="text" placeholder="Search indicators..." className="w-full bg-[#0f172a] border border-white/5 rounded-lg px-3 py-1.5 text-[10px] text-slate-400 outline-none focus:border-cyan-500/30" />
                    </div>
                    {['EMA', 'RSI', 'MACD', 'Volume'].map((ind) => (
                      <button
                        key={ind}
                        onClick={() => setIndicators(prev => ({ ...prev, [ind.toLowerCase()]: !prev[ind.toLowerCase()] }))}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between hover:bg-white/5 transition-all ${indicators[ind.toLowerCase()] ? 'text-cyan-400' : 'text-slate-400'}`}
                      >
                        {ind}
                        {indicators[ind.toLowerCase()] && <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Undo/Redo ── */}
              <div className="flex items-center gap-1 border-l border-white/5 pl-4 ml-4">
                <button className="p-1.5 text-slate-500 hover:text-white transition-colors"><RotateCcw size={16} /></button>
                <button className="p-1.5 text-slate-500 hover:text-white transition-colors rotate-180 scale-y-[-1]"><RotateCcw size={16} /></button>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-8">
            <div className="h-4 w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Volume</span>
              <span className="text-xs font-black text-slate-200">9.06M</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">ATR</span>
              <span className="text-xs font-black text-slate-200">42.8</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Sentiment</span>
              <span className="text-xs font-black text-emerald-400 uppercase">Positive</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!advanced && (
              <button
                onClick={() => navigate(`/chart/${symbol}`)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-400 border border-white/10 text-[10px] font-black transition-all group"
              >
                <Maximize2 size={14} className="group-hover:scale-110 transition-transform" />
                FULL CHART
              </button>
            )}

            {advanced && (
              <div className="relative">
                <button
                  onClick={() => setShowLayoutMenu(!showLayoutMenu)}
                  className={`p-2 rounded-lg transition-all ${showLayoutMenu ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-500 hover:text-white'}`}
                >
                  <Layout size={18} />
                </button>
                {showLayoutMenu && (
                  <div className="absolute top-10 right-0 w-32 bg-[#1e293b]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl z-50 p-2 grid grid-cols-2 gap-2">
                    <button onClick={() => { setLayout('1'); setShowLayoutMenu(false); }} className={`p-2 rounded hover:bg-white/5 flex items-center justify-center ${layout === '1' ? 'text-cyan-400' : 'text-slate-500'}`}><Square size={16} /></button>
                    <button onClick={() => { setLayout('2-v'); setShowLayoutMenu(false); }} className={`p-2 rounded hover:bg-white/5 flex items-center justify-center ${layout === '2-v' ? 'text-cyan-400' : 'text-slate-500'}`}><div className="flex gap-0.5"><div className="w-2 h-4 border border-current opacity-50" /><div className="w-2 h-4 border border-current opacity-50" /></div></button>
                    <button onClick={() => { setLayout('2-h'); setShowLayoutMenu(false); }} className={`p-2 rounded hover:bg-white/5 flex items-center justify-center ${layout === '2-h' ? 'text-cyan-400' : 'text-slate-500'}`}><div className="flex flex-col gap-0.5"><div className="w-4 h-2 border border-current opacity-50" /><div className="w-4 h-2 border border-current opacity-50" /></div></button>
                    <button onClick={() => { setLayout('4'); setShowLayoutMenu(false); }} className={`p-2 rounded hover:bg-white/5 flex items-center justify-center ${layout === '4' ? 'text-cyan-400' : 'text-slate-500'}`}><div className="grid grid-cols-2 gap-0.5"><div className="w-2 h-2 border border-current opacity-50" /><div className="w-2 h-2 border border-current opacity-50" /><div className="w-2 h-2 border border-current opacity-50" /><div className="w-2 h-2 border border-current opacity-50" /></div></button>
                  </div>
                )}
              </div>
            )}

            {advanced && (
              <>
                <button
                  onClick={toggleFullscreen}
                  className={`p-2 transition-all ${isFullscreen ? 'text-cyan-400' : 'text-slate-500 hover:text-white'}`}
                >
                  <Maximize2 size={18} />
                </button>
                <button
                  onClick={() => setRightPanelOpen(!rightPanelOpen)}
                  className={`p-2 transition-all ${rightPanelOpen ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-500 hover:text-white transition-colors'}`}
                >
                  <Menu size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 relative bg-[#0f172a]">
        {/* ── Fixed Left Sidebar Toolbar (Advanced Only) ── */}
        {advanced && (
          <div className="w-14 border-r border-white/5 bg-[#111827]/40 flex flex-col items-center py-4 gap-4 z-40">
            <div className="flex flex-col gap-2">
              {floatingTools.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => setSelectedTool(toggleTool(selectedTool, tool.id))}
                  title={tool.label}
                  className={`p-2.5 rounded-xl transition-all relative group/tool ${selectedTool === tool.id ? 'bg-cyan-500 text-white shadow-xl shadow-cyan-500/40' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
                >
                  <tool.icon size={20} />
                  <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-[10px] font-bold text-white rounded opacity-0 pointer-events-none group-hover/tool:opacity-100 transition-opacity whitespace-nowrap border border-white/10 z-50">
                    {tool.label}
                  </div>
                </button>
              ))}
              <div className="h-px bg-white/10 mx-2 my-2" />
              <button
                onClick={() => { setDrawings([]); setDraftDrawing(null); }}
                title="Clear Drawings"
                className="p-2.5 rounded-xl text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-all"
              >
                <Eraser size={20} />
              </button>
            </div>
          </div>
        )}

        {/* ── Main Viewport Area ── */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0f172a] relative">
          {advanced ? (
            <div className={`grid h-full w-full gap-px bg-white/5 ${
              layout === '1' ? 'grid-cols-1' :
              layout === '2-v' ? 'grid-cols-2' :
              layout === '2-h' ? 'grid-rows-2' :
              'grid-cols-2 grid-rows-2'
            }`}>
              {Array.from({ length: layout === '4' ? 4 : layout.startsWith('2') ? 2 : 1 }).map((_, idx) => (
                <ResearchChartViewport
                  key={`${layout}-${idx}`}
                  panelId={`${timeframe}-${idx}`}
                  timeframe={timeframe}
                  rows={displayedRowsByTimeframe[timeframe] ?? []}
                  drawings={drawings}
                  draftDrawing={draftDrawing}
                  selectedTool={selectedTool}
                  onDrawingStart={handleDrawingStart}
                  onDrawingUpdate={handleDrawingUpdate}
                  onDrawingEnd={handleDrawingEnd}
                  height={layout === '1' ? window.innerHeight - 80 : layout === '2-h' ? (window.innerHeight - 80) / 2 : layout === '4' ? (window.innerHeight - 80) / 2 : window.innerHeight - 80}
                  showRsi={indicators.rsi}
                  showMacd={indicators.macd}
                  showEma={indicators.ema}
                  showVolume={indicators.volume}
                  chartType={chartType}
                  settings={chartSettings}
                  onRequestMoreHistory={requestMoreHistory}
                />
              ))}
            </div>
          ) : (
            <div ref={mainRef} className="h-full w-full" />
          )}

          {/* ── Advanced Settings Overlay ── */}
          {showSettings && (
            <div className="absolute top-4 right-4 w-80 bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-white">Chart Settings</span>
                <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto custom-scrollbar">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Theme</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setChartSettings(prev => ({ ...prev, theme: 'dark' }))}
                      className={`flex items-center justify-center py-3 rounded-xl text-[11px] font-black uppercase tracking-tight transition-all ${chartSettings.theme === 'dark' ? 'bg-cyan-500 text-[#0f172a] shadow-lg shadow-cyan-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                    >
                      Dark
                    </button>
                    <button
                      onClick={() => setChartSettings(prev => ({ ...prev, theme: 'light' }))}
                      className={`flex items-center justify-center py-3 rounded-xl text-[11px] font-black uppercase tracking-tight transition-all ${chartSettings.theme === 'light' ? 'bg-cyan-500 text-[#0f172a] shadow-lg shadow-cyan-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                    >
                      Light
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Visibility</label>
                  <div className="space-y-2">
                    {[
                      { id: 'grid', label: 'Grid Lines' },
                      { id: 'watermark', label: 'Symbol Watermark' },
                      { id: 'sessionBreaks', label: 'Session Breaks' },
                      { id: 'priceLabels', label: 'Price Labels' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setChartSettings(prev => ({ ...prev, [opt.id]: !prev[opt.id] }))}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all group"
                      >
                        <span className={`text-xs font-bold ${chartSettings[opt.id] ? 'text-slate-200' : 'text-slate-500'}`}>{opt.label}</span>
                        <div className={`w-8 h-4 rounded-full relative transition-all ${chartSettings[opt.id] ? 'bg-cyan-500/40' : 'bg-slate-700'}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${chartSettings[opt.id] ? 'left-4.5 shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'left-0.5'}`} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Price Source</label>
                  <div className="relative">
                    <select className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none appearance-none cursor-pointer focus:border-cyan-500/50 transition-colors">
                      <option>Open</option>
                      <option>High</option>
                      <option>Low</option>
                      <option>Close</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>



        {/* ── Right Panel: Insights & Signals (Advanced Only) ── */}
        {advanced && (
          <div className="w-[300px] border-l border-white/5 bg-[#0f172a] flex flex-col z-30 animate-in slide-in-from-right duration-500">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-white">Insights</span>
              <Activity size={16} className="text-cyan-400" />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-8">
              {/* Trend Analysis */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Technical Trend</label>
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black text-emerald-400">Strong Bullish</div>
                    <div className="text-[10px] font-bold text-slate-500 mt-0.5">Confirmed by EMA 20/50</div>
                  </div>
                  <TrendingUp className="text-emerald-500" size={24} />
                </div>
              </div>

              {/* Live Signals */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Signals</label>
                <div className="space-y-3">
                  {[
                    { label: 'EMA Crossover', status: 'Bullish Cross', color: 'text-emerald-400' },
                    { label: 'RSI Momentum', status: 'Oversold Recovery', color: 'text-cyan-400' },
                    { label: 'MACD Histogram', status: 'Positive Divergence', color: 'text-emerald-400' },
                  ].map(sig => (
                    <div key={sig.label} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-[11px] font-bold text-slate-400">{sig.label}</span>
                      <span className={`text-[10px] font-black uppercase ${sig.color}`}>{sig.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Levels */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Key Levels</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
                    <div className="text-[9px] font-black text-rose-400 uppercase mb-1">Resistance</div>
                    <div className="text-xs font-black text-white tabular-nums">2,984.70</div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                    <div className="text-[9px] font-black text-emerald-400 uppercase mb-1">Support</div>
                    <div className="text-xs font-black text-white tabular-nums">2,810.15</div>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-4 pt-4">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                  <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                    The asset is showing a strong recovery pattern from the support level at 2,810. RSI has exited the oversold zone, confirming immediate bullish momentum.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Metrics */}
            <div className="p-4 border-t border-white/5 bg-[#111827]/50 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Volatility (ATR)</span>
                <span className="text-xs font-black text-white tabular-nums">42.85</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Score</span>
                <span className="text-xs font-black text-emerald-400 tabular-nums">84/100</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Research Footer ── */}
      <div className="h-8 border-t border-white/5 bg-[#111827] flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
            <div className={`w-2 h-2 rounded-full ${mktOpen ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
            Connected
          </div>
          <div className={`text-[10px] font-bold uppercase tracking-widest border-l border-white/5 pl-4 ${mktOpen ? 'text-emerald-500' : 'text-slate-600'}`}>
            {isCrypto ? 'CRYPTO MARKET: OPEN 24/7' : (mktOpen ? 'MARKET OPEN' : 'MARKET CLOSED')}
          </div>
        </div>
        <div className="text-[10px] font-mono text-slate-600 flex items-center gap-4">
          <span>UTC +5:30</span>
          <span className="text-cyan-500/50">AUTO</span>
        </div>
      </div>
    </div>
  );
}
