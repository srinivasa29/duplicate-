import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  createChart, ColorType,
  CandlestickSeries, LineSeries, HistogramSeries,
  AreaSeries, BarSeries, BaselineSeries,
} from 'lightweight-charts';
import { HeikinAshi } from 'technicalindicators';
import useChartData from '../../../hooks/useChartData';
import useChartSocket from '../../../hooks/useChartSocket';
import useIndicators from '../../../hooks/useIndicators';
import { Loader2, AlertCircle } from 'lucide-react';

// ── Heikin Ashi transform ─────────────────────────────────────────────────────
const toHeikinAshi = (data) => {
  if (!data?.length) return [];
  const ha = HeikinAshi.calculate({
    open: data.map(d => d.open),
    high: data.map(d => d.high),
    low: data.map(d => d.low),
    close: data.map(d => d.close),
    volume: data.map(d => d.volume || 0),
  });
  return data.map((d, i) => ({
    time: d.time,
    open: ha.open[i], high: ha.high[i],
    low: ha.low[i], close: ha.close[i],
  }));
};

// ── Mock data fallback ────────────────────────────────────────────────────────
const generateMockData = (symbol) => {
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) seed += symbol.charCodeAt(i);
  const rng = () => { const x = Math.sin(seed++) * 10000; return x - Math.floor(x); };

  const data = [];
  let price = 100 + rng() * 1500;
  const now = Math.floor(Date.now() / 1000);

  for (let i = 365; i >= 0; i--) {
    const vol = price * 0.02;
    const open = price;
    const close = Math.max(1, open + (rng() * vol * 2) - vol);
    const high = Math.max(open, close) + rng() * vol;
    const low = Math.max(1, Math.min(open, close) - rng() * vol);
    data.push({ time: now - i * 86400, open, high, low, close, volume: Math.floor(50000 + rng() * 500000) });
    price = close;
  }
  return data;
};

// ── Color helpers ─────────────────────────────────────────────────────────────
const UP_COLOR = '#22c55e';
const DOWN_COLOR = '#ef4444';
const candleColor = (d) => (d.close >= d.open ? UP_COLOR : DOWN_COLOR);
const calculateEMA = (data, period = 20) => {

  if (!data?.length) return [];

  const multiplier = 2 / (period + 1);

  let emaPrev = data[0].close;

  return data.map((candle, index) => {

    if (index === 0) {
      return {
        time: candle.time,
        value: candle.close,
      };
    }

    const ema =
      (candle.close - emaPrev) * multiplier + emaPrev;

    emaPrev = ema;

    return {
      time: candle.time,
      value: parseFloat(ema.toFixed(2)),
    };
  });
};

// ── Theme configs ─────────────────────────────────────────────────────────────
const getThemeConfig = (isDark, showGrid, showCrosshair) => ({
  layout: {
    textColor: isDark ? '#94a3b8' : '#64748b',
    background: { type: ColorType.Solid, color: isDark ? '#0f172a' : '#ffffff' },
    fontSize: 11,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  grid: {
    vertLines: { color: showGrid ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)') : 'transparent' },
    horzLines: { color: showGrid ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)') : 'transparent' },
  },
  crosshair: { mode: showCrosshair !== false ? 1 : 2 },
  timeScale: { borderColor: 'transparent', borderVisible: false, timeVisible: true, fixLeftEdge: false, rightOffset: 5 },
  rightPriceScale: { borderColor: 'transparent', borderVisible: false },
  handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
  handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
});

// ─────────────────────────────────────────────────────────────────────────────
const ChartPane = ({
  panel,
  interval,
  historyRange,
  //timeframe,
  isActive,
  onSelect,
  settings,           // global settings
  crosshairSync,
  onCrosshairMove,
  rangeSync,
  onRangeChange,
  customFrom,
  customTo,
}) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const indicatorSeriesRef = useRef([]);
  const ema20SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const [hoverData, setHoverData] = useState(null);
  const [selectedCandle, setSelectedCandle] = useState(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });

  const { data: fetchedData, loading, error } = useChartData(
    panel.symbol,
    interval,
    historyRange,
    //timeframe,
    customFrom,
    customTo
  )

  // Use fetched data or fall back to mock
  const [data, setData] = useState([]);
  useEffect(() => {
    if (fetchedData?.length) {
      setData(fetchedData);
    } else if (!loading) {
      setData([]); // Never use mock data
    }
  }, [fetchedData, loading, panel.symbol]);

  // Indicators
  const indicators = useIndicators(data, panel.indicators);

  // Live WebSocket updates
  useChartSocket(panel.symbol, useCallback((tick) => {
    if (!mainSeriesRef.current) return;
    const candle = {
      time: tick.time || Math.floor(Date.now() / 1000),
      open: tick.open || tick.price || 0,
      high: tick.high || tick.price || 0,
      low: tick.low || tick.price || 0,
      close: tick.close || tick.price || 0,
      volume: tick.volume || 0,
    };
    try { mainSeriesRef.current.update(candle); } catch (_) { }
  }, []));

  // ── Build chart ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    if (!data.length) {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        mainSeriesRef.current = null;
      }
      return;
    }

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
    const isDark = settings.theme === 'dark';
    const showGrid = settings.showGrid !== false;
    const showCrosshair = settings.showCrosshair !== false;

    // Count panel indicators for layout math
    const panelInds = panel.indicators ? ['rsi', 'macd', 'stoch', 'obv', 'atr']
      .filter(k => panel.indicators[k]) : [];
    const panelCount = panelInds.length;
    const mainHeightFrac = panelCount > 0 ? 0.60 - panelCount * 0.01 : 0.95;

    /*const chart = createChart(containerRef.current, {
      ...getThemeConfig(isDark, showGrid, showCrosshair),
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });*/
    const chart = createChart(containerRef.current, {
      ...getThemeConfig(isDark, showGrid, showCrosshair),

      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,

      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chart.applyOptions({
      rightPriceScale: {
        scaleMargins: { top: 0.05, bottom: panelCount > 0 ? 1 - mainHeightFrac + 0.05 : 0.05 },
        borderVisible: false,
      },
    });

    chartRef.current = chart;

    // ── Main Series ──────────────────────────────────────────────────────────
    let mainSeries;
    const precision = parseInt(settings.precision || 2, 10);
    const minMove = 1 / Math.pow(10, precision);
    const priceFormat = { type: 'price', precision, minMove };

    const chartType = panel.chartType || settings.chartType || 'candlestick';

    switch (chartType) {
      case 'hollow_candle':
      case 'candlestick':
        mainSeries = chart.addSeries(CandlestickSeries, {
          upColor: UP_COLOR, downColor: DOWN_COLOR,
          borderVisible: chartType === 'hollow_candle',
          wickUpColor: UP_COLOR, wickDownColor: DOWN_COLOR,
          priceFormat,
        });
        mainSeries.setData(chartType === 'heikinAshi' ? toHeikinAshi(data) : data);
        break;

      case 'heikinAshi':
        mainSeries = chart.addSeries(CandlestickSeries, {
          upColor: UP_COLOR, downColor: DOWN_COLOR,
          borderVisible: false,
          wickUpColor: UP_COLOR, wickDownColor: DOWN_COLOR,
          priceFormat,
        });
        mainSeries.setData(toHeikinAshi(data));
        break;

      case 'bars':
        mainSeries = chart.addSeries(BarSeries, {
          upColor: UP_COLOR, downColor: DOWN_COLOR, priceFormat,
        });
        mainSeries.setData(data);
        break;

      case 'line':
        mainSeries = chart.addSeries(LineSeries, {   //change series to lineSeries
          color: '#3b82f6', lineWidth: 2,
          priceLineVisible: true, lastValueVisible: true, priceFormat,
        });
        mainSeries.setData(data.map(d => ({ time: d.time, value: d.close })));
        break;

      case 'area':
        mainSeries = chart.addSeries(AreaSeries, {
          lineColor: '#3b82f6',
          topColor: 'rgba(59,130,246,0.35)',
          bottomColor: 'rgba(59,130,246,0.02)',
          lineWidth: 2, priceFormat,
        });
        mainSeries.setData(data.map(d => ({ time: d.time, value: d.close })));
        break;

      case 'baseline':
        mainSeries = chart.addSeries(BaselineSeries, {
          baseValue: { type: 'price', price: data[0]?.close || 0 },
          topLineColor: UP_COLOR, topFillColor1: 'rgba(34,197,94,0.28)', topFillColor2: 'rgba(34,197,94,0.04)',
          bottomLineColor: DOWN_COLOR, bottomFillColor1: 'rgba(239,68,68,0.04)', bottomFillColor2: 'rgba(239,68,68,0.28)',
          priceFormat,
        });
        mainSeries.setData(data.map(d => ({ time: d.time, value: d.close })));
        break;

      default:
        mainSeries = chart.addSeries(CandlestickSeries, {
          upColor: UP_COLOR, downColor: DOWN_COLOR,
          borderVisible: false, wickUpColor: UP_COLOR, wickDownColor: DOWN_COLOR,
          priceFormat,
        });
        mainSeries.setData(data);
    }

    mainSeriesRef.current = mainSeries;
    indicatorSeriesRef.current = [];
    const chartData =
      chartType === 'heikinAshi'
        ? toHeikinAshi(data)
        : data;

    // EMA 20 and EMA 50 defaults removed as per user request.
    // ── Volume ───────────────────────────────────────────────────────────────
    if (settings.showVolume !== false && panel.showVolume !== false && data.some(d => d.volume > 0)) {
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        color: 'rgba(100,116,139,0.4)',
      });
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 }, borderVisible: false,
      });
      volSeries.setData(data.map(d => ({
        time: d.time,
        value: d.volume || 0,
        color: d.close >= d.open ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
      })));
      volumeSeriesRef.current = volSeries;
    }

    // ── Overlay indicators ───────────────────────────────────────────────────
    if (indicators.sma?.length) {
      const s = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1.5, priceLineVisible: false, title: 'SMA(20)' });
      s.setData(indicators.sma);
      indicatorSeriesRef.current.push(s);
    }
    if (indicators.ema?.length) {
      const s = chart.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1.5, priceLineVisible: false, title: 'EMA(9)' });
      s.setData(indicators.ema);
      indicatorSeriesRef.current.push(s);
    }
    if (indicators.bb) {
      const commonBB = { priceLineVisible: false, lineWidth: 1 };
      const upper = chart.addSeries(LineSeries, { ...commonBB, color: 'rgba(99,102,241,0.6)', title: 'BB Up' });
      const middle = chart.addSeries(LineSeries, { ...commonBB, color: 'rgba(99,102,241,0.4)', title: 'BB Mid' });
      const lower = chart.addSeries(LineSeries, { ...commonBB, color: 'rgba(99,102,241,0.6)', title: 'BB Lo' });
      if (indicators.bb.upper?.length) upper.setData(indicators.bb.upper);
      if (indicators.bb.middle?.length) middle.setData(indicators.bb.middle);
      if (indicators.bb.lower?.length) lower.setData(indicators.bb.lower);
      indicatorSeriesRef.current.push(upper, middle, lower);
    }
    if (indicators.vwap?.length) {
      const s = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1.5, priceLineVisible: false, title: 'VWAP' });
      s.setData(indicators.vwap);
      indicatorSeriesRef.current.push(s);
    }

    // ── Sub-panel indicators ─────────────────────────────────────────────────
    const PANEL_COLORS = { rsi: '#ec4899', macd: '#06b6d4', stoch: '#10b981', obv: '#ef4444', atr: '#6366f1' };

    panelInds.forEach((key, idx) => {
      const scaleId = key;
      const top = mainHeightFrac + idx * ((1 - mainHeightFrac) / Math.max(panelCount, 1)) + 0.01;
      const bottom = 1 - (top + (1 - mainHeightFrac) / Math.max(panelCount, 1)) + 0.01;
      const margins = { top: Math.max(0, top), bottom: Math.max(0, bottom) };

      if (key === 'rsi' && indicators.rsi?.length) {
        const s = chart.addSeries(LineSeries, { color: PANEL_COLORS.rsi, lineWidth: 1.5, priceScaleId: 'rsi', priceLineVisible: false, title: 'RSI(14)' });
        s.setData(indicators.rsi);
        chart.priceScale('rsi').applyOptions({ scaleMargins: margins, borderVisible: false });
        indicatorSeriesRef.current.push(s);
      }

      if (key === 'macd' && indicators.macd) {
        const { macd, signal, hist } = indicators.macd;
        if (macd?.length) {
          const mLine = chart.addSeries(LineSeries, { color: '#2196F3', lineWidth: 1.5, priceScaleId: 'macd', priceLineVisible: false, title: 'MACD' });
          const sLine = chart.addSeries(LineSeries, { color: '#FF5252', lineWidth: 1.5, priceScaleId: 'macd', priceLineVisible: false, title: 'Signal' });
          const hBar = chart.addSeries(HistogramSeries, { priceScaleId: 'macd', priceLineVisible: false, title: 'Hist' });
          mLine.setData(macd.filter(d => d.value !== null));
          sLine.setData(signal.filter(d => d.value !== null));
          hBar.setData(hist.filter(d => d.value !== null).map(d => ({
            ...d, color: d.value >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)',
          })));
          chart.priceScale('macd').applyOptions({ scaleMargins: margins, borderVisible: false });
          indicatorSeriesRef.current.push(mLine, sLine, hBar);
        }
      }

      if (key === 'stoch' && indicators.stoch) {
        const { k, d } = indicators.stoch;
        if (k?.length) {
          const kLine = chart.addSeries(LineSeries, { color: PANEL_COLORS.stoch, lineWidth: 1.5, priceScaleId: 'stoch', priceLineVisible: false, title: '%K' });
          const dLine = chart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1.5, priceScaleId: 'stoch', priceLineVisible: false, title: '%D' });
          kLine.setData(k.filter(d => d.value !== null));
          dLine.setData(d.filter(d => d.value !== null));
          chart.priceScale('stoch').applyOptions({ scaleMargins: margins, borderVisible: false });
          indicatorSeriesRef.current.push(kLine, dLine);
        }
      }

      if (key === 'obv' && indicators.obv?.length) {
        const s = chart.addSeries(LineSeries, { color: PANEL_COLORS.obv, lineWidth: 1.5, priceScaleId: 'obv', priceLineVisible: false, title: 'OBV' });
        s.setData(indicators.obv);
        chart.priceScale('obv').applyOptions({ scaleMargins: margins, borderVisible: false });
        indicatorSeriesRef.current.push(s);
      }

      if (key === 'atr' && indicators.atr?.length) {
        const s = chart.addSeries(LineSeries, { color: PANEL_COLORS.atr, lineWidth: 1.5, priceScaleId: 'atr', priceLineVisible: false, title: 'ATR(14)' });
        s.setData(indicators.atr);
        chart.priceScale('atr').applyOptions({ scaleMargins: margins, borderVisible: false });
        indicatorSeriesRef.current.push(s);
      }
    });

    // ── Resize observer ──────────────────────────────────────────────────────
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      requestAnimationFrame(() => chartRef.current?.applyOptions({ width, height }));
    });
    ro.observe(containerRef.current);

    // ── Crosshair sync ───────────────────────────────────────────────────────
    /*chart.subscribeCrosshairMove(param => {
      if (param.time) {
        onCrosshairMove?.(panel.id, param);
        const price = param.seriesData.get(mainSeries);
        if (price) {
          setHoverData({
            time: new Date(param.time * 1000).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
              day: '2-digit',
              month: 'short',
              year: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }),
            open: price.open || price.value,
            high: price.high || price.value,
            low: price.low || price.value,
            close: price.close || price.value,
          });
        } else {
          setHoverData(null);
        }
      } else {
        setHoverData(null);
      }
    });*/
    chart.subscribeCrosshairMove(param => {

      if (
        !param ||
        !param.point ||
        !param.time ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        setHoverData(null);
        return;
      }

      onCrosshairMove?.(panel.id, param);

      const price = param.seriesData.get(mainSeries);

      if (!price) {
        setHoverData(null);
        return;
      }

      let formattedDate = '';

      // Intraday candles
      if (typeof param.time === 'number') {

        formattedDate = new Date(param.time * 1000)
          .toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });

      }

      // Daily / Weekly / Monthly candles
      else if (param.time.year) {

        formattedDate =
          `${param.time.day}/${param.time.month}/${param.time.year}`;

      }

      setHoverData({
        time: formattedDate,

        open: price.open ?? price.value,
        high: price.high ?? price.value,
        low: price.low ?? price.value,
        close: price.close ?? price.value,
      });

    });

    chart.subscribeClick(param => {
      if (param.time && param.point) {
        const price = param.seriesData.get(mainSeries);
        if (price) {
          selectedCandletSelectedCandle({
            /*time: new Date(param.time * 1000).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
              day: '2-digit',
              month: 'short',
              year: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }),*/
            time:

              typeof param.time === 'number'

                ? new Date(param.time * 1000).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  day: '2-digit',
                  month: 'short',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })

                : `${param.time.day}/${param.time.month}/${param.time.year}`,
            open: price.open || price.value,
            high: price.high || price.value,
            low: price.low || price.value,
            close: price.close || price.value,
            volume: data.find(d => d.time === param.time)?.volume || 0
          });
          setPopupPos({ x: param.point.x, y: param.point.y });
        }
      } else {
        setSelectedCandle(null);
      }
    });

    chart.timeScale().subscribeVisibleTimeRangeChange(range => {
      if (range) onRangeChange?.(panel.id, range);
    });

    chart.timeScale().fitContent();

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data,
    panel.historyRange,
    panel.chartType,
    panel.indicators,
    panel.showVolume,
    panel.symbol,
    settings.theme,
    settings.showGrid,
    settings.showVolume,
    settings.showCrosshair,
    settings.precision,
    settings.chartType
  ]);

  // ── External crosshair sync ──────────────────────────────────────────────
  useEffect(() => {
    if (!crosshairSync || !mainSeriesRef.current || !chartRef.current) return;
    try {
      chartRef.current.setCrosshairPosition(
        crosshairSync.price || 0,
        crosshairSync.time,
        mainSeriesRef.current
      );
    } catch (_) { }
  }, [crosshairSync]);

  // ── External range sync ──────────────────────────────────────────────────
  useEffect(() => {
    if (!rangeSync || !chartRef.current) return;
    try { chartRef.current.timeScale().setVisibleRange(rangeSync); } catch (_) { }
  }, [rangeSync]);

  // ── Latest price label ────────────────────────────────────────────────────
  const latestCandle = data[data.length - 1];
  const prevCandle = data[data.length - 2];
  const change = latestCandle && prevCandle
    ? ((latestCandle.close - prevCandle.close) / prevCandle.close * 100)
    : 0;
  const isUp = change >= 0;

  return (
    <div
      className={`relative w-full h-full flex flex-col cursor-pointer select-none rounded-xl overflow-hidden border-2 transition-all duration-200 ${isActive
        ? 'border-blue-500 shadow-lg shadow-blue-100/30'
        : 'border-transparent hover:border-slate-200'
        }`}
      style={{ background: settings.theme === 'dark' ? '#0f172a' : '#ffffff' }}
      onClick={onSelect}
    >
      {/* ── Legend bar ─────────────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 flex-wrap pointer-events-none">
        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${isActive ? 'bg-blue-600 text-white' : (settings.theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800')
          }`}>
          {panel.symbol}
        </span>
        {(hoverData || latestCandle) && (
          <div className="flex items-center gap-3 ml-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase">O</span>
              <span className={`text-[10px] font-black ${settings.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {(hoverData?.open || latestCandle?.open).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase">H</span>
              <span className={`text-[10px] font-black ${settings.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {(hoverData?.high || latestCandle?.high).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase">L</span>
              <span className={`text-[10px] font-black ${settings.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {(hoverData?.low || latestCandle?.low).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase">C</span>
              <span className={`text-[10px] font-black ${settings.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {(hoverData?.close || latestCandle?.close).toFixed(2)}
              </span>
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${(hoverData ? (hoverData.close >= hoverData.open) : isUp)
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
              }`}>
              {hoverData
                ? `${hoverData.close >= hoverData.open ? '+' : ''}${(((hoverData.close - hoverData.open) / hoverData.open) * 100).toFixed(2)}%`
                : `${isUp ? '+' : ''}${change.toFixed(2)}%`
              }
            </span>
          </div>
        )}
        {/* Active indicator labels */}
        {panel.indicators.sma && <span className="text-[8px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">SMA·20</span>}
        {panel.indicators.ema && <span className="text-[8px] font-black text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded">EMA·9</span>}
        {panel.indicators.bb && <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">BB</span>}
        {panel.indicators.vwap && <span className="text-[8px] font-black text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">VWAP</span>}
      </div>

      {/* ── Loading overlay ──────────────────────────────────────────────── */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading {panel.symbol}…</p>
          </div>
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────────── */}
      {error && !loading && !data.length && (
        <div className="absolute top-10 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">
            <AlertCircle className="w-3 h-3 text-red-500" />
            <span className="text-[9px] font-bold text-red-600">Failed to fetch chart data</span>
          </div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && !data.length && !error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none opacity-60">
          <AlertCircle className="w-8 h-8 text-slate-400 mb-2" />
          <span className="text-xs font-bold text-slate-500">No trading data available</span>
          <span className="text-[10px] text-slate-400">Try adjusting the history or interval settings.</span>
        </div>
      )}

      {/* ── Chart container ───────────────────────────────────────────────── */}
      <div ref={containerRef} className="w-full h-full" />

      {/* ── Click Popup Box ────────────────────────────────────────────────── */}
      {selectedCandle && (
        <div
          className={`absolute z-30 pointer-events-auto p-4 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in fade-in zoom-in duration-200 ${settings.theme === 'dark'
            ? 'bg-slate-900/90 border-slate-700 text-white'
            : 'bg-white/90 border-slate-200 text-slate-900'
            }`}
          /*style={{
            left: Math.min(popupPos.x + 20, containerRef.current?.clientWidth - 180 || 0),
            //top: Math.min(popupPos.y + 20, containerRef.current?.clientHeight - 200 || 0),
            
            width: '160px'
          }}*/
          style={{
            position: 'absolute',

            left: Math.max(
              20,
              Math.min(
                popupPos.x + 20,
                (containerRef.current?.clientWidth || 0) - 220
              )
            ),

            top: Math.max(
              20,
              Math.min(
                popupPos.y - 20,
                (containerRef.current?.clientHeight || 0) - 260
              )
            ),

            width: '180px',

            zIndex: 9999,
          }}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-black text-blue-500 uppercase">Data Point</span>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedCandle(null); }}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <AlertCircle size={14} className="rotate-45" />
            </button>
          </div>

          <div className="space-y-2.5">
            {[
              { label: 'Open', val: selectedCandle.open },
              { label: 'High', val: selectedCandle.high },
              { label: 'Low', val: selectedCandle.low },
              { label: 'Close', val: selectedCandle.close },
            ].map((item, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase">{item.label}</span>
                <span className="text-[11px] font-black tracking-tight">₹{item.val.toFixed(2)}</span>
              </div>
            ))}

            <div className="pt-2 mt-2 border-t border-slate-500/10">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Volume</span>
                <span className="text-[10px] font-black text-slate-500">
                  {selectedCandle.volume > 1000000
                    ? `${(selectedCandle.volume / 1000000).toFixed(2)}M`
                    : selectedCandle.volume.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Date</span>
                <span className="text-[9px] font-bold text-blue-400">
                  {new Date((typeof selectedCandle.time === 'number' ? selectedCandle.time : selectedCandle.time.year) * 1000).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartPane;

