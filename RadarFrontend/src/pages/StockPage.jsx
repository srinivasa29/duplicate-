import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchMarketData, fetchMarketHistory, fetchMarketNews } from '../api/marketApi';
import { fetchTechnicalSummary } from '../api/technicalApi';
import { fetchRealtimeQuote } from '../api/quotesApi';
import api from '../api/api';
import { fetchStockFundamentals } from '../api/fundamentalApi';
import Header from '../components/common/Header';

import { getAssetMetadata } from '../utils/assetClassifier';

const INDEX_MAP = {
    NIFTY: '^NSEI', BANKNIFTY: '^NSEBANK', SENSEX: '^BSESN',
    FINNIFTY: 'NIFTY_FIN_SERVICE.NS', MIDCPNIFTY: '^NSEMDCP50', INDIAVIX: '^INDIAVIX',
};

const deriveApiSymbol = (symbol) => {
    const upper = String(symbol || '').toUpperCase();
    const meta = getAssetMetadata(upper);
    if (meta.type === 'Index')  return INDEX_MAP[upper] || `^${upper}`;
    if (meta.type === 'Crypto') return upper.endsWith('USDT') ? upper : `${upper}USDT`;
    if (meta.type === 'Forex')  return `${upper}=X`;
    // Equity — add .NS if no exchange suffix
    return upper.endsWith('.NS') || upper.endsWith('.BO') ? upper : `${upper}.NS`;
};

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase().replace(/\.(NS|BO)$/i, '');

const formatSignedPercent = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '--';
    return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
};

const formatTimeLabel = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatNumber = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '--';
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const findBestQuoteMatch = (rows, targetSymbol) => {
    const normalizedTarget = normalizeSymbol(targetSymbol);
    const list = Array.isArray(rows) ? rows : [];
    return list.find((row) => {
        const symbolMatch = normalizeSymbol(row?.symbol) === normalizedTarget;
        const nameMatch = normalizeSymbol(row?.name) === normalizedTarget;
        return symbolMatch || nameMatch;
    }) || null;
};

const getPreferredMode = () => {
    const mode = localStorage.getItem('mode');
    return mode === 'TRADER' ? 'TRADER' : 'INVESTOR';
};


const runStockScreener = async (symbol) => {
    const payload = {
        limit: 10,
        filters: {
            symbols: [symbol],
        },
        sortBy: 'score',
        sortOrder: 'desc',
        strictLive: true,
    };
    const response = await api.post('/screener/run', payload);
    return response?.data?.data ?? null;
};

function StockPageHeader({
    navigate,
    normalizedSymbol,
    mode,
    quoteStatus,
    historyStatus,
    newsStatus,
    warning,
    toneClass,
    change,
    isPositive,
}) {
    const isTraderMode = mode === 'TRADER';
    const headerShellClass = isTraderMode
        ? 'rounded-3xl border border-slate-700 bg-[#0B1220] text-slate-100 p-6 md:p-7 shadow-xl relative overflow-hidden'
        : 'rounded-3xl border border-slate-200 bg-white text-slate-800 p-6 md:p-7 shadow-sm relative overflow-hidden';
    const titleClass = isTraderMode ? 'text-slate-50' : 'text-[#1F3D2B]';
    const subtitleClass = isTraderMode ? 'text-slate-300' : 'text-slate-500';
    const chipBaseClass = isTraderMode
        ? 'px-2.5 py-1 rounded-full border bg-slate-800 border-slate-600 text-slate-200'
        : 'px-2.5 py-1 rounded-full border bg-white border-slate-200 text-slate-600';
    const modeChipClass = isTraderMode
        ? 'bg-slate-700 text-slate-100 border-slate-500'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';

    return (
        <div className={headerShellClass}>
            <div className={`pointer-events-none absolute -top-20 -right-16 w-72 h-72 rounded-full blur-3xl ${isTraderMode ? 'bg-slate-500/20' : 'bg-emerald-100/60'}`} />
            <div className={`pointer-events-none absolute -bottom-24 -left-16 w-80 h-80 rounded-full blur-3xl ${isTraderMode ? 'bg-slate-800/40' : 'bg-orange-100/70'}`} />
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
                <div>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border mb-2 ${isTraderMode ? 'border-slate-600 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-500'}`}>
                        RADAR STOCK VIEW
                    </div>
                    <h1 className={`text-3xl md:text-4xl font-black tracking-tight ${titleClass}`}>{normalizedSymbol}</h1>
                    <p className={`text-sm font-semibold mt-1 ${subtitleClass}`}>
                        {mode === 'TRADER'
                            ? 'Trader mode: execution-focused, chart-first view'
                            : 'Investor mode: fundamentals + screener intelligence'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                        <span className={`${chipBaseClass} ${quoteStatus.live ? (isTraderMode ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10' : 'text-emerald-700 border-emerald-200 bg-emerald-50') : (isTraderMode ? 'text-amber-200 border-amber-400/50 bg-amber-500/10' : 'text-amber-700 border-amber-200 bg-amber-50')}`}>
                            Quote: {quoteStatus.live ? 'Live' : 'Delayed'}
                        </span>
                        <span className={`${chipBaseClass} ${historyStatus.live ? (isTraderMode ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10' : 'text-emerald-700 border-emerald-200 bg-emerald-50') : (isTraderMode ? 'text-amber-200 border-amber-400/50 bg-amber-500/10' : 'text-amber-700 border-amber-200 bg-amber-50')}`}>
                            History: {historyStatus.live ? 'Live' : 'Unavailable'}
                        </span>
                        <span className={`${chipBaseClass} ${newsStatus.live ? (isTraderMode ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10' : 'text-emerald-700 border-emerald-200 bg-emerald-50') : (isTraderMode ? 'text-amber-200 border-amber-400/50 bg-amber-500/10' : 'text-amber-700 border-amber-200 bg-amber-50')}`}>
                            News: {newsStatus.live ? 'Live' : 'Unavailable'}
                        </span>
                        <span className={`${chipBaseClass} ${modeChipClass}`}>
                            {mode}
                        </span>
                    </div>
                    {warning && (
                        <p className={`text-[11px] font-semibold mt-2 ${isTraderMode ? 'text-amber-300' : 'text-amber-700'}`}>{warning}</p>
                    )}
                </div>
                <div className={`inline-flex items-center gap-1.5 text-sm font-black ${toneClass}`}>
                    {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {formatSignedPercent(change)}
                </div>
            </div>
            <button
                onClick={() => navigate('/dashboard')}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm font-bold mb-2 ${isTraderMode ? 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700' : 'border-slate-200 bg-white hover:border-emerald-300 hover:text-emerald-700'}`}
            >
                <ArrowLeft size={15} /> Back to Dashboard
            </button>
        </div>
    );
}

function TraderPanel({ backendSymbol, history, toneClass, quoteStatus, historyStatus, summary, currentPrice }) {
    const tradingViewSymbol = backendSymbol.includes('.') ? backendSymbol : `NSE:${backendSymbol}`;
    const score = Number(summary?.score?.score || 0);
    const bias = String(summary?.score?.bias || 'neutral').toLowerCase();
    const rsi = Number(summary?.indicators?.rsi || 0);
    const support = Number(summary?.indicators?.support || 0);
    const resistance = Number(summary?.indicators?.resistance || 0);
    const topPattern = summary?.patterns?.[0]?.pattern || 'No active pattern';
    const supportGap = currentPrice > 0 && support > 0 ? ((currentPrice - support) / currentPrice) * 100 : null;
    const resistanceGap = currentPrice > 0 && resistance > 0 ? ((resistance - currentPrice) / currentPrice) * 100 : null;
    const scoreTone = score >= 60 ? 'text-emerald-300' : score >= 45 ? 'text-amber-300' : 'text-slate-300';

    return (
        <>
            <div className="rounded-2xl border border-slate-700 bg-[#111827] p-4 md:p-5 mb-6 shadow-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-700 bg-[#0F172A] p-3">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Price</div>
                        <div className="text-sm md:text-base font-black mt-1 text-slate-100">{currentPrice > 0 ? currentPrice.toLocaleString() : '--'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-[#0F172A] p-3">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bias</div>
                        <div className={`text-sm md:text-base font-black mt-1 ${bias.includes('bull') ? 'text-emerald-300' : bias.includes('bear') ? 'text-rose-300' : 'text-slate-300'}`}>
                            {bias.toUpperCase()}
                        </div>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-[#0F172A] p-3">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">RSI</div>
                        <div className="text-sm md:text-base font-black mt-1 text-slate-100">{Number.isFinite(rsi) && rsi > 0 ? rsi.toFixed(1) : '--'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-[#0F172A] p-3">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Score</div>
                        <div className={`text-sm md:text-base font-black mt-1 ${scoreTone}`}>{score > 0 ? `${score}/100` : '--'}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
                <div className="xl:col-span-2 rounded-2xl border border-slate-700 bg-[#111827] p-4 shadow-lg">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">TradingView</h2>
                        <span className="text-[11px] text-slate-400 font-semibold">{tradingViewSymbol}</span>
                    </div>
                    <div className="h-[460px] rounded-xl border border-slate-700 overflow-hidden bg-[#0F172A]">
                        <iframe
                            title={`TradingView-${tradingViewSymbol}`}
                            src={`https://s.tradingview.com/widgetembed/?frameElementId=tv-widget&symbol=${encodeURIComponent(tradingViewSymbol)}&interval=60&hidesidetoolbar=1&symboledit=1&saveimage=0&toolbarbg=F1F3F6&studies=[]&theme=light&style=1&timezone=Etc%2FUTC&withdateranges=1&hideideas=1&locale=en`}
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            allowTransparency
                            scrolling="no"
                        />
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-slate-400">
                        If the widget cannot load, use the live history chart below. Quote status: {quoteStatus.live ? 'live' : 'delayed'}.
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-[#111827] p-4 shadow-lg">
                    <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider mb-3">Execution Levels</h2>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs border-b border-slate-700 pb-2">
                            <span className="font-semibold text-slate-400 uppercase tracking-wider">Support</span>
                            <span className="font-black text-slate-100">{formatNumber(support)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs border-b border-slate-700 pb-2">
                            <span className="font-semibold text-slate-400 uppercase tracking-wider">Resistance</span>
                            <span className="font-black text-slate-100">{formatNumber(resistance)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs border-b border-slate-700 pb-2">
                            <span className="font-semibold text-slate-400 uppercase tracking-wider">Top Pattern</span>
                            <span className="font-black text-slate-100 text-right">{topPattern}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs border-b border-slate-700 pb-2">
                            <span className="font-semibold text-slate-400 uppercase tracking-wider">Gap to Support</span>
                            <span className="font-black text-emerald-300">
                                {Number.isFinite(supportGap) ? `${supportGap.toFixed(2)}%` : '--'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs pb-2">
                            <span className="font-semibold text-slate-400 uppercase tracking-wider">Gap to Resistance</span>
                            <span className="font-black text-amber-300">
                                {Number.isFinite(resistanceGap) ? `${resistanceGap.toFixed(2)}%` : '--'}
                            </span>
                        </div>
                    </div>
                    <div className="mt-3 text-[11px] font-semibold text-slate-400">
                        {historyStatus.live ? 'Live candles available.' : 'No live candles currently available.'}
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-[#111827] p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                    <Activity size={14} className="text-slate-300" />
                    <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">Backup Price History</h2>
                </div>
                <div className="h-[240px]">
                    {history.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400">Live history unavailable right now.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={40} />
                                <Tooltip formatter={(v) => Number(v || 0).toLocaleString()} />
                                <Area type="monotone" dataKey="close" stroke={toneClass.includes('emerald') ? '#22C55E' : '#F43F5E'} fill={toneClass.includes('emerald') ? '#22C55E22' : '#F43F5E22'} strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </>
    );
}

function InvestorPanel({ fundamentals, screenerRows, screenerWarning, summary, news }) {
    const pe = fundamentals?.snapshot?.peRatio;
    const pb = fundamentals?.snapshot?.pbRatio;
    const dy = fundamentals?.snapshot?.dividendYield;
    const marketCap = fundamentals?.snapshot?.marketCap;
    const sector = fundamentals?.snapshot?.sector || '--';
    const qualityScore = Number(summary?.score?.score || 0);
    const bias = String(summary?.score?.bias || 'neutral').toLowerCase();
    const topPattern = summary?.patterns?.[0]?.pattern || 'No active pattern';

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-3">Fundamentals</h2>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                            <span className="font-semibold text-slate-500 uppercase tracking-wider">Sector</span>
                            <span className="font-black text-slate-800">{sector}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                            <span className="font-semibold text-slate-500 uppercase tracking-wider">P/E</span>
                            <span className="font-black text-slate-800">{Number.isFinite(pe) ? pe.toFixed(2) : '--'}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                            <span className="font-semibold text-slate-500 uppercase tracking-wider">P/B</span>
                            <span className="font-black text-slate-800">{Number.isFinite(pb) ? pb.toFixed(2) : '--'}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                            <span className="font-semibold text-slate-500 uppercase tracking-wider">Dividend Yield</span>
                            <span className="font-black text-slate-800">{Number.isFinite(dy) ? `${dy.toFixed(2)}%` : '--'}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs pb-1">
                            <span className="font-semibold text-slate-500 uppercase tracking-wider">Market Cap</span>
                            <span className="font-black text-slate-800">{marketCap || '--'}</span>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Screener</h2>
                        <span className={`text-[11px] font-black ${qualityScore >= 60 ? 'text-emerald-600' : qualityScore >= 45 ? 'text-amber-600' : 'text-slate-500'}`}>
                            Score {qualityScore > 0 ? `${qualityScore}/100` : '--'}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">Bias</div>
                            <div className={`text-xs font-black mt-0.5 ${bias.includes('bull') ? 'text-emerald-600' : bias.includes('bear') ? 'text-rose-600' : 'text-slate-500'}`}>
                                {bias.toUpperCase()}
                            </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">Pattern</div>
                            <div className="text-xs font-black mt-0.5 text-slate-700 truncate">{topPattern}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">Quality</div>
                            <div className="text-xs font-black mt-0.5 text-slate-700">{qualityScore > 0 ? `${qualityScore}/100` : '--'}</div>
                        </div>
                    </div>
                    {screenerWarning && (
                        <p className="text-[11px] text-amber-700 font-semibold mb-2">{screenerWarning}</p>
                    )}
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                            <thead>
                                <tr className="text-slate-500 uppercase tracking-wider">
                                    <th className="text-left py-2 pr-3">Symbol</th>
                                    <th className="text-right py-2 pr-3">Price</th>
                                    <th className="text-right py-2 pr-3">Change</th>
                                    <th className="text-right py-2 pr-3">P/E</th>
                                    <th className="text-right py-2 pr-3">RSI</th>
                                    <th className="text-right py-2">Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(screenerRows.length > 0 ? screenerRows : [{
                                    symbol: '--',
                                    price: null,
                                    change: null,
                                    pe: null,
                                    rsi: null,
                                    score: null,
                                }]).map((row, idx) => (
                                    <tr key={`${row.symbol}-${idx}`} className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors">
                                        <td className="py-2 pr-3 font-black text-slate-700">{row.symbol || '--'}</td>
                                        <td className="py-2 pr-3 text-right font-semibold text-slate-700">{Number.isFinite(Number(row.price)) ? Number(row.price).toLocaleString() : '--'}</td>
                                        <td className="py-2 pr-3 text-right font-semibold text-slate-700">{Number.isFinite(Number(row.change)) ? formatSignedPercent(row.change) : '--'}</td>
                                        <td className="py-2 pr-3 text-right font-semibold text-slate-700">{Number.isFinite(Number(row.pe)) ? Number(row.pe).toFixed(2) : '--'}</td>
                                        <td className="py-2 pr-3 text-right font-semibold text-slate-700">{Number.isFinite(Number(row.rsi)) ? Number(row.rsi).toFixed(1) : '--'}</td>
                                        <td className="py-2 text-right font-black text-slate-800">{Number.isFinite(Number(row.score)) ? Number(row.score).toFixed(0) : '--'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-3">Investor Headlines</h2>
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {news.length === 0 && (
                        <div className="text-xs text-slate-500">No live headlines available right now.</div>
                    )}
                    {news.map((item, idx) => (
                        <a
                            key={`${item.title}-${idx}`}
                            href={item.url || item.link || '#'}
                            target={(item.url || item.link) ? '_blank' : undefined}
                            rel={(item.url || item.link) ? 'noreferrer' : undefined}
                            className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300 hover:shadow-sm transition-all"
                            onClick={(event) => {
                                if (!(item.url || item.link)) {
                                    event.preventDefault();
                                }
                            }}
                        >
                            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">{item.source || 'Market Desk'}</div>
                            <div className="text-xs font-semibold text-slate-700 mt-1 line-clamp-2">{item.title}</div>
                        </a>
                    ))}
                </div>
            </div>
        </>
    );
}

export default function StockPage() {
    const navigate = useNavigate();
    const { symbol } = useParams();

    const normalizedSymbol = normalizeSymbol(decodeURIComponent(symbol || 'NIFTY 50'));
    const backendSymbol = deriveApiSymbol(normalizedSymbol);

    const [mode, setMode] = useState(getPreferredMode());
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [isNotFound, setIsNotFound] = useState(false);
    const [quote, setQuote] = useState(null);
    const [history, setHistory] = useState([]);
    const [summary, setSummary] = useState(null);
    const [news, setNews] = useState([]);
    const [fundamentals, setFundamentals] = useState(null);
    const [screenerRows, setScreenerRows] = useState([]);
    const [screenerWarning, setScreenerWarning] = useState('');
    const [historyStatus, setHistoryStatus] = useState({ live: false, warning: '' });
    const [quoteStatus, setQuoteStatus] = useState({ live: false, source: 'market-feed', warning: '' });
    const [newsStatus, setNewsStatus] = useState({ live: false, warning: '' });

    useEffect(() => {
        if (mode === 'INVESTOR') {
            document.body.style.backgroundColor = '#f0f9ff';
            document.body.style.backgroundImage = 'linear-gradient(180deg, #f0f9ff 0%, #e1effe 100%)';
            document.body.style.backgroundAttachment = 'fixed';
        } else {
            document.body.style.backgroundColor = '#020617';
            document.body.style.backgroundImage = 'linear-gradient(180deg, #020617 0%, #0F172A 100%)';
            document.body.style.backgroundAttachment = 'fixed';
        }
        return () => {
            document.body.style.backgroundColor = '';
            document.body.style.backgroundImage = '';
            document.body.style.backgroundAttachment = '';
        };
    }, [mode]);

    useEffect(() => {
        setMode(getPreferredMode());
    }, []);

    useEffect(() => {
        let isMounted = true;

        const loadStockPage = async () => {
            try {
                setIsLoading(true);
                setHasError(false);
                setIsNotFound(false);
                setScreenerWarning('');

                const [marketRes, realtimeQuoteRes, historyRes, summaryRes, newsRes, fundamentalsRes, screenerRes] = await Promise.allSettled([
                    fetchMarketData({ search: normalizedSymbol, limit: 8 }),
                    fetchRealtimeQuote(backendSymbol),
                    fetchMarketHistory(backendSymbol, 'STOCK', '1M', { strictLive: true }),
                    fetchTechnicalSummary('stock', backendSymbol, { strictLive: true }),
                    fetchMarketNews(),
                    fetchStockFundamentals(backendSymbol),
                    runStockScreener(backendSymbol),
                ]);

                if (!isMounted) return;

                const marketRows = marketRes.status === 'fulfilled' ? marketRes.value : [];
                const marketMatch = findBestQuoteMatch(marketRows, normalizedSymbol);

                const realtimeQuote = realtimeQuoteRes.status === 'fulfilled' && !realtimeQuoteRes.value?.error
                    ? realtimeQuoteRes.value
                    : null;

                const mergedQuote = marketMatch
                    ? {
                        ...marketMatch,
                        price: Number.isFinite(Number(realtimeQuote?.price)) ? Number(realtimeQuote.price) : Number(marketMatch.price || 0),
                        change_24h: Number.isFinite(Number(realtimeQuote?.changePercent)) ? Number(realtimeQuote.changePercent) : Number(marketMatch.change_24h ?? marketMatch.change ?? 0),
                        source: realtimeQuote?.source || 'market-feed',
                        stale: Boolean(realtimeQuote?.stale),
                    }
                    : (realtimeQuote ? {
                        symbol: normalizeSymbol(realtimeQuote.symbol || backendSymbol),
                        name: normalizeSymbol(realtimeQuote.symbol || normalizedSymbol),
                        type: 'STOCK',
                        price: Number(realtimeQuote.price || 0),
                        change_24h: Number(realtimeQuote.changePercent || 0),
                        source: realtimeQuote.source || 'quotes-feed',
                        stale: Boolean(realtimeQuote.stale),
                    } : null);

                setQuote(mergedQuote || null);
                setIsNotFound(!mergedQuote);
                setQuoteStatus({
                    live: Boolean(realtimeQuote && !realtimeQuote.stale),
                    source: realtimeQuote?.source || 'market-feed',
                    warning: realtimeQuote?.stale ? 'Showing delayed cached quote data.' : '',
                });

                const historyRows = historyRes.status === 'fulfilled'
                    ? (Array.isArray(historyRes.value?.data) ? historyRes.value.data : [])
                    : [];

                if (historyRows.length > 0) {
                    setHistoryStatus({ live: true, warning: '' });
                } else {
                    setHistoryStatus({ live: false, warning: 'No live historical candles available for this symbol right now.' });
                }

                setHistory(
                    historyRows.map((row, index) => ({
                        index,
                        time: formatTimeLabel(row.timestamp),
                        close: Number(row.close || 0),
                    }))
                );

                setSummary(summaryRes.status === 'fulfilled' ? summaryRes.value : null);

                const newsRows = newsRes.status === 'fulfilled'
                    ? (Array.isArray(newsRes.value) ? newsRes.value : (Array.isArray(newsRes.value?.data) ? newsRes.value.data : []))
                    : [];

                const symbolNews = newsRows
                    .filter((item) => {
                        const text = `${item?.title || ''} ${item?.summary || ''} ${item?.description || ''}`.toUpperCase();
                        return text.includes(normalizedSymbol);
                    })
                    .slice(0, 8);

                const fallbackNews = newsRows.slice(0, 8);
                if (symbolNews.length > 0) {
                    setNews(symbolNews);
                    setNewsStatus({ live: true, warning: '' });
                } else {
                    setNews(fallbackNews);
                    setNewsStatus({
                        live: fallbackNews.length > 0,
                        warning: fallbackNews.length > 0
                            ? 'No symbol-specific headlines found. Showing latest market headlines.'
                            : 'No live news headlines available.',
                    });
                }

                setFundamentals(fundamentalsRes.status === 'fulfilled' ? fundamentalsRes.value : null);
                const screenerData = screenerRes.status === 'fulfilled' ? screenerRes.value : null;
                const rows = Array.isArray(screenerData?.results) ? screenerData.results : [];
                setScreenerRows(rows);
                if (rows.length === 0) {
                    setScreenerWarning('Screener did not return symbol-specific rows. Showing fallback table state.');
                }
            } catch (error) {
                console.error('Failed to load stock page:', error);
                if (isMounted) {
                    setHasError(true);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadStockPage();
        return () => {
            isMounted = false;
        };
    }, [backendSymbol, normalizedSymbol]);

    const change = Number(quote?.change_24h ?? quote?.change ?? 0);
    const isPositive = change >= 0;
    const currentPrice = Number(quote?.price ?? summary?.indicators?.current ?? fundamentals?.snapshot?.price ?? 0);
    const toneClass = isPositive ? 'text-emerald-600' : 'text-rose-600';
    const warning = quoteStatus.warning || historyStatus.warning || newsStatus.warning || screenerWarning;
    const isTraderMode = mode === 'TRADER';

    return (
        <div
            className={`min-h-screen pt-4 ${isTraderMode ? 'text-slate-100' : 'text-slate-800'}`}
            style={{
                background: isTraderMode
                    ? 'linear-gradient(180deg, #0B1220 0%, #0F172A 100%)'
                    : 'linear-gradient(180deg, #f0f9ff 0%, #e1effe 100%)',
            }}
        >
            <Header onToggleMode={() => setMode(mode === 'TRADER' ? 'INVESTOR' : 'TRADER')} />
            <div className="w-full px-3 md:px-6 xl:px-8 py-4 md:py-6">
                <StockPageHeader
                    navigate={navigate}
                    normalizedSymbol={normalizedSymbol}
                    mode={mode}
                    quoteStatus={quoteStatus}
                    historyStatus={historyStatus}
                    newsStatus={newsStatus}
                    warning={warning}
                    toneClass={toneClass}
                    change={change}
                    isPositive={isPositive}
                />

                <div className={`mt-4 rounded-3xl border p-4 md:p-6 xl:p-8 ${isTraderMode ? 'border-slate-700 bg-[#0F172A] shadow-lg' : 'border-slate-200 bg-white shadow-sm'}`}>
                    {isLoading && (
                        <div className="py-10 text-center text-sm text-slate-500 font-semibold">Loading stock page...</div>
                    )}

                    {!isLoading && hasError && (
                        <div className="py-10 text-center text-sm text-rose-600 font-semibold">Unable to load stock details right now.</div>
                    )}

                    {!isLoading && !hasError && isNotFound && (
                        <div className="py-10 text-center">
                            <p className="text-base font-black text-slate-700">No listed symbol found for "{normalizedSymbol}"</p>
                            <p className="text-sm text-slate-500 mt-2">Try an exact symbol like RELIANCE, HDFCBANK, INFY, or TCS.</p>
                        </div>
                    )}

                    {!isLoading && !hasError && !isNotFound && mode === 'TRADER' && (
                        <TraderPanel
                            backendSymbol={backendSymbol}
                            history={history}
                            toneClass={toneClass}
                            quoteStatus={quoteStatus}
                            historyStatus={historyStatus}
                            summary={summary}
                            currentPrice={currentPrice}
                        />
                    )}

                    {!isLoading && !hasError && !isNotFound && mode === 'INVESTOR' && (
                        <InvestorPanel
                            fundamentals={fundamentals}
                            screenerRows={screenerRows}
                            screenerWarning={screenerWarning}
                            summary={summary}
                            news={news}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
