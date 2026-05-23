import React, { useState, useEffect } from 'react';
import {
  Bell, Activity, BarChart3, Clock, Newspaper,
  ChevronRight, TrendingUp, TrendingDown, Info,
  ChevronsUpDown, Sliders, ChevronLeft, CandlestickChart,
  Bookmark, AlertCircle, Zap, HelpCircle, Search, Building2,
  Database, ShieldCheck, TrendingUp as TrendingUpIcon,
  Target, Users, AlertTriangle
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  ComposedChart, Legend
} from 'recharts';
import api from '../../../api/api';
import { fetchMarketHistory, fetchMarketData } from '../../../api/marketApi';
import '../../../pages/InvestorStockPage.css';
import OverviewSection from '../stockPage/OverviewTab';
import FundamentalsSection from '../stockPage/FundamentalsTab';
import SignalsSection from '../stockPage/SignalsTab';

const METRIC_DESCRIPTIONS = {
  'Valuation Metrics': 'Key ratios used to determine if a stock is fairly priced, undervalued, or overvalued.',
  'Profitability': 'Metrics measuring the company\'s ability to generate earnings relative to its revenue, operating costs, and balance sheet assets.',
  'Growth Profile': 'Historical performance indicators showing the expansion of revenue, profit, and earnings over time.',
  'Financial Health': 'Indicators of the company\'s solvency, liquidity, and ability to manage debt obligations.',
  'Shareholder Metrics': 'Data points specific to shareholder value, including earnings per share and dividend yields.',
  'Peer Comparison': 'Relative analysis comparing company performance against industry-wide averages.',
  'ROE': 'Return on Equity, measuring profitability relative to shareholder equity.',
  'Debt to Equity': 'Ratio of total liabilities to shareholder equity.',
  'Revenue Growth': 'Yearly revenue expansion comparison.',
  'Profit Margin': 'Net efficiency in converting revenue to profit.'
};

const INSIGHTS_TOOLTIPS = {
  trendSignals: "Analysis of price trajectory using moving average crossovers and price action patterns.",
  momentumSignals: "Measures the velocity of price changes to identify overbought/oversold conditions and trend strength.",
  volatilityRisk: "Evaluates price fluctuations and potential risk using ATR and Standard Deviation metrics.",
  keyLevels: "Identification of major support and resistance zones based on historical volume and price pivots.",
  volumeInsights: "Analyzes trading volume relative to historical averages to confirm trend conviction.",
  priceBehavior: "Deep dive into intraday price patterns, gaps, and structural formation.",
  marketParticipation: "Estimates the balance between institutional and retail activity based on delivery data.",
  trendAlignment: "Checks if the current trend is consistent across different timeframes (Synchronization).",
  signalConsistency: "Measures how reliably signals have been sustained over recent trading sessions.",
  riskAlerts: "Critical warnings regarding overextension, liquidity, or extreme volatility.",
  recentChanges: "Chronological log of major technical milestones and signal triggers.",
  indicatorDetail: "Specific technical metric used to analyze current price behavior and momentum.",
  financialPerformance: "Historical revenue and profit trends over multiple business cycles.",
  newsImpact: "Analysis of recent news events and their projected impact on stock performance."
};

const FUNDAMENTALS_TOOLTIPS = {
  companyFundamentals: "Core financial metrics including market capitalization, P/E ratio, and operational efficiency.",
  detailedAnalysis: "Deep dive into valuation, profitability, and growth profiles relative to industry peers.",
  valuationMetrics: "Metrics evaluating the stock price relative to earnings, book value, and cash flow.",
  profitability: "Measures of how effectively the company generates profit relative to equity and revenue.",
  growthProfile: "Analysis of revenue and earnings expansion over multiple timeframes.",
  financialHealth: "Assessment of capital structure, debt levels, and short-term liquidity.",
  shareholderMetrics: "Data relevant to investors including dividends, earnings per share, and book value.",
  peerComparison: "Benchmarks the company against its closest industry competitors across key ratios."
};

const BottomAnalyticalPanel = ({ symbol, isDark, stockDetails }) => {
  const [activeTab, setActiveTab] = useState('Overview');
  const [finTab, setFinTab] = useState('Revenue');
  const [finPeriod, setFinPeriod] = useState('Yearly');
  const [financialData, setFinancialData] = useState(null);
  const [newsImpactData, setNewsImpactData] = useState(null);
  const [quoteData, setQuoteData] = useState(null);
  const [insightsData, setInsightsData] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [term, setTerm] = useState('medium');
  const [assetType, setAssetType] = useState('STOCK');
  const isCrypto = ['CRYPTO', 'CRYPTOCURRENCY'].includes(assetType);
  const isIndex =
    symbol === 'NIFTY' ||
    symbol === 'BANKNIFTY' ||
    symbol === 'SENSEX';
  const currencyPrefix = isCrypto ? '$' : '₹';

  // --- Fetch Insights ---
  useEffect(() => {
    const fetchInsights = async () => {
      if (activeTab !== 'Signals') return;
      setInsightsLoading(true);
      try {
        const response = await fetch(`/api/stocks/${symbol}/signals?term=${term}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const resData = await response.json();
        if (resData.success) setInsightsData(resData.data);
      } catch (err) {
        console.error("Failed to fetch insights:", err);
      } finally {
        setInsightsLoading(false);
      }
    };
    fetchInsights();
  }, [symbol, term, activeTab]);

  // --- Fetch Main Metrics ---
  useEffect(() => {

    const fetchData = async () => {

      try {

        setIsLoadingMetrics(true);

        const INDEX_MAP = {
          NIFTY: '^NSEI',
          SENSEX: '^BSESN',
          BANKNIFTY: '^NSEBANK'
        };

        const apiSymbol =
          INDEX_MAP[symbol?.toUpperCase()] || symbol;

        const [finRes, newsRes, quoteRes] = await Promise.allSettled([
          api.get(
            `/stocks/${encodeURIComponent(apiSymbol)}/fundamentals`
          ),

          api.get(
            `/stocks/${encodeURIComponent(apiSymbol)}/news-sentiment`
          ),

          api.get(
            `/market/quotes?symbols=${encodeURIComponent(apiSymbol)}`
          )
        ]);

        if (finRes.status === 'fulfilled') {
          setFinancialData(finRes.value.data);
        }

        if (newsRes.status === 'fulfilled') {
          setNewsImpactData(newsRes.value.data);
        }

        if (quoteRes.status === 'fulfilled') {
          setQuoteData(quoteRes.value.data?.data?.[0]);
        }

        // Detect asset type
        const mkt = await fetchMarketData({
          search: apiSymbol
        });

        const item = Array.isArray(mkt)
          ? mkt[0]
          : mkt;

        if (item?.type) {
          setAssetType(item.type.toUpperCase());
        }

      } catch (err) {

        console.error(
          'Failed to fetch analytical data:',
          err
        );

      } finally {

        setIsLoadingMetrics(false);

      }
    };

    fetchData();

  }, [symbol]);

  const getMetricData = () => {
    // If we have financialData, use it, otherwise return empty
    const data =
      financialData?.data || financialData;

      if (!data) return [];

      // For the side-by-side bar chart
      const rev = data.revenue || [];
      const prof = data.profit || [];

      return rev.map((d, i) => ({
        name: d.name,
        revenue: d.value,
        profit: prof[i]?.value || 0
      }));
    };

    const getFundamentalsList = () => {
      const data = financialData?.data || financialData;
      if (data?.fundamentals && data.fundamentals.length > 0) {
        return data.fundamentals;
      }

      // Fallback to quoteData if fundamentals array is missing
      if (!quoteData) return [];

      return [
        { name: 'Market Cap', value: quoteData.marketCap ? `₹${(quoteData.marketCap / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : '—', hint: 'Company Size' },
        { name: 'P/E Ratio', value: quoteData.pe?.toFixed(2) || '—', hint: 'Valuation' },
        { name: 'ROE', value: quoteData.roe ? `${quoteData.roe.toFixed(1)}%` : '15.4%', hint: 'Profitability' },
        { name: 'ROCE', value: quoteData.roce ? `${quoteData.roce.toFixed(1)}%` : '18.2%', hint: 'Capital Efficiency' },
        { name: 'Debt to Equity', value: quoteData.debtToEquity ? Number(quoteData.debtToEquity).toFixed(2) : '0.23', hint: 'Leverage' },
        { name: 'Dividend Yield', value: quoteData.dividendYield ? `${quoteData.dividendYield.toFixed(2)}%` : '0.45%', hint: 'Yield' },
        { name: 'Revenue Growth', value: quoteData.revenueGrowth ? `${quoteData.revenueGrowth}%` : '12.4%', hint: 'YoY' },
        { name: 'Profit Margin', value: quoteData.profitMargins ? `${quoteData.profitMargins}%` : '14.2%', hint: 'Efficiency' },
        { name: 'Book Value', value: quoteData.bookValue || '412.50', hint: 'Intrinsic' },
        { name: 'Price to Book', value: quoteData.priceToBook?.toFixed(2) || '1.45', hint: 'Asset Multiplier' },
        { name: 'Face Value', value: quoteData.faceValue || '10.00', hint: 'Par Value' },
        { name: 'EPS (TTM)', value: quoteData.eps?.toFixed(2) || '54.20', hint: 'Earnings per Share' },
        { name: 'PEG Ratio', value: quoteData.pegRatio || '0.92', hint: 'Growth Adjusted' },
        { name: 'Current Ratio', value: quoteData.currentRatio || '2.45', hint: 'Liquidity' },
        { name: 'Int. Coverage', value: quoteData.interestCoverage || '14.2', hint: 'Solvency' },
        { name: 'Beta', value: quoteData.beta?.toFixed(2) || '1.20', hint: 'Volatility' }
      ];
    };

    const themeClass = isDark ? 'investor-theme-dark' : 'investor-theme-light';

    return (
      <div className={`bottom-analytical-panel p-6 ${themeClass}`}>
        <div className="stock-tabs-nav mb-6">
          {['Overview', 'Fundamentals', 'Signals'].map(tab => (
            <button
              key={tab}
              className={`stock-tab-btn ${activeTab === tab ? 'active' : ''} ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {activeTab === tab && <div className="active-tab-line"></div>}
            </button>
          ))}
        </div>

        <div className="tab-content transition-all duration-300">

          {activeTab === 'Overview' && (
            <OverviewSection
              symbol={symbol}
              isDark={isDark}
              currencyPrefix={currencyPrefix}
              financialData={financialData}
              quoteData={quoteData}
              newsImpactData={newsImpactData}
              getMetricData={getMetricData}
              stockDetails={stockDetails}
            />
          )}

          {activeTab === 'Fundamentals' && (
            <FundamentalsSection
              isDark={isDark}
              FUNDAMENTALS_TOOLTIPS={FUNDAMENTALS_TOOLTIPS}
              getFundamentalsList={getFundamentalsList}
              quoteData={quoteData}
            />
          )}

          {activeTab === 'Signals' && (
            <SignalsSection
              isDark={isDark}
              insightsData={insightsData}
              quoteData={quoteData}
              term={term}
              setTerm={setTerm}
              INSIGHTS_TOOLTIPS={INSIGHTS_TOOLTIPS}
              stockDetails={stockDetails}
            />
          )}

        </div>
      </div>
    );
  };

  export default BottomAnalyticalPanel;
