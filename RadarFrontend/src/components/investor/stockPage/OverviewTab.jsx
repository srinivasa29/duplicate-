import React from 'react';
import {
  Info,
  Clock,
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Building2,
  Newspaper,
  ShieldCheck,
  AlertTriangle,
  Zap,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Globe,
  Users,
  Target,
  Briefcase,
  Calendar,
  Star,
  Bookmark,
  Search,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';
const INSIGHTS_TOOLTIPS = {
  valuation: 'Stock valuation metrics',
  profitability: 'Company profit metrics',
  growth: 'Business growth metrics',
  technical: 'Technical analysis indicators',
};
const newsImpactData = [];
const OverviewSection = ({
  symbol,
  isDark,
  currencyPrefix,
  financialData,
  quoteData,
  newsImpactData,
  getMetricData,
  stockDetails,
}) => {



  const companyName =
    quoteData?.companyName ||
    quoteData?.longName ||
    quoteData?.shortName ||
    symbol ||
    'Unknown Stock';

  const currentPrice =
    quoteData?.currentPrice ||
    quoteData?.regularMarketPrice ||
    0;

  const changePercent =
    quoteData?.regularMarketChangePercent || 0;

  const marketCap =
    quoteData?.marketCap || 0;

  const peRatio =
    quoteData?.trailingPE || 0;

  const eps =
    quoteData?.epsTrailingTwelveMonths || 0;

  const sector =
    quoteData?.sector || 'Unknown';

  const industry =
    quoteData?.industry || 'Unknown';

  const website =
    quoteData?.website || '#';


  const formatNumber = (num) => {
    if (!num) return '0';

    if (num >= 1_000_000_000_000)
      return (num / 1_000_000_000_000).toFixed(2) + 'T';

    if (num >= 1_000_000_000)
      return (num / 1_000_000_000).toFixed(2) + 'B';

    if (num >= 1_000_000)
      return (num / 1_000_000).toFixed(2) + 'M';

    return num.toLocaleString();
  };
  const rawAbout = stockDetails?.about || financialData?.data?.description || `${companyName} operates in the ${quoteData?.sector || 'financial'} sector and is listed on the exchange.`;
  const sentences = rawAbout.replace(/;/g, '.').split('.').map(s => s.trim()).filter(Boolean);
  const formattedAbout = sentences.slice(0, 4).join('. ') + (sentences.length > 0 ? '.' : '');

  const [finPeriod, setFinPeriod] = React.useState('Quarterly');
  const financialPerformance = React.useMemo(() => {
    const data = financialData?.data || financialData;
    const source = data?.financialPerformance || stockDetails?.financialPerformance;
    if (source) {
      return finPeriod === 'Quarterly'
        ? source.quarterly || []
        : source.yearly || [];
    }
    return [];
  }, [financialData, finPeriod, stockDetails]);

  const [hoveredIndex, setHoveredIndex] = React.useState(null);

  const displayIndex = hoveredIndex !== null ? hoveredIndex : (financialPerformance.length > 0 ? financialPerformance.length - 1 : 0);
  const latestPerf = financialPerformance[displayIndex] || {};
  const prevPerf = displayIndex > 0 ? financialPerformance[displayIndex - 1] : {};

  const getPercentChange = (current, previous) => {
    if (!current || !previous) return null;
    const diff = current - previous;
    return (diff / Math.abs(previous)) * 100;
  };

  const revChange = getPercentChange(latestPerf.revenue, prevPerf.revenue);
  const profChange = getPercentChange(latestPerf.profit, prevPerf.profit);

  const formatChange = (val) => {
    if (val === null) return '—';
    const prefix = val > 0 ? '+' : '';
    return `${prefix}${val.toFixed(1)}%`;
  };

  const getChangeColor = (val) => {
    if (val === null) return 'text-slate-400';
    return val > 0 ? 'text-emerald-500' : 'text-rose-500';
  };
  return (
    <div className="overview-section animate-fade-in">
      {/* Price Overview Component */}
      <div className="price-overview-fintech mb-8">
        <div className={`po-container-card shadow-premium ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
          <div className="po-header-row">
            <div className="po-title-group">
              <h3 className={`po-main-title ${isDark ? 'text-white' : 'text-slate-800'}`}>Price Overview</h3>
              <Info size={14} className="po-info-icon" />
            </div>
            <div className="po-badge-tag">Trading near upper range</div>
          </div>

          <div className="po-ranges-stack">
            <div className="po-range-item">
              <div className="po-range-header">
                <span className="po-range-label">Today's Range</span>
              </div>
              <div className="po-visual-track-wrap">
                <span className="po-limit-price">{currencyPrefix}{(financialData?.data?.stats?.dayLow || (quoteData?.price || 0) * 0.98).toFixed(2)}</span>
                <div className="po-track-main today-gradient relative h-1.5 flex-1 mx-4 bg-slate-100 rounded-full">
                  <div className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 opacity-80 rounded-full" />
                  <div className="po-marker-assembly absolute -top-1" style={{ left: '50%' }}>
                    <div className="po-floating-price absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white shadow-md border border-slate-100 px-2 py-1 rounded text-[10px] font-black z-10">
                      {currencyPrefix}{(quoteData?.price || 0).toFixed(2)} • Current
                    </div>
                    <div className="po-marker-v-line w-[2px] h-3 bg-slate-900 mx-auto" />
                    <div className="po-marker-dot w-2 h-2 bg-slate-900 rounded-full mx-auto -mt-1 ring-2 ring-white" />
                  </div>
                </div>
                <span className="po-limit-price">{currencyPrefix}{(financialData?.data?.stats?.dayHigh || (quoteData?.price || 0) * 1.02).toFixed(2)}</span>
              </div>
            </div>

            <div className="po-range-item mt-6">
              <div className="po-range-header flex justify-between">
                <span className="po-range-label">52 Week Range</span>
                <span className="text-[10px] font-black text-emerald-600 uppercase">Near 52W High</span>
              </div>
              <div className="po-visual-track-wrap mt-2">
                <span className="po-limit-price">{currencyPrefix}{(financialData?.data?.stats?.low52w || (quoteData?.price || 0) * 0.7).toFixed(2)}</span>
                <div className="po-track-main relative h-1.5 flex-1 mx-4 bg-blue-50 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-100 via-blue-300 to-blue-500 opacity-40" />
                  <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white" style={{ left: '70%' }} />
                </div>
                <span className="po-limit-price">{currencyPrefix}{(financialData?.data?.stats?.high52w || (quoteData?.price || 0) * 1.3).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="po-stats-row-fintech grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {[
              { label: 'Open', val: (financialData?.data?.stats?.open || quoteData?.price || 0).toFixed(2), icon: Clock, color: 'blue' },
              { label: 'Prev Close', val: (quoteData?.price && quoteData?.change ? (quoteData.price - quoteData.change).toFixed(2) : '—'), icon: TrendingUp, color: 'green' },
              { label: 'Volume', val: quoteData?.volume?.toLocaleString('en-IN') || '—', icon: Activity, color: 'purple' },
              { label: 'Market Cap', val: quoteData?.marketCap ? `${(quoteData.marketCap / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : '—', icon: ShieldCheck, color: 'orange' },
            ].map((stat, i) => (
              <div key={i} className={`po-stat-card-luxury p-4 rounded-2xl flex items-center gap-3 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <div className={`ps-icon-circle w-10 h-10 rounded-full flex items-center justify-center bg-${stat.color}-50 text-${stat.color}-500 shadow-sm`}><stat.icon size={16} /></div>
                <div className="ps-data flex flex-col">
                  <span className="ps-label text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</span>
                  <span className={`ps-value font-black text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>{stat.val}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="key-metrics-compact-row grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        {[
          { label: 'Market Cap', val: quoteData?.marketCap ? `₹${(quoteData.marketCap / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : 'N/A', tag: quoteData?.marketCap > 200000000000 ? 'Large Cap' : 'Mid Cap', hint: 'Company Size', type: 'neutral' },
          { label: 'P/E Ratio', val: quoteData?.pe ? quoteData.pe.toString() : 'N/A', tag: quoteData?.valStatus || 'Fair Value', hint: 'Trailing 12m', type: quoteData?.valStatus === 'undervalued' ? 'green' : 'neutral' },
          { label: 'ROE', val: quoteData?.roe ? `${quoteData.roe}%` : 'N/A', tag: quoteData?.roe > 15 ? 'Strong' : 'Average', hint: 'Consistent returns', type: quoteData?.roe > 15 ? 'green' : 'neutral' },
          { label: 'Debt to Equity', val: quoteData?.debtToEquity != null ? Number(quoteData.debtToEquity).toFixed(2) : 'N/A', tag: quoteData?.debtToEquity < 1 ? 'Low Risk' : 'High Risk', hint: 'Capital Structure', type: quoteData?.debtToEquity < 1 ? 'green' : 'red' },
          { label: 'Revenue Growth', val: quoteData?.revenueGrowth != null ? `${Number(quoteData.revenueGrowth).toFixed(1)}%` : 'N/A', tag: quoteData?.revenueGrowth > 10 ? 'High Growth' : 'Stable', hint: 'YoY Growth', type: quoteData?.revenueGrowth > 10 ? 'green' : 'neutral' },
          { label: 'Profit Margin', val: quoteData?.profitMargins != null ? `${Number(quoteData.profitMargins).toFixed(1)}%` : 'N/A', tag: quoteData?.profitMargins > 10 ? 'Healthy' : 'Average', hint: 'Post-tax earnings', type: quoteData?.profitMargins > 10 ? 'green' : 'neutral' },
        ].map((m, i) => (
          <div key={i} className={`km-card p-4 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
            <span className="km-label text-[10px] font-bold text-slate-400 block mb-2 uppercase tracking-tight">{m.label}</span>
            <div className="km-val-box flex flex-col gap-1">
              <span className={`km-value text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{m.val}</span>
              <span className={`km-status text-[9px] font-black w-fit px-2 py-0.5 rounded-md tag-${m.type}`}>{m.tag}</span>
            </div>
            <span className="km-hint text-[10px] font-medium text-slate-400 mt-2 block">{m.hint}</span>
          </div>
        ))}
      </div>

      <div className="radar-layout-stack space-y-6">
        <div className={`radar-card about-company-row p-6 rounded-3xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm flex flex-col md:flex-row justify-between items-start gap-8`}>
          <div className="about-col-text flex-1">
            <div className="rc-title-row flex items-center gap-2 mb-4">
              <Building2 className="rc-icon text-blue-500" size={20} />
              <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>About {symbol}</h3>
            </div>

            <p className={`about-text-clean text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {formattedAbout}
            </p>
          </div>
          <div className="about-col-meta grid grid-cols-2 gap-x-8 gap-y-4 min-w-[240px]">
            {[
              { label: 'Sector', val: quoteData?.sector || 'Equity' },
              { label: 'Industry', val: quoteData?.industry || 'Services' },
              { label: 'Last Update', val: new Date().toLocaleDateString() },
            ].map((item, i) => (
              <div key={i} className="meta-item">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{item.label}</span>
                <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.val}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="radar-quad-grid grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">
          {/* 1. Financial Performance */}
          <div className={`radar-card p-6 rounded-3xl border flex flex-col h-full ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
            <div className="rc-header flex flex-col mb-6">
              <div className="flex flex-col gap-4 mb-4">
                <h3 className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Financial Performance</h3>
                <div className="flex items-center">
                  <div className="fin-period-toggles flex bg-slate-100 p-1 rounded-xl">
                    {['Quarterly', 'Yearly'].map(p => (
                      <button
                        key={p}
                        onClick={() => setFinPeriod(p)}
                        className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${finPeriod === p ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="fin-summary-display flex gap-8">
                <div className="fs-item">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">REVENUE (CR)</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {currencyPrefix}{
                        latestPerf.revenue?.toLocaleString('en-IN', { maximumFractionDigits: 1 }) || '—'
                      }
                    </span>
                    <span className={`text-[10px] font-black ${getChangeColor(revChange)}`}>
                      {formatChange(revChange)}
                    </span>
                  </div>
                </div>
                <div className="fs-item">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">PROFIT (CR)</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {currencyPrefix}{
                        latestPerf.profit?.toLocaleString('en-IN', { maximumFractionDigits: 1 }) || '—'
                      }
                    </span>
                    <span className={`text-[10px] font-black ${getChangeColor(profChange)}`}>
                      {formatChange(profChange)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rc-content flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
                <BarChart 
                  data={financialPerformance} 
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  style={{ outline: 'none' }}
                  onMouseMove={(state) => {
                    if (state?.isTooltipActive && state?.activeTooltipIndex !== undefined) {
                      setHoveredIndex(state.activeTooltipIndex);
                    } else {
                      setHoveredIndex(null);
                    }
                  }}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                  <XAxis
                    dataKey="quarter"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                  />
                  <YAxis
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                  />
                  <Tooltip
                    cursor={{ fill: isDark ? '#334155' : '#f1f5f9' }}
                    content={<></>}
                  />
                  <Bar dataKey="revenue" fill={isDark ? '#475569' : '#cbd5e1'} radius={[4, 4, 0, 0]} barSize={35} />
                  <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} barSize={35} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. News & Impact */}
          <div className={`radar-card p-6 rounded-3xl border flex flex-col h-full ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
            <div className="rc-header flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-blue-500" />
                <h3 className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>News & Impact</h3>
              </div>
              <div className="info-trigger-s">
                <Info size={15} className="text-slate-300 cursor-help" />
                <div className="ft-dropdown-s">{INSIGHTS_TOOLTIPS.newsImpact}</div>
              </div>
            </div>
            <div className="rc-content flex-1 space-y-4 overflow-y-auto pr-1">
              {(newsImpactData?.data?.articles || []).slice(0, 3).map((article, i) => (
                <div key={i} 
                     className={`news-article-item p-4 rounded-2xl border transition-all hover:shadow-md cursor-pointer ${isDark ? 'bg-slate-800/40 border-slate-700 hover:bg-slate-800' : 'bg-slate-50 border-slate-100 hover:bg-white'}`} 
                     onClick={() => article.url && window.open(article.url, '_blank')}
                >
                  <div className="flex justify-between items-center gap-2 mb-2.5">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${article.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700' : article.sentiment === 'negative' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                      {article.sentiment || 'NEUTRAL'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {article.source} • {new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className={`text-[13px] font-bold leading-snug line-clamp-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {article.title}
                  </p>
                </div>
              ))}
              {(!newsImpactData?.data?.articles || newsImpactData.data.articles.length === 0) && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 opacity-60 min-h-[150px]">
                  <Newspaper size={32} />
                  <p className="text-[10px] font-bold uppercase tracking-widest">No recent news articles found</p>
                </div>
              )}
            </div>
          </div>

          {/* 3. Things to Note and 4. Long-Term Signals removed as requested */}
        </div>
      </div>
    </div>
  );
};

export default OverviewSection;