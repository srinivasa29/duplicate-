import { useState, useEffect } from "react";
import { useAsset } from "../../context/AssetContext";
import { fetchMarketHistory } from "../../api/marketApi";
import { Settings, Maximize2 } from "lucide-react";
import { ResponsiveContainer, AreaChart, Tooltip, XAxis, YAxis, Area, Line, CartesianGrid } from "recharts";

const BACKEND_SYMBOL_MAP = {
  RELIANCE: "RELIANCE.NS",
  HDFCBANK: "HDFCBANK.NS",
  INFY: "INFY.NS",
  TCS: "TCS.NS",
  "NIFTY 50": "^NSEI",
  BANKNIFTY: "^NSEBANK",
  SENSEX: "^BSESN",
  "NIFTY IT": "^CNXIT",
};

const BACKEND_INTERVAL_MAP = {
  "1m": "1D",
  "5m": "1D",
  "15m": "1D",
  "1h": "1D",
  "4h": "1W",
  "1D": "1M",
};

const FALLBACK_BASE_PRICE = {
  "NIFTY 50": 22500,
  BANKNIFTY: 48500,
  SENSEX: 74000,
  "NIFTY IT": 38000,
  RELIANCE: 2950,
  HDFCBANK: 1660,
  TCS: 4030,
  INFY: 1580,
};

const FALLBACK_POINTS_BY_TIMEFRAME = {
  "1m": 40,
  "5m": 40,
  "15m": 36,
  "1h": 30,
  "4h": 24,
  "1D": 20,
};

const FALLBACK_STEP_MINUTES = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1D": 1440,
};

const normalizeChartSymbol = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const upper = raw.toUpperCase();
  if (upper === "^NSEI" || upper === "NIFTY" || upper === "NIFTY50") {
    return "NIFTY 50";
  }
  if (upper === "^NSEBANK" || upper === "BANKNIFTY") {
    return "BANKNIFTY";
  }
  if (upper === "^CNXFIN" || upper === "FINNIFTY") {
    return "FINNIFTY";
  }
  if (upper === "MIDCPNIFTY" || upper === "NIFTYMIDCAP" || upper === "^NSMIDCP50") {
    return "MIDCPNIFTY";
  }

  return upper.replace(/\.(NS|BO)$/i, "");
};

const calculateMA = (data, period) => {
  if (!data || data.length === 0) return [];
  return data.map((point, index) => {
    if (index < period - 1) return null;
    const sum = data.slice(index - period + 1, index + 1).reduce((acc, p) => acc + (p.price || p.close), 0);
    return sum / period;
  });
};

const calculateBollinger = (data, period = 20, stdMult = 2) => {
  const mas = calculateMA(data, period);
  return data.map((_, index) => {
    if (index < period - 1) return { upper: null, lower: null, mid: null };
    const mid = mas[index];
    const slice = data.slice(index - period + 1, index + 1).map(p => p.price || p.close);
    const variance = slice.reduce((acc, v) => acc + Math.pow(v - mid, 2), 0) / period;
    const std = Math.sqrt(variance);
    return { upper: mid + stdMult * std, lower: mid - stdMult * std, mid };
  });
};

const calculateVWAP = (data) => {
  if (!data || data.length === 0) return [];
  let cumVolPrice = 0, cumVol = 0;
  return data.map((p) => {
    const vol = p.volume || 1;
    const typicalPrice = ((p.high || p.price) + (p.low || p.price) + (p.close || p.price)) / 3;
    cumVolPrice += typicalPrice * vol;
    cumVol += vol;
    return cumVol > 0 ? cumVolPrice / cumVol : null;
  });
};

const calculateRSI = (data, period = 14) => {
  if (!data || data.length < period + 1) return [];
  const result = new Array(data.length).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = (data[i].price || data[i].close) - (data[i - 1].price || data[i - 1].close);
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < data.length; i++) {
    const diff = (data[i].price || data[i].close) - (data[i - 1].price || data[i - 1].close);
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
};

const INDICATOR_OPTIONS = [
  { id: 'ma7',   label: 'MA 7',         color: '#FFA500' },
  { id: 'ma25',  label: 'MA 25',        color: '#FF1493' },
  { id: 'vwap',  label: 'VWAP',         color: '#60a5fa' },
  { id: 'bb',    label: 'Bollinger',    color: '#a78bfa' },
  { id: 'rsi',   label: 'RSI (14)',     color: '#34d399' },
];

const symbolSeed = (symbol) => {
  return String(symbol || "")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
};

const generateFallbackHistory = (symbol, timeframe) => {
  const pointCount = FALLBACK_POINTS_BY_TIMEFRAME[timeframe] || 36;
  const stepMinutes = FALLBACK_STEP_MINUTES[timeframe] || 15;
  const seed = symbolSeed(symbol);
  const base = FALLBACK_BASE_PRICE[symbol] || Math.max(120, seed * 2.5);
  const now = Date.now();

  return Array.from({ length: pointCount }, (_, index) => {
    const phase = index + 1;
    const wave = Math.sin((phase + seed % 13) / 4.5) * 0.0045;
    const drift = (phase - pointCount / 2) * 0.00045;
    const close = base * (1 + wave + drift);
    const open = close * (1 + Math.sin((phase + seed) / 5.8) * 0.0018);
    const high = Math.max(open, close) * 1.0022;
    const low = Math.min(open, close) * 0.9978;
    const timestamp = now - (pointCount - 1 - index) * stepMinutes * 60 * 1000;

    return {
      timestamp,
      time: new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      open,
      high,
      low,
      close,
      price: close,
      __source: "fallback",
    };
  });
};

const MultiChartGrid = ({ className, onOpenChart, timeframe = "15m", activeIndicators = new Set(), showGridLines = true, layout = "4-grid" }) => {

  const [histories, setHistories] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const { activeSymbol } = useAsset();

  // This pack is indices-only — always show the fixed 4 regardless of activeSymbol
  const INDEX_CHARTS = ["NIFTY 50", "BANKNIFTY", "SENSEX", "NIFTY IT"];

  const getChartsToShow = () => {
    switch (layout) {
      case "1-grid": return [INDEX_CHARTS[0]];
      case "2-grid": return INDEX_CHARTS.slice(0, 2);
      case "4-grid":
      default:       return INDEX_CHARTS;
    }
  };

  const chartsToShow = getChartsToShow();
  const chartsToShowKey = chartsToShow.join(",");

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      const symbols = [...new Set(chartsToShow)];
      const newHistories = {};
      await Promise.all(symbols.map(async (sym) => {
        try {
          const backendSymbol = BACKEND_SYMBOL_MAP[sym] || sym;
          const backendInterval = BACKEND_INTERVAL_MAP[timeframe] || "1D";
          const res = await fetchMarketHistory(backendSymbol, "STOCK", backendInterval);
          if (res && Array.isArray(res.data) && res.data.length > 0) {
            newHistories[sym] = res.data.map(d => ({
              ...d,
              time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              price: d.close,
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close
            }));
          } else {
            newHistories[sym] = generateFallbackHistory(sym, timeframe);
          }
        } catch (err) {
          console.error(`Failed to fetch history for ${sym}`, err);
          newHistories[sym] = generateFallbackHistory(sym, timeframe);
        }
      }));
      setHistories(prev => ({ ...prev, ...newHistories }));
      setIsLoading(false);
    };
    fetchAll();
  }, [chartsToShowKey, timeframe]);
  const getLayoutClass = () => {
    switch (layout) {
      case "1-grid": return "layout-1-grid";
      case "2-grid": return "layout-2-grid";
      case "4-grid": return "layout-4-grid";
      default: return "layout-4-grid";
    }
  };

  return (
    <div className={`${className} h-full min-h-0 w-full`}>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2.5 gap-2">
          <div className="flex items-center gap-2 pl-2">
            <div className="w-2 h-2 bg-[#42C0A5] rounded-full animate-pulse flex-shrink-0 self-center"></div>
            <span className="text-lg font-bold text-white font-['Plus_Jakarta_Sans'] uppercase tracking-wider leading-none">
              MULTI-CHART WORKSPACE
            </span>
          </div>
          <div className="flex gap-2 text-white/50 items-center bg-white/5 px-2 py-1 rounded-full border border-white/10">
            <span className="text-xs font-bold tracking-wider">LAYOUT: {layout.toUpperCase()}</span>
            <div className="w-1 h-1 bg-white/20 rounded-full"></div>
            <span className="text-xs text-[#42C0A5] font-mono font-bold tracking-wider">{timeframe.toUpperCase()}</span>
            {activeIndicators.size > 0 && (
              <>
                <div className="w-1 h-1 bg-white/20 rounded-full"></div>
                <span className="text-xs font-mono font-bold tracking-wider text-white/60">
                  {[...activeIndicators].map(id => ({ma7:'MA7',ma25:'MA25',vwap:'VWAP',bb:'BB',rsi:'RSI'})[id]).filter(Boolean).join(' · ')}
                </span>
              </>
            )}
          </div>
        </div>
        <div className={`multi-chart-grid ${getLayoutClass()} flex-1 min-h-0 mb-1`}>
          {chartsToShow.map((title, i) => {
            const chartData = histories[title] || [];
            const isFallback = chartData[0]?.__source === "fallback";
            const ma7   = activeIndicators.has('ma7')  ? calculateMA(chartData, 7)   : [];
            const ma25  = activeIndicators.has('ma25') ? calculateMA(chartData, 25)  : [];
            const vwap  = activeIndicators.has('vwap') ? calculateVWAP(chartData)    : [];
            const bb    = activeIndicators.has('bb')   ? calculateBollinger(chartData) : [];
            const rsi   = activeIndicators.has('rsi')  ? calculateRSI(chartData)     : [];
            const latestRsi = rsi.length > 0 ? rsi[rsi.length - 1] : null;
            const latest = chartData[chartData.length - 1] || {};
            const prev = chartData[chartData.length - 2] || latest;
            const pctChange = latest.close ? (((latest.close - prev.close) / prev.close) * 100).toFixed(2) : '0.00';
            const isPos = parseFloat(pctChange) >= 0;

            return (
              <div
                key={i}
                className="chart-card bg-white/5 border border-white/5 hover:border-white/10 transition-colors rounded-xl relative group flex flex-col overflow-hidden"
              >
                <div className="flex justify-between text-xs px-2.5 py-1.5 border-b border-white/5 bg-white/5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm tracking-wide">
                        {title}
                      </span>
                      {isFallback && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-300/30 rounded px-1.5 py-0.5">
                          Reference
                        </span>
                      )}
                      <span className={`${isPos ? 'text-[#42C0A5]' : 'text-red-400'} text-xs font-mono font-bold`}>
                        {(latest.close || 0).toLocaleString()} ({isPos ? '+' : ''}{pctChange}%)
                      </span>
                      {latestRsi !== null && (
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                          latestRsi < 30 ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' :
                          latestRsi > 70 ? 'text-red-300 bg-red-500/10 border-red-500/30' :
                          'text-slate-300 bg-white/5 border-white/10'
                        }`}>RSI {latestRsi.toFixed(0)}</span>
                      )}
                    </div>
                    <div className="flex gap-2 text-[10px] text-white/40 font-mono mt-0.5 font-medium tracking-wider scale-90 origin-left">
                      <span>
                        O:<span className="text-white/80 ml-1">{(latest.open || 0).toFixed(1)}</span>
                      </span>
                      <span>
                        H:<span className="text-white/80 ml-1">{(latest.high || 0).toFixed(1)}</span>
                      </span>
                      <span>
                        L:<span className="text-white/80 ml-1">{(latest.low || 0).toFixed(1)}</span>
                      </span>
                      <span>
                        C:<span className="text-white/80 ml-1">{(latest.close || 0).toFixed(1)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2.5 opacity-0 group-hover:opacity-100 transition-opacity items-start pt-1">
                    <Settings size={14} className="cursor-pointer text-white/50 hover:text-white transition-colors" />
                    <Maximize2
                      size={14}
                      className="cursor-pointer text-white/50 hover:text-white transition-colors"
                      onClick={() => onOpenChart?.(title)}
                    />
                  </div>
                </div>

                <div
                  className="flex-1 min-h-0 w-full relative p-1 cursor-pointer"
                  onClick={() => onOpenChart?.(title)}
                >
                  {isLoading ? (
                    <div className="h-full w-full flex items-center justify-center text-[10px] text-[#5d606b] font-mono uppercase tracking-wider">
                      Loading backend history...
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3db26b" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#3db26b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#161c27",
                            border: "1px solid #293839",
                            fontSize: "10px",
                            color: "#fff",
                          }}
                          itemStyle={{ color: "#fff" }}
                          labelStyle={{ display: "none" }}
                        />
                        <XAxis dataKey="time" hide />
                        <YAxis hide domain={["auto", "auto"]} />
                        <Area
                          type="monotone"
                          dataKey="price"
                          stroke="#3db26b"
                          fill={`url(#grad${i})`}
                          strokeWidth={1.5}
                          isAnimationActive={false}
                        />
                        {activeIndicators.has('ma7') && (
                          <Line type="monotone"
                            data={chartData.map((d, idx) => ({ ...d, ma7: ma7[idx] }))}
                            dataKey="ma7" stroke="#FFA500" strokeWidth={1} dot={false} isAnimationActive={false} />
                        )}
                        {activeIndicators.has('ma25') && (
                          <Line type="monotone"
                            data={chartData.map((d, idx) => ({ ...d, ma25: ma25[idx] }))}
                            dataKey="ma25" stroke="#FF1493" strokeWidth={1} dot={false} isAnimationActive={false} />
                        )}
                        {activeIndicators.has('vwap') && (
                          <Line type="monotone"
                            data={chartData.map((d, idx) => ({ ...d, vwap: vwap[idx] }))}
                            dataKey="vwap" stroke="#60a5fa" strokeWidth={1.2} dot={false} strokeDasharray="4 2" isAnimationActive={false} />
                        )}
                        {activeIndicators.has('bb') && (
                          <>
                            <Line type="monotone"
                              data={chartData.map((d, idx) => ({ ...d, bbUpper: bb[idx]?.upper }))}
                              dataKey="bbUpper" stroke="#a78bfa" strokeWidth={0.8} dot={false} strokeDasharray="2 3" isAnimationActive={false} />
                            <Line type="monotone"
                              data={chartData.map((d, idx) => ({ ...d, bbLower: bb[idx]?.lower }))}
                              dataKey="bbLower" stroke="#a78bfa" strokeWidth={0.8} dot={false} strokeDasharray="2 3" isAnimationActive={false} />
                          </>
                        )}
                        {showGridLines && (
                          <CartesianGrid
                            stroke="#293839"
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
};

export default MultiChartGrid;
