import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, TrendingUp, TrendingDown, Layers, Activity, AlertTriangle, Zap, BarChart2, Bookmark, BookmarkCheck } from 'lucide-react';
import { fetchTechnicalSummary } from '../api/technicalApi';
import { fetchWatchlistLiveData, addSymbolToWatchlist, removeSymbolFromWatchlist } from '../api/watchlistApi';
import { fetchMarketHistory } from '../api/marketApi';
import api from '../api/api';
import { formatPrice } from '../utils/currency';
import { getAssetMetadata } from '../utils/assetClassifier';
import StockFundamentalsPanel from '../components/shared/StockFundamentalsPanel';
import { useMarketStatus } from '../hooks/useMarketStatus';

import TradeDecisionZone from '../components/trader/stockResearch/TradeDecisionZone';

const TraderChartPanel = lazy(() => import('../components/trader/stockResearch/TraderChartPanel'));

/* helpers */
const Card = ({ children, className = '' }) => (
  <div
    className={`rounded-xl p-5 ${className}`}
    style={{ background: '#0D1421', border: '1px solid rgba(255,255,255,0.07)' }}
  >
    {children}
  </div>
);

const Lbl = ({ children }) => (
  <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">{children}</div>
);

const Bar = ({ label, value, color = '#475569' }) => (
  <div className="mb-3.5 last:mb-0">
    <div className="mb-1.5 flex justify-between">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="text-[11px] font-semibold text-slate-300">{value}%</span>
    </div>
    <div className="h-1 overflow-hidden rounded-full bg-white/5">
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
    </div>
  </div>
);

const Spark = ({ d, color = '#22d3ee' }) => {
  if (!d?.length) return null;
  const mx = Math.max(...d);
  const mn = Math.min(...d);
  const r = mx - mn || 1;
  const pts = d.map((v, i) => `${(i / (d.length - 1)) * 92},${30 - ((v - mn) / r) * 24}`).join(' ');
  return (
    <svg width={92} height={32} viewBox="0 0 92 32">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const InsightsSection = ({ techData }) => {
  const items = [];
  
  if (techData?.score) {
    const bias = techData.score.bias;
    if (bias === 'bullish') {
      items.push({ text: 'Trend alignment is generally positive across intraday structures.', type: 'bull' });
      items.push({ text: 'Pullbacks are likely to be absorbed near short-term support zones.', type: 'bull' });
    } else if (bias === 'bearish') {
      items.push({ text: 'Trend alignment is negative, reflecting short-term weakness.', type: 'bear' });
      items.push({ text: 'Sector is underperforming the index on a relative strength basis.', type: 'bear' });
    } else {
      items.push({ text: 'Trend alignment is currently neutral or mixed.', type: 'neutral' });
    }

    if (techData.score.score > 65) {
      items.push({ text: 'Asset is showing strong relative performance and conviction.', type: 'bull' });
    } else if (techData.score.score < 35) {
      items.push({ text: 'Asset is underperforming relative to market benchmarks.', type: 'bear' });
    }
  }

  if (techData?.indicators) {
    const vol = techData.indicators.volumeStatus;
    if (vol === 'high_volume' || vol === 'above_average') {
      items.push({ text: 'Strong volume participation supporting the recent price action.', type: 'bull' });
    } else if (vol === 'low_volume' || vol === 'below_average') {
      items.push({ text: 'Volume is declining, indicating a potential lack of directional conviction.', type: 'caution' });
    }

    const rsi = techData.indicators.rsi;
    if (rsi > 70) {
      items.push({ text: `Momentum is heavily overextended (RSI ${rsi}). Pullback risk is high.`, type: 'bear' });
    } else if (rsi < 30) {
      items.push({ text: `Oversold territory (RSI ${rsi}). Potential bounce opportunity emerging.`, type: 'bull' });
    } else if (rsi >= 50) {
      items.push({ text: 'Momentum indicators are constructive, not yet overextended.', type: 'neutral' });
    } else {
      items.push({ text: 'Momentum is weak but not entirely in the oversold zone.', type: 'caution' });
    }
  }

  if (items.length === 0) {
    items.push({ text: 'Not enough technical data to generate actionable insights.', type: 'neutral' });
  }

  const dot = { bull: '#10b981', bear: '#ef4444', caution: '#f59e0b', neutral: '#64748b' };
  const tag = { bull: 'Bullish', bear: 'Bearish', caution: 'Caution', neutral: 'Neutral' };
  const tc = { bull: 'text-emerald-500', bear: 'text-rose-500', caution: 'text-amber-500', neutral: 'text-slate-500' };
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl p-4" style={{ background: '#0D1421', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: dot[item.type] }} />
            <span className={`text-[9px] font-bold uppercase tracking-widest ${tc[item.type]}`}>{tag[item.type]}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">{item.text}</p>
        </div>
      ))}
    </div>
  );
};

const ActivitySection = ({ techData }) => {
  const feed = [];
  const now = new Date();
  
  if (techData?.patterns && techData.patterns.length > 0) {
    techData.patterns.forEach((p, i) => {
      feed.push({ 
        time: `${now.getHours()}:${String(Math.max(0, now.getMinutes() - i * 5)).padStart(2,'0')}`, 
        type: 'PATTERN', 
        msg: `${p.pattern} detected (${p.confidence}% confidence): ${p.description}`, 
        color: '#a78bfa', 
        Icon: Zap 
      });
    });
  }

  if (techData?.indicators) {
    const vol = techData.indicators.volumeStatus;
    if (vol === 'high_volume') {
      feed.push({ time: 'Recent', type: 'VOL ALERT', msg: 'Unusual volume surge: Institutional accumulation or distribution signal', color: '#22d3ee', Icon: Activity });
    }

    const rsi = techData.indicators.rsi;
    if (rsi > 70) {
      feed.push({ time: 'Recent', type: 'CAUTION', msg: 'RSI divergence: Momentum is heavily overbought', color: '#f59e0b', Icon: AlertTriangle });
    } else if (rsi < 30) {
      feed.push({ time: 'Recent', type: 'OPPORTUNITY', msg: 'RSI oversold: Asset trading in deep discount zone', color: '#10b981', Icon: TrendingDown });
    }
  }

  if (techData?.score) {
    const bias = techData.score.bias;
    if (bias === 'bullish') {
      feed.push({ time: 'Today', type: 'SIGNAL', msg: 'Price maintaining strong bullish structure above key MAs', color: '#10b981', Icon: TrendingUp });
    } else if (bias === 'bearish') {
      feed.push({ time: 'Today', type: 'SIGNAL', msg: 'Price broke below key short-term supports', color: '#ef4444', Icon: TrendingDown });
    }
  }

  if (feed.length === 0) {
    feed.push({ time: 'Today', type: 'INFO', msg: 'No significant technical activity detected in the current session.', color: '#64748b', Icon: Activity });
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {feed.map(({ time, type, msg, color, Icon }, i) => (
        <div key={i} className="flex gap-4 rounded-2xl border p-4" style={{ background: `${color}08`, borderColor: `${color}22` }}>
          <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${color}15` }}>
              <Icon size={15} style={{ color }} />
            </div>
            <span className="text-[9px] font-bold text-slate-600">{time}</span>
          </div>
          <div>
            <span className="mb-1 block text-[9px] font-black uppercase tracking-widest" style={{ color }}>{type}</span>
            <p className="text-xs leading-relaxed text-slate-300">{msg}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const PerformanceSection = ({ stock, techData }) => {
  const chg = stock?.changePercent || 0;
  
  const generateSpark = (baseChg, variance) => {
    return Array(7).fill(0).map((_, i) => 100 + baseChg + (Math.sin(i) * variance));
  };

  const sparks = {
    '1D': generateSpark(chg, 1),
    '1W': generateSpark(chg * 2, 3),
    '1M': generateSpark(chg * 4, 6),
    '6M': generateSpark(chg * 10, 12),
    '1Y': generateSpark(chg * 15, 20),
  };

  const benchmarks = {
    '1D': `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`,
    '1W': `${(chg * 2) > 0 ? '+' : ''}${(chg * 2).toFixed(2)}%`,
    '1M': `${(chg * 4) > 0 ? '+' : ''}${(chg * 4).toFixed(2)}%`,
    '6M': `${(chg * 10) > 0 ? '+' : ''}${(chg * 10).toFixed(2)}%`,
    '1Y': `${(chg * 15) > 0 ? '+' : ''}${(chg * 15).toFixed(2)}%`,
  };

  const dashboardCardStyle = {
    background: '#0B1D2A',
    borderRadius: '12px',
    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.24)',
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries(benchmarks).map(([label, value]) => {
          const positive = String(value).startsWith('+');
          return (
            <div key={label} className="p-4 md:p-5" style={dashboardCardStyle}>
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8FA3B0]">{label}</div>
              <div className={`mt-2 text-3xl font-black leading-none ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>{value}</div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] font-medium text-[#8FA3B0]">Return</div>
                  <div className="mt-1 text-xs text-slate-500">{positive ? 'Positive trend' : 'Negative trend'}</div>
                </div>
                <Spark d={sparks[label]} color={positive ? '#22c55e' : '#ef4444'} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="p-4 md:p-5" style={dashboardCardStyle}>
          <div className="text-base font-medium text-slate-100">Volatility</div>
          <div className="mt-4 divide-y divide-white/6">
            {[
              ['Beta', '1.12', 'text-slate-100'],
              ['ATR (14)', techData?.indicators?.atr ? `Rs ${Number(techData.indicators.atr).toFixed(2)}` : 'N/A', 'text-slate-100'],
              ['RSI (14)', techData?.indicators?.rsi ? Number(techData.indicators.rsi).toFixed(2) : 'N/A', techData?.indicators?.rsi > 50 ? 'text-emerald-400' : 'text-rose-400'],
              ['Sharpe Ratio', '1.84', 'text-emerald-400'],
            ].map(([label, value, tone]) => (
              <div key={label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <span className="text-sm font-medium text-[#8FA3B0]">{label}</span>
                <span className={`text-lg font-black ${tone}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 md:p-5" style={dashboardCardStyle}>
          <div className="text-base font-medium text-slate-100">Alpha vs Nifty</div>
          <div className="mt-4 divide-y divide-white/6">
            {[
              ['1W Alpha', '+0.8%', 'text-emerald-400'],
              ['1M Alpha', '+1.4%', 'text-emerald-400'],
              ['6M Alpha', '+2.6%', 'text-emerald-400'],
              ['RS Rating', '1.46', 'text-cyan-400'],
            ].map(([label, value, tone]) => (
              <div key={label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <span className="text-sm font-medium text-[#8FA3B0]">{label}</span>
                <span className={`text-lg font-black ${tone}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// FundamentalsSection now delegates to the shared DB-backed panel
const FundamentalsSection = ({ symbol }) => (
  <StockFundamentalsPanel symbol={symbol} compact={true} />
);

const KeyLevelsSignal = ({ keyLevels, techData, stock }) => {
  const breakdown = techData?.score?.breakdown || {};
  const trendPct = Math.min(100, Math.round(((breakdown.trend || 0) / 20) * 100)) || 50;
  const oscPct = Math.min(100, Math.round((((breakdown.rsi || 0) + (breakdown.macd || 0)) / 40) * 100)) || 50;
  const volPct = Math.min(100, Math.round(((breakdown.volume || 0) / 15) * 100)) || 50;
  const paPct = Math.min(100, Math.round(((breakdown.priceAction || 0) / 25) * 100)) || 50;

  const totalScore = techData?.score?.score || 50;
  const totalIndicators = 20;
  const buyCount = Math.round((totalScore / 100) * totalIndicators);
  const sellCount = Math.round(((100 - totalScore) / 100) * (totalIndicators * 0.7));
  const neutralCount = totalIndicators - buyCount - sellCount;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <Lbl>Key Price Levels</Lbl>
        <div className="space-y-2">
          {[
            { badge: 'R2', label: 'Resistance 2', value: keyLevels?.resistance?.r2, color: '#f87171', bg: 'rgba(239,68,68,0.07)' },
            { badge: 'R1', label: 'Resistance 1', value: keyLevels?.resistance?.r1, color: '#fca5a5', bg: 'rgba(239,68,68,0.10)' },
            { badge: 'S1', label: 'Support 1', value: keyLevels?.support?.s1, color: '#34d399', bg: 'rgba(16,185,129,0.10)' },
            { badge: 'S2', label: 'Support 2', value: keyLevels?.support?.s2, color: '#6ee7b7', bg: 'rgba(16,185,129,0.07)' },
          ].filter((r) => r.value).map(({ badge, label, value, color, bg }) => (
            <div key={label} className="flex items-center justify-between rounded-xl p-3" style={{ background: bg, border: `1px solid ${color}22` }}>
              <div className="flex items-center gap-3">
                <span className="rounded border px-2 py-0.5 text-[9px] font-black" style={{ color, borderColor: `${color}44`, background: `${color}15` }}>{badge}</span>
                <span className="text-xs font-semibold text-slate-400">{label}</span>
              </div>
              <span className="font-mono text-base font-black" style={{ color }}>{formatPrice(value, stock?.type, stock?.symbol)}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <Lbl>Signal Strength</Lbl>
        <Bar label={`Moving Averages (${breakdown.trend || 0})`} value={trendPct} color="#10b981" />
        <Bar label={`Oscillators (${(breakdown.rsi || 0) + (breakdown.macd || 0)})`} value={oscPct} color="#22d3ee" />
        <Bar label={`Price Action (${breakdown.priceAction || 0})`} value={paPct} color="#a78bfa" />
        <Bar label={`Volume Analysis (${breakdown.volume || 0})`} value={volPct} color="#fb923c" />
        <div className="mt-4 border-t border-white/5 pt-3">
          <div className="mb-2 flex justify-between text-[9px] font-bold text-slate-500">
            <span>Sell {sellCount}</span><span>Neutral {neutralCount}</span><span>Buy {buyCount}</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full" style={{ background: '#101828' }}>
            <div style={{ width: `${(sellCount / totalIndicators) * 100}%`, background: '#ef4444', opacity: 0.7 }} />
            <div style={{ width: `${(neutralCount / totalIndicators) * 100}%`, background: '#64748b', opacity: 0.5 }} />
            <div style={{ width: `${(buyCount / totalIndicators) * 100}%`, background: '#10b981', opacity: 0.8 }} />
          </div>
        </div>
      </Card>
    </div>
  );
};

const TABS = ['Insights', 'Activity', 'Performance', 'Fundamentals'];

const EMPTY_STOCK = {
  symbol: '', name: '', price: 0, changePercent: 0, volume: 0,
  atr: null, dayRange: null, sentiment: null, exchange: 'NSE',
};

export default function TraderStockPage({ overrideSymbol, onBack }) {
  const navigate = useNavigate();
  const { symbol: routeSymbol } = useParams();
  const symbol = overrideSymbol || routeSymbol || 'RELIANCE';
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState({ ...EMPTY_STOCK, symbol });
  const [keyLevels, setKeyLevels] = useState({});
  const [techData, setTechData] = useState(null);
  const [stockDetails, setStockDetails] = useState({});
  const [tab, setTab] = useState('Insights');
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistId, setWatchlistId] = useState(null);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [watchlistMsg, setWatchlistMsg] = useState('');
  const [marketStatus, setMarketStatus] = useState({ nifty: null, bankNifty: null, isOpen: false });
  const [assetType, setAssetType] = useState('STOCK');
  
  const assetMeta = getAssetMetadata(stock.symbol);
  const { isOpen: isMarketOpen, isCrypto } = useMarketStatus(assetMeta.type);

  // Fetch NIFTY + BANKNIFTY live change %
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [niftyRes, bankRes] = await Promise.allSettled([
          fetchMarketHistory('^NSEI', 'STOCK', '1D'),
          fetchMarketHistory('^NSEBANK', 'STOCK', '1D'),
        ]);
        const calcChange = (res) => {
          const pts = res.status === 'fulfilled' ? (Array.isArray(res.value?.data) ? res.value.data : []) : [];
          if (pts.length < 2) return null;
          const cur = Number(pts[pts.length - 1]?.close || 0);
          const prev = Number(pts[pts.length - 2]?.close || 0);
          if (!cur || !prev) return null;
          return ((cur - prev) / prev) * 100;
        };
        if (active) {
          setMarketStatus({
            nifty: calcChange(niftyRes),
            bankNifty: calcChange(bankRes),
            isOpen: isMarketOpen,
          });
        }
      } catch (e) {
        console.warn('Market status fetch failed:', e);
      }
    };
    load();
    // Refresh every 5 mins
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { active = false; clearInterval(interval); };
  }, [assetMeta.type]);

  useEffect(() => {
    if (assetMeta.type !== 'Equity' && tab === 'Fundamentals') {
      setTab('Insights');
    }
  }, [assetMeta.type, tab]);

  useEffect(() => {
    if (!symbol) return;
    let active = true;
    setLoading(true);

    Promise.allSettled([
      fetchTechnicalSummary('stock', symbol),
      api.get(`/market?symbols=${encodeURIComponent(symbol)}`).catch(() => null),
      fetchWatchlistLiveData('trader'),
      api.get('/watchlist', { params: { mode: 'trader' } }).catch(() => ({ data: [] })),
    ]).then(([techRes, mktRes, wlRes, listsRes]) => {
      if (!active) return;

      const tech = techRes.status === 'fulfilled' ? techRes.value : null;
      const mktArr = mktRes?.status === 'fulfilled' ? (mktRes.value?.data?.data ?? mktRes.value?.data ?? []) : [];
      const mkt = Array.isArray(mktArr) ? (mktArr.find(s => s.symbol.toUpperCase() === symbol.toUpperCase()) || mktArr[0]) : mktArr;
      
      const wlArr = wlRes?.status === 'fulfilled' ? wlRes.value : [];

      const price = Number(mkt?.price ?? mkt?.ltp ?? tech?.indicators?.ema20 ?? 0);
      const changePercent = Number(mkt?.changePercent ?? mkt?.pChange ?? 0);
      const am = getAssetMetadata(symbol);
      const isCrypto = am.type === 'Crypto';

      setStock({
        symbol: symbol.replace(/\.(NS|BO)$/i, ''),
        name: mkt?.name ?? mkt?.companyName ?? `${symbol} Ltd.`,
        price,
        changePercent,
        volume: mkt?.volume != null && mkt.volume > 0 
          ? (isCrypto ? `${Number(mkt.volume).toLocaleString()} ${am.currency}` : `${(Number(mkt.volume) / 1e6).toFixed(2)}M`) 
          : '—',
        atr: tech?.indicators?.atr ? Number(tech.indicators.atr).toFixed(1) : '—',
        dayRange: mkt?.dayLow && mkt?.dayHigh && mkt.dayLow !== mkt.dayHigh ? `${mkt.dayLow} – ${mkt.dayHigh}` : '—',
        sentiment: tech?.score?.bias ?? '—',
        exchange: 'NSE',
      });
      setAssetType(mkt?.type || 'STOCK');

      setTechData(tech);
      setStockDetails(mkt?.details || {});

      setKeyLevels({
        support: { s1: tech?.indicators?.support ?? null, s2: null },
        resistance: { r1: tech?.indicators?.resistance ?? null, r2: null },
      });
      
      if (Array.isArray(wlArr)) {
        setWatchlist(wlArr.map(w => ({
          symbol: w.symbol.replace(/\.(NS|BO)$/i, '').replace(/-USD$/i, ''),
          price: Number(w.price || w.ltp || 0),
          chg: Number(w.changePercent || w.pChange || 0)
        })));
      }

      // Populate watchlistId and isInWatchlist
      if (listsRes?.status === 'fulfilled') {
        const lists = Array.isArray(listsRes.value?.data) ? listsRes.value.data : [];
        if (lists.length > 0) {
          const id = lists[0]._id || lists[0].id || null;
          setWatchlistId(id);
          const symSet = new Set((lists[0].items || []).map(i =>
            String(typeof i === 'string' ? i : (i?.symbol || '')).replace(/\.(NS|BO)$/i, '').toUpperCase()
          ));
          setIsInWatchlist(symSet.has(symbol.replace(/\.(NS|BO)$/i, '').toUpperCase()));
        }
      }

      setLoading(false);
    });

    return () => { active = false; };
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#050B14' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-300" />
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">Loading Terminal...</p>
        </div>
      </div>
    );
  }

  const pos = stock.changePercent >= 0;

  const handleWatchlistToggle = async () => {
    if (!watchlistId) { setWatchlistMsg('No watchlist found'); setTimeout(() => setWatchlistMsg(''), 2000); return; }
    try {
      if (isInWatchlist) {
        await removeSymbolFromWatchlist(watchlistId, symbol);
        setIsInWatchlist(false);
        setWatchlistMsg('Removed from watchlist');
      } else {
        await addSymbolToWatchlist(watchlistId, symbol);
        setIsInWatchlist(true);
        setWatchlistMsg('Added to watchlist!');
      }
    } catch (e) {
      setWatchlistMsg('Failed — try again');
    }
    setTimeout(() => setWatchlistMsg(''), 2500);
  };

  return (
    <div className="min-h-screen text-slate-200" style={{ background: '#050B14', fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 px-5 py-2.5" style={{ background: '#0B1220' }}>
        <button onClick={onBack || (() => navigate('/dashboard'))} className="flex items-center gap-1.5 text-sm font-bold text-slate-400 transition-colors hover:text-white">
          <ChevronLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="text-slate-500">NIFTY</span>
          <span className={marketStatus.nifty !== null ? (marketStatus.nifty >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}>
            {marketStatus.nifty !== null ? `${marketStatus.nifty >= 0 ? '+' : ''}${marketStatus.nifty.toFixed(2)}%` : '—'}
          </span>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-slate-500">BANKNIFTY</span>
          <span className={marketStatus.bankNifty !== null ? (marketStatus.bankNifty >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}>
            {marketStatus.bankNifty !== null ? `${marketStatus.bankNifty >= 0 ? '+' : ''}${marketStatus.bankNifty.toFixed(2)}%` : '—'}
          </span>
          <div className="h-4 w-px bg-white/10" />
          {isMarketOpen || isCrypto ? (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="text-slate-500 font-normal mr-1">Asset Status:</span>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              {isCrypto ? 'CRYPTO 24/7' : 'MARKET OPEN'}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="text-slate-500 font-normal mr-1">Asset Status:</span>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              MARKET CLOSED
            </span>
          )}
        </div>
      </div>


      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-3" style={{ background: '#0B1220' }}>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-white">{stock.symbol}</h1>
              <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider flex items-center gap-1.5 ${assetMeta.badgeColor}`}>
                <span className="text-sm">{assetMeta.icon}</span>
                {assetMeta.type.toUpperCase()}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-2 mt-1">
               <span>{stock.name}</span>
               <span>·</span>
               <span>{assetMeta.exchange}</span>
               <span>·</span>
               <span>{assetMeta.currency}</span>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 text-2xl font-black ${pos ? 'text-emerald-400' : 'text-rose-400'}`}>
            {pos ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            {formatPrice(stock.price, assetType, stock.symbol)}
            <span className="text-sm">{pos ? '+' : ''}{Number(stock.changePercent).toFixed(2)}%</span>
          </div>
        </div>
        <div className="flex items-center gap-5 text-[11px] font-semibold text-slate-400">
          {[['Vol', stock.volume], ['ATR', stock.atr], ['Range', stock.dayRange], ['Sentiment', stock.sentiment]].map(([l, v]) => (
            <div key={l}><span className="text-slate-600">{l}: </span><span className="text-slate-200">{v}</span></div>
          ))}
        </div>

        {/* ── Watchlist button ── */}
        <div className="flex items-center gap-3">
          {watchlistMsg && (
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${
              watchlistMsg.includes('Added') ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
              : watchlistMsg.includes('Removed') ? 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
              : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
            }`}>{watchlistMsg}</span>
          )}
          <button
            onClick={handleWatchlistToggle}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold border transition-all ${
              isInWatchlist
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-rose-500/15 hover:text-rose-300 hover:border-rose-500/30'
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-emerald-500/15 hover:text-emerald-300 hover:border-emerald-500/30'
            }`}
          >
            {isInWatchlist ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            {isInWatchlist ? 'In Watchlist' : '+ Watchlist'}
          </button>
        </div>
      </div>

      <div className="flex" style={{ height: 'calc(100vh - 90px)' }}>
        <div className="hidden flex-shrink-0 flex-col overflow-y-auto border-r border-white/5 lg:flex" style={{ width: 240, background: '#0B1220', scrollbarWidth: 'none' }}>
          <div className="sticky top-0 border-b border-white/5 px-4 py-3" style={{ background: '#0B1220' }}>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500"><Layers size={11} />Watchlist</div>
          </div>
          <div className="space-y-1 p-2">
            {watchlist.map((w) => (
              <div
                key={w.symbol}
                onClick={() => navigate(`/stocks/${w.symbol}`)}
                className="cursor-pointer rounded-xl px-3 py-2.5 transition-all hover:bg-white/5"
                style={w.symbol === stock.symbol ? { background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.18)' } : {}}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">{w.symbol}</div>
                    <div className="text-[10px] text-slate-500">
                      {getAssetMetadata(w.symbol).type}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-white">{w.price.toFixed(2)}</div>
                    <div className={`text-[10px] font-bold ${w.chg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{w.chg >= 0 ? '+' : ''}{w.chg.toFixed(2)}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1f2937 transparent' }}>
          <div className="space-y-5 pb-10">
            <Suspense
              fallback={
                <div className="px-4 pt-4">
                  <div className="flex items-center justify-center rounded-2xl" style={{ height: 560, background: '#0B1220', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-300" />
                  </div>
                </div>
              }
            >
              <TraderChartPanel symbol={stock.symbol} price={stock.price} assetType={stock.type} />
            </Suspense>

            <div className="px-4 space-y-5">
              <TradeDecisionZone stock={stock} keyLevels={keyLevels} techData={techData} />
              <KeyLevelsSignal keyLevels={keyLevels} techData={techData} stock={stock} />

              <div className="overflow-hidden rounded-2xl" style={{ background: '#0B1220', boxShadow: '0 20px 60px rgba(0,0,0,0.8),0 0 0 1px rgba(255,255,255,0.04)' }}>
                <div className="flex overflow-x-auto border-b border-white/5" style={{ scrollbarWidth: 'none' }}>
                  {TABS.filter(t => t !== 'Fundamentals' || assetMeta.type === 'Equity').map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className="flex-shrink-0 border-b-2 px-6 py-3.5 text-xs font-bold transition-all"
                      style={tab === t ? { borderColor: '#22d3ee', color: '#22d3ee', background: 'rgba(34,211,238,0.05)' } : { borderColor: 'transparent', color: '#475569' }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="p-6">
                  {tab === 'Insights' && <InsightsSection techData={techData} />}
                  {tab === 'Activity' && <ActivitySection techData={techData} />}
                  {tab === 'Performance' && <PerformanceSection stock={stock} techData={techData} />}
                  {tab === 'Fundamentals' && <FundamentalsSection symbol={symbol} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
