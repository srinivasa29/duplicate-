/**
 * StockFundamentalsPanel
 *
 * A comprehensive, production-grade fundamentals display component.
 * Fetches from MongoDB-backed /api/stocks/:symbol/fundamentals endpoint.
 * Used in both InvestorStockPage and TraderStockPage.
 *
 * Props:
 *   symbol  {string}  — ticker without suffix (e.g. "RELIANCE")
 *   compact {bool}    — render a compact 2-row grid instead of full panel
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, BarChart2, ShieldCheck,
  Percent, Users, Globe, RefreshCw, AlertCircle, Building2,
  Activity, Layers, ChevronDown, ChevronUp
} from 'lucide-react';
import { fetchStockFundamentals } from '../../api/fundamentalApi';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v, suffix = '', decimals = 2) => {
  if (v === null || v === undefined || (typeof v === 'number' && !isFinite(v))) return 'N/A';
  return `${Number(v).toFixed(decimals)}${suffix}`;
};

const fmtCap = (v) => {
  if (!v || !isFinite(v)) return 'N/A';
  if (v >= 1e12) return `₹${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `₹${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e7)  return `₹${(v / 1e7).toFixed(2)}Cr`;
  return `₹${v.toLocaleString('en-IN')}`;
};

const fmtVol = (v) => {
  if (!v) return 'N/A';
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${v}`;
};

const valColor = (status) => {
  if (status === 'undervalued') return { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' };
  if (status === 'overvalued')  return { text: 'text-rose-400',    bg: 'bg-rose-400/10',    border: 'border-rose-400/20' };
  return                               { text: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/20' };
};

// ── Skeleton loader ───────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-white/5 ${className}`} />
);

// ── Single metric tile ────────────────────────────────────────────────────────
const Tile = ({ label, value, sub, color = '#94a3b8', icon: Icon, tooltip }) => (
  <div
    title={tooltip}
    className="group relative flex flex-col justify-between rounded-xl border border-white/5 p-4 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.03]"
    style={{ background: 'rgba(255,255,255,0.02)' }}
  >
    <div className="mb-3 flex items-center justify-between">
      <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {Icon && <Icon size={12} className="text-slate-600 group-hover:text-slate-400 transition-colors" />}
    </div>
    <div className="text-xl font-black leading-none" style={{ color }}>{value}</div>
    {sub && <div className="mt-1.5 text-[10px] text-slate-500">{sub}</div>}
  </div>
);

// ── Section heading ───────────────────────────────────────────────────────────
const SectionHead = ({ icon: Icon, label, color = '#64748b' }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `${color}18` }}>
      <Icon size={12} style={{ color }} />
    </div>
    <span className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color }}>{label}</span>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const StockFundamentalsPanel = ({ symbol, compact = false }) => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchStockFundamentals(symbol);
      if (result?.snapshot) setData(result);
      else setError('No fundamentals available for this symbol.');
    } catch (e) {
      setError('Failed to load fundamentals.');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { load(); }, [load]);

  const s = data?.snapshot ?? {};
  const vc = valColor(s.valStatus);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 py-10 text-center"
           style={{ background: 'rgba(255,255,255,0.02)' }}>
        <AlertCircle size={28} className="text-slate-600" />
        <p className="text-sm text-slate-500">{error || 'No data available.'}</p>
        <button onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={11} /> Retry
        </button>
      </div>
    );
  }

  // ── Compact mode (for Trader sidebar) ─────────────────────────────────────
  if (compact) {
    const tiles = [
      ['P/E',     fmt(s.peRatio, '', 1),             '#94a3b8'],
      ['P/B',     fmt(s.pbRatio, '', 2),             '#94a3b8'],
      ['ROE',     fmt(s.roe, '%', 1),                '#10b981'],
      ['D/E',     fmt(s.debtToEquity, '', 2),        '#f59e0b'],
      ['Div%',    fmt(s.dividendYield, '%', 2),      '#22d3ee'],
      ['Sector',  s.sector?.split(' ')[0] || 'N/A',  '#a78bfa'],
    ];
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {tiles.map(([l, v, c]) => (
            <div key={l} className="rounded-xl border border-white/5 p-3 text-center"
                 style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="mb-1.5 text-[8px] font-black uppercase tracking-widest text-slate-500">{l}</div>
              <div className="truncate text-sm font-black" style={{ color: c }}>{v}</div>
            </div>
          ))}
        </div>
        {data.description?.summary && (
          <div className="rounded-xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">About</div>
            <p className="text-xs leading-relaxed text-slate-400 line-clamp-3">{data.description.summary}</p>
          </div>
        )}
        <div className="text-[9px] text-slate-600 text-right">
          {data.asOf ? `Updated ${new Date(data.asOf).toLocaleDateString('en-IN')}` : ''} · {data.source || 'yahoo'}
        </div>
      </div>
    );
  }

  // ── Full mode ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Valuation status banner ─────────────────────────────────────── */}
      {s.valStatus && (
        <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${vc.bg} ${vc.border}`}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className={vc.text} />
            <span className={`text-sm font-bold capitalize ${vc.text}`}>{s.valStatus}</span>
            <span className="text-xs text-slate-500">based on trailing P/E</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{s.sector}</span>
            {s.industry && <span>· {s.industry}</span>}
          </div>
        </div>
      )}

      {/* ── Valuation row ───────────────────────────────────────────────── */}
      <div>
        <SectionHead icon={BarChart2} label="Valuation" color="#22d3ee" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Tile label="P/E (TTM)"   value={fmt(s.peRatio, '', 1)}      color="#94a3b8" icon={BarChart2} tooltip="Price-to-Earnings (Trailing Twelve Months)" />
          <Tile label="Fwd P/E"     value={fmt(s.forwardPe, '', 1)}    color="#64748b" icon={BarChart2} tooltip="Forward Price-to-Earnings (next 12 months estimate)" />
          <Tile label="P/B"         value={fmt(s.pbRatio, '', 2)}      color="#94a3b8" icon={Layers}   tooltip="Price-to-Book ratio" />
          <Tile label="P/S"         value={fmt(s.psRatio, '', 2)}      color="#94a3b8" icon={Layers}   tooltip="Price-to-Sales ratio" />
          <Tile label="EV/EBITDA"   value={fmt(s.evEbitda, 'x', 1)}    color="#64748b" icon={Layers}   tooltip="Enterprise Value to EBITDA" />
          <Tile label="PEG"         value={fmt(s.peg, '', 2)}          color="#94a3b8" icon={Activity} tooltip="Price/Earnings to Growth ratio. <1 = potentially undervalued" />
        </div>
      </div>

      {/* ── Profitability row ────────────────────────────────────────────── */}
      <div>
        <SectionHead icon={TrendingUp} label="Profitability" color="#10b981" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="ROE"              value={fmt(s.roe, '%', 1)}              color={s.roe > 15 ? '#10b981' : '#94a3b8'} icon={TrendingUp}   tooltip="Return on Equity — higher is better (>15% is strong)" />
          <Tile label="ROA"              value={fmt(s.roa, '%', 1)}              color={s.roa > 5  ? '#10b981' : '#94a3b8'} icon={TrendingUp}   tooltip="Return on Assets" />
          <Tile label="Profit Margin"    value={fmt(s.profitMargins, '%', 1)}    color="#22d3ee"                             icon={Percent}      tooltip="Net profit margin %" />
          <Tile label="Operating Margin" value={fmt(s.operatingMargins, '%', 1)} color="#94a3b8"                             icon={Percent}      tooltip="Operating profit margin %" />
        </div>
      </div>

      {/* ── Growth row ──────────────────────────────────────────────────── */}
      <div>
        <SectionHead icon={Activity} label="Growth" color="#a78bfa" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile label="Revenue Growth" value={fmt(s.revenueGrowth, '%', 1)}
                color={s.revenueGrowth > 0 ? '#10b981' : '#ef4444'}
                icon={s.revenueGrowth > 0 ? TrendingUp : TrendingDown}
                tooltip="Year-over-year revenue growth %" />
          <Tile label="Earnings Growth" value={fmt(s.earningsGrowth, '%', 1)}
                color={s.earningsGrowth > 0 ? '#10b981' : '#ef4444'}
                icon={s.earningsGrowth > 0 ? TrendingUp : TrendingDown}
                tooltip="Year-over-year earnings growth %" />
          <Tile label="Qtrly EPS Growth" value={fmt(s.earningsQuarterlyGrowth, '%', 1)}
                color={s.earningsQuarterlyGrowth > 0 ? '#10b981' : '#ef4444'}
                icon={Activity}
                tooltip="Quarterly earnings per share growth %" />
        </div>
      </div>

      {/* ── Financial Health row ─────────────────────────────────────────── */}
      <div>
        <SectionHead icon={ShieldCheck} label="Financial Health" color="#f59e0b" />
        <div className="grid grid-cols-3 gap-3">
          <Tile label="Debt / Equity"
                value={fmt(s.debtToEquity, '', 2)}
                color={s.debtToEquity !== null && s.debtToEquity < 1 ? '#10b981' : '#f59e0b'}
                icon={ShieldCheck}
                tooltip="Total debt relative to shareholders' equity. <1 is generally healthy." />
          <Tile label="Current Ratio"
                value={fmt(s.currentRatio, 'x', 2)}
                color={s.currentRatio > 1.5 ? '#10b981' : '#f59e0b'}
                icon={ShieldCheck}
                tooltip="Short-term assets vs liabilities. >1.5 is healthy." />
          <Tile label="Quick Ratio"
                value={fmt(s.quickRatio, 'x', 2)}
                color={s.quickRatio > 1 ? '#10b981' : '#f59e0b'}
                icon={ShieldCheck}
                tooltip="Liquid assets vs liabilities (excludes inventory)." />
        </div>
      </div>

      {/* ── Market & Shareholder row ─────────────────────────────────────── */}
      <div>
        <SectionHead icon={DollarSign} label="Market & Shareholder" color="#64748b" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Market Cap"     value={fmtCap(s.marketCap)}            color="#94a3b8" icon={Building2}  tooltip="Total market capitalisation" />
          <Tile label="Beta"           value={fmt(s.beta, '', 2)}              color={s.beta > 1.2 ? '#f59e0b' : '#10b981'} icon={Activity}
                sub={s.beta > 1.2 ? 'High volatility' : s.beta < 0.8 ? 'Defensive' : 'Moderate'}
                tooltip="Market volatility relative to Nifty 50. >1 = more volatile" />
          <Tile label="Dividend Yield" value={fmt(s.dividendYield, '%', 2)}   color="#22d3ee" icon={Percent}   tooltip="Annual dividend as % of current price" />
          <Tile label="Payout Ratio"   value={fmt(s.payoutRatio, '%', 1)}     color="#94a3b8" icon={Percent}   tooltip="% of earnings paid as dividends" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Tile label="52W High"  value={fmt(s.fiftyTwoWeekHigh, '', 2)}  color="#10b981" icon={TrendingUp}   tooltip="52-week high price" />
          <Tile label="52W Low"   value={fmt(s.fiftyTwoWeekLow, '', 2)}   color="#ef4444" icon={TrendingDown} tooltip="52-week low price" />
        </div>
      </div>

      {/* ── Volume ───────────────────────────────────────────────────────── */}
      <div>
        <SectionHead icon={BarChart2} label="Volume" color="#64748b" />
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Avg Volume"   value={fmtVol(s.averageVolume)}  color="#94a3b8" icon={BarChart2} tooltip="10-day average daily traded volume" />
          <Tile label="Volume Ratio" value={fmt(s.volumeRatio, 'x', 2)}
                color={s.volumeRatio > 1.2 ? '#10b981' : s.volumeRatio < 0.8 ? '#ef4444' : '#94a3b8'}
                icon={Activity}
                sub={s.volumeRatio > 1.2 ? 'Above average' : s.volumeRatio < 0.8 ? 'Below average' : 'Normal'}
                tooltip="10-day avg volume vs longer-term avg. >1 means elevated activity." />
        </div>
      </div>

      {/* ── About (expandable) ───────────────────────────────────────────── */}
      {data.description?.summary && (
        <div>
          <SectionHead icon={Building2} label="About the Company" color="#64748b" />
          <div className="rounded-xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className={`text-sm leading-relaxed text-slate-400 ${expanded ? '' : 'line-clamp-4'}`}>
              {data.description.summary}
            </p>
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors"
            >
              {expanded ? <><ChevronUp size={11} /> Show less</> : <><ChevronDown size={11} /> Read more</>}
            </button>
            <div className="mt-3 flex flex-wrap gap-4 border-t border-white/5 pt-3 text-[11px] text-slate-500">
              {data.description.employees && (
                <span className="flex items-center gap-1.5"><Users size={11} /> {Number(data.description.employees).toLocaleString()} employees</span>
              )}
              {s.country && <span className="flex items-center gap-1.5"><Globe size={11} /> {s.country}</span>}
              {data.description.website && (
                <a href={data.description.website} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1.5 text-cyan-500 hover:underline">
                  <Globe size={11} /> {new URL(data.description.website).hostname}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Data freshness footer ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-white/5 pt-3">
        <span className="text-[10px] text-slate-600">
          Source: Yahoo Finance via RADAR DB · {data.asOf ? `Updated ${new Date(data.asOf).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Cached'}
        </span>
        <button onClick={load}
          className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-300 transition-colors">
          <RefreshCw size={9} /> Refresh
        </button>
      </div>
    </div>
  );
};

export default StockFundamentalsPanel;
