import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Maximize2, TrendingDown, TrendingUp, Search, Newspaper, Globe, Zap, ExternalLink, Monitor } from "lucide-react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";




import { fetchPulse, fetchHeatmap } from "../api/analyticsApi";
import { fetchTechnicalSummary, fetchBreakoutAlerts, fetchIndicatorSignals, fetchQuickOrderData, fetchWatchlistTechnicals } from "../api/technicalApi";
import { fetchEconomicCalendar } from "../api/calendarApi";
import { fetchPortfolio } from "../api/portfolioApi";
import { fetchFnoDashboard } from "../api/fnoApi";
import { fetchMarketHistory, fetchMarketNews } from "../api/marketApi";
import { useAsset } from "../context/AssetContext";
import { SettingsContext } from "../context/SettingsContext";
import SharedMultiChartGrid from "../components/trader/MultiChartGrid";
import AdvancedTradingChart from "../components/trader/AdvancedTradingChart";
import SharedAdvancedWatchlist from "../components/trader/AdvancedWatchlist";
import EnhancedStockScreener from "../components/trader/EnhancedStockScreener";
import MultiChartWorkspace from "../components/trader/MultiChartWorkspace"; // TRADINGVIEW MULTI-CHART
import RealTimeScanner from "../components/trader/RealTimeScanner"; // TRADINGVIEW SCANNER
import MainLayout from "../components/layout/MainLayout";
import MarketTicker from "../components/dashboard/MarketTicker";
import TraderStockPage from "./TraderStockPage"; 
import TraderProfilePage from "./traderProfile/TraderProfilePage";
import SettingsPage from "./settings/SettingsPage";
import TraderHelpSupportPage from "./support/HelpSupportPage";
import LearningAcademy from "./LearningAcademy";
import "./TraderDashboard.css";

import ScreenerPage from "./ScreenerPage";
const ENABLE_SIMULATION_MODE = false;

const BACKEND_SYMBOL_MAP = {
  RELIANCE: "RELIANCE.NS",
  HDFCBANK: "HDFCBANK.NS",
  INFY: "INFY.NS",
  TCS: "TCS.NS",
  ICICIBANK: "ICICIBANK.NS",
  SBIN: "SBIN.NS",
  ITC: "ITC.NS",
  LT: "LT.NS",
  "NIFTY 50": "^NSEI",
  BANKNIFTY: "^NSEBANK",
  SENSEX: "^BSESN",
  "NIFTY IT": "^CNXIT",
  "NIFTY AUTO": "^CNXAUTO",
  "NIFTY INFRA": "^CNXINFRA",
  "NIFTY FIN SERVICE": "NIFTY_FIN_SERVICE.NS",
};

const BACKEND_INTERVAL_MAP = {
  "1m": "1D",
  "5m": "1D",
  "15m": "1D",
  "1h": "1D",
  "4h": "1W",
  "1D": "1M",
};

const RESEARCH_UNIVERSE = [
  "NIFTY 50",
  "BANKNIFTY",
  "RELIANCE",
  "HDFCBANK",
  "INFY",
  "TCS",
  "ICICIBANK",
  "SBIN",
  "ITC",
  "LT",
];

const SUMMARY_INDEX_UNIVERSE = ["NIFTY 50", "BANKNIFTY", "SENSEX", "NIFTY IT", "NIFTY AUTO", "NIFTY FIN SERVICE", "NIFTY INFRA"];

const FALLBACK_HEATMAP = [];

const FALLBACK_PULSE = {
  gapUp: [],
  gapDown: [],
  volumeShockers: [],
};

const FALLBACK_RESEARCH_INSIGHTS = [];

const FALLBACK_SUMMARY = {
  score: { score: 0, bias: "neutral" },
  indicators: {
    rsi: 0,
    volumeStatus: "neutral",
    macd: { value: 0, signal: 0 },
    support: 0,
    resistance: 0,
    ema20: 0,
    current: 0,
  },
  trendMatrix: {},
  patterns: [],
};

const getBiasMeta = (bias) => {
  if (bias === "bullish") return { label: "Bullish", color: "#42C0A5", symbol: "UP" };
  if (bias === "bearish") return { label: "Bearish", color: "#ed5750", symbol: "DN" };
  return { label: "Neutral", color: "#8b909a", symbol: "NT" };
};

const getImpactColor = (impact) => {
  if (String(impact).toLowerCase().includes("high")) return "#ed5750";
  if (String(impact).toLowerCase().includes("med")) return "#f0b429";
  return "#8b909a";
};

const formatSignedPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0.00%";
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(2)}%`;
};

const formatVolumeStatus = (value) => {
  const mapping = {
    high_volume: "High Volume",
    above_average: "Above Average",
    average: "Average",
    below_average: "Below Average",
    low_volume: "Low Volume",
  };
  return mapping[value] || "Average";
};

const formatCalendarDate = (value) => {
  if (!value) return "Today";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const formatNewsTime = (value) => {
  if (!value) return "Now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const NEWS_VIEW_MODES = ["Headline Stream", "Source Radar", "Catalyst Watch"];
const CATALYST_KEYWORDS = [
  "results",
  "earnings",
  "guidance",
  "merger",
  "acquisition",
  "stake",
  "approval",
  "order",
  "contract",
  "policy",
  "dividend",
  "buyback",
  "split",
  "upgrade",
  "downgrade",
  "target",
];

const deriveNewsMeta = (item, index = 0) => {
  const lower = String(item?.title || "").toLowerCase();
  const sentiment = lower.includes("gain") || lower.includes("rise") || lower.includes("buy") || lower.includes("expand") || lower.includes("record")
    ? "positive"
    : lower.includes("fall") || lower.includes("drop") || lower.includes("loss") || lower.includes("decline") || lower.includes("weak")
      ? "negative"
      : "neutral";

  const indicatorColor = sentiment === "positive" ? "bg-emerald-400" : sentiment === "negative" ? "bg-rose-400" : "bg-sky-400";
  const tag = lower.includes("bank") || lower.includes("banking")
    ? "Banking"
    : lower.includes("it") || lower.includes("tech") || lower.includes("software")
      ? "IT"
      : lower.includes("energy") || lower.includes("crude")
        ? "Energy"
        : lower.includes("auto")
          ? "Auto"
          : null;

  return {
    sentiment,
    indicatorColor,
    isBreaking: index === 0,
    tag,
    isCatalyst: CATALYST_KEYWORDS.some((keyword) => lower.includes(keyword)),
  };
};

const toTradeAssetType = (value) => {
  const normalized = String(value || "stock").toUpperCase();
  return ["STOCK", "CRYPTO", "FOREX"].includes(normalized) ? normalized : "STOCK";
};

const normalizeDisplaySymbol = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const upper = raw.toUpperCase();
  if (upper === "^NSEI" || upper === "NIFTY" || upper === "NIFTY50") return "NIFTY 50";
  if (upper === "^NSEBANK" || upper === "BANKNIFTY") return "BANKNIFTY";
  if (upper === "^BSESN" || upper === "SENSEX") return "SENSEX";
  if (upper === "^CNXIT" || upper === "NIFTY IT" || upper === "NIFTYIT") return "NIFTY IT";
  if (upper === "^CNXAUTO" || upper === "NIFTY AUTO" || upper === "NIFTYAUTO") return "NIFTY AUTO";
  if (upper === "^CNXINFRA" || upper === "NIFTY INFRA" || upper === "NIFTYINFRA") return "NIFTY INFRA";
  if (upper === "NIFTY_FIN_SERVICE.NS" || upper === "NIFTY_FIN_SERVICE" || upper === "NIFTY FIN SERVICE") return "NIFTY FIN SERVICE";
  return upper.replace(/\.(NS|BO)$/i, "");
};

const resolveBackendSymbol = (value) => {
  const normalized = normalizeDisplaySymbol(value);
  if (!normalized) return "";
  return BACKEND_SYMBOL_MAP[normalized] || normalized;
};

const resolveTrendBias = (value) => {
  const normalized = String(value || "neutral").toLowerCase();
  if (normalized.includes("bull")) return "bullish";
  if (normalized.includes("bear")) return "bearish";
  return "neutral";
};

const normalizePulseRows = (rows = []) => (
  (Array.isArray(rows) ? rows : [])
    .map((item) => {
      const changeRaw = Number.parseFloat(String(item?.changePercent ?? item?.change ?? 0).replace("%", ""));
      const priceRaw = Number(item?.price ?? item?.ltp ?? item?.lastPrice ?? 0);

      return {
        symbol: normalizeDisplaySymbol(item?.symbol),
        change: formatSignedPercent(Number.isFinite(changeRaw) ? changeRaw : 0),
        price: Number.isFinite(priceRaw) ? priceRaw : 0,
      };
    })
    .filter((item) => item.symbol)
);

const normalizeVolumeShockers = (rows = []) => (
  (Array.isArray(rows) ? rows : [])
    .map((item) => {
      const shockRaw = Number.parseFloat(String(item?.shock ?? "1").replace("x", ""));
      const shock = Number.isFinite(shockRaw) ? shockRaw : 1;

      return {
        symbol: normalizeDisplaySymbol(item?.symbol),
        shock: `${shock.toFixed(1)}x`,
      };
    })
    .filter((item) => item.symbol)
);

// Minimal fallback shown only when the news API is completely unavailable
const NEWS_FALLBACK_ITEMS = [
  { source: "RADAR", title: "Market news unavailable — backend may be offline.", publishedAt: new Date().toISOString() },
];

const usePreMarketPulse = () => {
  const [pulse, setPulse] = useState({ gapUp: [], gapDown: [], volumeShockers: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPulse = async (silent = false) => {
      try {
        if (ENABLE_SIMULATION_MODE) {
          if (!silent) setIsLoading(true);
          setTimeout(() => {
            if (isMounted) {
              setPulse(FALLBACK_PULSE);
              setIsFallback(true);
              if (!silent) setIsLoading(false);
            }
          }, 500);
          return;
        }

        if (!silent) {
          setIsLoading(true);
        }
        const response = await fetchPulse();
        if (isMounted) {
          const gapUp = normalizePulseRows(response?.gapUp);
          const gapDown = normalizePulseRows(response?.gapDown);
          const volumeShockers = normalizeVolumeShockers(response?.volumeShockers);
          const shouldFallback = gapUp.length === 0 && gapDown.length === 0 && volumeShockers.length === 0;
          if (shouldFallback) {
            setPulse(FALLBACK_PULSE);
            setIsFallback(true);
          } else {
            setPulse({ gapUp, gapDown, volumeShockers });
            setIsFallback(false);
          }
        }
      } catch (error) {
        console.error("Failed to load pre-market pulse:", error);
        if (isMounted) {
          setPulse(FALLBACK_PULSE);
          setIsFallback(true);
        }
      } finally {
        if (isMounted && !silent) {
          setIsLoading(false);
        }
      }
    };

    loadPulse(false);
    const intervalId = setInterval(() => {
      loadPulse(true);
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return { pulse, isLoading, isFallback };
};

const SectorHeatmap = () => {
  const [sectors, setSectors] = useState(FALLBACK_HEATMAP);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadHeatmap = async (silent = false) => {
      try {
        if (ENABLE_SIMULATION_MODE) {
          if (!silent) setIsLoading(true);
          setTimeout(() => {
             if (isMounted) {
               setSectors(FALLBACK_HEATMAP);
               if (!silent) setIsLoading(false);
             }
          }, 800);
          return;
        }

        if (!silent) {
          setIsLoading(true);
        }
        const response = await fetchHeatmap();
        const mapped = (response || [])
          .map((sector) => {
            const changes = sector.children?.map((item) => Number(item.change) || 0) || [];
            const averageChange = changes.length
              ? changes.reduce((sum, value) => sum + value, 0) / changes.length
              : 0;

            return {
              name: String(sector.name || "SECTOR").toUpperCase().slice(0, 12),
              change: Number(averageChange.toFixed(2)),
            };
          })
          .sort((a, b) => b.change - a.change)
          .slice(0, 6);

        if (isMounted) {
          setSectors(mapped.length ? mapped : FALLBACK_HEATMAP);
        }
      } catch (error) {
        console.error("Failed to load sector heatmap:", error);
        if (isMounted) {
          setSectors(FALLBACK_HEATMAP);
        }
      } finally {
        if (isMounted && !silent) {
          setIsLoading(false);
        }
      }
    };

    loadHeatmap(false);
    const intervalId = setInterval(() => {
      loadHeatmap(true);
    }, 45000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="tr-card flex flex-col h-full">
      <div className="tr-card-header">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-[#42C0A5]" />
          <h3 className="tr-card-title">Sector Heatmap</h3>
        </div>
        <span className={`tr-pill ${isLoading ? "text-amber-400 bg-amber-400/10" : "text-[#42C0A5] bg-[#42C0A5]/10"}`}>
          {isLoading ? "SYNCING" : "LIVE"}
        </span>
      </div>
      <div className="flex-1 p-3 grid grid-cols-3 gap-2 overflow-y-auto custom-scrollbar">
        {!isLoading && sectors.length === 0 && (
          <div className="col-span-3 text-[10px] text-[#5d606b] font-mono uppercase tracking-wider px-1">No backend sectors available.</div>
        )}
        {sectors.map((sector) => {
          const absChange = Math.abs(sector.change);
          const intensity = Math.min(1, absChange / 3); // scale up to 3% max
          const isPositive = sector.change > 0;
          const isNeutral = sector.change === 0;

          const bg = isNeutral
            ? "rgba(51,65,85,0.4)"
            : isPositive
              ? `rgba(16,${Math.round(80 + intensity * 105)},${Math.round(40 + intensity * 50)}, ${0.2 + intensity * 0.4})`
              : `rgba(${Math.round(120 + intensity * 119)},${Math.round(20)},${Math.round(20)}, ${0.2 + intensity * 0.4})`;

          const borderColor = isNeutral
            ? "rgba(100,116,139,0.3)"
            : isPositive
              ? `rgba(16,185,129,${0.2 + intensity * 0.5})`
              : `rgba(239,68,68,${0.2 + intensity * 0.5})`;

          const glowColor = isPositive
            ? `rgba(16,185,129,${intensity * 0.3})`
            : `rgba(239,68,68,${intensity * 0.3})`;

          const textColor = isNeutral ? "#94a3b8" : isPositive ? "#4ade80" : "#f87171";

          return (
            <motion.div
              key={sector.name}
              whileHover={{ scale: 1.06, zIndex: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              style={{
                background: bg,
                border: `1px solid ${borderColor}`,
                boxShadow: `0 0 16px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`,
                borderRadius: "0.6rem",
              }}
              className="flex flex-col justify-center items-center relative overflow-hidden group cursor-pointer p-2 min-h-[64px]"
            >
              <span className="text-white font-bold text-[10px] z-10 text-center leading-tight mb-1 tracking-wider">{sector.name}</span>
              <span className="font-mono font-black text-sm z-10" style={{ color: textColor }}>
                {formatSignedPercent(sector.change)}
              </span>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

const TrendStrengthPanel = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const symbols = ["NIFTY 50", "BANKNIFTY", "RELIANCE", "HDFCBANK", "INFY", "TCS"];

    const loadTrendMatrix = async (silent = false) => {
      try {
        if (ENABLE_SIMULATION_MODE) {
           if (!silent) setIsLoading(true);
           setTimeout(() => {
             if (isMounted) {
               setRows([
                 { symbol: "NIFTY 50", matrix: { "5m": "bullish", "15m": "bullish", "1h": "neutral", "4h": "bullish", "1d": "bullish" } },
                 { symbol: "BANKNIFTY", matrix: { "5m": "bearish", "15m": "neutral", "1h": "bearish", "4h": "neutral", "1d": "bullish" } },
                 { symbol: "RELIANCE", matrix: { "5m": "bullish", "15m": "bullish", "1h": "bullish", "4h": "bullish", "1d": "bullish" } },
                 { symbol: "HDFCBANK", matrix: { "5m": "neutral", "15m": "neutral", "1h": "neutral", "4h": "bullish", "1d": "bullish" } },
               ]);
               setHasError(false);
               if (!silent) setIsLoading(false);
             }
           }, 1000);
           return;
        }

        if (!silent) {
          setIsLoading(true);
        }
        setHasError(false);

        const responses = await Promise.allSettled(
          symbols.map(async (symbol) => {
            const backendSymbol = resolveBackendSymbol(symbol);
            const summary = await fetchTechnicalSummary("stock", backendSymbol);
            const matrix = summary?.trendMatrix || {};
            const mapTrendState = (value) => {
              if (value === undefined || value === null || String(value).trim() === "") {
                return null;
              }
              return resolveTrendBias(value);
            };

            const mappedMatrix = {
              "5m": mapTrendState(matrix["5m"]),
              "15m": mapTrendState(matrix["15m"]),
              "1h": mapTrendState(matrix["1h"]),
              "4h": mapTrendState(matrix["4h"] ?? matrix["1h"]),
              "1d": mapTrendState(matrix["1d"]),
            };

            if (!Object.values(mappedMatrix).some(Boolean)) {
              return null;
            }

            return {
              symbol,
              matrix: mappedMatrix,
            };
          })
        );

        const nextRows = responses
          .filter((response) => response.status === "fulfilled")
          .map((response) => response.value)
          .filter(Boolean);
        const allRejected = responses.every((response) => response.status === "rejected");

        if (isMounted) {
          setRows(nextRows);
          setHasError(allRejected);
        }
      } catch (error) {
        console.error("Failed to load trend matrix:", error);
        if (isMounted) {
          setRows([]);
          setHasError(true);
        }
      } finally {
        if (isMounted && !silent) {
          setIsLoading(false);
        }
      }
    };

    loadTrendMatrix(false);
    const intervalId = setInterval(() => {
      loadTrendMatrix(true);
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const matrixRows = rows;
  const biasScore = matrixRows.reduce((acc, row) => {
    const values = Object.values(row.matrix);
    values.forEach((value) => {
      if (value === "bullish") acc += 1;
      if (value === "bearish") acc -= 1;
    });
    return acc;
  }, 0);
  const marketBias = biasScore > 0 ? "Bullish" : biasScore < 0 ? "Bearish" : "Neutral";
  const marketBiasColor = marketBias === "Bullish" ? "#42C0A5" : marketBias === "Bearish" ? "#ed5750" : "#8b909a";

  const stateToGlyph = {
    bullish: "UP",
    bearish: "DN",
    neutral: "NT",
    unknown: "--",
  };

  return (
    <div className="tr-card flex flex-col h-full relative">
      {isLoading && (
        <div className="absolute inset-0 bg-[#0b0f17]/70 backdrop-blur-sm z-20 flex items-center justify-center text-[10px] font-mono text-[#9194a2] uppercase tracking-wider">Syncing trend matrix...</div>
      )}
      <div className="tr-card-header">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#42C0A5] rounded-full animate-pulse"></div>
          <div>
            <h3 className="tr-card-title">TREND MATRIX</h3>
          </div>
        </div>
        {hasError ? (
          <span className="tr-pill text-[#f0b429] bg-[#f0b429]/10">OFFLINE</span>
        ) : matrixRows.length > 0 ? (
          <span className="tr-pill text-[#42C0A5] bg-[#42C0A5]/10">LIVE</span>
        ) : (
          <span className="tr-pill text-[#8b909a] bg-white/5">NO DATA</span>
        )}
      </div>

      <div className="flex-1 px-2 pb-2 pt-1 overflow-y-auto custom-scrollbar" style={{ scrollbarColor: "#2a2e39 transparent" }}>
        {!isLoading && hasError && (
          <div className="text-[10px] text-[#f0b429] font-mono uppercase tracking-wider px-1 py-2">Unable to load trend matrix from backend.</div>
        )}
        {!isLoading && !hasError && matrixRows.length === 0 && (
          <div className="text-[10px] text-[#5d606b] font-mono uppercase tracking-wider px-1 py-2">No trend matrix data from backend.</div>
        )}
        <table className="tr-table">
          <thead>
            <tr>
              <th className="w-[30%]">Symbol</th>
              <th className="text-center">5M</th>
              <th className="text-center">15M</th>
              <th className="text-center">1H</th>
              <th className="text-center">4H</th>
              <th className="text-center">1D</th>
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((row, idx) => {
              const values = [row.matrix["5m"], row.matrix["15m"], row.matrix["1h"], row.matrix["4h"], row.matrix["1d"]];
              const ups = values.filter((value) => value === "bullish").length;
              const downs = values.filter((value) => value === "bearish").length;
              const bias = ups > downs ? "#42C0A5" : downs > ups ? "#ed5750" : "#8b909a";

              return (
                <tr
                  key={idx}
                  className="border-b transition-colors cursor-pointer"
                  onClick={() => navigate(`/stocks/${row.symbol}`)}
                  style={{ borderColor: "rgba(255,255,255,0.05)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#1a1f2e";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: bias }}></div>
                      <span className="text-white font-bold text-[10px] truncate">{normalizeDisplaySymbol(row.symbol)}</span>
                    </div>
                  </td>
                  {values.map((state, i) => {
                    const glyph = stateToGlyph[state] || stateToGlyph.unknown;
                    const color = state === "bullish" ? "#42C0A5" : state === "bearish" ? "#ed5750" : state === "neutral" ? "#8b909a" : "#5d606b";
                    const bg = state === "bullish"
                      ? "rgba(61,178,107,0.2)"
                      : state === "bearish"
                        ? "rgba(237,87,80,0.2)"
                        : state === "neutral"
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(255,255,255,0.03)";

                    return (
                      <td key={i} className="py-2 text-center">
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                          style={{ background: bg, color }}
                        >
                          {glyph}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-2.5 py-1.5 border-t border-white/10 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="flex items-center gap-2 text-[9px]">
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[9px] font-bold" style={{ background: "rgba(61,178,107,0.2)", color: "#42C0A5" }}>UP</span>
            <span className="text-[#5d606b]">Bullish</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[9px] font-bold" style={{ background: "rgba(237,87,80,0.2)", color: "#ed5750" }}>DN</span>
            <span className="text-[#5d606b]">Bearish</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[9px] font-bold" style={{ background: "rgba(255,255,255,0.08)", color: "#8b909a" }}>NT</span>
            <span className="text-[#5d606b]">Neutral</span>
          </div>
        </div>
        <div className="text-[9px] font-bold" style={{ color: marketBiasColor }}>
          Market Bias: <span>{marketBias}</span>
        </div>
      </div>
    </div>
  );
};

const GapLists = () => {
  const [activeTab, setActiveTab] = useState("GAINERS");
  const { pulse, isLoading, isFallback } = usePreMarketPulse();

  const rows = activeTab === "GAINERS"
    ? pulse.gapUp
    : pulse.gapDown;

  const isGainers = activeTab === "GAINERS";
  const accentColor = isGainers ? "#10b981" : "#ef4444";
  const accentBg = isGainers ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)";

  return (
    <div className="tr-card flex flex-col h-full">
      <div className="tr-card-header">
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
          <button
            onClick={() => setActiveTab("GAINERS")}
            style={activeTab === "GAINERS" ? { background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" } : { background: "transparent", color: "#5d6b7a", border: "1px solid transparent" }}
            className="flex items-center gap-1.5 text-[10px] font-black tracking-widest px-3 py-1.5 rounded-md transition-all"
          >
            <TrendingUp size={11} />
            GAINERS
          </button>
          <button
            onClick={() => setActiveTab("LOSERS")}
            style={activeTab === "LOSERS" ? { background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" } : { background: "transparent", color: "#5d6b7a", border: "1px solid transparent" }}
            className="flex items-center gap-1.5 text-[10px] font-black tracking-widest px-3 py-1.5 rounded-md transition-all"
          >
            <TrendingDown size={11} />
            LOSERS
          </button>
        </div>
        <Maximize2 size={12} className="text-[#5d606b] cursor-pointer hover:text-white transition-colors" />
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-1">
        {isLoading && <div className="text-[10px] text-[#5d606b] font-mono uppercase tracking-wider pt-2">Refreshing pulse...</div>}
        {!isLoading && isFallback && <div className="text-[10px] text-amber-400/70 font-mono uppercase tracking-wider pt-2">Fallback data active.</div>}
        {!isLoading && rows.length === 0 && <div className="text-[10px] text-[#5d606b] font-mono uppercase tracking-wider pt-2">No data available.</div>}
        {rows.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ x: 4 }}
            className="flex justify-between items-center group cursor-pointer rounded-lg px-3 py-2.5 transition-all"
            onClick={() => navigate(`/stocks/${item.symbol}`)}
            style={{ border: "1px solid transparent" }}
            onMouseEnter={e => { e.currentTarget.style.background = accentBg; e.currentTarget.style.borderColor = `${accentColor}25`; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
          >
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 rounded-full" style={{ background: accentColor, boxShadow: `0 0 6px ${accentColor}` }} />
              <div>
                <div className="font-bold text-white text-xs tracking-wide">{normalizeDisplaySymbol(item.symbol)}</div>
                <div className="text-[10px] font-mono" style={{ color: "#5d6b7a" }}>₹ {Number(item.price || 0).toLocaleString()}</div>
              </div>
            </div>
            <span className="font-mono text-sm font-black px-2 py-0.5 rounded-md" style={{ color: accentColor, background: `${accentColor}15` }}>
              {item.change}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const VolumeShockers = () => {
  const { pulse, isLoading, isFallback } = usePreMarketPulse();
  const items = pulse.volumeShockers.map((item, index) => ({
    symbol: normalizeDisplaySymbol(item.symbol),
    shock: item.shock,
    progress: Math.min(100, Math.max(20, Math.round((parseFloat(item.shock) || 1) * 40))),
    color: ["#bc13fe", "#3b82f6", "#10b981", "#f97316"][index % 4],
  }));

  return (
    <div className="tr-card flex flex-col h-full">
      <div className="tr-card-header">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md inline-flex items-center justify-center text-[10px] font-black" style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}>V&#x21;</div>
          <h3 className="tr-card-title">Vol Shockers</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="tr-pill text-[#fbbf24] bg-amber-400/10">LIVE</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-2">
        {isLoading && <div className="text-[10px] text-[#5d606b] font-mono uppercase tracking-wider pt-2">Refreshing spikes...</div>}
        {!isLoading && isFallback && <div className="text-[10px] text-amber-400/70 font-mono uppercase tracking-wider pt-2">Fallback data active.</div>}
        {!isLoading && items.length === 0 && <div className="text-[10px] text-[#5d606b] font-mono uppercase tracking-wider pt-2">No volume spikes.</div>}
        {items.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07 }}
            whileHover={{ scale: 1.02 }}
            className="rounded-lg px-3 py-2.5 cursor-pointer"
            onClick={() => navigate(`/stocks/${item.symbol}`)}
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="font-bold text-white text-xs tracking-wide">{item.symbol}</span>
              <span className="font-mono text-xs font-black px-2 py-0.5 rounded" style={{ color: item.color, background: `${item.color}20`, boxShadow: `0 0 8px ${item.color}40` }}>
                {item.shock}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.progress}%` }}
                transition={{ duration: 0.8, delay: idx * 0.1, ease: "easeOut" }}
                style={{ background: `linear-gradient(90deg, ${item.color}80, ${item.color})`, boxShadow: `0 0 10px ${item.color}60` }}
                className="h-full rounded-full"
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const KeyLevelsPanel = () => {
  const [selectedIndex, setSelectedIndex] = useState(SUMMARY_INDEX_UNIVERSE[0]);
  const [levels, setLevels] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [indexStatus, setIndexStatus] = useState(() => (
    Object.fromEntries(SUMMARY_INDEX_UNIVERSE.map((symbol) => [symbol, "loading"]))
  ));
  const [isStatusLoading, setIsStatusLoading] = useState(true);

  const pickFinite = (...values) => {
    for (const candidate of values) {
      const numeric = Number(candidate);
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric;
      }
    }
    return null;
  };

  const buildLevelsFromPayload = (summary, depth = null) => {
    const indicators = summary?.indicators || {};
    const bid = Number(depth?.bids?.[0]?.price);
    const ask = Number(depth?.asks?.[0]?.price);
    const midpoint = Number.isFinite(bid) && bid > 0 && Number.isFinite(ask) && ask > 0
      ? (bid + ask) / 2
      : null;

    return {
      current: pickFinite(midpoint, bid, ask, indicators?.lastPrice, indicators?.current, summary?.price, summary?.ltp),
      ema20: pickFinite(indicators?.ema20, indicators?.vwap),
      support: pickFinite(indicators?.support, indicators?.support1, indicators?.s1),
      resistance: pickFinite(indicators?.resistance, indicators?.resistance1, indicators?.r1),
      weeklyHigh: pickFinite(indicators?.weeklyHigh, indicators?.high52w, indicators?.dayHigh),
      weeklyLow: pickFinite(indicators?.weeklyLow, indicators?.low52w, indicators?.dayLow),
    };
  };

  const hasAnyLiveLevel = (candidateLevels) => (
    Object.values(candidateLevels || {}).some((value) => Number.isFinite(value) && value > 0)
  );

  useEffect(() => {
    let isMounted = true;

    const loadLevels = async (silent = false) => {
      try {
        if (!silent) {
          setIsLoading(true);
        }
        setHasError(false);
        const backendSymbol = resolveBackendSymbol(selectedIndex);
        const [summaryResponse, depthResponse] = await Promise.allSettled([
          fetchTechnicalSummary("stock", backendSymbol, { strictLive: true }),
          fetchQuickOrderData(backendSymbol),
        ]);

        const summary = summaryResponse.status === "fulfilled" ? summaryResponse.value : null;
        const depth = depthResponse.status === "fulfilled" ? depthResponse.value : null;
        const nextLevels = buildLevelsFromPayload(summary, depth);
        const hasAnyLevel = hasAnyLiveLevel(nextLevels);
        const allRejected = summaryResponse.status === "rejected" && depthResponse.status === "rejected";

        if (isMounted) {
          setLevels(hasAnyLevel ? nextLevels : null);
          setHasError(allRejected);
        }
      } catch (error) {
        console.error("Failed to load key levels:", error);
        if (isMounted) {
          setLevels(null);
          setHasError(true);
        }
      } finally {
        if (isMounted && !silent) {
          setIsLoading(false);
        }
      }
    };

    loadLevels(false);
    const intervalId = setInterval(() => {
      loadLevels(true);
    }, 20000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [selectedIndex]);

  useEffect(() => {
    let isMounted = true;

    const loadIndexStatus = async (silent = false) => {
      if (!silent) {
        setIsStatusLoading(true);
      }

      try {
        const settled = await Promise.allSettled(
          SUMMARY_INDEX_UNIVERSE.map(async (symbol) => {
            const backendSymbol = resolveBackendSymbol(symbol);
            const summary = await fetchTechnicalSummary("stock", backendSymbol, { strictLive: true });
            const previewLevels = buildLevelsFromPayload(summary, null);
            return {
              symbol,
              hasLive: hasAnyLiveLevel(previewLevels),
            };
          })
        );

        if (isMounted) {
          const nextStatus = {};
          settled.forEach((entry, index) => {
            const symbol = SUMMARY_INDEX_UNIVERSE[index];
            if (entry.status === "fulfilled") {
              nextStatus[symbol] = entry.value.hasLive ? "live" : "no-data";
            } else {
              nextStatus[symbol] = "offline";
            }
          });
          setIndexStatus(nextStatus);
        }
      } catch (error) {
        if (isMounted) {
          setIndexStatus(Object.fromEntries(SUMMARY_INDEX_UNIVERSE.map((symbol) => [symbol, "offline"])));
        }
      } finally {
        if (isMounted && !silent) {
          setIsStatusLoading(false);
        }
      }
    };

    loadIndexStatus(false);
    const intervalId = setInterval(() => {
      loadIndexStatus(true);
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const rows = [
    { label: "Resistance", value: levels?.resistance, color: "text-[#ed5750]", icon: "R", bg: "bg-[#ed5750]/10" },
    { label: "VWAP", value: levels?.ema20, color: "text-[#8b909a]", icon: "V", bg: "bg-white/5" },
    { label: "Current", value: levels?.current, color: "text-[#d1d4dc]", icon: "C", bg: "bg-blue-500/10" },
    { label: "Support", value: levels?.support, color: "text-[#42C0A5]", icon: "S", bg: "bg-[#42C0A5]/10" },
    { label: "Weekly High", value: levels?.weeklyHigh, color: "text-[#8b909a]", icon: "H", bg: "bg-white/5" },
    { label: "Weekly Low", value: levels?.weeklyLow, color: "text-[#8b909a]", icon: "L", bg: "bg-white/5" },
  ];
  const hasLiveLevels = rows.some((row) => Number.isFinite(row.value) && row.value > 0);

  return (
  <div className="tr-card flex flex-col h-full relative">
    {isLoading && (
      <div className="absolute inset-0 bg-[#0b0f17]/70 backdrop-blur-sm z-20 flex items-center justify-center text-[10px] font-mono text-[#9194a2] uppercase tracking-wider">Loading levels...</div>
    )}
    <div className="tr-card-header">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-[#42C0A5] rounded-full animate-pulse"></div>
        <h3 className="tr-card-title">
          KEY LEVELS
        </h3>
      </div>
      <div className="flex flex-col items-end gap-1">
        <select
          value={selectedIndex}
          onChange={(event) => setSelectedIndex(event.target.value)}
          className="trade-input !w-[128px] !py-1 !text-[10px]"
        >
          {SUMMARY_INDEX_UNIVERSE.map((symbol) => (
            <option key={symbol} value={symbol}>{symbol}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          {SUMMARY_INDEX_UNIVERSE.map((symbol) => {
            const status = isStatusLoading ? "loading" : (indexStatus[symbol] || "no-data");
            const isSelected = symbol === selectedIndex;
            const dotColor = status === "live"
              ? "#42C0A5"
              : status === "offline"
                ? "#f0b429"
                : status === "loading"
                  ? "#5d606b"
                  : "#8b909a";
            const statusLabel = status === "live"
              ? "LIVE"
              : status === "offline"
                ? "OFFLINE"
                : status === "loading"
                  ? "CHECKING"
                  : "NO DATA";

            return (
              <button
                key={symbol}
                type="button"
                onClick={() => setSelectedIndex(symbol)}
                title={`${symbol}: ${statusLabel}`}
                className="w-2 h-2 rounded-full border transition-transform"
                style={{
                  background: dotColor,
                  borderColor: isSelected ? "rgba(209,212,220,0.95)" : "rgba(255,255,255,0.18)",
                  transform: isSelected ? "scale(1.2)" : "scale(1)",
                }}
              />
            );
          })}
          <span className={`tr-pill ${hasError ? "text-[#f0b429] bg-[#f0b429]/10" : hasLiveLevels ? "text-[#42C0A5] bg-[#42C0A5]/10" : "text-[#8b909a] bg-white/5"}`}>{hasError ? "OFFLINE" : hasLiveLevels ? "LIVE" : "NO DATA"}</span>
        </div>
      </div>
    </div>
    <div className="flex-1 px-2.5 pb-2.5 space-y-2">
      {!isLoading && hasError && (
        <div className="text-[10px] text-[#f0b429] font-mono uppercase tracking-wider text-center py-2">Unable to load key levels from backend.</div>
      )}
      {!isLoading && !hasError && !hasLiveLevels && (
        <div className="text-[10px] text-[#5d606b] font-mono uppercase tracking-wider text-center py-2">No backend key levels available.</div>
      )}
      {rows.map((row, idx) => (
        <div key={idx} className={`flex justify-between items-center text-xs ${row.bg} rounded-lg p-2 hover:scale-[1.02] transition-transform`}>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md inline-flex items-center justify-center text-[10px] font-bold text-[#cfd3df] bg-white/10 border border-white/10">{row.icon}</span>
            <span className="text-[#8b909a] uppercase text-[10px] tracking-wider font-semibold">{row.label}</span>
          </div>
          <span className={`font-mono font-bold text-sm ${Number.isFinite(row.value) && row.value > 0 ? row.color : "text-[#8b909a]"}`}>
            {Number.isFinite(row.value) && row.value > 0 ? Number(row.value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "--"}
          </span>
        </div>
      ))}
    </div>
  </div>
  );
};

const InstrumentSummaryPanel = () => {
  const { activeType } = useAsset();
  const [summary, setSummary] = useState(null);
  const [hasVerifiedSummary, setHasVerifiedSummary] = useState(false);
  const [hasSummaryError, setHasSummaryError] = useState(false);
  const [indexSnapshots, setIndexSnapshots] = useState([]);
  const [summarySymbol, setSummarySymbol] = useState(SUMMARY_INDEX_UNIVERSE[0]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSummary = async (silent = false) => {
      try {
        if (!silent) {
          setIsLoading(true);
        }
        setHasSummaryError(false);
        const settled = await Promise.allSettled(
          SUMMARY_INDEX_UNIVERSE.map(async (symbol) => {
            const backendSymbol = resolveBackendSymbol(symbol);
            const response = await fetchTechnicalSummary(activeType, backendSymbol, { strictLive: true });
            const verified = Boolean(response?.indicators || response?.score);
            return {
              symbol,
              summary: verified ? response : null,
              verified,
            };
          })
        );

        if (isMounted) {
          const snapshots = settled
            .map((entry, index) => {
              if (entry.status === "fulfilled") {
                return entry.value;
              }
              return {
                symbol: SUMMARY_INDEX_UNIVERSE[index],
                summary: null,
                verified: false,
              };
            });

          setIndexSnapshots(snapshots);

          const current = snapshots.find((item) => item.symbol === summarySymbol && item.verified);
          const firstVerified = snapshots.find((item) => item.verified);
          const selected = current || firstVerified || snapshots[0] || null;

          setSummarySymbol(selected?.symbol || SUMMARY_INDEX_UNIVERSE[0]);
          setSummary(selected?.summary || null);
          setHasVerifiedSummary(Boolean(selected?.verified));
          setHasSummaryError(snapshots.every((item) => !item.verified));
        }
      } catch (error) {
        console.error("Failed to load technical summary:", error);
        if (isMounted) {
          setSummary(null);
          setHasVerifiedSummary(false);
          setIndexSnapshots(
            SUMMARY_INDEX_UNIVERSE.map((symbol) => ({
              symbol,
              summary: null,
              verified: false,
            }))
          );
          setHasSummaryError(true);
        }
      } finally {
        if (isMounted && !silent) {
          setIsLoading(false);
        }
      }
    };

    loadSummary(false);
    const intervalId = setInterval(() => {
      loadSummary(true);
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [activeType, summarySymbol]);

  const score = Number(summary?.score?.score || 0);
  const biasMeta = getBiasMeta(summary?.score?.bias || "neutral");
  const indicators = summary?.indicators || {};
  const sessionChange = Number(indicators?.lastChangePercent);
  const sessionChangeText = Number.isFinite(sessionChange) ? formatSignedPercent(sessionChange) : "--";
  const sessionChangeColor = Number.isFinite(sessionChange)
    ? (sessionChange > 0 ? "#42C0A5" : sessionChange < 0 ? "#ed5750" : "#8b909a")
    : "#8b909a";
  const lastUpdatedText = indicators?.lastUpdatedAt
    ? new Date(indicators.lastUpdatedAt).toLocaleString()
    : "No timestamp";
  const trendMatrix = summary?.trendMatrix || {};
  const patterns = summary?.patterns?.length ? summary.patterns : [];
  const bullishCount = Object.values(trendMatrix).filter((value) => value === "bullish").length;
  const macdDiff = indicators?.macd ? indicators.macd.value - indicators.macd.signal : 0;
  const summaryOptions = indexSnapshots.length
    ? indexSnapshots
    : SUMMARY_INDEX_UNIVERSE.map((symbol) => ({
      symbol,
      summary: null,
      verified: false,
    }));
  const selectedSnapshot = summaryOptions.find((item) => item.symbol === summarySymbol) || summaryOptions[0] || null;

  const handleSummarySymbolChange = (nextSymbol) => {
    setSummarySymbol(nextSymbol);
    const nextSnapshot = summaryOptions.find((item) => item.symbol === nextSymbol) || null;
    setSummary(nextSnapshot?.summary || null);
    setHasVerifiedSummary(Boolean(nextSnapshot?.verified));
  };

  const metrics = [
    { label: "Trend", value: hasVerifiedSummary ? biasMeta.label : "--", color: hasVerifiedSummary ? biasMeta.color : "#8b909a", icon: "TR", progress: hasVerifiedSummary ? Math.max(0, bullishCount * 25) : 0, sub: hasVerifiedSummary ? `${bullishCount}/4 timeframes aligned` : "No verified trend matrix" },
    { label: "Momentum", value: hasVerifiedSummary && Number.isFinite(Number(indicators?.rsi)) ? `RSI ${Number(indicators.rsi).toFixed(1)}` : "--", color: hasVerifiedSummary ? (indicators?.rsi >= 60 ? "#42C0A5" : indicators?.rsi <= 40 ? "#ed5750" : "#f0b429") : "#8b909a", icon: "MO", progress: hasVerifiedSummary && Number.isFinite(Number(indicators?.rsi)) ? Math.min(100, Math.round(Number(indicators.rsi))) : 0, sub: hasVerifiedSummary ? (macdDiff >= 0 ? "MACD crossover positive" : "MACD pressure negative") : "No verified momentum" },
    { label: "Volume", value: hasVerifiedSummary ? formatVolumeStatus(indicators?.volumeStatus) : "--", color: hasVerifiedSummary ? "#42C0A5" : "#8b909a", icon: "VO", progress: hasVerifiedSummary ? ({ high_volume: 95, above_average: 78, average: 55, below_average: 35, low_volume: 20 }[indicators?.volumeStatus] || 55) : 0, sub: hasVerifiedSummary ? "20-period participation" : "No verified volume status" },
    { label: "Pattern", value: hasVerifiedSummary ? (patterns[0]?.pattern || "No verified pattern") : "--", color: hasVerifiedSummary ? "#f0b429" : "#8b909a", icon: "PT", progress: hasVerifiedSummary ? (patterns[0]?.confidence || 0) : 0, sub: hasVerifiedSummary ? (patterns[0]?.description || "No pattern payload from backend") : "No verified pattern payload" },
    { label: "Session Change", value: hasVerifiedSummary ? sessionChangeText : "--", color: hasVerifiedSummary ? sessionChangeColor : "#8b909a", icon: "CH", progress: hasVerifiedSummary && Number.isFinite(sessionChange) ? Math.min(100, Math.abs(sessionChange) * 20) : 0, sub: hasVerifiedSummary ? "Last closed bar vs prior bar" : "No verified session change" },
    { label: "Strength Score", value: hasVerifiedSummary ? `${score} / 100` : "--", color: hasVerifiedSummary ? biasMeta.color : "#8b909a", icon: "SC", progress: hasVerifiedSummary ? score : 0, sub: hasVerifiedSummary ? `Composite bias: ${biasMeta.label}` : "No verified composite score" },
  ];

  return (
  <div className="tr-card flex flex-col h-full relative overflow-hidden">
    {isLoading && (
      <div className="absolute inset-0 bg-[#0b0f17]/70 backdrop-blur-sm z-20 flex items-center justify-center text-[11px] font-mono text-[#9194a2] uppercase tracking-wider">Syncing summary...</div>
    )}
    {}
    <div className="tr-card-header">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-[#42C0A5] rounded-full animate-pulse"></div>
        <div>
          <h3 className="tr-card-title">INSTRUMENT SUMMARY</h3>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-[20px] font-black tr-text-mono" style={{ color: hasVerifiedSummary ? biasMeta.color : "#8b909a" }}>{hasVerifiedSummary ? score : "--"}</span>
        <span className="tr-pill" style={{ color: hasVerifiedSummary ? "#42C0A5" : "#f59e0b", background: hasVerifiedSummary ? "rgba(66,192,165,0.1)" : "rgba(245,158,11,0.1)" }}>{hasVerifiedSummary ? "VERIFIED" : "NO FEED"}</span>
      </div>
    </div>

    {}
    <div className="flex-1 px-2.5 pb-2 pt-1.5 space-y-1.5 overflow-y-auto custom-scrollbar">
      <div className="rounded-lg p-2.5 border" style={{ background: "#131722", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-[#7f8591] uppercase tracking-wider font-semibold">Select Index</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${selectedSnapshot?.verified ? "text-[#42C0A5] bg-[#42C0A5]/15" : "text-[#f0b429] bg-[#f0b429]/15"}`}>
            {selectedSnapshot?.verified ? "VERIFIED" : "NO FEED"}
          </span>
        </div>
        <select
          value={summarySymbol}
          onChange={(event) => handleSummarySymbolChange(event.target.value)}
          className="w-full mt-1.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold outline-none"
          style={{
            background: "rgba(17, 24, 39, 0.9)",
            color: "#d1d4dc",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {summaryOptions.map((item) => (
            <option key={item.symbol} value={item.symbol}>
              {item.symbol}{item.verified ? " - VERIFIED" : " - NO FEED"}
            </option>
          ))}
        </select>
        <div className="flex justify-between items-center mt-2">
          <span className="text-[11px]" style={{ color: selectedSnapshot?.verified ? getBiasMeta(selectedSnapshot?.summary?.score?.bias || "neutral").color : "#8b909a" }}>
            {selectedSnapshot?.verified ? getBiasMeta(selectedSnapshot?.summary?.score?.bias || "neutral").label : "--"}
          </span>
          <span className="text-[13px] font-mono font-bold" style={{ color: selectedSnapshot?.verified ? getBiasMeta(selectedSnapshot?.summary?.score?.bias || "neutral").color : "#8b909a" }}>
            {selectedSnapshot?.verified ? Number(selectedSnapshot?.summary?.score?.score || 0) : "--"}
          </span>
        </div>
      </div>

      {!isLoading && hasSummaryError && (
        <div className="text-[12px] text-[#f0b429] font-mono uppercase tracking-wider text-center py-2">Unable to load verified summary from backend.</div>
      )}
      {!isLoading && !hasSummaryError && !hasVerifiedSummary && (
        <div className="text-[12px] text-[#5d606b] font-mono uppercase tracking-wider text-center py-2">No verified technical summary available.</div>
      )}
      {metrics.map((row, idx) => (
        <div key={idx} className="rounded-lg p-2.5 transition-all" style={{ background: '#131722', borderTop: '1px solid rgba(255,255,255,0.07)', borderRight: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', borderLeft: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex justify-between items-center mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[11px] font-bold text-[#d1d4dc] bg-white/10 border border-white/10">{row.icon}</span>
              <div>
                <span className="text-[#9ca3af] uppercase text-[11px] tracking-wider font-semibold">{row.label}</span>
                <div className="text-[10px] text-[#4b5563] mt-0.5">{row.sub}</div>
              </div>
            </div>
            <span className="font-bold text-[14px] font-mono" style={{ color: row.color }}>{row.value}</span>
          </div>
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${row.progress}%`,
                background: row.progress >= 75
                  ? 'linear-gradient(90deg, #42C0A5, #6FFFE9)'
                  : row.progress >= 50
                    ? 'linear-gradient(90deg, #d97706, #f0b429)'
                    : 'linear-gradient(90deg, #6b7280, #9ca3af)',
                boxShadow: row.progress >= 75 ? '0 0 6px rgba(61,178,107,0.4)' : 'none',
              }}
            />
          </div>
        </div>
      ))}
    </div>

    {}
    <div className="px-2.5 py-1.5 border-t border-white/10 flex justify-between items-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <span className="text-[10px] text-[#5d606b]">Source: technical summary API (verified feed) | Updated: {hasVerifiedSummary ? lastUpdatedText : "--"}</span>
      <span className="text-[11px] font-bold" style={{ color: hasVerifiedSummary ? biasMeta.color : "#8b909a" }}>Overall: {hasVerifiedSummary ? `${biasMeta.label} ${biasMeta.symbol}` : "--"}</span>
    </div>
  </div>
  );
};


const SignalEnginePanel = () => {
  const { activeSymbol, activeType } = useAsset();
  const [insights, setInsights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadInsights = async (silent = false) => {
      try {
        if (!silent) {
          setIsLoading(true);
        }
        const [watchlistResponse, alertsResponse, signalsResponse] = await Promise.allSettled([
          fetchWatchlistTechnicals(),
          fetchBreakoutAlerts(),
          fetchIndicatorSignals(),
        ]);

        const watchlistSymbols = (watchlistResponse.status === "fulfilled" ? watchlistResponse.value : [])
          .map((item) => normalizeDisplaySymbol(item?.symbol || ""))
          .filter(Boolean);

        const symbolsToScan = Array.from(
          new Set([
            normalizeDisplaySymbol(activeSymbol),
            ...watchlistSymbols,
            ...RESEARCH_UNIVERSE,
          ])
        )
          .filter(Boolean)
          .slice(0, 10);

        const toOpportunityScore = ({ summary, indicators, pattern, bias, macdDelta }) => {
          const baseScore = Number(summary?.score?.score || 50);
          const confidence = Number(pattern?.confidence || 0);
          const rsi = Number(indicators?.rsi || 50);
          const rsiBonus = rsi >= 55 && rsi <= 70 ? 8 : rsi > 70 ? 4 : rsi <= 40 ? -6 : 0;
          const macdBonus = macdDelta >= 0 ? 7 : -5;
          const biasBonus = bias === "bullish" ? 10 : bias === "bearish" ? -8 : 0;
          const volumeBonus = ["high_volume", "above_average"].includes(indicators?.volumeStatus) ? 6 : 0;

          return baseScore + confidence * 0.2 + rsiBonus + macdBonus + biasBonus + volumeBonus;
        };

        const summaryResponses = await Promise.allSettled(
          symbolsToScan.map(async (symbol) => {
            const backendSymbol = resolveBackendSymbol(symbol);
            const summary = await fetchTechnicalSummary("stock", backendSymbol);

            return {
              symbol,
              summary,
            };
          })
        );

        const nextInsights = [];
        summaryResponses
          .filter((response) => response.status === "fulfilled")
          .forEach((response) => {
            const symbol = response.value.symbol;
            const summary = response.value.summary;
            if (!(summary?.indicators || summary?.score)) {
              return;
            }

            const biasMeta = getBiasMeta(summary?.score?.bias || "neutral");
            const leadPattern = summary?.patterns?.[0] || null;
            const leadIndicators = summary?.indicators || {};
            const macdDelta = leadIndicators?.macd
              ? Number(leadIndicators.macd.value || 0) - Number(leadIndicators.macd.signal || 0)
              : 0;
            const rankScore = toOpportunityScore({
              summary,
              indicators: leadIndicators,
              pattern: leadPattern,
              bias: summary?.score?.bias,
              macdDelta,
            });

            nextInsights.push({
              key: `summary-${symbol}`,
              title: normalizeDisplaySymbol(symbol),
              badge: leadPattern?.pattern || "Setup Watch",
              badgeColor: biasMeta.color,
              kind: "summary",
              rankScore,
              timeframe: "Backend scan",
              details: [
                { name: "Bias", value: biasMeta.label, note: `Score ${summary?.score?.score ?? "--"}`, color: biasMeta.color },
                { name: "RSI", value: Number(leadIndicators.rsi || 0).toFixed(1), note: "Momentum", color: leadIndicators.rsi >= 60 ? "#42C0A5" : leadIndicators.rsi <= 40 ? "#ed5750" : "#f0b429" },
                { name: "MACD Delta", value: macdDelta.toFixed(2), note: "Signal spread", color: macdDelta >= 0 ? "#42C0A5" : "#ed5750" },
                { name: "Volume", value: formatVolumeStatus(leadIndicators.volumeStatus), note: "Participation", color: "#42C0A5" },
              ],
              note: leadPattern?.description || `${normalizeDisplaySymbol(symbol)} technical snapshot sourced from backend summary API.`,
            });
          });

        if (alertsResponse.status === "fulfilled") {
          alertsResponse.value.slice(0, 3).forEach((alert) => {
            nextInsights.push({
              key: `alert-${alert.symbol}-${alert.time}`,
              title: alert.symbol,
              badge: alert.type,
              badgeColor: "#42C0A5",
              kind: "alert",
              rankScore: 35,
              timeframe: alert.time,
              details: [
                { name: "Trigger", value: alert.type, note: "Technical alert", color: "#42C0A5" },
                { name: "Price", value: `₹${Number(alert.price || 0).toLocaleString()}`, note: "Spot price", color: "#d1d4dc" },
              ],
              note: `${alert.symbol} flashed a live breakout condition at ${alert.time}.`,
            });
          });
        }

        if (signalsResponse.status === "fulfilled") {
          signalsResponse.value.slice(0, 2).forEach((signal) => {
            nextInsights.push({
              key: `signal-${signal.symbol}`,
              title: signal.symbol,
              badge: signal.value,
              badgeColor: "#f0b429",
              kind: "signal",
              rankScore: 30,
              timeframe: "Market scan",
              details: [
                { name: "Signal", value: signal.value, note: "Active condition", color: "#f0b429" },
                { name: "Stocks", value: signal.stocks?.join(", ") || "N/A", note: "Current matches", color: "#42C0A5" },
              ],
              note: `${signal.symbol} scan currently flags ${signal.stocks?.join(", ") || "selected symbols"}.`,
            });
          });
        }

        if (isMounted) {
          const prioritized = [...nextInsights].sort((a, b) => {
            const kindPriority = { summary: 0, alert: 1, signal: 2 };
            const aKind = kindPriority[a.kind] ?? 9;
            const bKind = kindPriority[b.kind] ?? 9;

            if (aKind !== bKind) {
              return aKind - bKind;
            }

            return Number(b.rankScore || 0) - Number(a.rankScore || 0);
          });

          if (prioritized.length > 0) {
            setInsights(prioritized.slice(0, 12));
            setIsFallback(false);
          } else {
            setInsights(FALLBACK_RESEARCH_INSIGHTS);
            setIsFallback(true);
          }
        }
      } catch (error) {
        console.error("Failed to load research insights:", error);
        if (isMounted) {
          setInsights(FALLBACK_RESEARCH_INSIGHTS);
          setIsFallback(true);
        }
      } finally {
        if (isMounted && !silent) {
          setIsLoading(false);
        }
      }
    };

    loadInsights(false);
    const intervalId = setInterval(() => {
      loadInsights(true);
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [activeSymbol, activeType]);

  return (
  <div className="tr-card flex flex-col h-full relative">
    {isLoading && (
      <div className="absolute inset-0 bg-[#0b0f17]/70 backdrop-blur-sm z-20 flex items-center justify-center text-[10px] font-mono text-[#9194a2] uppercase tracking-wider">Scanning insights...</div>
    )}
    <div className="tr-card-header">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-[#42C0A5] rounded-full animate-pulse shadow-[0_0_12px_var(--tr-accent-glow)]"></div>
        <h3 className="tr-card-title">RESEARCH INSIGHTS</h3>
      </div>
      <div className="flex items-center gap-2">
        {isFallback ? (
          <span className="tr-pill text-[#f0b429] bg-[#f0b429]/10">FALLBACK</span>
        ) : (
          <span className="tr-pill text-[#42C0A5] bg-[#42C0A5]/10">LIVE</span>
        )}
      </div>
    </div>

    <div className="flex-1 px-2.5 pb-2 pt-1.5 space-y-2 overflow-y-auto custom-scrollbar">
      {!isLoading && isFallback && (
        <div className="text-[10px] text-[#f0b429] font-mono uppercase tracking-wider">
          Fallback research insights active.
        </div>
      )}
      {insights.map((item) => (
        <div
          key={item.key}
          className="rounded-lg p-2 transition-all duration-200 cursor-pointer"
          onClick={() => navigate(`/stocks/${item.title}`)}
          style={{
            borderTop: `1px solid ${item.badgeColor}5a`,
            borderRight: `1px solid ${item.badgeColor}4a`,
            borderBottom: `1px solid ${item.badgeColor}3a`,
            borderLeft: `1px solid ${item.badgeColor}5a`,
            background: `linear-gradient(155deg, ${item.badgeColor}18 0%, rgba(255,255,255,0.035) 55%, rgba(255,255,255,0.02) 100%)`,
            boxShadow: `0 12px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px ${item.badgeColor}1e`,
          }}
        >
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-semibold text-[13px] tracking-wide">{item.title}</span>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ color: item.badgeColor, background: `${item.badgeColor}24`, borderTop: `1px solid ${item.badgeColor}50`, borderRight: `1px solid ${item.badgeColor}50`, borderBottom: `1px solid ${item.badgeColor}50`, borderLeft: `1px solid ${item.badgeColor}50` }}
              >
                {item.badge}
              </span>
            </div>
            <span className="text-[10px] text-[#a6abba] bg-white/10 px-2 py-0.5 rounded-full font-mono border border-white/10">{item.timeframe}</span>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-2">
            {item.details.map((ind, i) => (
              <div key={i} className="rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.09)', borderTop: '1px solid rgba(255,255,255,0.18)', borderRight: '1px solid rgba(255,255,255,0.12)', borderBottom: '1px solid rgba(255,255,255,0.12)', borderLeft: '1px solid rgba(255,255,255,0.18)' }}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-[#8f96aa] uppercase tracking-[0.12em] font-semibold">{ind.name}</span>
                  <span className="text-[11px] font-mono font-semibold" style={{ color: ind.color }}>{ind.value}</span>
                </div>
              </div>
            ))}
          </div>

          <div
            className="rounded-lg px-2.5 py-2"
            style={{
              background: 'linear-gradient(90deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.06) 100%)',
              borderTop: '1px solid rgba(255,255,255,0.16)',
              borderRight: '1px solid rgba(255,255,255,0.12)',
              borderBottom: '1px solid rgba(255,255,255,0.12)',
              borderLeft: `3px solid ${item.badgeColor}`,
            }}
          >
            <p className="text-[11px] text-[#c2c8d7] leading-snug truncate">{item.note}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
  );
};


const CatalystPanel = () => {
  const [events, setEvents] = useState([]);
  const [eventsSource, setEventsSource] = useState("none");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadEvents = async (silent = false) => {
      try {
        if (!silent) {
          setIsLoading(true);
        }
        setHasError(false);
        const response = await fetchEconomicCalendar();
        if (isMounted) {
          const sourceEvents = Array.isArray(response) ? response : [];
          const validEvents = sourceEvents.filter((item) => item?.event && item?.date);
          const verifiedEvents = validEvents.filter((item) => item?.factual === true || String(item?.source || "").toLowerCase().includes("tradingeconomics"));

          if (verifiedEvents.length > 0) {
            setEvents(verifiedEvents.slice(0, 6));
            setEventsSource("verified");
          } else {
            setEvents([]);
            setEventsSource("none");
          }
        }
      } catch (error) {
        console.error("Failed to load catalyst events:", error);
        if (isMounted) {
          setEvents([]);
          setEventsSource("none");
          setHasError(true);
        }
      } finally {
        if (isMounted && !silent) {
          setIsLoading(false);
        }
      }
    };

    loadEvents(false);
    const intervalId = setInterval(() => {
      loadEvents(true);
    }, 180000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
  <div className="tr-card flex flex-col h-full relative">
    {isLoading && (
      <div className="absolute inset-0 bg-[#0b0f17]/70 backdrop-blur-sm z-20 flex items-center justify-center text-[10px] font-mono text-[#9194a2] uppercase tracking-wider">Loading catalysts...</div>
    )}
    {}
    <div className="tr-card-header">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-[#42C0A5] rounded-full animate-pulse"></div>
        <div>
          <h3 className="tr-card-title">MARKET CATALYSTS</h3>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="tr-pill text-[#f0b429] bg-[#f0b429]/10">{events.length ? formatCalendarDate(events[0]?.date) : "NO FEED"}</span>
      </div>
    </div>

    {}
    <div className="flex-1 px-2.5 pb-1.5 pt-1.5 space-y-1.5 overflow-y-auto custom-scrollbar">
      {!isLoading && hasError && (
        <div className="text-[12px] text-[#f0b429] font-mono uppercase tracking-wider">Unable to load verified catalyst events from backend.</div>
      )}
      {!isLoading && !hasError && events.length === 0 && (
        <div className="text-[12px] text-[#5d606b] font-mono uppercase tracking-wider">No verified catalyst events available.</div>
      )}
      {events.map((item, idx) => {
        const impactColor = getImpactColor(item.impact);
        const metadata = [
          item?.country ? String(item.country).toUpperCase() : null,
          item?.actual && item.actual !== "-" ? `Actual ${item.actual}` : null,
          item?.forecast && item.forecast !== "-" ? `Forecast ${item.forecast}` : null,
          item?.previous && item.previous !== "-" ? `Prev ${item.previous}` : null,
        ].filter(Boolean).join(" | ");
        return (
        <div
          key={idx}
          className="rounded-lg p-2.5 transition-all cursor-pointer"
          style={{
            background: '#131722',
            borderTop: `1px solid ${impactColor}30`,
            borderRight: `1px solid ${impactColor}30`,
            borderBottom: `1px solid ${impactColor}30`,
            borderLeft: `3px solid ${impactColor}`,
          }}
        >
          <div className="flex items-start gap-2">
            <span className="text-base mt-0.5 flex-shrink-0">{String(item.impact).toLowerCase().includes("high") ? "[!]" : String(item.impact).toLowerCase().includes("med") ? "[~]" : "[i]"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-1">
                <span className="text-[15px] text-white font-semibold leading-tight">{item.event}</span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ color: impactColor, background: `${impactColor}18` }}
                >
                  {item.impact}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 text-[#42C0A5] bg-[#42C0A5]/15">
                  VERIFIED
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[11px] font-mono text-[#7b8190]">{formatCalendarDate(item.date)}</span>
                {metadata ? (
                  <>
                    <span className="text-[#2a2e39]">|</span>
                    <span className="text-[11px] text-[#7b8190]">{metadata}</span>
                  </>
                ) : (
                  <>
                    <span className="text-[#2a2e39]">|</span>
                    <span className="text-[11px] text-[#7b8190]">Verified event schedule</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )})}
    </div>

    {}
    <div className="px-2.5 py-1.5 border-t border-white/10 flex justify-between items-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <span className="text-[11px] text-[#5d606b]">{events.length} {eventsSource === "verified" ? "verified" : "loaded"} events</span>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-[#ed5750] font-bold">{events.filter((event) => String(event.impact).toLowerCase().includes("high")).length} HIGH</span>
        <span className="text-[#f0b429] font-bold">{events.filter((event) => String(event.impact).toLowerCase().includes("med")).length} MED</span>
        <span className="text-[#5d606b]">{events.filter((event) => !String(event.impact).toLowerCase().includes("high") && !String(event.impact).toLowerCase().includes("med")).length} LOW</span>
      </div>
    </div>
  </div>
  );
};


const TechnicalScreeners = () => {
  const [activeTab, setActiveTab] = useState("BREAKOUT");
  const [breakoutAlerts, setBreakoutAlerts] = useState([]);
  const [indicatorSignals, setIndicatorSignals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasBreakoutError, setHasBreakoutError] = useState(false);
  const [hasSignalsError, setHasSignalsError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadScreeners = async (silent = false) => {
      try {
        if (ENABLE_SIMULATION_MODE) {
           if (!silent) setIsLoading(true);
           setTimeout(() => {
             if (isMounted) {
               setBreakoutAlerts([
                 { symbol: "RELIANCE", type: "Channel Breakout", price: 2845, time: "11:20" },
                 { symbol: "TCS", type: "Moving Average Cross", price: 3910, time: "10:45" },
               ]);
               setIndicatorSignals([
                 { symbol: "RSI Bullish", value: "Oversold", stocks: ["HDFCBANK", "SBIN"] },
                 { symbol: "Golden Cross", value: "EMA 50/200", stocks: ["INFY", "LT"] },
               ]);
               setHasBreakoutError(false);
               setHasSignalsError(false);
               if (!silent) setIsLoading(false);
             }
           }, 700);
           return;
        }

        if (!silent) {
          setIsLoading(true);
        }
        setHasBreakoutError(false);
        setHasSignalsError(false);
        const [alertsResponse, signalsResponse] = await Promise.allSettled([
          fetchBreakoutAlerts(),
          fetchIndicatorSignals(),
        ]);

        const normalizeBreakouts = (payload) => {
          const source = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
              ? payload.data
              : Array.isArray(payload?.alerts)
                ? payload.alerts
                : [];

          return source
            .map((item) => {
              const symbol = normalizeDisplaySymbol(item?.symbol || item?.ticker || item?.name);
              if (!symbol) return null;

              const rawPrice = Number(item?.price ?? item?.ltp ?? item?.value);

              return {
                symbol,
                type: String(item?.type || item?.signal || item?.pattern || "Signal"),
                price: Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null,
                time: item?.time || item?.timestamp || item?.date || null,
              };
            })
            .filter(Boolean);
        };

        const normalizeSignals = (payload) => {
          const source = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
              ? payload.data
              : Array.isArray(payload?.signals)
                ? payload.signals
                : [];

          return source
            .map((item) => {
              const label = String(item?.symbol || item?.name || item?.signal || "").trim();
              if (!label) return null;

              const stocks = Array.isArray(item?.stocks)
                ? item.stocks.map((stock) => normalizeDisplaySymbol(stock)).filter(Boolean)
                : item?.stock
                  ? [normalizeDisplaySymbol(item.stock)].filter(Boolean)
                  : [];

              return {
                symbol: label,
                value: String(item?.value || item?.type || item?.description || "Signal"),
                stocks,
              };
            })
            .filter(Boolean);
        };

        if (isMounted) {
          const nextBreakouts = alertsResponse.status === "fulfilled"
            ? normalizeBreakouts(alertsResponse.value)
            : [];
          const nextSignals = signalsResponse.status === "fulfilled"
            ? normalizeSignals(signalsResponse.value)
            : [];

          setBreakoutAlerts(nextBreakouts);
          setIndicatorSignals(nextSignals);
          setHasBreakoutError(alertsResponse.status === "rejected");
          setHasSignalsError(signalsResponse.status === "rejected");
        }
      } catch (error) {
        console.error("Failed to load technical screeners:", error);
        if (isMounted) {
          setBreakoutAlerts([]);
          setIndicatorSignals([]);
          setHasBreakoutError(true);
          setHasSignalsError(true);
        }
      } finally {
        if (isMounted && !silent) {
          setIsLoading(false);
        }
      }
    };

    loadScreeners(false);
    const intervalId = setInterval(() => {
      loadScreeners(true);
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="tr-card flex flex-col h-full overflow-hidden">
      <div className="flex border-b border-white/10 bg-white/5 p-1">
        <button
          onClick={() => setActiveTab("BREAKOUT")}
          className={`flex-1 px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md ${activeTab === "BREAKOUT"
            ? "bg-white/10 text-white shadow-inner"
            : "text-white/40 hover:text-white hover:bg-white/5"
            }`}
        >
          Breakouts
        </button>
        <button
          onClick={() => setActiveTab("INDICATOR")}
          className={`flex-1 px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md ${activeTab === "INDICATOR"
            ? "bg-white/10 text-white shadow-inner"
            : "text-white/40 hover:text-white hover:bg-white/5"
            }`}
        >
          Indicators
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
        {activeTab === "BREAKOUT" ? (
          <div className="space-y-1">
            {isLoading && (
              <div className="text-[#9194a2] text-sm text-center py-4">Loading live breakout alerts...</div>
            )}
            {!isLoading && breakoutAlerts.length === 0 && (
              <div className="text-[#9194a2] text-sm text-center py-4">{hasBreakoutError ? "Unable to load breakout alerts." : "No breakout alerts from backend."}</div>
            )}
            {breakoutAlerts.map((item, k) => (
              <div
                key={k}
                className="flex justify-between items-center p-2.5 rounded hover:bg-white/10/50 text-xs border-b border-white/10/30 cursor-pointer"
                onClick={() => navigate(`/stocks/${item.symbol}`)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[#5d606b] font-mono text-xs">
                    {item.time || "--"}
                  </span>
                  <span className="font-bold text-[#e2e8f0] text-sm w-24">
                    {item.symbol}
                  </span>
                  <span className="text-[#9194a2] text-xs bg-white/10 px-2 py-0.5 rounded">
                    {item.type}
                  </span>
                </div>
                <span className={`font-mono font-bold text-sm ${(item.type || "").toLowerCase().includes("support") ? "text-[#ed5750]" : "text-[#42C0A5]"}`}>
                  {Number.isFinite(item.price) ? `₹${Number(item.price).toLocaleString()}` : "--"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {isLoading ? (
              <div className="text-[#9194a2] text-sm text-center py-4">
                Scanning active markets...
              </div>
            ) : (
              indicatorSignals.length === 0 ? (
                <div className="text-[#9194a2] text-sm text-center py-4">{hasSignalsError ? "Unable to load indicator signals." : "No indicator signals from backend."}</div>
              ) : (
              <>
              {indicatorSignals.map((item, index) => (
                <div
                  key={`${item.symbol}-${index}`}
                  className="flex justify-between items-center p-2.5 rounded hover:bg-white/10/50 text-xs border-b border-white/10/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#e2e8f0] text-sm w-24">
                      {item.symbol}
                    </span>
                    <span className="text-[#9194a2] text-xs bg-white/10 px-2 py-0.5 rounded">
                      {item.value}
                    </span>
                  </div>
                  <div className="text-[#42C0A5] font-mono font-bold text-xs text-right flex flex-wrap gap-1">
                    {(item.stocks || []).length ? (item.stocks || []).map(s => (
                      <span key={s} onClick={(e) => { e.stopPropagation(); navigate(`/stocks/${s}`); }} className="hover:underline cursor-pointer">
                        {s}
                      </span>
                    )) : "--"}
                  </div>
                </div>
              ))}
              </>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const FODashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadFno = async (silent = false) => {
      try {
        if (!silent) {
          setIsLoading(true);
        }
        const response = await fetchFnoDashboard();
        if (isMounted) {
          setDashboard(response);
        }
      } catch (error) {
        console.error("Failed to load F&O dashboard:", error);
        if (isMounted) {
          setDashboard(null);
        }
      } finally {
        if (isMounted && !silent) {
          setIsLoading(false);
        }
      }
    };

    loadFno(false);
    const intervalId = setInterval(() => {
      loadFno(true);
    }, 45000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const activeContracts = Array.isArray(dashboard?.activeContracts) ? dashboard.activeContracts : [];
  const fallbackContracts = [
    { symbol: "NIFTY 50 22500 CE", type: "CALL", oi: "42.3L" },
    { symbol: "NIFTY 50 22400 PE", type: "PUT", oi: "38.1L" },
  ];
  const contracts = activeContracts.length ? activeContracts : fallbackContracts;
  const pcr = Number(dashboard?.pcr?.nifty);
  const callOi = contracts
    .filter((contract) => String(contract.type).toLowerCase().includes("call"))
    .map((contract) => contract.oi)
    .join(" | ") || "--";
  const putOi = contracts
    .filter((contract) => String(contract.type).toLowerCase().includes("put"))
    .map((contract) => contract.oi)
    .join(" | ") || "--";
  const longCount = dashboard?.buildup?.long?.length || 0;
  const shortCount = dashboard?.buildup?.short?.length || 0;
  const normalizedPcr = Number.isFinite(pcr) ? Math.max(0, Math.min(100, Math.round(pcr * 50))) : 0;

  return (
  <div className="tr-card flex flex-col h-full relative">
    {isLoading && (
      <div className="absolute inset-0 bg-[#0b0f17]/70 backdrop-blur-sm z-20 flex items-center justify-center text-[10px] font-mono text-[#9194a2] uppercase tracking-wider">Loading derivatives...</div>
    )}
    <div className="tr-card-header">
      <h3 className="tr-card-title">F&O INSIGHTS</h3>
      <div className="flex gap-2 items-center">
        <span className="tr-pill text-[#42C0A5] bg-[#42C0A5]/10">CHAIN</span>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 h-full p-2">
      <div className="flex flex-col justify-center border-r border-white/10 pr-2.5">
        <div className="flex justify-between text-xs text-[#9194a2] mb-1">
          <span>PCR (Nifty)</span>
          <span className="text-white font-bold font-mono">{Number.isFinite(pcr) ? pcr.toFixed(2) : "--"}</span>
        </div>
        <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden border border-white/10 mb-4">
          <div className="bg-gradient-to-r from-[#ed5750] via-yellow-400 to-[#42C0A5] w-full h-full relative">
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_5px_white]"
              style={{ left: `${normalizedPcr}%` }}
            ></div>
          </div>
        </div>

        <div className="flex justify-between text-xs text-[#5d606b] mb-4 px-1">
          <div className="text-center">
            <div className="font-bold text-[#ed5750] text-sm">{callOi}</div>
            <div>CALL OI</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-[#42C0A5] text-sm">{putOi}</div>
            <div>PUT OI</div>
          </div>
        </div>

        <div className="flex justify-between text-xs text-[#9194a2] mb-1">
          <span>MAX PAIN</span>
          <span className="text-[#e2e8f0] font-bold font-mono">{contracts[0]?.symbol?.split(" ")?.[1] || "--"}</span>
        </div>
        <div className="flex justify-between text-xs text-[#9194a2]">
          <span>IV PERCENTILE</span>
          <span className="text-[#e2e8f0] font-bold font-mono">{Number.isFinite(pcr) ? `${Math.min(99, Math.round(pcr * 45))}%` : "--"}</span>
        </div>
      </div>

      <div className="space-y-2 text-xs flex flex-col justify-center">
        <div className="flex justify-between items-center bg-white/10/30 p-2.5 rounded border-l-2 border-[#42C0A5]">
          <div>
            <div className="text-[#e2e8f0] font-bold text-sm">
              Long Buildup
            </div>
            <div className="text-xs text-[#5d606b] mt-1 flex flex-wrap gap-1">
              {(dashboard?.buildup?.long || ["RELIANCE", "INFY"]).map(s => (
                <span key={s} onClick={(e) => { e.stopPropagation(); navigate(`/stocks/${s}`); }} className="hover:underline cursor-pointer">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <span className="font-mono text-white bg-[#42C0A5]/20 px-2 py-1 rounded text-sm">
            {longCount}
          </span>
        </div>
        <div className="flex justify-between items-center bg-white/10/30 p-2.5 rounded border-l-2 border-[#ed5750]">
          <div>
            <div className="text-[#e2e8f0] font-bold text-sm">
              Short Covering
            </div>
            <div className="text-xs text-[#5d606b] mt-1 flex flex-wrap gap-1">
              {(dashboard?.buildup?.short || ["HDFCBANK", "SBIN"]).map(s => (
                <span key={s} onClick={(e) => { e.stopPropagation(); navigate(`/stocks/${s}`); }} className="hover:underline cursor-pointer">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <span className="font-mono text-white bg-[#ed5750]/20 px-2 py-1 rounded text-sm">
            {shortCount}
          </span>
        </div>
      </div>
    </div>
  </div>
  );
};

const MarketBreadth = () => {
  const [breadth, setBreadth] = useState({ adv: 1240, unch: 230, dec: 980 });

  useEffect(() => {
    let isMounted = true;

    const loadBreadth = async () => {
      try {
        const response = await fetchHeatmap();
        const changes = (response || []).map((sector) => {
          const sectorChanges = sector.children?.map((item) => Number(item.change) || 0) || [];
          return sectorChanges.length ? sectorChanges.reduce((sum, value) => sum + value, 0) / sectorChanges.length : 0;
        });

        const adv = changes.filter((value) => value > 0).length;
        const dec = changes.filter((value) => value < 0).length;
        const unch = changes.filter((value) => value === 0).length;

        if (changes.length > 0) {
          const scale = 180;
          if (isMounted) {
            setBreadth({
              adv: adv * scale,
              unch: Math.max(unch * scale, 90),
              dec: dec * scale,
            });
          }
        }
      } catch (error) {
        console.error("Failed to load market breadth:", error);
      }
    };

    loadBreadth();

    const intervalId = setInterval(() => {
      loadBreadth();
    }, 45000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const total = breadth.adv + breadth.unch + breadth.dec || 1;

  return (
  <div className="tr-card h-full flex flex-col gap-2.5 p-2.5">
    <div className="flex justify-between items-center">
      <span className="tr-card-title">MARKET BREADTH</span>
    </div>
    <div className="flex items-center gap-0.5 h-3 rounded-full overflow-hidden bg-black/40">
      <div
        className="bg-[#42C0A5] h-full shadow-[0_0_5px_#42C0A5]"
        style={{ width: `${(breadth.adv / total) * 100}%` }}
      ></div>
      <div className="bg-[#5d606b] h-full" style={{ width: `${(breadth.unch / total) * 100}%` }}></div>
      <div
        className="bg-[#ed5750] h-full shadow-[0_0_5px_#ed5750]"
        style={{ width: `${(breadth.dec / total) * 100}%` }}
      ></div>
    </div>
    <div className="flex justify-between text-xs font-mono font-bold">
      <div className="text-[#42C0A5]">
        {breadth.adv} <span className="text-[10px] opacity-70">ADV</span>
      </div>
      <div className="text-[#9194a2]">
        {breadth.unch} <span className="text-[10px] opacity-70">UNCH</span>
      </div>
      <div className="text-[#ed5750]">
        {breadth.dec} <span className="text-[10px] opacity-70">DEC</span>
      </div>
    </div>
  </div>
  );
};

const MarketSentiment = () => {
  const [sentiment, setSentiment] = useState(68);

  useEffect(() => {
    let isMounted = true;

    const loadSentiment = async () => {
      try {
        const [pulseResponse, heatmapResponse] = await Promise.allSettled([
          fetchPulse(),
          fetchHeatmap(),
        ]);

        const pulse = pulseResponse.status === "fulfilled" ? pulseResponse.value : FALLBACK_PULSE;
        const heatmap = heatmapResponse.status === "fulfilled" ? heatmapResponse.value : [];

        const gapUp = pulse?.gapUp?.length || 0;
        const gapDown = pulse?.gapDown?.length || 0;
        const sectorBoost = (heatmap || []).reduce((sum, sector) => {
          const avg = (sector.children || []).reduce((acc, item) => acc + (Number(item.change) || 0), 0) / Math.max((sector.children || []).length, 1);
          return sum + avg;
        }, 0);

        const base = gapUp + gapDown > 0 ? (gapUp / (gapUp + gapDown)) * 100 : 50;
        const adjusted = Math.max(5, Math.min(95, Math.round(base + sectorBoost * 5)));
        if (isMounted) {
          setSentiment(adjusted);
        }
      } catch (error) {
        console.error("Failed to load market sentiment:", error);
      }
    };

    loadSentiment();

    const intervalId = setInterval(() => {
      loadSentiment();
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
  <div className="tr-card h-full flex flex-col gap-2.5 p-2.5">
    <div className="flex justify-between items-center">
      <span className="tr-card-title">MARKET SENTIMENT</span>
    </div>
    <div className="relative h-3 bg-black/40 rounded-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-[#ed5750] via-yellow-500 to-[#42C0A5]"></div>
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_white]"
        style={{ left: `${sentiment}%` }}
      ></div>
    </div>
    <div className="flex justify-between text-xs font-mono font-bold">
      <span className="text-[#ed5750]">BEARISH</span>
      <span className="text-[#42C0A5]">BULLISH {sentiment}%</span>
    </div>
  </div>
  );
};

const NewsFlash = ({ variant = "full" }) => {
  const navigate = useNavigate();
  const [newsItems, setNewsItems] = useState(NEWS_FALLBACK_ITEMS);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFeed, setActiveFeed] = useState("All");
  const [activeNewsMode, setActiveNewsMode] = useState("Headline Stream");

  useEffect(() => {
    let isMounted = true;

    const loadNews = async (silent = false) => {
      try {
        if (!silent) {
          setIsLoading(true);
        }
        const response = await fetchMarketNews();
        if (isMounted) {
          setNewsItems(
            Array.isArray(response) && response.length
              ? response
              : NEWS_FALLBACK_ITEMS
          );
        }
      } catch (error) {
        console.error("Failed to load market news:", error);
        if (isMounted) {
          setNewsItems(NEWS_FALLBACK_ITEMS);
        }
      } finally {
        if (isMounted && !silent) {
          setIsLoading(false);
        }
      }
    };

    loadNews(false);
    const intervalId = setInterval(() => {
      loadNews(true);
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const sourceStatsMap = {};
  (newsItems || []).forEach((item) => {
    const key = String(item.source || "Radar");
    sourceStatsMap[key] = (sourceStatsMap[key] || 0) + 1;
  });

  const filtered = (newsItems || [])
    .map((item, index) => ({ item, meta: deriveNewsMeta(item, index) }))
    .filter(({ item, meta }) => {
      const term = search.trim().toLowerCase();
      const source = String(item.source || "").toLowerCase();

      if (activeFeed !== "All" && source !== activeFeed.toLowerCase()) return false;
      if (activeNewsMode === "Catalyst Watch" && !meta.isCatalyst) return false;
      if (!term) return true;

      return `${item.source} ${item.title}`.toLowerCase().includes(term);
    })
    .sort((a, b) => {
      const timeA = new Date(a.item?.publishedAt || 0).getTime() || 0;
      const timeB = new Date(b.item?.publishedAt || 0).getTime() || 0;

      if (activeNewsMode === "Source Radar") {
        const sourceA = String(a.item?.source || "Radar");
        const sourceB = String(b.item?.source || "Radar");
        const countA = sourceStatsMap[sourceA] || 0;
        const countB = sourceStatsMap[sourceB] || 0;
        if (countA !== countB) return countB - countA;
      }

      return timeB - timeA;
    })
    .map(({ item }) => item);
  const sourceStats = Object.entries(sourceStatsMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
  const feeds = ["All", ...sourceStats.map((item) => item.name)];

  const headline = filtered[0];
  const avgPerSource = sourceStats.length > 0
    ? (sourceStats.reduce((acc, item) => acc + item.value, 0) / sourceStats.length).toFixed(1)
    : "0.0";
  const handleNewsClick = (newsItem) => {
    navigate("/news", { state: { selectedNews: newsItem } });
  };

  if (variant === "compact") {
    return (
      <div className="tr-card flex flex-col h-full overflow-hidden bg-gradient-to-b from-[#0e1a2d] via-[#0a1320] to-[#070d17]">
        <div className="relative px-4 py-3 border-b border-white/10">
          <div className="absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/65 to-transparent shadow-[0_0_14px_rgba(34,211,238,0.5)]" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 shadow-[0_0_16px_rgba(34,211,238,0.16)]">
                <Newspaper size={15} className="text-cyan-200" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black tracking-[0.18em] text-white uppercase">Flash News</h3>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-slate-400">Desk feed</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/news")}
              className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100 transition-all hover:border-cyan-300/40 hover:bg-cyan-300/15 hover:text-white"
            >
              View All <ExternalLink size={12} />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
              Live
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">{filtered.length} stories</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">{sourceStats.length} sources</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">{headline ? formatNewsTime(headline.publishedAt) : "--:--"}</span>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-2.5">
            <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">Feed Filters</div>
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {feeds.map((feed) => (
                <button
                  key={feed}
                  type="button"
                  onClick={() => setActiveFeed(feed)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-all ${activeFeed === feed
                    ? "border-cyan-300/35 bg-cyan-400/15 text-white shadow-[0_0_16px_rgba(34,211,238,0.12)]"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/25 hover:bg-cyan-400/8"
                    }`}
                >
                  {feed}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7f95b8]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search headlines"
                className="h-9 w-full rounded-full border border-white/10 bg-[#09172e] pl-8 pr-3 text-xs text-[#dbeafe] outline-none placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 max-h-[500px] overflow-y-auto custom-scrollbar px-3 py-4 space-y-3">
          {isLoading && <div className="py-8 text-center text-[#8b909a] text-xs">Loading news...</div>}
          {!isLoading && filtered.length === 0 && <div className="py-8 text-center text-[#8b909a] text-xs">No matching headlines.</div>}
          {!isLoading && filtered.map((news, i) => {
            const { indicatorColor, isBreaking, tag } = deriveNewsMeta(news, i);

            return (
              <button
                key={`${news.publishedAt || "ts"}-${i}`}
                type="button"
                onClick={() => handleNewsClick(news)}
                className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-left backdrop-blur-md transition-all duration-300 hover:scale-[1.01] hover:border-cyan-400/40 hover:shadow-[0_0_20px_rgba(34,211,238,0.15)] hover:bg-white/7 cursor-pointer"
              >
                <div className={`mr-3 h-full w-1 rounded-full ${indicatorColor} self-stretch min-h-[46px]`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isBreaking && (
                      <span className="rounded-full border border-red-500/25 bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-red-400">
                        BREAKING
                      </span>
                    )}
                    {tag && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                        {tag}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[15px] font-semibold leading-tight text-white group-hover:text-cyan-100 transition-colors line-clamp-2">
                    {news.title}
                  </p>
                  <div className="mt-1 text-xs text-gray-400">{news.source}</div>
                </div>
                <div className="ml-4 flex items-center gap-3 text-right shrink-0">
                  <div className="text-xs text-gray-500 font-mono">{formatNewsTime(news.publishedAt)}</div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition-all group-hover:border-cyan-300/30 group-hover:bg-cyan-400/10 group-hover:text-cyan-100">
                    <ExternalLink size={13} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen px-6 py-6 text-[#dce9ff]">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-200">
              <Newspaper size={12} /> News Research Feed
            </div>
            <h3 className="mt-3 text-[30px] font-black tracking-tight text-white md:text-[34px]">Research News Terminal</h3>
            <p className="mt-1 text-sm text-slate-300">High-signal headlines and catalyst-aware monitoring for deep market research.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-300">
            {NEWS_VIEW_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setActiveNewsMode(mode)}
                className={`rounded-full border px-3 py-1.5 transition-all ${activeNewsMode === mode
                  ? mode === "Source Radar"
                    ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                    : mode === "Catalyst Watch"
                      ? "border-violet-400/30 bg-violet-400/12 text-violet-100"
                      : "border-white/20 bg-white/10 text-slate-100"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/25 hover:bg-cyan-400/8"
                  }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center border-b border-white/5 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {feeds.map((feed) => (
              <button
                key={feed}
                type="button"
                onClick={() => setActiveFeed(feed)}
                className={`h-8 shrink-0 rounded-full border px-4 text-[12px] font-semibold transition ${activeFeed === feed ? "border-cyan-300/35 bg-cyan-400/15 text-white shadow-[0_0_0_1px_rgba(34,211,238,0.12)]" : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/25 hover:bg-cyan-400/8"}`}
              >
                {feed}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap xl:justify-end">
            <button
              type="button"
              onClick={() => navigate("/news")}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-[11px] font-semibold text-slate-100 hover:border-sky-300/30 hover:bg-sky-400/10"
            >
              <ExternalLink size={12} /> Open Full News
            </button>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7f95b8]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search headlines"
                className="h-9 w-[220px] rounded-full border border-white/10 bg-[#09172e] pl-8 pr-3 text-xs text-[#dbeafe] outline-none placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/5 bg-[linear-gradient(145deg,rgba(5,150,105,0.24),rgba(3,105,161,0.14))] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
            <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-200/75">Top Source</div>
            <div className="mt-2 text-2xl font-black text-white">{sourceStats[0]?.name || "--"}</div>
            <div className="mt-1 text-sm text-emerald-100/90">{sourceStats[0]?.value || 0} stories</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[linear-gradient(145deg,rgba(29,78,216,0.24),rgba(15,118,110,0.12))] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
            <div className="text-[10px] uppercase tracking-[0.22em] text-sky-200/75">Headline Pool</div>
            <div className="mt-2 text-2xl font-black text-white">{filtered.length}</div>
            <div className="mt-1 text-sm text-sky-100/90">active filtered rows</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[linear-gradient(145deg,rgba(185,28,28,0.24),rgba(88,28,135,0.12))] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
            <div className="text-[10px] uppercase tracking-[0.22em] text-rose-200/75">Source Breadth</div>
            <div className="mt-2 text-2xl font-black text-white">{sourceStats.length}</div>
            <div className="mt-1 text-sm text-rose-100/90">unique sources</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-300">Avg / Source</div>
            <div className="mt-2 text-2xl font-black text-white">{avgPerSource}</div>
            <div className="mt-1 text-sm text-slate-400">story concentration</div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 mt-6">
          <div className="col-span-12 xl:col-span-8 min-h-0">
            <div className="grid grid-cols-[1.2fr_0.75fr_0.45fr_0.45fr] gap-2 border-b border-white/5 px-2 pb-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
              <span>Headline</span>
              <span>Source</span>
              <span>Time</span>
              <span>Open</span>
            </div>

            <div className="max-h-[68vh] overflow-y-auto custom-scrollbar pr-1 pt-4">
              {isLoading && <div className="py-10 text-center text-sm text-[#8ea1be]">Loading news feed...</div>}
              {!isLoading && filtered.length === 0 && <div className="py-10 text-center text-sm text-[#8ea1be]">No matching headlines.</div>}

              <div className="space-y-3">
                {filtered.map((news, index) => (
                  <motion.button
                    key={`${news.publishedAt || "ts"}-${index}`}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02, duration: 0.2 }}
                    whileHover={{ scale: 1.005 }}
                    onClick={() => handleNewsClick(news)}
                    className="w-full text-left cursor-pointer rounded-xl border border-white/5 bg-[rgba(30,41,59,0.42)] px-3 py-3 shadow-[0_14px_30px_rgba(0,0,0,0.18)] transition-all hover:border-cyan-300/30 hover:shadow-[0_0_26px_rgba(6,182,212,0.18)]"
                  >
                    <div className="grid grid-cols-[1.2fr_0.75fr_0.45fr_0.45fr] gap-2 items-center">
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-black tracking-tight text-[#eef5ff]">{news.title}</div>
                      </div>
                      <div className="text-[12px] text-[#aac0e0] flex items-center gap-2"><Globe size={12} /> {news.source || "Radar"}</div>
                      <div className="text-[12px] text-[#aac0e0]">{formatNewsTime(news.publishedAt)}</div>
                      <div className="text-[12px] text-cyan-200 inline-flex items-center gap-1"><ExternalLink size={12} /> Open</div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-12 xl:col-span-4 min-h-0">
            <div className="flex h-full min-h-[520px] flex-col gap-3 rounded-[24px] border border-white/5 bg-[rgba(8,22,43,0.44)] p-4 shadow-[0_0_26px_rgba(34,211,238,0.14)]">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Headline spotlight</div>
                <h4 className="mt-2 text-2xl font-black tracking-tight text-white leading-tight">{headline?.title || "Select a headline"}</h4>
                <p className="mt-2 text-sm leading-relaxed text-[#9fb2cf]">{headline ? `${headline.source || "Radar"} at ${formatNewsTime(headline.publishedAt)}` : "Use the feed to inspect the strongest market stories."}</p>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Source Breakdown</div>
                <div className="mt-2 space-y-2">
                  {sourceStats.length > 0 ? sourceStats.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        setActiveFeed(item.name);
                        setActiveNewsMode("Source Radar");
                      }}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[12px] transition-all ${activeFeed === item.name
                        ? "bg-cyan-400/12 text-cyan-100"
                        : "text-[#9fb2cf] hover:bg-white/5"
                        }`}
                    >
                      <span>{item.name}</span>
                      <span className="font-semibold text-[#dbeafe]">{item.value}</span>
                    </button>
                  )) : <div className="text-[11px] text-[#7f95b8]">No source stats yet.</div>}
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Research Cue</div>
                <div className="mt-2 text-sm text-[#b7cae4] inline-flex items-center gap-2">
                  <Zap size={14} className="text-amber-300" />
                  Track cross-source confirmation before thesis updates.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


const SIGNAL_COLOR = { BUY: 'text-emerald-400', SELL: 'text-rose-400', NEUTRAL: 'text-amber-400', HOLD: 'text-amber-400' };
const SIGNAL_BG   = { BUY: 'bg-emerald-500/10 border-emerald-500/30', SELL: 'bg-rose-500/10 border-rose-500/30', NEUTRAL: 'bg-amber-500/10 border-amber-500/30', HOLD: 'bg-amber-500/10 border-amber-500/30' };

const ResearchToolPanel = ({ symbol: symbolProp } = {}) => {
  const { activeSymbol, setAsset } = useAsset();
  // Prefer the explicit prop (set by parent when a stock is clicked/selected);
  // fall back to the context value which is updated by other parts of the app.
  const raw = symbolProp || activeSymbol || '';
  const sym = raw.replace(/\.(NS|BO)$/i, '');

  const [tech, setTech]         = useState(null);
  const [techLoading, setTL]    = useState(false);
  const [activeTab, setActiveTab] = useState('signals'); // 'signals' | 'links' | 'ratios'

  // Load technical summary whenever symbol changes
  useEffect(() => {
    if (!sym) return;
    let alive = true;
    setTL(true);
    fetchTechnicalSummary('STOCK', sym)
      .then(d => { if (alive) setTech(d); })
      .catch(() => {})
      .finally(() => { if (alive) setTL(false); });
    return () => { alive = false; };
  }, [sym]);

  const overall   = tech?.overall  || tech?.recommendation || '—';
  const rsi       = Number(tech?.rsi ?? tech?.indicators?.rsi ?? 0);
  const macd      = tech?.macd     || tech?.indicators?.macd || null;
  const trend     = tech?.trend    || tech?.indicators?.trend || '—';
  const support   = Number(tech?.support  ?? tech?.levels?.support  ?? 0);
  const resist    = Number(tech?.resistance ?? tech?.levels?.resistance ?? 0);
  const momentum  = tech?.momentum || tech?.indicators?.momentum || '—';

  const overallKey = String(overall).toUpperCase();
  const sigColor   = SIGNAL_COLOR[overallKey] || 'text-slate-300';
  const sigBg      = SIGNAL_BG[overallKey]    || 'bg-white/5 border-white/10';

  // External links
  const nseBase   = `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(sym)}`;
  const tvBase    = `https://www.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(sym)}`;
  const scBase    = `https://www.screener.in/company/${encodeURIComponent(sym)}/`;
  const moneyBase = `https://www.moneycontrol.com/india/stockpricequote//${encodeURIComponent(sym.toLowerCase())}`;

  const externalLinks = [
    { label: 'NSE India',      href: nseBase,   color: 'text-sky-300',    bg: 'bg-sky-500/10 border-sky-500/20' },
    { label: 'TradingView',    href: tvBase,     color: 'text-blue-300',   bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Screener.in',    href: scBase,     color: 'text-violet-300', bg: 'bg-violet-500/10 border-violet-500/20' },
    { label: 'MoneyControl',   href: moneyBase,  color: 'text-emerald-300',bg: 'bg-emerald-500/10 border-emerald-500/20' },
  ];

  return (
    <div className="tr-card flex flex-col h-full">
      {/* ── Header ── */}
      <div className="tr-card-header">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-amber-400" />
          <h3 className="tr-card-title uppercase tracking-widest text-[11px]">Research Tools</h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">

        {/* ── Active Symbol pill ── */}
        <div className={`rounded-xl border p-3 flex items-center justify-between ${sigBg}`}>
          <div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Active Symbol</div>
            <div className="text-base font-black text-white">{sym || '—'}</div>
          </div>
          {techLoading
            ? <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
            : overall !== '—' && (
              <span className={`text-[10px] font-black px-2 py-1 rounded-full border ${sigBg} ${sigColor} uppercase`}>
                {overall}
              </span>
            )
          }
        </div>

        {/* ── Tab selector ── */}
        <div className="flex rounded-lg bg-white/5 p-0.5 gap-0.5">
          {[
            { id: 'signals', label: 'Signals' },
            { id: 'links',   label: 'Research' },
            { id: 'ratios',  label: 'Levels' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                activeTab === t.id
                  ? 'bg-white/10 text-white shadow'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── SIGNALS TAB ── */}
        {activeTab === 'signals' && (
          <div className="space-y-2">
            {[
              { label: 'RSI (14)',   value: rsi ? rsi.toFixed(1) : '—', sub: rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral',
                color: rsi > 70 ? 'text-rose-400' : rsi < 30 ? 'text-emerald-400' : 'text-amber-400' },
              { label: 'Trend',      value: trend,    sub: 'Price direction', color: String(trend).toUpperCase().includes('UP') || String(trend).toUpperCase() === 'BULLISH' ? 'text-emerald-400' : 'text-rose-400' },
              { label: 'MACD',       value: macd ? (Number(macd) > 0 ? 'Bullish' : 'Bearish') : '—',
                sub: 'Signal crossover', color: macd && Number(macd) > 0 ? 'text-emerald-400' : 'text-rose-400' },
              { label: 'Momentum',   value: momentum, sub: 'Price velocity', color: String(momentum).toUpperCase() === 'STRONG' ? 'text-emerald-400' : 'text-slate-400' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2.5">
                <div>
                  <div className="text-[10px] font-black text-slate-300">{row.label}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{row.sub}</div>
                </div>
                <span className={`text-[11px] font-black ${row.color}`}>{row.value || '—'}</span>
              </div>
            ))}
            {!tech && !techLoading && (
              <p className="text-center text-[10px] text-slate-600 py-3">Select a symbol to load signals</p>
            )}
          </div>
        )}

        {/* ── EXTERNAL LINKS TAB ── */}
        {activeTab === 'links' && (
          <div className="space-y-2">
            {externalLinks.map(link => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-[11px] font-bold hover:opacity-80 transition-all ${link.bg} ${link.color}`}
              >
                <span>{link.label}</span>
                <ExternalLink size={11} />
              </a>
            ))}
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Quick Copy</div>
              <div
                onClick={() => navigator.clipboard?.writeText(sym)}
                className="text-[11px] font-black text-slate-200 cursor-pointer hover:text-white transition-colors flex items-center gap-2"
              >
                <Monitor size={11} className="text-slate-500" />
                {sym || '—'} <span className="text-[9px] text-slate-500 font-normal">(click to copy)</span>
              </div>
            </div>
          </div>
        )}

        {/* ── LEVELS TAB ── */}
        {activeTab === 'ratios' && (
          <div className="space-y-2">
            {[
              { label: 'Support',    value: support  ? `₹${support.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—', color: 'text-emerald-400' },
              { label: 'Resistance', value: resist   ? `₹${resist.toLocaleString('en-IN',  { maximumFractionDigits: 2 })}` : '—', color: 'text-rose-400' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2.5">
                <span className="text-[10px] font-black text-slate-400 uppercase">{row.label}</span>
                <span className={`text-[11px] font-black ${row.color}`}>{row.value}</span>
              </div>
            ))}
            {!tech && !techLoading && (
              <p className="text-center text-[10px] text-slate-600 py-3">Select a symbol to load levels</p>
            )}
            <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 px-3 py-2">
              <div className="flex items-center gap-1.5 text-amber-300 text-[9px] font-black uppercase tracking-widest">
                <Zap size={9} /> Research Cue
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Confirm thesis with cross-source validation before acting.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-2 border-t border-white/5">
        <p className="text-[9px] text-slate-600 italic">Research only. No trade execution.</p>
      </div>
    </div>
  );
};

function ResearchView({ activeModule, onRequestModuleChange }) {
  const navigate = useNavigate();
  const { settings: savedSettings } = useContext(SettingsContext);

  const [expandedChart, setExpandedChart] = useState(null);
  const [timeframe, setTimeframe]         = useState("15m");
  const [showIndicators, setShowIndicators] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState(new Set(['ma7', 'ma25']));
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);
  const [layout, setLayout]               = useState("4-grid");
  const [niftyQuote, setNiftyQuote]       = useState(null);

  // Apply saved display settings once context loads
  useEffect(() => {
    if (!savedSettings?.display) return;
    const d = savedSettings.display;
    if (d.defaultTimeframe) setTimeframe(d.defaultTimeframe);
    if (d.defaultLayout)    setLayout(d.defaultLayout);
    if (typeof d.showIndicators === 'boolean') setShowIndicators(d.showIndicators);
  }, [savedSettings]);

  const [analysisSymbol, setAnalysisSymbol] = useState(null);
  const [focusedSymbol, setFocusedSymbol]   = useState('RELIANCE');
  const { setAsset } = useAsset();

  // Fetch live NIFTY 50 quote (same API as the chart)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { fetchMarketHistory } = await import('../api/marketApi');
        const res = await fetchMarketHistory('^NSEI', 'STOCK', '1D');
        if (!alive) return;
        const data = Array.isArray(res?.data) ? res.data : [];
        if (data.length >= 2) {
          const latest = data[data.length - 1];
          const prev   = data[data.length - 2];
          const pct = (((latest.close - prev.close) / prev.close) * 100).toFixed(2);
          setNiftyQuote({ price: latest.close, pct, pos: parseFloat(pct) >= 0 });
        } else if (data.length === 1) {
          setNiftyQuote({ price: data[0].close, pct: '0.00', pos: true });
        }
      } catch { /* silently ignore */ }
    };
    load();
    return () => { alive = false; };
  }, []);

  if (activeModule === "WATCHLIST") {
    return (
      <MainLayout>
        <div className="dashboard-layout flex flex-col w-full">
          <div className="flex-1 overflow-y-auto main-content-area" style={{ padding: 0 }}>
            <SharedAdvancedWatchlist />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (activeModule === "PROFILE") {
    return (
      <MainLayout>
        <div className="dashboard-layout flex flex-col w-full">
          <div className="flex-1 overflow-y-auto main-content-area" style={{ padding: 0 }}>
            <TraderProfilePage embedded />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (activeModule === "SETTINGS") {
    return (
      <MainLayout>
        <div className="dashboard-layout flex flex-col w-full">
          <div className="flex-1 overflow-y-auto main-content-area" style={{ padding: 0 }}>
            <SettingsPage embedded />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (activeModule === "SUPPORT") {
    return (
      <MainLayout>
        <div className="dashboard-layout flex flex-col w-full">
          <div className="flex-1 overflow-y-auto main-content-area" style={{ padding: 0 }}>
            <TraderHelpSupportPage embedded />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (analysisSymbol) {
    return (
        <div className="dashboard-layout flex flex-col w-full">
            <div className="flex-1 overflow-y-auto main-content-area" style={{ padding: 0 }}>
                {}
                <TraderStockPage 
                    overrideSymbol={analysisSymbol} 
                    onBack={() => setAnalysisSymbol(null)} 
                    isInDashboard={true}
                />
            </div>
        </div>
    )
  }

  if (activeModule === "SCREENERS") {
    return (
      <MainLayout>
        <ScreenerPage />
      </MainLayout>
    );
  }

  if (activeModule === "NEWS") {
    return (
      <MainLayout>
        <div className="dashboard-layout flex flex-col w-full">
          <div className="flex-1 overflow-y-auto main-content-area" style={{ padding: 0 }}>
            <NewsFlash variant="full" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (activeModule === "ACADEMY") {
    return (
      <MainLayout>
        <div className="dashboard-layout flex flex-col w-full">
          <div className="flex-1 overflow-y-auto main-content-area" style={{ padding: 0 }}>
            <LearningAcademy />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (activeModule === "MULTI-CHART") {
    return (
      <div className="dashboard-layout flex flex-col w-full">
        <div className="flex-1 overflow-y-auto main-content-area" style={{ padding: 0, height: 'calc(100vh - 64px)' }}>
          <MultiChartWorkspace />
        </div>
      </div>
    );
  }

  if (activeModule === "SCANNER") {
    return (
      <div className="dashboard-layout flex flex-col w-full">
        <div className="flex-1 overflow-y-auto main-content-area" style={{ padding: 0, height: 'calc(100vh - 64px)' }}>
          <RealTimeScanner />
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="dashboard-layout flex flex-col w-full">
        <MarketTicker />
        <div className="flex-1 overflow-y-auto main-content-area">
          <div className="tr-dashboard-stage">
            <div className="trader-dashboard-container">
            <section className="trader-dashboard-grid">
              <div className="trader-left-column">
                <section className="tr-surface-card tr-panel-shell tr-panel-shell--hero">
                  <div className="trader-dashboard-eyebrow">Trader Dashboard</div>
                  <h1 className="trader-dashboard-title">Structured market research workspace</h1>
                  <p className="trader-dashboard-subtitle">
                    Advanced analysis panels and high-fidelity research data for data-driven decisions.
                  </p>
                </section>

                <section className="tr-surface-card tr-panel-shell tr-panel-shell--chart">
                  <div className="workspace-header">
                    <div className="workspace-title">
                      <span className="workspace-label">Multi-Chart Workspace</span>
                      <span className="workspace-symbol">
                        NIFTY 50{' '}
                        {niftyQuote ? (
                          <span className={niftyQuote.pos ? 'text-[#42C0A5]' : 'text-red-400'}>
                            {niftyQuote.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}{' '}
                            {niftyQuote.pos ? '+' : ''}{niftyQuote.pct}%
                          </span>
                        ) : (
                          <span className="text-white/30 text-xs">Loading…</span>
                        )}
                      </span>
                    </div>
                    <div className="workspace-controls">
                      {["1m", "5m", "15m", "1h", "4h", "1D"].map((tf) => (
                        <button
                          key={tf}
                          onClick={() => setTimeframe(tf)}
                          className={`workspace-chip ${tf === timeframe ? "active" : ""}`}
                        >
                          {tf.toUpperCase()}
                        </button>
                      ))}
                      <div className="relative">
                        <button
                          onClick={() => setShowIndicatorMenu(v => !v)}
                          className={`workspace-chip ${activeIndicators.size > 0 ? "active" : ""}`}
                        >
                          Indicators {activeIndicators.size > 0 && `(${activeIndicators.size})`}
                        </button>
                        {showIndicatorMenu && (
                          <div
                            className="absolute top-full right-0 mt-1 z-50 bg-[#0f1520] border border-white/10 rounded-xl shadow-2xl p-2 min-w-[160px]"
                            onMouseLeave={() => setShowIndicatorMenu(false)}
                          >
                            {[
                              { id: 'ma7',  label: 'MA 7',      color: '#FFA500' },
                              { id: 'ma25', label: 'MA 25',     color: '#FF1493' },
                              { id: 'vwap', label: 'VWAP',      color: '#60a5fa' },
                              { id: 'bb',   label: 'Bollinger', color: '#a78bfa' },
                              { id: 'rsi',  label: 'RSI (14)',  color: '#34d399' },
                            ].map(ind => (
                              <button
                                key={ind.id}
                                onClick={() => setActiveIndicators(prev => {
                                  const next = new Set(prev);
                                  next.has(ind.id) ? next.delete(ind.id) : next.add(ind.id);
                                  return next;
                                })}
                                className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                              >
                                <div className="w-2.5 h-2.5 rounded-full border-2 flex items-center justify-center"
                                  style={{ borderColor: ind.color, backgroundColor: activeIndicators.has(ind.id) ? ind.color : 'transparent' }}
                                >
                                  {activeIndicators.has(ind.id) && <div className="w-1 h-1 rounded-full bg-[#0f1520]" />}
                                </div>
                                <span className="text-xs font-mono" style={{ color: activeIndicators.has(ind.id) ? ind.color : '#9ca3af' }}>
                                  {ind.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          const layouts = ["1-grid", "2-grid", "4-grid"];
                          const currentIndex = layouts.indexOf(layout);
                          const nextIndex = (currentIndex + 1) % layouts.length;
                          setLayout(layouts[nextIndex]);
                        }}
                        className="workspace-chip"
                      >
                        Layouts
                      </button>
                    </div>
                  </div>
                  <SharedMultiChartGrid
                    className="workspace-body"
                    onOpenChart={(title) => {
                      setExpandedChart(title);
                      if (title) {
                        setFocusedSymbol(title);
                        setAsset(title, 'stock');
                      }
                    }}
                    timeframe={timeframe}
                    activeIndicators={activeIndicators}
                    showGridLines={savedSettings?.display?.showGridLines ?? true}
                    layout={layout}
                  />
                </section>

                <section className="tr-surface-card tr-panel-shell tr-panel-shell--auto">
                  <TechnicalScreeners />
                </section>

                <section className="tr-surface-card tr-panel-shell tr-panel-shell--fixed">
                  <FODashboard />
                </section>

                <section className="tr-surface-card tr-panel-shell tr-panel-shell--grouped">
                  <div className="trader-section-header">
                    <div>
                      <div className="trader-section-eyebrow">Trader Insights</div>
                      <h2 className="trader-section-title">Research insights and catalysts</h2>
                    </div>
                  </div>
                  <div className="trader-insights-grid">
                    <div className="tr-surface-card tr-panel-shell tr-panel-shell--nested">
                      <SignalEnginePanel />
                    </div>
                    <div className="tr-surface-card tr-panel-shell tr-panel-shell--nested">
                      <CatalystPanel />
                    </div>
                  </div>
                </section>

                <section className="tr-surface-card tr-panel-shell tr-panel-shell--grouped">
                  <div className="trader-section-header">
                    <div>
                      <div className="trader-section-eyebrow">Market Analytics</div>
                      <h2 className="trader-section-title">Sectors, gainers, and shockers</h2>
                    </div>
                  </div>
                  <div className="trader-market-grid">
                    <div className="tr-surface-card tr-panel-shell tr-panel-shell--nested">
                      <SectorHeatmap />
                    </div>
                    <div className="tr-surface-card tr-panel-shell tr-panel-shell--nested">
                      <GapLists />
                    </div>
                    <div className="tr-surface-card tr-panel-shell tr-panel-shell--nested">
                      <VolumeShockers />
                    </div>
                  </div>
                </section>
              </div>

              <aside className="trader-right-column">
                <div className="tr-surface-card tr-panel-shell tr-panel-shell--sidebar">
                  <TrendStrengthPanel />
                </div>

                <div className="tr-surface-card tr-panel-shell tr-panel-shell--sidebar">
                  <ResearchToolPanel symbol={focusedSymbol || analysisSymbol || undefined} />
                </div>

                <div className="tr-surface-card tr-panel-shell tr-panel-shell--sidebar">
                  <InstrumentSummaryPanel />
                </div>

                <div className="tr-surface-card tr-panel-shell tr-panel-shell--news-sidebar">
                  <NewsFlash variant="compact" />
                </div>
              </aside>
            </section>
          </div>
        </div>
      </div>
      </div>


      {expandedChart && (
        <>
          {/* Backdrop — fixed, full viewport, click to close */}
          <div
            className="chart-modal-backdrop"
            onClick={() => setExpandedChart(null)}
          />
          {/* Centering shell */}
          <div className="chart-modal">
            <div
              className="chart-modal-panel"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="chart-modal-header">
                <div className="chart-modal-title">
                  {expandedChart} — Full Screen
                </div>
                <button
                  className="chart-modal-close"
                  onClick={() => setExpandedChart(null)}
                >
                  Close
                </button>
              </div>
              <div className="chart-modal-body" style={{ padding: 0 }}>
                <AdvancedTradingChart
                  symbol={resolveBackendSymbol(expandedChart)}
                  initialTimeframe="D"
                  height={680}
                  showHeader={false}
                />
              </div>
            </div>
          </div>
        </>
      )}

    </MainLayout>
  );
}


export default ResearchView;

