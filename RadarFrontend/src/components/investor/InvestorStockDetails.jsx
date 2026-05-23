import React, { useState } from 'react';
import { 
  Bell, 
  User, 
  Plus, 
  TrendingUp, 
  ShieldCheck, 
  Lightbulb, 
  Activity, 
  BarChart3, 
  Clock, 
  Newspaper, 
  ChevronRight,
  TrendingDown,
  Info,
  ChevronsUpDown,
  Sliders,
  ChevronLeft,
  CandlestickChart,
  Bookmark,
  AlertCircle,
  Zap,
  HelpCircle,
  Search,
  Building2
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Legend
} from 'recharts';
import Header from '../components/common/Header';
import './InvestorStockPage.css';
import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { saveToDefaultWatchlist } from '../api/api';
import { fetchUserWatchlist, removeSymbolFromWatchlist } from '../api/watchlistApi';
import { useSocket } from '../hooks/useSocket';
import { formatPrice } from '../utils/currency';
import { fetchMarketHistory, fetchMarketData } from '../api/marketApi';



const METRIC_DESCRIPTIONS = {
    'Valuation Metrics': 'Key ratios used to determine if a stock is fairly priced, undervalued, or overvalued.',
    'Profitability': 'Metrics measuring the company\'s ability to generate earnings relative to its revenue, operating costs, and balance sheet assets.',
    'Growth Profile': 'Historical performance indicators showing the expansion of revenue, profit, and earnings over time.',
    'Financial Health': 'Indicators of the company\'s solvency, liquidity, and ability to manage debt obligations.',
    'Shareholder Metrics': 'Data points specific to shareholder value, including earnings per share and dividend yields.',
    'Peer Comparison': 'Relative analysis comparing company performance against industry-wide averages.',
    'P/E (TTM)': 'Price-to-Earnings ratio, indicating how much investors are willing to pay per rupee of earnings.',
    'Price to Book': 'Compares a firm\'s market value to its book value.',
    'EV / EBITDA': 'Enterprise Value to EBITDA, used to determine the core operational value of a company.',
    'PEG Ratio': 'P/E ratio divided by the growth rate of its earnings.',
    'ROE': 'Return on Equity, measuring profitability relative to shareholder equity.',
    'ROCE': 'Return on Capital Employed, measuring efficiency in using capital.',
    'Operating Margin': 'Percentage of revenue left after paying for variable costs of production.',
    'Net Profit Margin': 'Percentage of revenue left after all expenses have been deducted.',
    'Rev Growth (3Y)': 'Compounded annual growth rate of revenue over the last 3 years.',
    'Profit Growth': 'Year-over-year growth in net profit.',
    'EPS Growth': 'Year-over-year growth in Earnings Per Share.',
    'Debt to Equity': 'Ratio of total liabilities to shareholder equity.',
    'Int. Coverage': 'Measures how easily a company can pay interest on its outstanding debt.',
    'Current Ratio': 'Measures a company\'s ability to pay short-term obligations.',
    'EPS (TTM)': 'Earnings per share over the last twelve months.',
    'Dividend Yield': 'Annual dividend payment divided by the stock price.',
    'Book Value': 'The net asset value of a company divided by its outstanding shares.',
    'P/E Ratio': 'Standard Price-to-Earnings comparison.',
    'Profit Margin': 'Net efficiency in converting revenue to profit.',
    'Rev Growth': 'Yearly revenue expansion comparison.'
};


const InvestorStockPage = () => {
  const { symbol = 'JINDRILL' } = useParams();
  const [activeTab, setActiveTab] = useState('Overview');
  const [timeFilter, setTimeFilter] = useState('1M');
  const [finTab, setFinTab] = useState('Revenue');
  const [finType, setFinType] = useState('Yearly');
  const [exchange, setExchange] = useState('NSE');
  const [chartType, setChartType] = useState('area');
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [isAlertOn, setIsAlertOn] = useState(false);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistId, setWatchlistId] = useState(null);
  const [toast, setToast] = useState(null); // { msg, type: 'success'|'error' }

  // Fast-path crypto detection from the symbol itself (prevents .NS leakage on first render)
  // Confirmed/overridden by backend item.type once API responds
  const KNOWN_CRYPTO_SYMBOLS = new Set([
    'BTC','ETH','SOL','XRP','BNB','ADA','DOT','DOGE','MATIC','LINK',
    'AVAX','ATOM','LTC','UNI','SHIB','TRX','ETC','FIL','NEAR','APT',
    'ARB','OP','INJ','SUI','SEI','PEPE','WIF','TON','FLOKI','BONK',
  ]);
  const isSymbolCrypto = KNOWN_CRYPTO_SYMBOLS.has(String(symbol).toUpperCase().replace(/USDT$/i,'')) ||
                          String(symbol).toUpperCase().endsWith('USDT');

  // Asset type: starts with fast-path guess, confirmed by backend
  const [assetType, setAssetType] = useState(isSymbolCrypto ? 'CRYPTO' : 'STOCK');
  const isCrypto = assetType === 'CRYPTO';
  const currencyPrefix = isCrypto ? '$' : '₹';

  const [financialData, setFinancialData] = useState(null);
  const [newsImpactData, setNewsImpactData] = useState(null);
  const [quoteData, setQuoteData] = useState(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [errorMetrics, setErrorMetrics] = useState(null);
  
  // Real-time states
  const [livePrice, setLivePrice] = useState(0);
  const [liveChange, setLiveChange] = useState({ val: 0, pct: 0 });
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString());
  const [historyData, setHistoryData] = useState([]);
  // Crypto-specific enriched data from backend
  const [cryptoData, setCryptoData] = useState(null);

  // --- Socket.io Integration ---
  const { on, isConnected } = useSocket(['ticker', `symbol:${symbol.toLowerCase()}`]);

  // --- Intelligence Insights System ---
  const [term, setTerm] = useState('medium');
  const [insightsData, setInsightsData] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsCache, setInsightsCache] = useState({});

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
    indicatorDetail: "Specific technical metric used to analyze current price behavior and momentum."
  };

  const FUNDAMENTALS_TOOLTIPS = {
    companyFundamentals: "Core financial health indicators providing a snapshot of the company's valuation and operational efficiency.",
    detailedAnalysis: "Granular breakdown of financial performance across valuation, profitability, and shareholder returns.",
    valuationMetrics: "Comparative ratios used to determine if a stock is overvalued or undervalued relative to its earnings and assets.",
    profitability: "Measures the company's ability to generate earnings relative to its revenue, operating costs, and other expenses.",
    efficiency: "Evaluates how effectively the company uses its assets and capital to generate returns.",
    shareholderMetrics: "Key data points specifically relevant to equity holders, including dividends and per-share earnings.",
    peerComparison: "Benchmarks the company against its closest industry rivals to identify relative strength or weakness."
  };

  const NEWS_TOOLTIPS = {
    upcomingEvents: "Future milestones including earnings calls, board meetings, and corporate actions that may impact stock price.",
    latestNews: "Real-time coverage of company developments, industry trends, and macroeconomic factors affecting the sector."
  };


  // --- Load watchlist membership on mount ---
  useEffect(() => {
    const checkWatchlist = async () => {
      try {
        const res = await api.get('/watchlist');
        const lists = res.data || [];
        if (lists.length > 0) {
          const first = lists[0];
          setWatchlistId(first._id);
          // Model stores items[], each with { symbol: '...' }
          const syms = (first.items || []).map(s =>
            String(s?.symbol || s).toUpperCase().replace(/\.(NS|BO)$/i, '')
          );
          setIsInWatchlist(syms.includes(symbol.toUpperCase()));
        }
      } catch (_) { /* not logged in or no watchlist — silent */ }
    };
    checkWatchlist();
  }, [symbol]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleWatchlistToggle = async () => {
    if (watchlistLoading) return;
    setWatchlistLoading(true);
    try {
      if (isInWatchlist && watchlistId) {
        await api.delete(`/watchlist/${watchlistId}/remove/${encodeURIComponent(symbol)}`);
        setIsInWatchlist(false);
        showToast(`${symbol} removed from watchlist`, 'info');
      } else {
        await saveToDefaultWatchlist(symbol);
        setIsInWatchlist(true);
        showToast(`${symbol} added to watchlist ✓`, 'success');
      }
    } catch (err) {
      showToast('Failed to update watchlist', 'error');
    } finally {
      setWatchlistLoading(false);
    }
  };

  useEffect(() => {
    // Set body background for stability when scrolling
    document.body.style.backgroundColor = '#f8fafc';
    document.body.style.backgroundImage = 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)';
    document.body.style.backgroundAttachment = 'fixed';
    on('price_update', (event) => {
      if (event.symbol === symbol || event.asset === symbol) {
        if (event.price) {
          setLivePrice(event.price);
          setLastUpdate(new Date().toLocaleTimeString());
        }
        if (event.change !== null && event.change !== undefined) {
          setLiveChange({ val: (event.price * (event.change / 100)).toFixed(2), pct: event.change });
        }
      }
    });

    return () => {
      // Clean up body styles if any were set by other pages
      document.body.style.backgroundColor = '';
      document.body.style.backgroundImage = '';
    };
  }, [symbol]);



  useEffect(() => {
    const fetchInsightsData = async () => {
      const cacheKey = `${symbol}-${term}`;
      if (insightsCache[cacheKey]) {
        setInsightsData(insightsCache[cacheKey]);
        return;
      }

      setInsightsLoading(true);
      try {
        const response = await fetch(`/api/stocks/${symbol}/signals?term=${term}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const resData = await response.json();
        
        if (resData.success) {
          setInsightsData(resData.data);
          setInsightsCache(prev => ({ ...prev, [cacheKey]: resData.data }));
        } else {
          console.warn("Insights API returned success:false", resData);
        }
      } catch (err) {
        console.error("Failed to fetch insights:", err);
      } finally {
        setInsightsLoading(false);
      }
    };

    if (activeTab === 'Signals') {
      fetchInsightsData();
    }
  }, [symbol, term, activeTab]);

  useEffect(() => {
    const fetchDynamicData = async () => {
      try {
        setIsLoadingMetrics(true);
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        
        const activeSymbol = (!isCrypto && exchange === 'NSE' && !symbol.endsWith('.NS')) ? `${symbol}.NS` : symbol;


        const [finRes, newsRes, quoteRes] = await Promise.allSettled([
          api.get(`/stocks/${activeSymbol}/fundamentals`),
          api.get(`/stocks/${activeSymbol}/news-sentiment`),
          api.get(`/market/quotes?symbols=${activeSymbol}`)
        ]);

        if (finRes.status === 'fulfilled') setFinancialData(finRes.value.data);
        if (newsRes.status === 'fulfilled') setNewsImpactData(newsRes.value.data);

        // Primary price source: /api/market/quotes — works for ANY symbol
        const quoteItem = quoteRes.status === 'fulfilled' ? quoteRes.value.data?.data?.[0] : null;
        if (quoteItem) {
          setQuoteData(quoteItem);
          if (quoteItem.price > 0) {
            setLivePrice(quoteItem.price);
            setLiveChange({
              val: quoteItem.change ?? 0,
              pct: quoteItem.changePercent ?? 0,
            });
          }
        }

        // Secondary: fetchMarketData for asset-type detection + fallback price
        try {
            const searchSymbol = isCrypto ? symbol : activeSymbol;
            const mkt = await fetchMarketData({ search: searchSymbol });
            const item = Array.isArray(mkt)
              ? mkt.find(s => s.symbol.toUpperCase() === symbol.toUpperCase()
                  || s.symbol.toUpperCase() === activeSymbol.toUpperCase())
                || mkt[0]
              : mkt;
            if (item) {
                // Only update price if quotes didn't give us one
                if (!quoteItem?.price || quoteItem.price === 0) {
                  setLivePrice(item.price || item.ltp || 0);
                  setLiveChange({
                    val: item.change || 0,
                    pct: item.changePercent || 0,
                  });
                }
                // Always update asset type from backend
                if (item.type) {
                    setAssetType(String(item.type).toUpperCase());
                }
            }
        } catch(e) {
            console.warn("fetchMarketData fallback failed:", e.message);
        }


        setErrorMetrics(null);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
        setErrorMetrics("Data unavailable. Please try again later.");
      } finally {
        setIsLoadingMetrics(false);
      }
    };

    fetchDynamicData();
    const interval = setInterval(fetchDynamicData, 300000); // 5 min auto-refresh
    return () => clearInterval(interval);
  }, [symbol]);

  // Fetch enriched crypto data from dedicated endpoint when asset is crypto
  useEffect(() => {
    if (!isCrypto) return;
    let active = true;
    const fetchCrypto = async () => {
      try {
        const res = await api.get(`/market/crypto/${symbol.toLowerCase()}`);
        if (active && res.data?.success && res.data?.data) {
          const d = res.data.data;
          setCryptoData(d);
          // Update live price from crypto endpoint if not yet set via market data
          if (d.current_price > 0) {
            setLivePrice(d.current_price);
            setLiveChange({ val: d.price_change_24h || 0, pct: d.price_change_percentage_24h || 0 });
          }
        }
      } catch (e) {
        console.warn('Crypto detail fetch failed:', e.message);
      }
    };
    fetchCrypto();
    const timer = setInterval(fetchCrypto, 30000); // 30s refresh for crypto
    return () => { active = false; clearInterval(timer); };
  }, [symbol, isCrypto]);


  useEffect(() => {
    let active = true;
    const fetchChart = async () => {
        setIsChartLoading(true);
        try {
            let interval = '1D';
            if (timeFilter === '1D') interval = '5m';
            else if (timeFilter === '1W') interval = '1h';
            else if (timeFilter === '1M') interval = '1D';
            else if (timeFilter === '3M') interval = '1D';
            else if (timeFilter === '6M') interval = '1W';
            else if (timeFilter === '1Y') interval = '1W';
            else if (timeFilter === '5Y') interval = '1M';
            else if (timeFilter === 'All') interval = '1M';

            // Use raw symbol + CRYPTO type for crypto, add .NS for Indian stocks
            const chartSymbol = isCrypto
              ? String(symbol).toUpperCase().endsWith('USDT') ? symbol : `${symbol}USDT`
              : (exchange === 'NSE' && !symbol.endsWith('.NS') ? `${symbol}.NS` : symbol);
            const chartType = isCrypto ? 'CRYPTO' : 'STOCK';

            const res = await fetchMarketHistory(chartSymbol, chartType, interval);
            if (active && res && res.data) {
                setHistoryData(res.data.map(d => ({
                    time: timeFilter === '1D' || timeFilter === '1W'
                        ? new Date(d.timestamp || d.time || d.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : new Date(d.timestamp || d.time || d.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
                    price: d.close,
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                    rangeLowHigh: [d.low, d.high],
                    rangeOpenClose: [d.open, d.close]
                })));
            }
        } catch(e) {
            console.error("Chart fetch failed", e);
        } finally {
            if (active) setIsChartLoading(false);
        }
    };
    fetchChart();
    return () => { active = false; };
  }, [symbol, timeFilter, exchange, isCrypto]);

  const getMetricData = () => {
    if (!financialData?.data) return [];
    if (finTab === 'Revenue') return financialData.data.revenue.map(d => ({ name: d.year, value: d.value, color: '#3b82f6' }));
    if (finTab === 'Profit') return financialData.data.profit.map(d => ({ name: d.year, value: d.value, color: '#10b981' }));
    return financialData.data.shareholding || [];
  };

  const handleExchangeChange = () => {
    setIsChartLoading(true);
    setExchange(prev => prev === 'NSE' ? 'BSE' : 'NSE');
    setTimeout(() => setIsChartLoading(false), 800); // Shimmer effect
  };

  const RenderChart = () => {
    const commonProps = {
      data: historyData,
      margin: { top: 10, right: 0, left: 0, bottom: 0 }
    };

    if (chartType === 'area') {
      return (
        <AreaChart {...commonProps}>
          <defs>
            <linearGradient id="premiumGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="time" hide={true} />
          <YAxis hide={true} domain={['dataMin - 10', 'dataMax + 10']} />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: '700' }} 
            cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Area type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#premiumGradient)" />
        </AreaChart>
      );
    }

    if (chartType === 'line') {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="time" hide={true} />
          <YAxis hide={true} domain={['dataMin - 10', 'dataMax + 10']} />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: '700' }} 
          />
          <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
        </LineChart>
      );
    }

    if (chartType === 'bar') {
      return (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="time" hide={true} />
          <YAxis hide={true} domain={['dataMin - 10', 'dataMax + 10']} />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: '700' }} 
          />
          <Bar dataKey="price" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={24} />
        </BarChart>
      );
    }

    if (chartType === 'candle') {
      return (
        <ComposedChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="time" hide={true} />
          <YAxis hide={true} domain={['dataMin - 20', 'dataMax + 20']} />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: '700' }} 
          />
          <Line dataKey="price" stroke="transparent" dot={false} isAnimationActive={false} />
          {}
          <Bar dataKey="rangeLowHigh" fill="#cbd5e1" barSize={2} />
          {}
          <Bar 
            dataKey="rangeOpenClose" 
            barSize={14}
            shape={(props) => {
              const { x, y, width, height, payload } = props;
              const fill = payload.close > payload.open ? '#10b981' : '#ef4444';
              return <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} ry={2} />;
            }}
          />
        </ComposedChart>
      );
    }
  };

  return (
    <div className="dashboard-container investor-theme pt-4">
      <Header activeModule="STOCKS" onToggleMode={() => {}} />

      <main className="main-content">
        <div className="page-container">
          
          <div className="stock-chart-card animate-fade-in">
            <div className="chart-card-header">
              <div className="header-left-info">
                <div className="meta-row">
                  <span className="symbol-name">{symbol}</span>
                  {/* Hide NSE/BSE switcher for crypto assets */}
                  {!isCrypto && (
                    <div className="exchange-switcher">
                      <button className="ex-arrow-btn" onClick={handleExchangeChange}>
                        <ChevronLeft size={16} />
                      </button>
                      <span className="ex-current">{exchange}</span>
                      <button className="ex-arrow-btn" onClick={handleExchangeChange}>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                  {isCrypto && (
                    <span className="ex-current" style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 800, letterSpacing: '0.08em' }}>CRYPTO · USD</span>
                  )}
                </div>
                <h1 className="stock-main-title">{symbol === 'JINDRILL' ? 'Jindal Drilling & Industries' : symbol}</h1>
              </div>

              <div className="header-right-actions" style={{ position: 'relative' }}>
                {/* Watchlist toast */}
                {toast && (
                  <div style={{
                    position: 'absolute', top: '-48px', right: 0,
                    background: toast.type === 'error' ? '#fee2e2' : toast.type === 'info' ? '#eff6ff' : '#d1fae5',
                    color: toast.type === 'error' ? '#991b1b' : toast.type === 'info' ? '#1e40af' : '#065f46',
                    border: `1px solid ${toast.type === 'error' ? '#fca5a5' : toast.type === 'info' ? '#93c5fd' : '#6ee7b7'}`,
                    borderRadius: '10px', padding: '6px 14px',
                    fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    animation: 'fadeIn 0.2s ease',
                    zIndex: 99,
                  }}>
                    {toast.msg}
                  </div>
                )}
                <button 
                  className={`icon-action-btn ${isAlertOn ? 'active' : ''}`}
                  onClick={() => setIsAlertOn(!isAlertOn)}
                  title="Price Alert"
                >
                  <Bell size={18} />
                </button>
                <button 
                  className={`icon-action-btn ${isInWatchlist ? 'active' : ''}`}
                  onClick={handleWatchlistToggle}
                  title={isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                  disabled={watchlistLoading}
                  style={{ opacity: watchlistLoading ? 0.6 : 1 }}
                >
                  <Bookmark size={18} fill={isInWatchlist ? 'currentColor' : 'none'} />
                </button>
                <Link to={`/advanced-charts?symbol=${symbol}`} className="advanced-chart-btn">
                  <TrendingUp size={16} />
                  Advanced Chart
                </Link>
              </div>
            </div>

            <div className="card-price-section">
              <span className="card-price-main">
                {currencyPrefix}{livePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className={`card-price-change ${liveChange.pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {liveChange.pct >= 0 ? '+' : ''}{Number(liveChange.val).toFixed(2)} ({liveChange.pct}%)
              </span>
              <span className="card-price-time">Live • Updated at {lastUpdate}</span>
            </div>

            <div className="chart-body">
              {isChartLoading && (
                <div className="chart-shimmer-overlay">
                  <div className="shimmer-anim"></div>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                {RenderChart()}
              </ResponsiveContainer>
            </div>

            <div className="card-footer-controls">
              <div className="time-filters-container">
                <div className="time-filters-group">
                {['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'All'].map(filter => (
                  <button 
                    key={filter}
                    className={`time-pill ${timeFilter === filter ? 'active' : ''}`}
                    onClick={() => setTimeFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
                </div>
              </div>

              <div className="control-divider"></div>

              <div className="chart-type-group">
                <button 
                  className={`type-pill ${chartType === 'area' ? 'active' : ''}`}
                  onClick={() => setChartType('area')}
                >
                  <Activity size={18} />
                </button>
                <button 
                  className={`type-pill ${chartType === 'line' ? 'active' : ''}`}
                  onClick={() => setChartType('line')}
                >
                  <TrendingUp size={18} />
                </button>
                <button 
                  className={`type-pill ${chartType === 'candle' ? 'active' : ''}`}
                  onClick={() => setChartType('candle')}
                >
                  <CandlestickChart size={18} />
                </button>
                <button 
                  className={`type-pill ${chartType === 'bar' ? 'active' : ''}`}
                  onClick={() => setChartType('bar')}
                >
                  <BarChart3 size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="stock-tabs-nav animate-fade-in">
            {['Overview', 'Fundamentals', 'Signals', 'News & Events'].map(tab => (
              <button 
                key={tab} 
                className={`stock-tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
                {activeTab === tab && <div className="active-tab-line"></div>}
              </button>
            ))}
          </div>

          {activeTab === 'Overview' && (
            <div className="overview-section">
              <div className="price-overview-fintech animate-fade-in">
                <div className="po-container-card shadow-premium">
                  <div className="po-header-row">
                    <div className="po-title-group">
                      <h3 className="po-main-title">Price Overview</h3>
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
                        <span className="po-limit-price">{currencyPrefix}{(financialData?.data?.stats?.dayLow || livePrice * 0.98).toFixed(2)}</span>
                        <div className="po-track-main today-gradient">
                          <div className="po-marker-assembly" style={{ left: '50%' }}>
                            <div className="po-floating-price">{currencyPrefix}{livePrice.toFixed(2)} • Current</div>
                            <div className="po-marker-v-line"></div>
                            <div className="po-marker-dot"></div>
                          </div>
                        </div>
                        <span className="po-limit-price">{currencyPrefix}{(financialData?.data?.stats?.dayHigh || livePrice * 1.02).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="po-range-item">
                      <div className="po-range-header">
                        <span className="po-range-label">52 Week Range</span>
                        <span className="po-context-indicator">Near 52W High</span>
                      </div>
                      <div className="po-visual-track-wrap">
                        <span className="po-limit-price">{currencyPrefix}{(financialData?.data?.stats?.low52w || livePrice * 0.7).toFixed(2)}</span>
                        <div className="po-track-main fiftytwo-gradient">
                          <div className="po-marker-assembly" style={{ left: '70%' }}>
                            <div className="po-marker-dot marker-muted"></div>
                          </div>
                        </div>
                        <span className="po-limit-price">{currencyPrefix}{(financialData?.data?.stats?.high52w || livePrice * 1.3).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="po-stats-row-fintech">
                    <div className="po-stat-card-luxury">
                      <div className="ps-icon-circle bg-blue-soft"><Clock size={16} /></div>
                      <div className="ps-data">
                        <span className="ps-label">Open</span>
                        <span className="ps-value">{currencyPrefix}{(financialData?.data?.stats?.open || livePrice).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="po-stat-card-luxury">
                      <div className="ps-icon-circle bg-green-soft"><TrendingUp size={16} /></div>
                      <div className="ps-data">
                        <span className="ps-label">Prev Close</span>
                        <span className="ps-value">
                          {currencyPrefix}{
                            isCrypto
                              ? (cryptoData?.prev_close > 0 ? cryptoData.prev_close.toFixed(2) : '\u2014')
                              : (quoteData?.price && quoteData?.change
                                  ? (quoteData.price - quoteData.change).toFixed(2)
                                  : (livePrice - liveChange.val).toFixed(2))
                          }
                        </span>
                      </div>
                    </div>
                    <div className="po-stat-card-luxury">
                      <div className="ps-icon-circle bg-purple-soft"><Activity size={16} /></div>
                      <div className="ps-data">
                        <span className="ps-label">Volume</span>
                        <span className="ps-value">{quoteData?.volume?.toLocaleString('en-IN') || '—'}</span>
                      </div>
                    </div>
                    <div className="po-stat-card-luxury">
                      <div className="ps-icon-circle bg-orange-soft"><ShieldCheck size={16} /></div>
                      <div className="ps-data">
                        <span className="ps-label">{isCrypto ? 'Market Cap (USD)' : 'Market Cap'}</span>
                        <span className="ps-value text-sm-luxury">
                          {quoteData?.marketCap
                            ? isCrypto
                              ? `$${(quoteData.marketCap / 1e9).toLocaleString('en-US', { maximumFractionDigits: 1 })}B`
                              : `₹${(quoteData.marketCap / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`
                            : '—'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ---- METRICS ROW: crypto vs stock ---- */}
              {isCrypto ? (
                <div className="key-metrics-compact-row animate-fade-in">
                  {[
                    {
                      label: '24h Volume',
                      val: cryptoData?.total_volume > 0 ? `$${(cryptoData.total_volume / 1e9).toFixed(2)}B` : (cryptoData?.details?.volume || 'Loading...'),
                      tag: 'USD', hint: 'Quote volume (USDT)', type: 'neutral'
                    },
                    {
                      label: '24h Trades',
                      val: cryptoData?.trade_count > 0 ? Number(cryptoData.trade_count).toLocaleString() : '—',
                      tag: 'Binance', hint: 'Number of trades', type: 'neutral'
                    },
                    {
                      label: 'Category',
                      val: cryptoData?.category || '—',
                      tag: 'Crypto', hint: 'Asset class', type: 'neutral'
                    },
                    {
                      label: 'Layer',
                      val: cryptoData?.layer || '—',
                      tag: 'Network', hint: 'Blockchain layer', type: 'neutral'
                    },
                    {
                      label: 'Consensus',
                      val: cryptoData?.consensus || '—',
                      tag: 'Protocol', hint: 'Validation mechanism', type: 'neutral'
                    },
                    {
                      label: 'Market Cap',
                      val: cryptoData?.market_cap > 0
                        ? `$${(cryptoData.market_cap / 1e9).toFixed(1)}B`
                        : cryptoData?.details?.market_cap || 'N/A',
                      tag: 'USD', hint: 'Total market value', type: 'neutral'
                    },
                  ].map((m, i) => (
                    <div key={i} className="km-card">
                      <span className="km-label">{m.label}</span>
                      <div className="km-val-box">
                        <span className="km-value">{m.val}</span>
                        <span className={`km-status tag-${m.type}`}>{m.tag}</span>
                      </div>
                      <span className="km-hint">{m.hint}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="key-metrics-compact-row animate-fade-in">
                  {[
                    { label: 'Market Cap', val: quoteData?.marketCap ? `₹${(quoteData.marketCap / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : 'N/A', tag: quoteData?.marketCap > 200000000000 ? 'Large Cap' : 'Mid Cap', hint: 'Company Size', type: 'neutral' },
                    { label: 'P/E Ratio', val: quoteData?.pe ? quoteData.pe.toString() : 'N/A', tag: quoteData?.valStatus === 'undervalued' ? 'Undervalued' : quoteData?.valStatus === 'overvalued' ? 'Overvalued' : 'Fair Value', hint: 'Trailing 12m', type: quoteData?.valStatus === 'undervalued' ? 'green' : quoteData?.valStatus === 'overvalued' ? 'red' : 'neutral' },
                    { label: 'ROE', val: quoteData?.roe ? `${quoteData.roe}%` : 'N/A', tag: quoteData?.roe > 15 ? 'Strong' : 'Average', hint: 'Consistent returns', type: quoteData?.roe > 15 ? 'green' : 'neutral' },
                    { label: 'Debt to Equity', val: quoteData?.debtToEquity != null ? quoteData.debtToEquity.toString() : 'N/A', tag: quoteData?.debtToEquity < 1 ? 'Low Risk' : 'High Risk', hint: 'Capital Structure', type: quoteData?.debtToEquity < 1 ? 'green' : 'red' },
                    { label: 'Revenue Growth', val: quoteData?.revenueGrowth != null ? `${quoteData.revenueGrowth}%` : 'N/A', tag: quoteData?.revenueGrowth > 10 ? 'High Growth' : 'Stable', hint: 'YoY Growth', type: quoteData?.revenueGrowth > 10 ? 'green' : 'neutral' },
                    { label: 'Profit Margin', val: quoteData?.profitMargins != null ? `${quoteData.profitMargins}%` : 'N/A', tag: quoteData?.profitMargins > 10 ? 'Healthy' : 'Average', hint: 'Post-tax earnings', type: quoteData?.profitMargins > 10 ? 'green' : 'neutral' },
                  ].map((m, i) => (
                    <div key={i} className="km-card">
                      <span className="km-label">{m.label}</span>
                      <div className="km-val-box">
                        <span className="km-value">{m.val}</span>
                        <span className={`km-status tag-${m.type}`}>{m.tag}</span>
                      </div>
                      <span className="km-hint">{m.hint}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="radar-layout-stack animate-fade-in">
                <div className="radar-card about-company-row">
                  <div className="about-col-text">
                    <div className="rc-title-row">
                      <Building2 className="rc-icon" />
                      <h3>About {symbol}</h3>
                    </div>
                    <p className="about-text-clean">
                      {financialData?.data?.description || (
                        isCrypto
                          ? `${symbol} is a digital asset and cryptocurrency traded globally on crypto exchanges. Price data is sourced from live market feeds in USD.`
                          : `${symbol} is an equity instrument listed on the exchange. Detailed company profiling and business operations data is currently being synced from the latest regulatory filings.`
                      )}
                    </p>
                    {financialData?.data?.website && <a href={financialData.data.website} target="_blank" rel="noreferrer" className="text-blue-500 font-bold text-xs mt-2 block uppercase">Visit Website</a>}
                  </div>
                  <div className="about-col-meta">
                    <div className="meta-grid">
                      <div className="meta-item">
                        <span className="meta-l">Sector</span>
                        <span className="meta-v">{isCrypto ? (cryptoData?.category || 'Cryptocurrency') : (quoteData?.sector || financialData?.data?.sector || 'Equity')}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-l">{isCrypto ? 'Layer' : 'Industry'}</span>
                        <span className="meta-v">{isCrypto ? (cryptoData?.layer || 'Layer 1') : (quoteData?.industry || financialData?.data?.industry || 'Services')}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-l">{isCrypto ? 'Consensus' : 'ISIN'}</span>
                        <span className="meta-v">{isCrypto ? (cryptoData?.consensus || 'N/A') : (financialData?.data?.isin || '—')}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-l">Last Update</span>
                        <span className="meta-v">{new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="radar-row-flex">
                  <div className="radar-card financial-performance-card flex-grow-main overflow-hidden">
                    <div className="rc-header">
                      <div className="rc-header-left">
                        <BarChart3 className="rc-icon" />
                        <div>
                          <h3>Financial Performance</h3>
                          {financialData?.source && financialData.source !== 'live' && (
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">
                              {financialData.source === 'cached' ? 'Updated recently' : 'Showing last available data'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="b-tabs">
                        {['Revenue', 'Profit', 'Share'].map(t => (
                          <button key={t} onClick={() => setFinTab(t === 'Share' ? 'Shareholding' : t)} className={finTab.startsWith(t) ? 'active' : ''}>{t}</button>
                        ))}
                      </div>
                    </div>
                    <div className="rc-content">
                      {isLoadingMetrics ? (
                        <div className="metric-skeleton-chart animate-pulse bg-slate-100/50 rounded-2xl h-[220px] w-full" />
                      ) : errorMetrics ? (
                        <div className="h-[220px] flex items-center justify-center text-xs text-slate-400 font-bold">{errorMetrics}</div>
                      ) : (
                        <div className="b-canvas" style={{ height: '220px', marginTop: '20px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getMetricData()}>
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} />
                              <Tooltip cursor={{fill: '#f8fafc', radius: 4}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 15px rgba(0,0,0,0.05)' }} />
                              <Bar 
                                name={finTab === 'Shareholding' ? 'Ownership %' : `${finTab} (₹ Cr)`} 
                                dataKey="value" 
                                fill={finTab === 'Profit' ? '#10b981' : '#3b82f6'} 
                                radius={[6, 6, 0, 0]} 
                                barSize={finTab === 'Shareholding' ? 48 : 32} 
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="radar-card news-impact-card flex-grow-side">
                    <div className="rc-header">
                      <div className="rc-header-left">
                        <Zap className="rc-icon" />
                        <div>
                          <h3>News & Impact</h3>
                          {newsImpactData?.source && newsImpactData.source !== 'live' && (
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Last synced {newsImpactData.source}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="rc-content">
                      {isLoadingMetrics ? (
                        <div className="space-y-4 pt-2">
                          {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />)}
                        </div>
                      ) : (
                        <div className="news-impact-list">
                          {(newsImpactData?.data || []).map((n, i) => (
                            <div key={i} className="news-impact-item">
                              <div className="ni-top">
                                <span className={`ni-tag tag-${i === 0 ? 'green' : i === 1 ? 'blue' : 'purple'}`}>{n.category.toUpperCase()}</span>
                                <p className="ni-head">{financialData?.data?.revenue?.[financialData.data.revenue.length-1]?.year} Forward Outlook</p>
                              </div>
                              <div className="news-impact-points mt-1">
                                {n.points.map((p, pi) => (
                                  <div key={pi} className="ni-interpretation mb-1">
                                    <div className="ni-dot"></div>
                                    <span>{p}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="radar-row-flex">
                  <div className="radar-card note-card-horizontal flex-equal">
                    <div className="rc-header">
                      <div className="rc-header-left">
                        <Info className="rc-icon" />
                        <h3>Things to Note</h3>
                      </div>
                    </div>
                    <div className="rc-content">
                      <div className="note-list-compact">
                        <div className="note-item-c">
                          <div className="n-dot bg-blue-500"></div>
                          <p>Consistent financial performance observed across multiple business cycles.</p>
                        </div>
                        <div className="note-item-c">
                          <div className="n-dot bg-green-500"></div>
                          <p>Sector tailwinds remain supportive due to increased offshore activity.</p>
                        </div>
                        <div className="note-item-c">
                          <div className="n-dot bg-amber-500"></div>
                          <p>Valuation gap still exists relative to sector intrinsic potential.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="radar-card signals-card-visual flex-equal">
                    <div className="rc-header">
                      <div className="rc-header-left">
                        <TrendingUp className="rc-icon" />
                        <h3>Long-Term Signals</h3>
                      </div>
                    </div>
                    <div className="rc-content">
                      <div className="signals-visual-list">
                        {[
                          { label: 'Financial Strength', val: 'Strong', color: 'green', pct: 85 },
                          { label: 'Growth Potential', val: 'High', color: 'green', pct: 72 },
                          { label: 'Risk Level', val: 'Moderate', color: 'amber', pct: 45 },
                          { label: 'Valuation', val: 'Undervalued', color: 'green', pct: 90 },
                        ].map((s, i) => (
                          <div key={i} className="sig-vis-item">
                            <div className="sv-top">
                              <span className="sv-label">{s.label}</span>
                              <span className={`sv-status text-${s.color}`}>{s.val}</span>
                            </div>
                            <div className="sv-progress-bg">
                              <div className={`sv-progress-fill bg-${s.color}`} style={{ width: `${s.pct}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Signals' && (
            <div className="signals-tab-content animate-fade-in">
              {/* Overall Sentiment Summary */}
              <div className="overall-sentiment-summary-card shadow-premium mb-10">
                <div className="oss-header">
                  <div className="oss-title-group">
                    <span className="oss-label-top">CURRENT SENTIMENT</span>
                    <h2 className={`oss-main-status ${insightsData?.overallSentiment?.label?.toLowerCase().includes('bullish') ? 'text-green-500' : 'text-red-500'}`}>
                      {insightsData?.overallSentiment?.label || 'Technical Neutral'}
                    </h2>
                  </div>
                  <div className="oss-score-box">
                    <div className="oss-score-circle">
                      <span className="oss-score-num">{insightsData?.overallSentiment?.score || '0.0'}</span>
                      <span className="oss-score-den">/10</span>
                    </div>
                    <span className={`oss-setup-badge ${insightsData?.overallSentiment?.score > 7 ? 'text-green-500' : 'text-slate-400'}`}>
                      {insightsData?.overallSentiment?.setup || 'NEUTRAL SETUP'}
                    </span>
                  </div>
                </div>
                
                <div className="oss-gauge-container">
                  <div className="oss-gauge-labels">
                    <span>BEARISH</span>
                    <span>NEUTRAL</span>
                    <span>BULLISH</span>
                  </div>
                  <div className="oss-gauge-track">
                    <div className="oss-gauge-marker" style={{ left: `${insightsData?.overallSentiment?.value || 50}%` }}></div>
                  </div>
                </div>
                
                <div className="oss-footer-insight">
                  <div className="oss-sparkle-icon">✨</div>
                  <p className="oss-insight-text">
                    {insightsData?.overallSentiment?.insight || 'No significant momentum patterns detected for the current selection.'}
                  </p>
                </div>
              </div>

              {/* 1. Timeframe Selector */}
              <div className="signal-timeframe-toggles mb-10">
                <div className="st-toggle-row">
                  {[
                    { id: 'short', label: 'Short Term', range: '1D - 5D' },
                    { id: 'medium', label: 'Medium Term', range: '1M - 3M' },
                    { id: 'long', label: 'Long Term', range: '1Y - 5Y' }
                  ].map(tf => (
                    <button 
                      key={tf.id}
                      className={`st-toggle-btn ${term === tf.id ? 'active' : ''}`}
                      onClick={() => setTerm(tf.id)}
                    >
                      <span className="st-btn-label">{tf.label}</span>
                      <span className="st-btn-range">{tf.range}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="insights-active-view">
                {insightsLoading && !insightsData ? (
                  <div className="insights-skeleton-grid">
                    {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton-card-pulse h-[200px] rounded-2xl bg-slate-100 mb-6"></div>)}
                  </div>
                ) : (
                  <>
                    <div className="signals-grid-main mb-8">
                      {/* Trend Signals */}
                      <div className="sig-category-card">
                        <div className="rc-header">
                          <div className="rc-header-left">
                            <TrendingUp className="rc-icon" />
                            <h3>Trend Signals</h3>
                          </div>
                          <div className="info-trigger-s">
                            <HelpCircle size={15} className="text-slate-300" />
                            <div className="ft-dropdown-s">{INSIGHTS_TOOLTIPS.trendSignals}</div>
                          </div>
                        </div>
                        <div className="sig-list">
                          {(insightsData?.trendSignals?.items || []).map((s, i) => (
                            <div key={i} className="sig-item-card">
                              <div className="sig-item-top">
                                <div className="flex items-center gap-1.5">
                                  <span className="sig-name">{s.name}</span>
                                  <div className="info-trigger-s">
                                    <HelpCircle size={10} className="text-slate-200" />
                                    <div className="ft-dropdown-s"><strong>{s.name}:</strong> {INSIGHTS_TOOLTIPS.indicatorDetail}</div>
                                  </div>
                                </div>
                                <span className="sig-val">{s.val}</span>
                                <span className={`sig-badge tag-${s.s}`}>{s.status}</span>
                              </div>
                              <p className="sig-interpretation">{s.imp}</p>
                            </div>
                          ))}
                        </div>
                        <div className="card-horizon-label">Based on {term.charAt(0).toUpperCase() + term.slice(1)} Term data</div>
                      </div>

                      {/* Momentum Signals */}
                      <div className="sig-category-card">
                        <div className="rc-header">
                          <div className="rc-header-left">
                            <Zap className="rc-icon" />
                            <h3>Momentum Signals</h3>
                          </div>
                          <div className="info-trigger-s">
                            <HelpCircle size={15} className="text-slate-300" />
                            <div className="ft-dropdown-s">{INSIGHTS_TOOLTIPS.momentumSignals}</div>
                          </div>
                        </div>
                        <div className="sig-list">
                          {(insightsData?.momentumSignals?.items || []).map((s, i) => (
                            <div key={i} className="sig-item-card">
                              <div className="sig-item-top">
                                <div className="flex items-center gap-1.5">
                                  <span className="sig-name">{s.name}</span>
                                  <div className="info-trigger-s">
                                    <HelpCircle size={10} className="text-slate-200" />
                                    <div className="ft-dropdown-s"><strong>{s.name}:</strong> {INSIGHTS_TOOLTIPS.indicatorDetail}</div>
                                  </div>
                                </div>
                                <span className="sig-val">{s.val}</span>
                                <span className={`sig-badge tag-${s.s}`}>{s.status}</span>
                              </div>
                              <p className="sig-interpretation">{s.imp}</p>
                            </div>
                          ))}
                        </div>
                        <div className="card-horizon-label">Based on {term.charAt(0).toUpperCase() + term.slice(1)} Term data</div>
                      </div>

                      {/* Volatility & Risk */}
                      <div className="sig-category-card">
                        <div className="rc-header">
                          <div className="rc-header-left">
                            <Activity className="rc-icon" />
                            <h3>Volatility & Risk</h3>
                          </div>
                          <div className="info-trigger-s">
                            <HelpCircle size={15} className="text-slate-300" />
                            <div className="ft-dropdown-s">{INSIGHTS_TOOLTIPS.volatilityRisk}</div>
                          </div>
                        </div>
                        <div className="sig-list">
                          {(insightsData?.volatilityRisk?.items || []).map((s, i) => (
                            <div key={i} className="sig-item-card">
                              <div className="sig-item-top">
                                <div className="flex items-center gap-1.5">
                                  <span className="sig-name">{s.name}</span>
                                  <div className="info-trigger-s">
                                    <HelpCircle size={10} className="text-slate-200" />
                                    <div className="ft-dropdown-s"><strong>{s.name}:</strong> {INSIGHTS_TOOLTIPS.indicatorDetail}</div>
                                  </div>
                                </div>
                                <span className="sig-val">{s.val}</span>
                                <span className={`sig-badge tag-${s.s}`}>{s.status}</span>
                              </div>
                              <p className="sig-interpretation">{s.imp}</p>
                            </div>
                          ))}
                        </div>
                        <div className="card-horizon-label">Based on {term.charAt(0).toUpperCase() + term.slice(1)} Term data</div>
                      </div>
                    </div>

                    <div className="signals-row-flex mb-8">
                      {/* Key Price Levels */}
                      <div className="sig-card-mid flex-equal">
                        <div className="rc-header">
                          <div className="rc-header-left">
                            <BarChart3 className="rc-icon" />
                            <h3>Key Price Levels</h3>
                          </div>
                          <div className="info-trigger-s">
                            <HelpCircle size={15} className="text-slate-300" />
                            <div className="ft-dropdown-s">{INSIGHTS_TOOLTIPS.keyLevels}</div>
                          </div>
                        </div>
                        <div className="kl-visual-range">
                          <div className="kl-track">
                            <div className="kl-marker kl-s2" style={{ left: insightsData?.keyLevels?.s2?.pos || '10%' }}><span>{insightsData?.keyLevels?.s2?.label || 'S2'}</span></div>
                            <div className="kl-marker kl-s1" style={{ left: insightsData?.keyLevels?.s1?.pos || '30%' }}><span>{insightsData?.keyLevels?.s1?.label || 'S1'}</span></div>
                            <div className="kl-current-thumb" style={{ left: insightsData?.keyLevels?.current?.pos || '72%' }}>
                              <div className="kl-p-label">{insightsData?.keyLevels?.current?.val || '0.00'}</div>
                              <div className="kl-p-dot"></div>
                            </div>
                            <div className="kl-marker kl-r1" style={{ left: insightsData?.keyLevels?.r1?.pos || '85%' }}><span>{insightsData?.keyLevels?.r1?.label || 'R1'}</span></div>
                            <div className="kl-marker kl-r2" style={{ left: insightsData?.keyLevels?.r2?.pos || '95%' }}><span>{insightsData?.keyLevels?.r2?.label || 'R2'}</span></div>
                          </div>
                        </div>
                        <div className="kl-interpretation-footer mt-4">
                          <p className="text-xs text-slate-500 font-medium">{insightsData?.keyLevels?.interpretation}</p>
                        </div>
                      </div>

                      {/* Volume Insights */}
                      <div className="sig-card-mid flex-equal">
                        <div className="rc-header">
                          <div className="rc-header-left">
                            <Activity className="rc-icon" />
                            <h3>Volume Insights</h3>
                          </div>
                          <div className="info-trigger-s">
                            <HelpCircle size={15} className="text-slate-300" />
                            <div className="ft-dropdown-s">{INSIGHTS_TOOLTIPS.volumeInsights}</div>
                          </div>
                        </div>
                        <div className="vi-metrics-row">
                          <div className="vi-stat-box">
                            <span className="vi-label">Volume vs Avg</span>
                            <span className="vi-value">{insightsData?.volumeInsights?.volumeVsAvg} <small className={insightsData?.volumeInsights?.trendColor}>{insightsData?.volumeInsights?.trend}</small></span>
                          </div>
                          <div className="vi-stat-box">
                            <span className="vi-label">Conviction</span>
                            <span className={`vi-value ${insightsData?.volumeInsights?.convictionColor}`}>{insightsData?.volumeInsights?.conviction}</span>
                          </div>
                        </div>
                        <div className="vi-note-box bg-slate-50 p-3 rounded-xl mt-4">
                          <p className="text-xs leading-relaxed text-slate-600">{insightsData?.volumeInsights?.note}</p>
                        </div>
                      </div>
                    </div>

                    <div className="signals-row-flex mb-8">
                      {/* Price Behavior */}
                      <div className="sig-card-mid flex-equal">
                        <div className="rc-header">
                          <div className="rc-header-left">
                            <Sliders className="rc-icon" />
                            <h3>Price Behavior</h3>
                          </div>
                          <div className="info-trigger-s">
                            <HelpCircle size={15} className="text-slate-300" />
                            <div className="ft-dropdown-s">{INSIGHTS_TOOLTIPS.priceBehavior}</div>
                          </div>
                        </div>
                        <ul className="pb-list">
                          {(insightsData?.priceBehavior?.items || []).map((item, i) => (
                            <li key={i}>
                              <span className="pb-l">{item.label}</span>
                              <span className={`pb-v ${item.color}`}>{item.val}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-[11px] text-slate-400 italic mt-3">"{insightsData?.priceBehavior?.note}"</p>
                      </div>

                      {/* Market Participation */}
                      <div className="sig-card-mid flex-equal">
                        <div className="rc-header">
                          <div className="rc-header-left">
                            <ShieldCheck className="rc-icon" />
                            <h3>Market Participation</h3>
                          </div>
                          <div className="info-trigger-s">
                            <HelpCircle size={15} className="text-slate-300" />
                            <div className="ft-dropdown-s">{INSIGHTS_TOOLTIPS.marketParticipation}</div>
                          </div>
                        </div>
                        <ul className="pb-list">
                          {(insightsData?.marketParticipation?.items || []).map((item, i) => (
                            <li key={i}>
                              <span className="pb-l">{item.label}</span>
                              <span className={`pb-v ${item.color}`}>{item.val}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-[11px] text-slate-400 italic mt-3">"{insightsData?.marketParticipation?.note}"</p>
                      </div>
                    </div>

                    <div className="signals-row-flex mb-8">
                      {/* Trend Alignment */}
                      <div className="sig-card-mid flex-equal">
                        <div className="rc-header">
                          <div className="rc-header-left">
                            <ChevronsUpDown className="rc-icon" />
                            <h3>Trend Alignment</h3>
                          </div>
                          <div className="info-trigger-s">
                            <HelpCircle size={15} className="text-slate-300" />
                            <div className="ft-dropdown-s">{INSIGHTS_TOOLTIPS.trendAlignment}</div>
                          </div>
                        </div>
                        <div className="ta-alignment-row">
                          <div className="ta-pill-group">
                            {['Short Term', 'Medium Term', 'Long Term'].map((t, i) => (
                              <div key={i} className={`ta-pill ${insightsData?.trendAlignment?.pills?.[i] || 'bg-slate-200'}`}>{t}</div>
                            ))}
                          </div>
                        </div>
                        <div className="ta-footer mt-4">
                          <span className={`badge-light ${insightsData?.trendAlignment?.statusColor}`}>{insightsData?.trendAlignment?.status}</span>
                          <p className="text-[12px] text-slate-500 mt-2">{insightsData?.trendAlignment?.note}</p>
                        </div>
                      </div>

                      {/* Signal Consistency */}
                      <div className="sig-card-mid flex-equal">
                        <div className="sig-cat-header flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Clock size={18} className="text-slate-500" />
                            <h3>Signal Consistency</h3>
                          </div>
                          <div className="info-trigger-s">
                            <HelpCircle size={15} className="text-slate-300" />
                            <div className="ft-dropdown-s">{INSIGHTS_TOOLTIPS.signalConsistency}</div>
                          </div>
                        </div>
                        <div className="sc-consistency-view">
                          <div className="sc-track">
                            {(insightsData?.signalConsistency?.track || []).map((s, i) => (
                              <div key={i} className={`sc-dot ${s === 1 ? 'bg-green' : s === 0.5 ? 'bg-amber' : 'bg-slate-200'}`}></div>
                            ))}
                          </div>
                          <span className="sc-total">{insightsData?.signalConsistency?.score}% Bullish</span>
                        </div>
                        <p className="text-[12px] text-slate-500 mt-4">{insightsData?.signalConsistency?.note}</p>
                      </div>
                    </div>

                    <div className="signals-row-flex mb-8">
                      {/* Risk Alerts */}
                      <div className="sig-card-mid risk-alerts-card flex-grow-side">
                        <div className="rc-header">
                          <div className="rc-header-left">
                            <AlertCircle className="rc-icon" />
                            <h3>Risk Alerts</h3>
                          </div>
                          <div className="info-trigger-s">
                            <HelpCircle size={15} className="text-slate-300" />
                            <div className="ft-dropdown-s">{INSIGHTS_TOOLTIPS.riskAlerts}</div>
                          </div>
                        </div>
                        <div className="risk-alerts-list">
                          {(insightsData?.riskAlerts || []).map((ra, idx) => (
                            <div key={idx} className={`ra-item alert-${ra.type}`}>
                              <div className="ra-dot"></div>
                              <p><strong>{ra.label}:</strong> {ra.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recent Changes */}
                      <div className="sig-card-mid flex-grow-main">
                        <div className="sig-cat-header flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Clock size={18} className="text-indigo-500" />
                            <h3>Recent Changes</h3>
                          </div>
                          <div className="info-trigger-s">
                            <HelpCircle size={15} className="text-slate-300" />
                            <div className="ft-dropdown-s">{INSIGHTS_TOOLTIPS.recentChanges}</div>
                          </div>
                        </div>
                        <div className="recent-changes-list">
                          {(insightsData?.recentChanges || []).map((rc, idx) => (
                            <div key={idx} className="rc-item-s">
                              <span className="rc-time-s">{rc.time}</span>
                              <p className="rc-desc-s" dangerouslySetInnerHTML={{ __html: rc.desc }}></p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Fundamentals' && (
            <div className="fundamentals-tab-rich animate-fade-in">
              {}
              <div className="ft-main-snapshot-card shadow-premium">
                <div className="ft-header-row-snap">
                  <div className="ft-title-group">
                    <Activity size={20} className="text-blue-600" />
                    <h2>Company Fundamentals</h2>
                    <div className="info-trigger-s ml-2">
                      <HelpCircle size={15} className="text-slate-300" />
                      <div className="ft-dropdown-s">{FUNDAMENTALS_TOOLTIPS.companyFundamentals}</div>
                    </div>
                  </div>
                  <span className="ft-sub-text">All figures in ₹ Cr unless specified</span>
                </div>

                <div className="ft-rich-table-grid">
                  <div className="ft-table-side">
                    {(financialData?.data?.fundamentals || []).slice(0, 8).map((m, i) => (
                      <div key={i} className="ft-table-row-item">
                        <div className="ft-row-label">
                          <span>{m.name}</span>
                        </div>
                        <div className="ft-row-data">
                          <div className="ft-val-top">
                            <span className="ft-val-bold">{m.value}</span>
                            {m.status && <span className="ft-status-pill tag-neutral">{m.status}</span>}
                          </div>
                          {m.hint && <span className="ft-val-hint">{m.hint}</span>}
                        </div>
                      </div>
                    ))}
                    {(!financialData?.data?.fundamentals) && <p className="text-xs p-4 text-slate-400">Loading metrics...</p>}
                  </div>

                  <div className="ft-table-side">
                    {(financialData?.data?.fundamentals || []).slice(8, 16).map((m, i) => (
                      <div key={i} className="ft-table-row-item">
                        <div className="ft-row-label">
                          <span>{m.name}</span>
                        </div>
                        <div className="ft-row-data">
                          <div className="ft-val-top">
                            <span className="ft-val-bold">{m.value}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {}
              <div className="ft-detailed-header mt-12 mb-6">
                <div className="ft-title-row">
                  <TrendingUp size={20} className="text-blue-500" />
                  <h2>Detailed Analysis</h2>
                  <div className="info-trigger-s ml-2">
                    <HelpCircle size={15} className="text-slate-300" />
                    <div className="ft-dropdown-s">{FUNDAMENTALS_TOOLTIPS.detailedAnalysis}</div>
                  </div>
                </div>
                <p>Granular breakdown of financial metrics and competitive standing.</p>
              </div>

              <div className="ft-detailed-layout-grid">
                {/* ── helpers ───────────────────────────────── */}
                {(() => {
                  const q = quoteData || {};
                  const fmt   = (v, dec = 2) => v != null && !isNaN(v) ? Number(v).toFixed(dec) : null;
                  const fmtPct= (v) => v != null && !isNaN(v) ? `${Number(v).toFixed(1)}%` : null;
                  const na    = (v, suffix = '') => v != null ? `${v}${suffix}` : 'N/A';

                  // Valuation
                  const pe        = fmt(q.pe, 2);
                  const peLabel   = pe == null ? 'N/A' : q.valStatus === 'undervalued' ? 'Undervalued' : q.valStatus === 'overvalued' ? 'Overvalued' : 'Fair Value';
                  const peColor   = q.valStatus === 'undervalued' ? 'green' : q.valStatus === 'overvalued' ? 'red' : 'neutral';
                  const ptb       = fmt(q.priceToBook, 2);
                  const evEbitda  = fmt(q.evToEbitda, 2);
                  const pegRatio  = fmt(q.pegRatio, 2);
                  const beta      = fmt(q.beta, 2);

                  // Profitability
                  const roe       = fmtPct(q.roe);
                  const roce      = fmtPct(q.roce);
                  const opMargin  = fmtPct(q.operatingMargins);
                  const netMargin = fmtPct(q.profitMargins);

                  // Growth
                  const revGrowth = fmtPct(q.revenueGrowth);
                  const epsGrowth = fmtPct(q.epsGrowth);

                  // Financial Health
                  const dte        = fmt(q.debtToEquity, 2);
                  const dteLabel   = dte == null ? 'N/A' : Number(dte) < 0.5 ? 'Very Low' : Number(dte) < 1 ? 'Low' : Number(dte) < 2 ? 'Moderate' : 'High';
                  const dteColor   = dte == null ? 'neutral' : Number(dte) < 1 ? 'green' : 'red';
                  const intCov     = fmt(q.interestCoverage, 1);
                  const curRatio   = fmt(q.currentRatio, 2);
                  const curLabel   = curRatio == null ? 'N/A' : Number(curRatio) >= 2 ? 'Robust' : Number(curRatio) >= 1.5 ? 'Healthy' : 'Weak';
                  const curColor   = curRatio == null ? 'neutral' : Number(curRatio) >= 1.5 ? 'green' : 'red';

                  // Shareholder
                  const eps        = fmt(q.eps, 2);
                  const divYield   = fmtPct(q.dividendYield ? q.dividendYield * 100 : null);
                  const bookVal    = fmt(q.bookValue, 2);

                  // Peer comparison — use sector from quoteData
                  const industry   = q.industry || q.sector || '—';

                  const tradeCount= q.tradeCount ? Number(q.tradeCount).toLocaleString() : null;
                  const category  = q.category || 'N/A';
                  const layer     = q.layer || 'N/A';
                  const consensus = q.consensus || 'N/A';
                  const volUSD    = q.volume ? `$${(Number(q.volume)/1e6).toFixed(1)}M` : 'N/A';

                  const cardMap = (items) => items.map((m, i) => (
                    <div key={i} className="fac-item">
                      <div className="fac-left">
                        <div className="flex items-center gap-1.5">
                          <span className="fac-n">{m.n}</span>
                          <div className="info-trigger-s">
                            <HelpCircle size={10} className="text-slate-200" />
                            <div className="ft-dropdown-s"><strong>{m.n}:</strong> {METRIC_DESCRIPTIONS[m.n] || 'Asset telemetry metric.'}</div>
                          </div>
                        </div>
                        <span className="fac-sub">{m.sub}</span>
                      </div>
                      <div className="fac-right">
                        <span className="fac-v">{m.v}</span>
                        <span className={`fac-label text-${m.t || 'neutral'}`}>{m.label}</span>
                      </div>
                    </div>
                  ));

                  if (isCrypto) {
                    return (
                      <>
                        {/* Crypto: Network Performance */}
                        <div className="ft-analysis-card">
                          <div className="fac-header flex items-center gap-2">
                            <Zap size={14} className="text-amber-500" />
                            <span>Network Performance</span>
                          </div>
                          <div className="fac-list">
                            {cardMap([
                              { n: '24h Volume',    v: volUSD,      label: 'Volume',     t: 'neutral', sub: 'Total traded value (24h)' },
                              { n: 'Trade Count',   v: na(tradeCount), label: 'Activity',   t: 'green', sub: 'Number of unique trades' },
                              { n: 'Price (24h)',   v: na(fmt(q.price, 2), '$'), label: 'Live', t: 'green', sub: 'Current asset price in USD' },
                            ])}
                          </div>
                        </div>

                        {/* Crypto: Project Architecture */}
                        <div className="ft-analysis-card">
                          <div className="fac-header flex items-center gap-2">
                            <Database size={14} className="text-blue-500" />
                            <span>Project Identity</span>
                          </div>
                          <div className="fac-list">
                            {cardMap([
                              { n: 'Category',      v: category,    label: 'Type',       t: 'neutral', sub: 'Primary use case' },
                              { n: 'Network Layer', v: layer,       label: 'Architecture',t: 'neutral', sub: 'Protocol layer depth' },
                              { n: 'Consensus',     v: consensus,   label: 'Security',   t: 'neutral', sub: 'Network validation method' },
                            ])}
                          </div>
                        </div>

                        {/* Crypto: Market Statistics */}
                        <div className="ft-analysis-card">
                          <div className="fac-header flex items-center gap-2">
                            <Activity size={14} className="text-emerald-500" />
                            <span>Market Statistics</span>
                          </div>
                          <div className="fac-list">
                            {cardMap([
                              { n: '24h High',      v: na(fmt(q.high, 2), '$'), label: 'Peak',   t: 'green', sub: 'Highest price in last 24h' },
                              { n: '24h Low',       v: na(fmt(q.low, 2), '$'),  label: 'Trough', t: 'red',   sub: 'Lowest price in last 24h' },
                              { n: 'Prev Close',    v: na(fmt(q.previousClose, 2), '$'), label: 'Reset', t: 'neutral', sub: 'Binance daily reset price' },
                            ])}
                          </div>
                        </div>

                        {/* Crypto: Growth Stats */}
                        <div className="ft-analysis-card">
                          <div className="fac-header flex items-center gap-2">
                            <TrendingUp size={14} className="text-violet-500" />
                            <span>Performance Metrics</span>
                          </div>
                          <div className="fac-list">
                            {cardMap([
                              { n: '24h Change',    v: na(fmtPct(q.changePercent)), label: Number(q.changePercent) >= 0 ? 'Bullish' : 'Bearish', t: Number(q.changePercent) >= 0 ? 'green' : 'red', sub: 'Percentage delta (24h)' },
                              { n: 'Volatility',    v: na(fmt(q.beta, 2)), label: 'Relative', t: 'neutral', sub: 'Historical price variance' },
                            ])}
                          </div>
                        </div>
                      </>
                    );
                  }

                  return (
                    <>
                      {/* Valuation Metrics */}
                      <div className="ft-analysis-card">
                        <div className="fac-header flex items-center gap-2">
                          <span>Valuation Metrics</span>
                          <div className="info-trigger-s">
                            <HelpCircle size={13} className="text-slate-300" />
                            <div className="ft-dropdown-s">{FUNDAMENTALS_TOOLTIPS.valuationMetrics}</div>
                          </div>
                        </div>
                        <div className="fac-list">
                          {cardMap([
                            { n: 'P/E (TTM)',      v: na(pe),      label: peLabel,  t: peColor,   sub: 'Trailing 12-month earnings' },
                            { n: 'Price to Book',  v: na(ptb),     label: ptb == null ? 'N/A' : Number(ptb) < 3 ? 'Healthy' : 'Elevated', t: ptb == null ? 'neutral' : Number(ptb) < 3 ? 'green' : 'red', sub: 'Fair relative to assets' },
                            { n: 'EV / EBITDA',    v: na(evEbitda),label: evEbitda == null ? 'N/A' : Number(evEbitda) < 10 ? 'Strong' : 'Moderate', t: evEbitda == null ? 'neutral' : Number(evEbitda) < 10 ? 'green' : 'neutral', sub: 'Good cash flow proxy' },
                            { n: 'Beta',           v: na(beta),    label: beta == null ? 'N/A' : Number(beta) < 1 ? 'Low Volatility' : 'High Volatility', t: beta == null ? 'neutral' : Number(beta) < 1 ? 'green' : 'red', sub: 'Market sensitivity' },
                          ])}
                        </div>
                      </div>

                      {/* Profitability */}
                      <div className="ft-analysis-card">
                        <div className="fac-header flex items-center gap-2">
                          <span>Profitability</span>
                          <div className="info-trigger-s">
                            <HelpCircle size={13} className="text-slate-300" />
                            <div className="ft-dropdown-s"><strong>Profitability:</strong> {METRIC_DESCRIPTIONS['Profitability']}</div>
                          </div>
                        </div>
                        <div className="fac-list">
                          {cardMap([
                            { n: 'ROE',             v: na(roe),       label: roe == null ? 'N/A' : parseFloat(roe) > 15 ? 'Strong' : 'Average',  t: roe == null ? 'neutral' : parseFloat(roe) > 15 ? 'green' : 'neutral', sub: 'Efficient equity usage' },
                            { n: 'Operating Margin',v: na(opMargin),  label: opMargin == null ? 'N/A' : parseFloat(opMargin) > 20 ? 'High' : parseFloat(opMargin) > 10 ? 'Stable' : 'Low', t: opMargin == null ? 'neutral' : parseFloat(opMargin) > 15 ? 'green' : 'neutral', sub: 'Core business efficiency' },
                            { n: 'Net Profit Margin',v: na(netMargin),label: netMargin == null ? 'N/A' : parseFloat(netMargin) > 10 ? 'Healthy' : 'Stable', t: netMargin == null ? 'neutral' : parseFloat(netMargin) > 10 ? 'green' : 'neutral', sub: 'Final post-tax margin' },
                            { n: 'Beta',            v: na(beta),      label: beta == null ? 'N/A' : Number(beta) < 1 ? 'Defensive' : 'Aggressive', t: 'neutral', sub: '5-yr monthly vs market' },
                          ])}
                        </div>
                      </div>

                      {/* Growth Profile */}
                      <div className="ft-analysis-card">
                        <div className="fac-header flex items-center gap-2">
                          <span>Growth Profile</span>
                          <div className="info-trigger-s">
                            <HelpCircle size={13} className="text-slate-300" />
                            <div className="ft-dropdown-s"><strong>Growth:</strong> {METRIC_DESCRIPTIONS['Growth Profile']}</div>
                          </div>
                        </div>
                        <div className="fac-list">
                          {cardMap([
                            { n: 'Rev Growth (3Y)', v: na(revGrowth), label: revGrowth == null ? 'N/A' : parseFloat(revGrowth) > 10 ? 'High Growth' : parseFloat(revGrowth) > 0 ? 'Stable' : 'Declining', t: revGrowth == null ? 'neutral' : parseFloat(revGrowth) > 5 ? 'green' : parseFloat(revGrowth) > 0 ? 'neutral' : 'red', sub: 'YoY Revenue CAGR' },
                            { n: 'EPS Growth',      v: na(epsGrowth), label: epsGrowth == null ? 'N/A' : parseFloat(epsGrowth) > 10 ? 'Positive' : 'Moderate', t: epsGrowth == null ? 'neutral' : parseFloat(epsGrowth) > 5 ? 'green' : 'neutral', sub: 'Consistent per-share gain' },
                            { n: 'Profit Margin',   v: na(netMargin), label: netMargin == null ? 'N/A' : parseFloat(netMargin) > 10 ? 'Healthy' : 'Moderate', t: netMargin == null ? 'neutral' : parseFloat(netMargin) > 10 ? 'green' : 'neutral', sub: 'Bottom-line expansion' },
                          ])}
                        </div>
                      </div>

                      {/* Financial Health */}
                      <div className="ft-analysis-card">
                        <div className="fac-header flex items-center gap-2">
                          <span>Financial Health</span>
                          <div className="info-trigger-s">
                            <HelpCircle size={13} className="text-slate-300" />
                            <div className="ft-dropdown-s"><strong>Health:</strong> {METRIC_DESCRIPTIONS['Financial Health']}</div>
                          </div>
                        </div>
                        <div className="fac-list">
                          {cardMap([
                            { n: 'Debt to Equity', v: na(dte),    label: dteLabel, t: dteColor,   sub: 'Prudent debt management' },
                            { n: 'Int. Coverage',  v: na(intCov), label: intCov == null ? 'N/A' : Number(intCov) > 5 ? 'Superior' : Number(intCov) > 2 ? 'Adequate' : 'Weak', t: intCov == null ? 'neutral' : Number(intCov) > 5 ? 'green' : Number(intCov) > 2 ? 'neutral' : 'red', sub: 'Safe interest repayments' },
                            { n: 'Current Ratio',  v: na(curRatio), label: curLabel, t: curColor,  sub: 'Optimal liquidity profile' },
                          ])}
                        </div>
                      </div>

                      {/* Shareholder Metrics */}
                      <div className="ft-analysis-card">
                        <div className="fac-header d-flex items-center gap-2">
                          <span>Shareholder Metrics</span>
                          <div className="info-trigger-s">
                            <HelpCircle size={13} className="text-slate-300" />
                            <div className="ft-dropdown-s"><strong>Shareholders:</strong> {METRIC_DESCRIPTIONS['Shareholder Metrics']}</div>
                          </div>
                        </div>
                        <div className="fac-list">
                          {cardMap([
                            { n: 'EPS (TTM)',     v: na(eps),      label: eps == null ? 'N/A' : Number(eps) > 0 ? 'Rising' : 'Loss', t: eps == null ? 'neutral' : Number(eps) > 0 ? 'green' : 'red', sub: 'Last 12 month earnings' },
                            { n: 'Dividend Yield',v: na(divYield), label: divYield == null ? 'N/A' : parseFloat(divYield) > 2 ? 'High Yield' : parseFloat(divYield) > 0.5 ? 'Moderate' : 'Low', t: 'neutral', sub: 'Annual yield percentage' },
                            { n: 'Book Value',    v: na(bookVal),  label: bookVal == null ? 'N/A' : 'Strong', t: bookVal == null ? 'neutral' : 'green', sub: 'Asset value per share' },
                          ])}
                        </div>
                      </div>

                      {/* Peer Comparison */}
                      <div className="ft-analysis-card ft-peer-card">
                        <div className="fac-header flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>Peer Comparison</span>
                            <div className="info-trigger-s">
                              <HelpCircle size={13} className="text-slate-300" />
                              <div className="ft-dropdown-s">{FUNDAMENTALS_TOOLTIPS.peerComparison}</div>
                            </div>
                          </div>
                          <span className="text-xs font-normal text-slate-400">Industry: {industry}</span>
                        </div>
                        <div className="peer-comp-table">
                          <div className="pct-header">
                            <span>Metric</span><span>Company</span><span>Industry Avg</span>
                          </div>
                          {[
                            { n: 'P/E Ratio',     c: na(pe),        i: q.industryPeAvg ? Number(q.industryPeAvg).toFixed(2) : '—', t: peColor,   d: q.valStatus === 'undervalued' ? 'down' : 'up' },
                            { n: 'ROE',           c: na(roe),       i: q.industryRoeAvg ? parseFloat(q.industryRoeAvg).toFixed(1) + '%' : '—', t: roe != null && parseFloat(roe) > 12 ? 'green' : 'neutral', d: 'up' },
                            { n: 'Profit Margin', c: na(netMargin), i: q.industryMarginAvg ? parseFloat(q.industryMarginAvg).toFixed(1) + '%' : '—', t: netMargin != null && parseFloat(netMargin) > 10 ? 'green' : 'neutral', d: 'up' },
                            { n: 'Rev Growth',    c: na(revGrowth), i: q.industryGrowthAvg ? parseFloat(q.industryGrowthAvg).toFixed(1) + '%' : '—', t: revGrowth != null && parseFloat(revGrowth) > 5 ? 'green' : 'neutral', d: 'up' },
                          ].map((m, idx) => (
                            <div key={idx} className="pct-row">
                              <div className="flex items-center gap-2">
                                <span className="pct-n">{m.n}</span>
                                <div className="info-trigger-s">
                                  <HelpCircle size={10} className="text-slate-200" />
                                  <div className="ft-dropdown-s"><strong>{m.n}:</strong> {METRIC_DESCRIPTIONS[m.n]}</div>
                                </div>
                              </div>
                              <div className="pct-c-cell">
                                <span className="pct-val">{m.c}</span>
                                <div className={`pct-indicator text-${m.t}`}>
                                  {m.d === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                </div>
                              </div>
                              <span className="pct-i">{m.i}</span>
                            </div>
                          ))}
                        </div>
                        <div className="peer-foot mt-4 border-t pt-3 border-slate-100">
                          <p className="text-[11px] text-slate-500 leading-relaxed italic">
                            {symbol} fundamentals sourced from Yahoo Finance · {q.fundamentalSource || 'live data'}.
                          </p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
          {activeTab === 'News & Events' && (
            <div className="news-events-tab animate-fade-in">
              {}
              <div className="ne-header-bar shadow-premium">
                <div className="ne-title-row">
                  <div className="ne-title-group">
                    <Newspaper size={20} className="text-blue-600" />
                    <h2>News & Events</h2>
                  </div>
                  <div className="ne-header-actions">
                    <div className="ne-dropdown-wrap">
                      <select className="ne-select-modern">
                        <option>Latest</option>
                        <option>Relevant</option>
                        <option>Top Impact</option>
                      </select>
                      <ChevronsUpDown size={14} className="ne-select-icon" />
                    </div>
                    <button className="ne-search-btn">
                      <Search size={18} />
                    </button>
                  </div>
                </div>

                <div className="ne-filter-pills mt-6">
                  {['All', 'News', 'Events'].map(p => (
                    <button key={p} className={`ne-pill ${p === 'All' ? 'active' : ''}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ne-content-layout mt-8">
                {}
                <div className="ne-events-section mb-10">
                  <div className="ne-section-header">
                    <Clock size={18} className="text-indigo-500" />
                    <h3>Upcoming Events</h3>
                    <div className="info-trigger-s ml-2">
                      <HelpCircle size={15} className="text-slate-300" />
                      <div className="ft-dropdown-s">{NEWS_TOOLTIPS.upcomingEvents}</div>
                    </div>
                  </div>

                  <div className="ne-timeline-container shadow-premium">
                    {(newsImpactData?.data?.events || []).map((e, idx) => (
                      <div key={idx} className="ne-timeline-item">
                        <div className="ne-t-left">
                          <span className="ne-t-date">{e.date}</span>
                          <div className="ne-t-node">
                            <div className={`ne-t-icon-bg bg-${e.s || 'blue'}-soft`}>
                              <Activity size={14} />
                            </div>
                            {idx < (newsImpactData.events.length - 1) && <div className="ne-t-line"></div>}
                          </div>
                        </div>
                        <div className="ne-t-right">
                          <div className="ne-t-header">
                            <h4 className="ne-t-title">{e.title}</h4>
                            <span className="ne-t-tag">{e.tag || 'EVENT'}</span>
                          </div>
                          <p className="ne-t-desc">{e.desc}</p>
                          <div className={`ne-t-impact impact-${e.s || 'blue'}`}>
                            <div className="ne-dot"></div>
                            <span>{e.imp}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(newsImpactData?.data?.events?.length === 0) && <p className="text-xs p-8 text-slate-400 text-center">No upcoming events found.</p>}
                  </div>
                </div>

                {}
                <div className="ne-news-section">
                  <div className="ne-section-header">
                    <TrendingUp size={18} className="text-blue-500" />
                    <h3>Latest News</h3>
                    <div className="info-trigger-s ml-2">
                      <HelpCircle size={15} className="text-slate-300" />
                      <div className="ft-dropdown-s">{NEWS_TOOLTIPS.latestNews}</div>
                    </div>
                  </div>

                  <div className="ne-news-stack">
                    {(newsImpactData?.data?.articles || newsImpactData?.data?.news || []).map((n, idx) => (
                      <div key={idx} className="ne-news-card shadow-premium border-l-[4px] border-l-blue-500">
                        <div className="ne-n-top">
                          <span className="ne-n-tag">NEWS</span>
                          <span className="ne-n-source">{n.source}</span>
                          <span className="ne-n-time">{n.time}</span>
                        </div>
                        <h4 className="ne-n-headline">{n.title || n.head}</h4>
                        <p className="ne-n-summary">{n.description || n.desc}</p>
                        <div className={`ne-n-interpretation impact-${n.s || 'blue'}`}>
                          <div className="ne-dot"></div>
                          <span>Interpretation: {n.imp || 'Neutral Market Impact'}</span>
                        </div>
                      </div>
                    ))}
                    {((newsImpactData?.data?.articles || newsImpactData?.data?.news || []).length === 0) && <p className="text-xs p-8 text-slate-400 text-center">No recent news articles found.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default InvestorStockPage;
