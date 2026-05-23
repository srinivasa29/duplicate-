import React from 'react';
import {
  Activity,
  Info,
  TrendingUp as TrendingUpIcon,
  ShieldCheck,
  BarChart3,
  PieChart,
} from 'lucide-react';

const FundamentalsSection = ({
  isDark,
  FUNDAMENTALS_TOOLTIPS,
  getFundamentalsList,
  formatCurrency,
  formatPercent,
  quoteData = {},
}) => {

  const fundamentals = getFundamentalsList();
  const getMetric = (name) => fundamentals.find((f) => f.name === name)?.value || 'N/A';

  return (
    <div className="fundamentals-tab-rich animate-fade-in p-2 space-y-12">

      {/* ============================== */}
      {/* COMPANY FUNDAMENTALS SNAPSHOT */}
      {/* ============================== */}

      <div
        className={`p-8 rounded-[32px] border shadow-premium transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-100'
        }`}
      >

        <div className="flex items-center justify-between mb-8">

          <div className="flex items-center gap-3">
            <Activity size={24} className="text-blue-600" />

            <h2
              className={`text-xl font-black ${
                isDark ? 'text-white' : 'text-slate-800'
              }`}
            >
              Company Fundamentals
            </h2>
          </div>

          <div className="flex items-center gap-4">

            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              All figures in ₹ Cr unless specified
            </span>

            <div className="relative group">
              <Info
                size={15}
                className="text-slate-300 cursor-help"
              />

              <div className="absolute hidden group-hover:block top-6 right-0 w-72 p-3 rounded-xl bg-slate-900 text-white text-xs shadow-2xl z-50">
                {FUNDAMENTALS_TOOLTIPS.companyFundamentals}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">

          {[0, 8].map((start, idx) => (
            <div key={idx} className="space-y-4">

              {fundamentals.slice(start, start + 8).map((metric, i) => (

                <div
                  key={i}
                  className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800"
                >

                  <span className="text-xs font-bold text-slate-500">
                    {metric.name}
                  </span>

                  <div className="flex flex-col items-end">

                    <span
                      className={`font-black ${
                        isDark ? 'text-white' : 'text-slate-800'
                      }`}
                    >
                      {metric.value}
                    </span>

                    {metric.hint && (
                      <span className="text-[9px] font-bold text-slate-400 uppercase">
                        {metric.hint}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ============================== */}
      {/* DETAILED ANALYSIS */}
      {/* ============================== */}

      <div>

        <div className="mb-8 flex items-center justify-between">

          <div>
            <div className="flex items-center gap-3">
              <TrendingUpIcon size={24} className="text-blue-500" />

              <h2
                className={`text-xl font-black ${
                  isDark ? 'text-white' : 'text-slate-800'
                }`}
              >
                Detailed Analysis
              </h2>
            </div>

            <p className="text-xs font-bold text-slate-400 mt-2">
              Granular breakdown of financial metrics and competitive standing.
            </p>
          </div>

          <div className="relative group">
            <Info
              size={15}
              className="text-slate-300 cursor-help"
            />

            <div className="absolute hidden group-hover:block top-6 right-0 w-72 p-3 rounded-xl bg-slate-900 text-white text-xs shadow-2xl z-50">
              {FUNDAMENTALS_TOOLTIPS.detailedAnalysis}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

          <AnalysisCard
            title="Valuation Metrics"
            isDark={isDark}
            metrics={[
              { label: 'P/E (TTM)', sub: 'Trailing 12-month earnings', val: getMetric('P/E Ratio') },
              { label: 'Price to Book', sub: 'Fair relative to assets', val: getMetric('Price to Book') },
              { label: 'PEG Ratio', sub: 'Growth adjusted valuation', val: getMetric('PEG Ratio') },
              { label: 'Beta', sub: 'Market sensitivity', val: getMetric('Beta') }
            ]}
          />

          <AnalysisCard
            title="Profitability"
            isDark={isDark}
            metrics={[
              { label: 'ROE', sub: 'Efficient equity usage', val: getMetric('ROE') },
              { label: 'ROCE', sub: 'Capital efficiency', val: getMetric('ROCE') },
              { label: 'Net Profit Margin', sub: 'Final post-tax margin', val: getMetric('Profit Margin') }
            ]}
          />

          <AnalysisCard
            title="Growth Profile"
            isDark={isDark}
            metrics={[
              { label: 'Rev Growth (3Y)', sub: 'YoY Revenue increase', val: getMetric('Revenue Growth') },
              { label: 'Market Cap', sub: 'Total company size', val: getMetric('Market Cap') },
              { label: 'Face Value', sub: 'Par value of share', val: getMetric('Face Value') }
            ]}
          />

          <AnalysisCard
            title="Financial Health"
            isDark={isDark}
            metrics={[
              { label: 'Debt to Equity', sub: 'Prudent debt management', val: getMetric('Debt to Equity') },
              { label: 'Int. Coverage', sub: 'Safe interest repayments', val: getMetric('Int. Coverage') },
              { label: 'Current Ratio', sub: 'Optimal liquidity profile', val: getMetric('Current Ratio') }
            ]}
          />

          <AnalysisCard
            title="Shareholder Metrics"
            isDark={isDark}
            metrics={[
              { label: 'EPS (TTM)', sub: 'Last 12 month earnings', val: getMetric('EPS (TTM)') },
              { label: 'Dividend Yield', sub: 'Annual yield percentage', val: getMetric('Dividend Yield') },
              { label: 'Book Value', sub: 'Asset value per share', val: getMetric('Book Value') }
            ]}
          />

          <div className={`col-span-1 md:col-span-2 xl:col-span-1 p-6 rounded-[24px] border flex flex-col h-full ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <h3 className={`font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Peer Comparison</h3>
                <Info size={14} className="text-slate-300" />
              </div>
              <span className="text-xs font-bold uppercase text-slate-400">Industry: {quoteData?.industry || '—'}</span>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <th className="text-left py-4 text-xs font-bold text-slate-400 uppercase">Metric</th>
                    <th className="text-left py-4 text-xs font-bold text-slate-400 uppercase">Company</th>
                    <th className="text-left py-4 text-xs font-bold text-slate-400 uppercase">Industry Avg</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={`border-b ${isDark ? 'border-slate-800/50' : 'border-slate-50'}`}>
                    <td className="py-4 font-semibold text-slate-500">P/E Ratio</td>
                    <td className={`font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{getMetric('P/E Ratio')}</td>
                    <td className="text-slate-400">{quoteData?.industryPeAvg ? Number(quoteData.industryPeAvg).toFixed(2) : '—'}</td>
                  </tr>
                  <tr className={`border-b ${isDark ? 'border-slate-800/50' : 'border-slate-50'}`}>
                    <td className="py-4 font-semibold text-slate-500">ROE</td>
                    <td className={`font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{getMetric('ROE')}</td>
                    <td className="text-slate-400">{quoteData?.industryRoeAvg ? Number(quoteData.industryRoeAvg).toFixed(1) + '%' : '—'}</td>
                  </tr>
                  <tr className={`border-b ${isDark ? 'border-slate-800/50' : 'border-slate-50'}`}>
                    <td className="py-4 font-semibold text-slate-500">Profit Margin</td>
                    <td className={`font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{getMetric('Profit Margin')}</td>
                    <td className="text-slate-400">{quoteData?.industryMarginAvg ? Number(quoteData.industryMarginAvg).toFixed(1) + '%' : '—'}</td>
                  </tr>
                  <tr>
                    <td className="py-4 font-semibold text-slate-500">Rev Growth</td>
                    <td className={`font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{getMetric('Revenue Growth')}</td>
                    <td className="text-slate-400">{quoteData?.industryGrowthAvg ? Number(quoteData.industryGrowthAvg).toFixed(1) + '%' : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] font-bold text-slate-400 italic mt-4">Fundamentals sourced from Yahoo Finance - live data.</p>
          </div>

        </div>
      </div>
    </div>
  );
};

const AnalysisCard = ({ title, metrics, isDark }) => (
  <div className={`p-6 rounded-[24px] border flex flex-col h-full transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
    <div className="flex items-center gap-2 mb-6">
      <h3 className={`font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
      <Info size={14} className="text-slate-300" />
    </div>
    <div className="space-y-5 flex-1">
      {metrics.map((m, i) => (
        <div key={i} className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{m.label}</span>
            <span className="text-[10px] font-semibold text-slate-400 mt-0.5">{m.sub}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{m.val}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default FundamentalsSection;

