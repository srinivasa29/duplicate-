import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Activity, TrendingUp } from "lucide-react";
import SectionPanel from "../components/research/SectionPanel";
import ScanLoader from "../components/research/ScanLoader";
import EmptyState from "../components/research/EmptyState";
import ScreenerCard from "../components/research/ScreenerCard";
import SectorFilter from "../components/research/SectorFilter";
import ScannerControls from "../components/research/ScannerControls";
import SearchBar from "../components/research/SearchBar";
import ActionPanel from "../components/research/ActionPanel";
import api from "../api/api";
import { useMarketStatus } from "../hooks/useMarketStatus";

const TABS = ["Market Opportunities", "Momentum", "Breakout", "Pullback", "Fakeout"];
const SECTORS = ["All", "IT", "Banking", "Auto", "Pharma", "FMCG", "Energy"];

const normalizeStock = (s, i) => ({
  id: s._id || s.id || s.symbol || i,
  symbol: String(s.symbol || '').replace(/\.(NS|BO)$/i, ''),
  name: s.name || s.companyName || s.symbol || '',
  sector: s.sector || 'Equity',
  price: Number(s.price ?? s.ltp ?? 0),
  change: Number(s.changePercent ?? s.change ?? 0),
  rsi: Number(s.rsi ?? 50),
  volume: Number(s.volume ?? 0),
  volumeSpike: Boolean(s.volumeSpike || Number(s.volumeRatio ?? 1) > 1.5),
  breakoutCandidate: Boolean(s.breakout || s.breakoutCandidate),
  aboveSma50: Boolean(s.aboveSma50 ?? true),
  macdPositive: Boolean(s.macdPositive ?? (Number(s.changePercent ?? 0) > 0)),
  signalType: s.signalType || (Number(s.changePercent ?? 0) > 2 ? 'Breakout' : 'Momentum'),
  confidence: Number(s.confidence ?? s.score ?? 72),
  entry: Number(s.entry ?? s.price ?? 0),
  target: Number(s.target ?? (s.price ?? 0) * 1.04),
  sl: Number(s.sl ?? (s.price ?? 0) * 0.985),
  rvol: Number(s.volumeRatio ?? 1.2),
  history: s.history || [],
});

const mapTabToSignal = (tab) => {
  if (tab === "Market Opportunities") return "all";
  return tab;
};

const applyFilters = ({ stocks, filters, activeTab, searchText }) => {
  const query = searchText.trim().toLowerCase();
  const selectedSignal = mapTabToSignal(activeTab);

  return stocks.filter((stock) => {
    if (query && !`${stock.name} ${stock.sector}`.toLowerCase().includes(query)) return false;
    if (filters.sector !== "All" && stock.sector !== filters.sector) return false;
    if (stock.rsi < filters.rsi[0] || stock.rsi > filters.rsi[1]) return false;
    if (filters.volumeSpike && !stock.volumeSpike) return false;
    if (filters.breakout && !stock.breakoutCandidate) return false;
    if (filters.aboveSma50 && !stock.aboveSma50) return false;
    if (filters.macdPositive && !stock.macdPositive) return false;
    if (selectedSignal !== "all" && stock.signalType !== selectedSignal) return false;
    return true;
  });
};



const MarketResearchDashboard = () => {
  const { isOpen: isMarketOpen, isCrypto } = useMarketStatus('Equity'); // Default to Equity for the dashboard
  const [baseStocks, setBaseStocks] = useState([]);
  const [filteredStocks, setFilteredStocks] = useState([]);
  const [expandedStockId, setExpandedStockId] = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [isScanning, setIsScanning] = useState(true);
  const [activeTab, setActiveTab] = useState("Market Opportunities");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState(null);

  const [marketPulse, setMarketPulse] = useState({
    nifty: 22453,
    sentimentLabel: 'Neutral',
    sentimentScore: 55,
  });

  const [filters, setFilters] = useState({
    sector: "All",
    rsi: [30, 70],
    volumeSpike: false,
    breakout: false,
    aboveSma50: false,
    macdPositive: false,
  });

  const sectors = useMemo(() => {
    const dynamic = Array.from(new Set(baseStocks.map((stock) => stock.sector)));
    const all = new Set([...SECTORS, ...dynamic]);
    return Array.from(all);
  }, [baseStocks]);

  // Apply client-side filters
  useEffect(() => {
    const next = applyFilters({ stocks: baseStocks, filters, activeTab, searchText: search });
    setFilteredStocks(next);
  }, [baseStocks, filters, activeTab, search]);

  // Live market pulse from backend (replaces Math.random() intervals)
  const fetchMarketPulse = useCallback(async () => {
    try {
      const [niftyRes, sentRes] = await Promise.allSettled([
        api.get('/market/nifty'),
        api.get('/market/sentiment'),
      ]);
      const nifty = niftyRes.status === 'fulfilled' ? Number(niftyRes.value?.data?.price ?? niftyRes.value?.data?.value ?? marketPulse.nifty) : marketPulse.nifty;
      const sent = sentRes.status === 'fulfilled' ? sentRes.value?.data : null;
      const score = Number(sent?.score ?? marketPulse.sentimentScore);
      const label = score >= 65 ? 'Constructive' : score <= 45 ? 'Cautious' : 'Neutral';
      setMarketPulse({ nifty, sentimentScore: score, sentimentLabel: label });
    } catch {}
  }, []);

  // Live stock scan from backend
  const runScan = useCallback(async () => {
    setIsScanning(true);
    setNotice(null);
    try {
      const res = await api.get('/market?type=STOCK&sort=gainers&limit=30');
      const raw = res.data?.data ?? res.data?.stocks ?? (Array.isArray(res.data) ? res.data : []);
      if (raw.length > 0) {
        setBaseStocks(raw.map(normalizeStock));
        setNotice('Scan complete. Live signals refreshed.');
      }
    } catch (err) {
      console.warn('MarketResearchDashboard scan failed:', err.message);
      setNotice('Scan failed. Check backend connection.');
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    runScan();
    fetchMarketPulse();
    const pulse = setInterval(fetchMarketPulse, 30000);
    return () => clearInterval(pulse);
  }, [runScan, fetchMarketPulse]);

  const clearFilters = () => {
    setFilters({
      sector: "All",
      rsi: [30, 70],
      volumeSpike: false,
      breakout: false,
      aboveSma50: false,
      macdPositive: false,
    });
    setActiveTab("Market Opportunities");
    setSearch("");
  };

  const handleDeleteStock = (stockId) => {
    setBaseStocks((prev) => prev.filter((stock) => stock.id !== stockId));
    if (expandedStockId === stockId) {
      setExpandedStockId(null);
    }
    setNotice("Stock removed from active scanner view.");
  };

  const handleToggleBookmark = (stockId) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(stockId)) {
        next.delete(stockId);
      } else {
        next.add(stockId);
      }
      return next;
    });
  };

  const simpleAction = (label) => {
    setNotice(`${label} action simulated (frontend-only).`);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_14%_0%,#1d3358_0%,#071225_45%,#030712_100%)] text-slate-100">
      <div className="mx-auto max-w-[1760px] px-4 py-6 md:px-6 lg:px-8">
        <header className="mb-6 rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(8,15,28,0.84),rgba(18,30,55,0.7))] p-4 backdrop-blur-md shadow-[0_14px_36px_rgba(0,0,0,0.28)] md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${isMarketOpen ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100' : 'border-slate-500/25 bg-slate-500/10 text-slate-300'}`}>
                {isMarketOpen ? <Activity size={12} /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-500" />}
                {isMarketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">Market Research Screener</h1>
              <p className="mt-1 text-sm text-slate-300">Live market intelligence — real-time signals from backend.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                NIFTY: <span className="font-bold text-cyan-100">{marketPulse.nifty.toLocaleString("en-IN")}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
                <TrendingUp size={13} className="text-cyan-200" />
                <span className="text-slate-300">Sentiment</span>
                <span className="font-bold text-cyan-100">{marketPulse.sentimentLabel}</span>
                <span className="rounded-md bg-cyan-400/15 px-2 py-0.5 font-semibold text-cyan-100">{marketPulse.sentimentScore}/100</span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <SearchBar value={search} onChange={setSearch} />
            <ActionPanel
              onSave={() => simpleAction("Save")}
              onExcel={() => simpleAction("Excel export")}
              onNewScan={runScan}
              isScanning={isScanning}
            />
          </div>

          {notice ? <div className="mt-3 text-xs text-cyan-100">{notice}</div> : null}
        </header>

        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-white/10 bg-[linear-gradient(155deg,rgba(12,20,37,0.84),rgba(7,14,28,0.72))] p-4 backdrop-blur-md lg:sticky lg:top-4 lg:h-fit md:p-6">
            <h2 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-white">Filters</h2>

            <div className="space-y-5 text-sm">
              <SectorFilter
                sectors={sectors}
                selectedSector={filters.sector}
                onSelect={(sector) => setFilters((prev) => ({ ...prev, sector }))}
              />

              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-400">RSI Filter</div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="mb-2 text-xs text-slate-300">{filters.rsi[0]} - {filters.rsi[1]}</div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.rsi[0]}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setFilters((prev) => ({ ...prev, rsi: [Math.min(value, prev.rsi[1]), prev.rsi[1]] }));
                    }}
                    className="w-full"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.rsi[1]}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setFilters((prev) => ({ ...prev, rsi: [prev.rsi[0], Math.max(value, prev.rsi[0])] }));
                    }}
                    className="mt-1 w-full"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-400">Volume Spike Filter</div>
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                  Only Volume Spike
                  <input
                    type="checkbox"
                    checked={filters.volumeSpike}
                    onChange={(e) => setFilters((prev) => ({ ...prev, volumeSpike: e.target.checked }))}
                  />
                </label>
              </div>

              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-400">Trend Overlays</div>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                    Above SMA 50
                    <input
                      type="checkbox"
                      checked={filters.aboveSma50}
                      onChange={(e) => setFilters((prev) => ({ ...prev, aboveSma50: e.target.checked }))}
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                    MACD Positive
                    <input
                      type="checkbox"
                      checked={filters.macdPositive}
                      onChange={(e) => setFilters((prev) => ({ ...prev, macdPositive: e.target.checked }))}
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                    Breakout Candidates
                    <input
                      type="checkbox"
                      checked={filters.breakout}
                      onChange={(e) => setFilters((prev) => ({ ...prev, breakout: e.target.checked }))}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={runScan}
                  disabled={isScanning}
                  className="w-full rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/25 disabled:opacity-60"
                >
                  Activate Scan
                </button>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-white/20"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </aside>

          <main className="space-y-6">
            <section>
              <ScannerControls
                tabs={TABS}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                resultCount={filteredStocks.length}
              />

              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 md:px-6 md:py-4">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-100">Top Trade Setups</h2>
              </div>

              {isScanning ? <ScanLoader /> : null}

              {!isScanning && filteredStocks.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredStocks.map((stock) => (
                    <ScreenerCard
                      key={stock.id}
                      stock={stock}
                      expanded={expandedStockId === stock.id}
                      onToggleExpand={() => setExpandedStockId(expandedStockId === stock.id ? null : stock.id)}
                      onDelete={() => handleDeleteStock(stock.id)}
                      onToggleWatchlist={() => handleToggleBookmark(stock.id)}
                      isBookmarked={bookmarkedIds.has(stock.id)}
                    />
                  ))}
                </div>
              ) : null}

              {!isScanning && filteredStocks.length === 0 ? (
                <EmptyState onRunScan={runScan} />
              ) : null}
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionPanel title="Market Overview" subtitle="NIFTY trend, sentiment, and volatility" accent="cyan">
                <div className="space-y-2 text-sm text-slate-200">
                  <div>NIFTY: <span className="font-semibold text-emerald-200">{marketPulse.nifty.toLocaleString('en-IN')}</span></div>
                  <div>Sentiment: <span className="font-semibold text-cyan-100">{marketPulse.sentimentLabel}</span></div>
                  <div>Score: <span className="font-semibold text-amber-200">{marketPulse.sentimentScore}/100</span></div>
                </div>
              </SectionPanel>

              <SectionPanel title="Top Gainers" subtitle="Highest % change stocks from live scan" accent="emerald">
                <div className="space-y-2">
                  {baseStocks.filter(s => s.change > 0).slice(0, 5).map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                      <span className="font-semibold text-white">{s.symbol}</span>
                      <span className="text-emerald-300">+{Number(s.change).toFixed(2)}%</span>
                    </div>
                  ))}
                  {baseStocks.filter(s => s.change > 0).length === 0 && <p className="text-slate-500 text-xs">Loading...</p>}
                </div>
              </SectionPanel>

              <SectionPanel title="Volume Spikes" subtitle="Stocks with unusual volume activity" accent="violet">
                <div className="space-y-2">
                  {baseStocks.filter(s => s.volumeSpike).slice(0, 5).map((s) => (
                    <div key={s.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                      <span className="font-semibold text-white">{s.symbol}</span> — Vol Ratio: {Number(s.rvol).toFixed(1)}x
                    </div>
                  ))}
                  {baseStocks.filter(s => s.volumeSpike).length === 0 && <p className="text-slate-500 text-xs">No spikes detected.</p>}
                </div>
              </SectionPanel>

              <SectionPanel title="Breakout Candidates" subtitle="Stocks near or above key resistance" accent="amber">
                <div className="space-y-2">
                  {baseStocks.filter(s => s.breakoutCandidate).slice(0, 5).map((s) => (
                    <div key={s.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                      <span className="font-semibold text-white">{s.symbol}</span> — ₹{Number(s.price).toLocaleString('en-IN')}
                    </div>
                  ))}
                  {baseStocks.filter(s => s.breakoutCandidate).length === 0 && <p className="text-slate-500 text-xs">No breakouts detected.</p>}
                </div>
              </SectionPanel>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
              <SectionPanel title="Top Momentum" subtitle="Stocks showing strong RSI momentum" accent="cyan">
                <ul className="space-y-2 text-sm text-slate-200">
                  {[...baseStocks].sort((a, b) => b.rsi - a.rsi).slice(0, 5).map((s) => (
                    <li key={s.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 flex justify-between">
                      <span className="font-semibold text-white">{s.symbol}</span>
                      <span className="text-cyan-300">RSI {Number(s.rsi).toFixed(0)}</span>
                    </li>
                  ))}
                  {baseStocks.length === 0 && <li className="text-slate-500 text-xs">Loading...</li>}
                </ul>
              </SectionPanel>

              <SectionPanel title="Live Signal Feed" subtitle="Real-time market intelligence from scan" accent="violet">
                <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                  {filteredStocks.slice(0, 8).map((s, index) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: 8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.04, duration: 0.22 }}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
                    >
                      <span className="font-semibold text-white">{s.symbol}</span> — {s.signalType} — <span className={s.change >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{s.change >= 0 ? '+' : ''}{Number(s.change).toFixed(2)}%</span>
                    </motion.div>
                  ))}
                  {filteredStocks.length === 0 && !isScanning && <p className="text-slate-500 text-xs">No signals matched.</p>}
                </div>
              </SectionPanel>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default MarketResearchDashboard;
