import React from 'react';
import {
  TrendingUp,
  Zap,
  Activity,
  Info,
  BarChart3,
  Sliders,
  ShieldCheck,
  Clock,
  AlertCircle,
} from 'lucide-react';

const SignalsSection = ({
  isDark,
  insightsData,
  quoteData,
  term,
  setTerm,
  INSIGHTS_TOOLTIPS,
  stockDetails,
}) => {

  const signalCategories = [
    {
      cat: 'trendSignals',
      icon: TrendingUp,
      color: 'blue',
      label: 'Trend Signals',
    },
    {
      cat: 'momentumSignals',
      icon: Zap,
      color: 'amber',
      label: 'Momentum Signals',
    },
    {
      cat: 'volatilityRisk',
      icon: Activity,
      color: 'rose',
      label: 'Volatility & Risk',
    },
  ];

  return (
    <div className="signals-tab-content animate-fade-in p-2 space-y-10">

      {/* ========================================= */}
      {/* OVERALL SENTIMENT */}
      {/* ========================================= */}

      <div
        className={`p-8 rounded-[32px] border shadow-premium ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-100'
        }`}
      >

        <div className="flex justify-between items-start mb-10">

          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block">
                CURRENT SENTIMENT
              </span>
              <div className="group relative flex items-center cursor-help">
                <Info size={12} className="text-slate-400 transition-colors" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-32 p-2 bg-slate-800 text-white text-[10px] font-bold text-center rounded-lg shadow-xl z-10 whitespace-nowrap">
                  Based on 1D data
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                </div>
              </div>
            </div>
            <span className="text-[9px] font-bold text-slate-400 block mb-2 opacity-80">Based on 1D data</span>

            <h2
              className={`text-4xl font-black ${
                insightsData?.overallSentiment?.label
                  ?.toLowerCase()
                  .includes('bullish')
                  ? 'text-green-500'
                  : 'text-rose-500'
              }`}
            >
              {insightsData?.overallSentiment?.label || 'Technical Neutral'}
            </h2>
          </div>

          <div className="flex flex-col items-end">

            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-slate-800 dark:text-white">
                {insightsData?.overallSentiment?.score || '5.0'}
              </span>

              <span className="text-sm font-bold text-slate-400">
                /10
              </span>
            </div>

            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Signal Strength
            </span>
          </div>
        </div>

        {/* Gauge */}

        <div className="relative pt-4">

          <div className="bg-slate-100 rounded-full h-3 relative overflow-hidden">

            <div className="absolute inset-0 bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 opacity-30" />

            <div
              className="bg-slate-900 w-[3px] h-full absolute top-0 z-10"
              style={{
                left: `${insightsData?.overallSentiment?.value || 50}%`,
              }}
            >
              <div className="absolute -top-1 -left-[3px] w-2.5 h-2.5 bg-slate-900 rounded-full ring-2 ring-white" />
            </div>
          </div>
        </div>

      </div>

      {/* ========================================= */}
      {/* TIMEFRAME TOGGLES */}
      {/* ========================================= */}

      <div className="flex gap-4">

        {['Short Term', 'Medium Term', 'Long Term'].map((t) => (

          <button
            key={t}
            onClick={() =>
              setTerm(t.split(' ')[0].toLowerCase())
            }
            className={`px-5 py-2.5 rounded-full text-[11px] font-black transition-all ${
              term === t.split(' ')[0].toLowerCase()
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                : 'bg-slate-50 text-slate-400 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ========================================= */}
      {/* SIGNAL CATEGORIES */}
      {/* ========================================= */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

        {signalCategories.map(({ cat, icon: Icon, color, label }) => (

          <SignalCard
            key={cat}
            cat={cat}
            Icon={Icon}
            color={color}
            label={label}
            insightsData={insightsData}
            isDark={isDark}
            INSIGHTS_TOOLTIPS={INSIGHTS_TOOLTIPS}
          />
        ))}

        {/* KEY PRICE LEVELS */}
        <MetricCard
          title="Key Price Levels"
          icon={<BarChart3 size={18} className="text-blue-500" />}
          tooltip={INSIGHTS_TOOLTIPS.keyLevels}
          isDark={isDark}
        >
          {(() => {
            const currentPrice = quoteData?.regularMarketPrice || quoteData?.currentPrice || 100;
            const high = quoteData?.regularMarketDayHigh || currentPrice * 1.02;
            const low = quoteData?.regularMarketDayLow || currentPrice * 0.98;
            const close = quoteData?.regularMarketPreviousClose || currentPrice;

            const pivot = (high + low + close) / 3;
            const r1 = (pivot * 2) - low;
            const r2 = pivot + (high - low);
            const s1 = (pivot * 2) - high;
            const s2 = pivot - (high - low);

            const range = r2 - s2 || 1;
            const getPos = (val) => Math.min(100, Math.max(0, ((val - s2) / range) * 80 + 10));

            return (
              <div className="relative h-1 bg-slate-100 rounded-full mt-8 mb-10">
                {[
                  { l: 'S2', p: `${getPos(s2)}%`, c: 'rose' },
                  { l: 'S1', p: `${getPos(s1)}%`, c: 'amber' },
                  { l: 'R1', p: `${getPos(r1)}%`, c: 'emerald' },
                  { l: 'R2', p: `${getPos(r2)}%`, c: 'blue' },
                ].map((m, i) => (
                  <div key={i} className="absolute -top-1 flex flex-col items-center" style={{ left: m.p }}>
                    <div className={`w-[2px] h-3 bg-${m.c}-500`} />
                    <span className="text-[8px] font-black text-slate-400 mt-2 uppercase">{m.l}</span>
                  </div>
                ))}
                <div className="absolute -top-4 -translate-x-1/2 flex flex-col items-center z-10" style={{ left: `${getPos(currentPrice)}%` }}>
                  <span className="text-[10px] font-black text-blue-600 mb-1">{currentPrice.toFixed(2)}</span>
                  <div className="w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white shadow-sm" />
                </div>
              </div>
            );
          })()}
        </MetricCard>

        {/* VOLUME INSIGHTS */}
        <MetricCard
          title="Volume Insights"
          icon={<Activity size={18} className="text-emerald-500" />}
          tooltip={INSIGHTS_TOOLTIPS.volumeInsights}
          isDark={isDark}
        >
          {(() => {
            const currentVolume = quoteData?.regularMarketVolume || quoteData?.volume || 0;
            const avgVolume = quoteData?.averageDailyVolume10Day || quoteData?.averageDailyVolume3Month || currentVolume || 1;
            const volumeRatio = currentVolume / avgVolume;
            const volumeUp = volumeRatio > 1;
            const volumePercent = currentVolume > 0 ? ((Math.abs(volumeRatio - 1)) * 100).toFixed(1) : "0.0";
            const conviction = volumeRatio > 1.5 ? 'Strong' : volumeRatio > 0.8 ? 'Moderate' : 'Weak';

            return (
              <>
                <div className="flex gap-8 mb-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Volume vs Avg</span>
                    <span className="text-sm font-black text-slate-800 dark:text-white">
                      {volumeUp ? '+' : '-'}{volumePercent}% <small className={volumeUp ? 'text-emerald-500' : 'text-rose-500'}>{volumeUp ? 'UP' : 'DOWN'}</small>
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Conviction</span>
                    <span className={`text-sm font-black uppercase ${conviction === 'Strong' ? 'text-emerald-500' : conviction === 'Moderate' ? 'text-amber-500' : 'text-slate-500'}`}>
                      {conviction}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">
                  {volumeUp 
                    ? `"Volume is trending higher than its 10-day average, confirming recent price action."`
                    : `"Volume is below average, indicating lower conviction in current price movements."`}
                </p>
              </>
            );
          })()}
        </MetricCard>

        {/* PRICE BEHAVIOR */}
        <MetricCard
          title="Price Behavior"
          icon={<Sliders size={18} className="text-indigo-500" />}
          tooltip={INSIGHTS_TOOLTIPS.priceBehavior}
          isDark={isDark}
        >
          <ul className="space-y-3">
            {(() => {
              const currentPrice = quoteData?.regularMarketPrice || quoteData?.currentPrice || 0;
              const open = quoteData?.regularMarketOpen || currentPrice;
              const prevClose = quoteData?.regularMarketPreviousClose || currentPrice;
              const high = quoteData?.regularMarketDayHigh || currentPrice;
              const low = quoteData?.regularMarketDayLow || currentPrice;
              const high52 = quoteData?.fiftyTwoWeekHigh || currentPrice * 1.5;

              const gapPercent = ((open - prevClose) / prevClose) * 100;
              const gapActivity = Math.abs(gapPercent) > 0.5 ? (gapPercent > 0 ? 'Gap Up' : 'Gap Down') : 'No Major Gaps';
              
              const volatility = ((high - low) / low) * 100;
              const volatilityRank = volatility > 3 ? 'High (>3%)' : volatility > 1.5 ? 'Moderate' : 'Low (<1.5%)';
              
              const from52WHigh = ((high52 - currentPrice) / currentPrice) * 100;
              const recentRange = from52WHigh < 5 ? 'Near 52W Highs' : from52WHigh > 20 ? 'Near 52W Lows' : 'Consolidating';

              return [
                { l: 'Gap Activity', v: gapActivity, c: gapActivity === 'Gap Up' ? 'emerald' : gapActivity === 'Gap Down' ? 'rose' : 'slate' },
                { l: 'Volatility', v: volatilityRank, c: volatilityRank.includes('High') ? 'rose' : volatilityRank.includes('Low') ? 'emerald' : 'amber' },
                { l: 'Recent Range', v: recentRange, c: recentRange.includes('High') ? 'emerald' : 'blue' },
              ].map((item, i) => (
                <li key={i} className="flex justify-between text-[11px] font-bold">
                  <span className="text-slate-400">{item.l}</span>
                  <span className={`text-${item.c}-500`}>{item.v}</span>
                </li>
              ));
            })()}
          </ul>
        </MetricCard>

        {/* SHAREHOLDING PATTERN */}
        <div className={`col-span-1 p-6 rounded-[24px] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center justify-between mb-8">
            <h3 className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Shareholding Pattern
            </h3>
            <div className="flex gap-4 text-[9px] font-bold text-slate-400">
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Current</span>
            </div>
          </div>

          <div className="space-y-6 max-w-3xl">
            {[
              { label: 'Promoters', value: Number(stockDetails?.shareholding?.promoters || 0), color: 'bg-emerald-500' },
              { label: 'Retail & Others', value: Number(stockDetails?.shareholding?.retail || 0), color: 'bg-emerald-500' },
              { label: 'Institutions', value: Number(stockDetails?.shareholding?.institutions || 0), color: 'bg-emerald-500' },
            ].map((item, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500">
                  <span>{item.label}</span>
                  <span className={`font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.value.toFixed(2)}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 flex overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SIGNAL CONSISTENCY */}
        <MetricCard
          title="Signal Consistency"
          icon={<Clock size={18} className="text-slate-500" />}
          tooltip={INSIGHTS_TOOLTIPS.signalConsistency}
          isDark={isDark}
        >
          <div className="flex flex-col gap-4 mt-2">
            {[
              { 
                label: 'Price Momentum', 
                val: (quoteData?.regularMarketPrice > quoteData?.regularMarketPreviousClose) ? 'Bullish' : 'Bearish',
                c: (quoteData?.regularMarketPrice > quoteData?.regularMarketPreviousClose) ? 'emerald' : 'rose'
              },
              { 
                label: 'Profitability', 
                val: stockDetails?.profitMargin > 0 ? 'Positive' : 'Negative',
                c: stockDetails?.profitMargin > 0 ? 'emerald' : 'rose'
              },
              { 
                label: 'Returns Profile', 
                val: stockDetails?.roe > 0 ? 'Generating Returns' : 'Capital Burn',
                c: stockDetails?.roe > 0 ? 'blue' : 'rose'
              }
            ].map((item, i) => (
              <div key={i} className="flex justify-between text-[11px] font-bold">
                <span className="text-slate-400">{item.label}</span>
                <span className={`text-${item.c}-500`}>{item.val}</span>
              </div>
            ))}
          </div>
        </MetricCard>

        {/* RISK ALERTS */}
        <div className="rounded-[24px] border border-rose-100 bg-rose-50/20 p-6">
          <div className="border-b border-rose-100 pb-4 mb-6 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-500" />
              <h3 className="text-sm font-black text-rose-800">Risk Alerts</h3>
            </div>
            <Tooltip text="System warnings and potential fundamental risk factors detected." />
          </div>

          <div className="space-y-4">
            {(() => {
              const alerts = [];
              if (stockDetails?.debtToEquity > 150) {
                alerts.push("High Leverage: Debt-to-Equity ratio indicates potential solvency risk.");
              }
              if (stockDetails?.profitMargin < 0) {
                alerts.push("Profitability Warning: Company is currently operating at a net loss.");
              }
              if (quoteData?.regularMarketPrice > (quoteData?.fiftyTwoWeekHigh * 0.95)) {
                alerts.push("Overbought Warning: Price is trading very close to its 52-week high resistance zone.");
              }
              if (alerts.length === 0) {
                return (
                  <div className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <p className="text-[11px] font-medium text-emerald-700">No major financial or technical risks detected.</p>
                  </div>
                );
              }
              return alerts.map((alert, i) => (
                <div key={i} className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <p className="text-[11px] font-medium text-rose-700">{alert}</p>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

const SignalCard = ({
  cat,
  Icon,
  color,
  label,
  insightsData,
  isDark,
  INSIGHTS_TOOLTIPS,
}) => {

  return (
    <div
      className={`p-6 rounded-[24px] border ${
        isDark
          ? 'bg-slate-900 border-slate-800'
          : 'bg-white border-slate-100'
      }`}
    >

      <div className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-6 flex justify-between items-center">

        <div className="flex items-center gap-2">
          <Icon size={18} className={`text-${color}-500`} />

          <h3
            className={`text-sm font-black ${
              isDark ? 'text-white' : 'text-slate-800'
            }`}
          >
            {label}
          </h3>
        </div>

        <Tooltip text={INSIGHTS_TOOLTIPS[cat]} />
      </div>

      <div className="space-y-6">

        {(insightsData?.[cat]?.items || []).map((s, i) => (

          <div key={i} className="group">

            <div className="flex justify-between items-center mb-1.5">

              <span
                className={`text-xs font-black ${
                  isDark ? 'text-slate-300' : 'text-slate-800'
                }`}
              >
                {s.name}
              </span>

              <span
                className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider tag-${s.s}`}
              >
                {s.status}
              </span>
            </div>

            <p className="text-[11px] font-medium leading-relaxed text-slate-500">
              {s.imp}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const MetricCard = ({
  title,
  icon,
  tooltip,
  isDark,
  children,
}) => {

  return (
    <div
      className={`p-6 rounded-[24px] border ${
        isDark
          ? 'bg-slate-900 border-slate-800'
          : 'bg-white border-slate-100'
      }`}
    >

      <div className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-6 flex justify-between items-center">

        <div className="flex items-center gap-2">
          {icon}

          <h3
            className={`text-sm font-black ${
              isDark ? 'text-white' : 'text-slate-800'
            }`}
          >
            {title}
          </h3>
        </div>

        <Tooltip text={tooltip} />
      </div>

      {children}
    </div>
  );
};

const Tooltip = ({ text }) => {

  return (
    <div className="relative group">

      <Info
        size={15}
        className="text-slate-300 cursor-help"
      />

      <div className="absolute hidden group-hover:block top-6 right-0 w-72 p-3 rounded-xl bg-slate-900 text-white text-xs shadow-2xl z-50">
        {text}
      </div>
    </div>
  );
};

export default SignalsSection;

