import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import YourInvestments from '../components/investor/YourInvestments';
import MostBoughtStocks from '../components/investor/MostBoughtStocks';
import SharedTickerTape from '../components/landing/TickerTape';
import Watchlist from '../components/investor/Watchlist';
import Screeners from '../components/investor/Screeners';
import Header from '../components/common/Header';
import LearningAcademy from './LearningAcademy';
import { ProfilePage } from './ContractPages';

import {
    LayoutDashboard,
    Star,
    Filter,
    Newspaper,
    Search,
    Bell,
    CheckCircle,
    User,
    Settings,
    HelpCircle,
    Activity,
    TrendingUp,
    TrendingDown,
    LogOut,
    Menu,
    Zap,
    RefreshCw,
    Compass,
    ArrowUp,
    ArrowDown,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    ExternalLink,
    AlertTriangle,
} from "lucide-react";
import {
    ResponsiveContainer,
    BarChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Bar,
    Cell,
    ReferenceLine,
    LabelList,
} from "recharts";

import "./InvestorDashboard.css";
import { fetchDiscoveryShelves, fetchMarketMood, fetchValuation } from "../api/fundamentalApi";
import { fetchSectorPerformance, fetchMarketData, fetchTrendingSearches, logSearchQuery, fetchMarketNews } from "../api/marketApi";
import { fetchEconomicCalendar } from "../api/calendarApi";
import { updateUserMode } from "../api/userApi";
import { fetchUserWatchlist } from "../api/watchlistApi";
import { useHeaderData } from "../hooks/useHeaderData";
import { useSocket } from "../hooks/useSocket";
import { formatPrice } from "../utils/currency";

const formatNotificationTime = (value) => {
    if (!value) return "Now";

    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return value;

    const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
};

const DEFAULT_REGION = String(import.meta.env.VITE_DEFAULT_REGION || 'IN').toUpperCase();
const VALUATION_BENCHMARK_BY_REGION = {
    IN: 'NIFTY 50',
    US: 'S&P 500',
    GLOBAL: 'Global Composite',
};

const inferRegionCode = (asset) => {
    const symbol = String(asset?.symbol || asset?.name || '').toUpperCase();

    if (symbol.endsWith('.NS') || symbol.endsWith('.BO') || symbol.includes('NIFTY') || symbol.includes('SENSEX') || symbol.includes('INR')) {
        return 'IN';
    }
    if (symbol.includes('FTSE') || symbol.includes('GBP')) {
        return 'UK';
    }
    if (symbol.includes('NIKKEI') || symbol.includes('JPY')) {
        return 'JP';
    }
    if (symbol.includes('DAX') || symbol.includes('EURO') || symbol.includes('EUR')) {
        return 'EU';
    }

    return DEFAULT_REGION;
};

const countryFlag = (code) => {
    if (code === 'US') return '🇺🇸';
    if (code === 'UK') return '🇬🇧';
    if (code === 'JP') return '🇯🇵';
    if (code === 'EU') return '🇪🇺';
    return '🇮🇳';
};

const displaySymbol = (value) => String(value || '').replace(/\.(NS|BO)$/i, '');

const extractHeadlineSymbol = (value) => {
    const text = String(value || '').toUpperCase();
    const matches = text.match(/\b[A-Z]{3,12}\b/g) || [];
    const blacklist = new Set(['THE', 'AND', 'WITH', 'FROM', 'MARKET', 'STOCK', 'STOCKS', 'NEWS', 'INDEX']);
    return matches.find((token) => !blacklist.has(token)) || null;
};



const themes = {
    blue: {
        dot: '#3b82f6',
        gradient: `linear-gradient(180deg, #f0f9ff 0%, #e1effe 100%)`
    },
    emerald: {
        dot: '#10b981',
        gradient: `linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)`
    },
    purple: {
        dot: '#8b5cf6',
        gradient: `linear-gradient(180deg, #f5f3ff 0%, #ede9fe 100%)`
    },
    rose: {
        dot: '#f43f5e',
        gradient: `linear-gradient(180deg, #fff1f2 0%, #ffe4e6 100%)`
    },
    slate: {
        dot: '#64748b',
        gradient: `linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)`
    }
};

const InvestorMode = ({ onToggleMode }) => {
    const params = useParams();
    const routeModule = String(params?.module || '').trim().toUpperCase();
    const [activeModule, setActiveModule] = useState(routeModule || "DASHBOARD");

    useEffect(() => {
        setActiveModule(routeModule || "DASHBOARD");
    }, [routeModule]);

    useEffect(() => {
        const currentTheme = 'blue';
        const fullBackground = themes[currentTheme].gradient;

        // Apply global background properties
        document.documentElement.style.setProperty('--investor-bg', fullBackground);

        // 1:1 EXACT "Minimalist Sky" linear gradient from latest Step 3759 reference image
        document.body.style.backgroundColor = '#f0f9ff';
        document.body.style.backgroundImage = fullBackground;
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundSize = 'cover';
        document.body.style.color = '#1e293b';
        document.documentElement.style.setProperty('transition', 'background 0.5s ease-in-out');

        return () => {
            document.documentElement.style.removeProperty('--investor-bg');
            document.documentElement.style.removeProperty('transition');
            document.body.style.backgroundColor = '';
            document.body.style.backgroundImage = '';
            document.body.style.backgroundAttachment = '';
            document.body.style.backgroundSize = '';
            document.body.style.color = '';
        };
    }, []);

    return (
        <div className="dashboard-container investor-theme pt-4">
            <Header
                activeModule={activeModule}
                setActiveModule={setActiveModule}
                onToggleMode={onToggleMode}
            />
            <SharedTickerTape variant="investor" />
            <main className="content fade-in transition-all duration-300">
                <InvestorView activeModule={activeModule} setActiveModule={setActiveModule} />
            </main>
        </div>
    );
};

export default InvestorMode;

const MarketMoodGauge = () => {
    const [score, setScore] = useState(50);
    const [error, setError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let timer;

        const load = async () => {
            try {
                setIsLoading(true);
                setError(false);
                const res = await fetchMarketMood();
                if (res) {
                    const liveScore = Number(res.score ?? res.value);
                    setScore(Number.isFinite(liveScore) ? liveScore : 50);
                }
            } catch (e) {
                console.error("Failed to load Market Mood:", e);
                setError(true);
            } finally {
                setIsLoading(false);
            }
        }

        load();
        timer = setInterval(load, 60000);

        return () => clearInterval(timer);
    }, []);

    const needleRotation = (score / 100) * 180 - 90;

    return (
        <div className="investor-card p-6 h-full flex flex-col justify-between relative overflow-hidden group">
            {/* Background blur */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -z-10 group-hover:bg-blue-500/10 transition-all duration-500"></div>

            {isLoading && (
                <div className="absolute inset-0 bg-white/5 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 bg-white/5 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-4">
                    <span className="text-xl mb-2">📡</span>
                    <span className="text-xs font-bold text-rose-600">Mood Sensor Offline</span>
                    <button onClick={() => window.location.reload()} className="mt-3 text-[10px] bg-white/5 border border-current px-4 py-1.5 rounded-lg text-rose-600 font-black hover:bg-rose-50 hover:border-rose-300 shadow-sm transition-all uppercase tracking-wider">RETRY</button>
                </div>
            )}

            <div className="card-header flex justify-between items-start mb-2">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Market Mood</h3>
                    <p className="text-xs text-slate-500 font-medium">Sentiment Index</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-bold ${score > 75 ? 'bg-green-100 text-green-700' : score < 25 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {score > 75 ? 'Greed' : score < 25 ? 'Fear' : 'Neutral'}
                </div>
            </div>

            <div className="gauge-chart-wrapper relative flex flex-col items-center justify-end h-32 mt-2">
                {/* Gauge SVG */}
                <svg viewBox="0 0 200 110" className="w-full h-full">
                    {/* Gradient and Filter Definitions */}
                    <defs>
                        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ef4444" /> {/* Red for Fear */}
                            <stop offset="50%" stopColor="#eab308" /> {/* Yellow for Neutral */}
                            <stop offset="100%" stopColor="#22c55e" /> {/* Green for Greed */}
                        </linearGradient>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>

                    {/* Background Arc */}
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#f1f5f9" strokeWidth="20" strokeLinecap="round" />

                    {/* Foreground Arc (Gradient) */}
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGradient)" strokeWidth="20" strokeLinecap="round" strokeDasharray="251.2" strokeDashoffset="0" filter="url(#glow)" />

                    {/* Ticks */}
                    {[0, 25, 50, 75, 100].map((tick, i) => {
                        const angle = (tick / 100) * 180 - 180;
                        const rad = (angle * Math.PI) / 180;
                        const x1 = 100 + 70 * Math.cos(rad);
                        const y1 = 100 + 70 * Math.sin(rad);
                        const x2 = 100 + 60 * Math.cos(rad);
                        const y2 = 100 + 60 * Math.sin(rad);
                        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="2" strokeOpacity="0.8" />;
                    })}
                </svg>

                {/* Needle */}
                <div
                    className="absolute bottom-2 left-1/2 w-1 h-24 bg-slate-800 origin-bottom rounded-full transition-transform duration-1000 ease-out z-10"
                    style={{ transform: `translateX(-50%) rotate(${needleRotation}deg)` }}
                >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 rounded-full"></div>
                </div>

                {/* Needle Base */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-8 h-8 bg-slate-800 rounded-full border-4 border-white shadow-lg z-20"></div>

                {/* Score Display */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center z-0">
                    <span className="text-3xl font-black text-slate-800 tracking-tighter">{score}</span>
                    <span className="text-xs text-slate-400 block -mt-1">Score</span>
                </div>
            </div>

            <div className="flex justify-between text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1 px-4">
                <span>Ext. Fear</span>
                <span>Neutral</span>
                <span>Ext. Greed</span>
            </div>
        </div>

    );
};

const ValuationThermometer = () => {
    const [valData, setValData] = useState({ pe: 0, pb: 0, avgPe: 0, avgPb: 0 });
    const [error, setError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let timer;

        const load = async () => {
            try {
                setIsLoading(true);
                setError(false);
                const res = await fetchValuation();
                if (res) {
                    setValData({
                        pe: Number(res.peRatio) || 0,
                        pb: Number(res.pbRatio) || 0,
                        avgPe: Number(res.avgPe) || 0,
                        avgPb: Number(res.avgPb) || 0,
                    });
                }
            } catch (e) {
                console.error("Failed to load valuations:", e);
                setError(true);
            } finally {
                setIsLoading(false);
            }
        }

        load();
        timer = setInterval(load, 120000);

        return () => clearInterval(timer);
    }, []);
    const getPos = (val, avg) => {
        if (!val || !avg) return '50%';
        const ratio = val / avg;
        let pos = (ratio - 0.5) * 80 + 10;
        return `${Math.min(95, Math.max(5, pos))}%`;
    };

    return (
        <div className="investor-card p-6 h-full flex flex-col relative overflow-hidden">
            {isLoading && (
                <div className="absolute inset-0 bg-white/5 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 bg-white/5 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-4">
                    <span className="text-xl mb-2">📈</span>
                    <span className="text-xs font-bold text-rose-600">Valuation Data Unavailable</span>
                </div>
            )}
            <div className="card-header flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">Valuation Check</h3>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider">{VALUATION_BENCHMARK_BY_REGION[DEFAULT_REGION] || VALUATION_BENCHMARK_BY_REGION.IN}</span>
            </div>

            <div className="space-y-8 flex-1">
                {/* P/E Ratio */}
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 block tracking-wider">P/E RATIO</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-slate-800">{(valData.pe || 0).toFixed(1)}</span>
                                <span className="text-[10px] text-slate-400 font-medium">({valData.pe > valData.avgPe ? 'Elevated' : 'Discount'})</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">Avg: {valData.avgPe}</span>
                    </div>
                    <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="absolute inset-0 w-full h-full flex">
                            <div className="w-[35%] bg-blue-400/80"></div>
                            <div className="w-[40%] bg-amber-400/80"></div>
                            <div className="w-[25%] bg-rose-400/80"></div>
                        </div>
                        <div className="absolute top-0 bottom-0 w-1.5 bg-slate-900 z-10 rounded-full ring-2 ring-white" style={{ left: getPos(valData.pe, valData.avgPe) }}></div>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold mt-2 px-0.5">
                        <span className="text-blue-600">Cheap</span>
                        <span className="text-amber-600">Fair</span>
                        <span className="text-rose-600">Exp.</span>
                    </div>
                </div>

                {/* P/B Ratio */}
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 block tracking-wider">P/B RATIO</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-slate-800">{(valData.pb || 0).toFixed(1)}</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">Avg: {valData.avgPb}</span>
                    </div>
                    <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-400 via-amber-400 to-rose-500 opacity-80"></div>
                        <div className="absolute top-0 bottom-0 w-1.5 bg-slate-900 z-10 rounded-full ring-2 ring-white" style={{ left: getPos(valData.pb, valData.avgPb) }}></div>
                    </div>
                </div>
            </div>
        </div>
    )
};

const GlobalPulse = () => {
    const [pulse, setPulse] = useState([]);
    const [error, setError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let timer;

        const load = async () => {
            try {
                setIsLoading(true);
                setError(false);
                const res = await fetchMarketData({ limit: 9 });
                if (res && res.length > 0) {
                    const unique = [];
                    const seen = new Set();
                    for (const row of res) {
                        const key = String(row.symbol || row.name || '').toUpperCase();
                        if (!key || seen.has(key)) {
                            continue;
                        }
                        seen.add(key);
                        unique.push(row);
                        if (unique.length >= 9) {
                            break;
                        }
                    }

                    const mapped = unique.map(i => ({
                        name: i.symbol || i.name || 'ASSET',
                        type: i.type,
                        val: Number.isFinite(Number(i.price)) && Number(i.price) > 0 ? formatPrice(i.price, i.type, i.symbol || i.name) : '--',
                        change: Number.isFinite(Number(i.change_24h ?? i.change))
                            ? `${Number(i.change_24h ?? i.change) >= 0 ? '▲' : '▼'} ${Math.abs(Number(i.change_24h ?? i.change)).toFixed(2)}%`
                            : '--',
                        changeDirection: Number.isFinite(Number(i.change_24h ?? i.change))
                            ? (Number(i.change_24h ?? i.change) >= 0 ? 'up' : 'down')
                            : 'flat',
                        code: inferRegionCode(i),
                    }));
                    setPulse(mapped);
                } else {
                    setPulse([]);
                }
            } catch (e) {
                console.error("Global Pulse fetch failed", e);
                setError(true);
                setPulse([]);
            } finally {
                setIsLoading(false);
            }
        }

        load();
        timer = setInterval(load, 30000);

        return () => clearInterval(timer);
    }, []);

    const { on } = useSocket(['ticker']);

    useEffect(() => {
        on('price_update', (event) => {
            if (!event.symbol) return;
            const eventSym = String(event.symbol).replace(/\.(NS|BO)$/i, '').toUpperCase();

            setPulse(prev => {
                const targetIdx = prev.findIndex(item => item.name.toUpperCase() === eventSym);
                if (targetIdx === -1) return prev;

                const next = [...prev];
                const item = next[targetIdx];
                const price = Number(event.price);
                const change = Number(event.change || item.change.replace(/[^0-9.-]/g, ''));
                const isPositive = change >= 0;

                next[targetIdx] = {
                    ...item,
                    val: formatPrice(price, item.type, item.name),
                    change: `${isPositive ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`,
                    changeDirection: isPositive ? 'up' : 'down',
                };
                return next;
            });
        });
    }, [on]);

    return (
        <div className="investor-card p-6 h-full flex flex-col relative overflow-hidden">
            {isLoading && (
                <div className="absolute inset-0 bg-white/5 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-primary-500 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 bg-white/5 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-4">
                    <span className="text-xl mb-2">🌍</span>
                    <span className="text-xs font-bold text-rose-600">Global Markets Offline</span>
                </div>
            )}
            <div className="card-header mb-6">
                <h3 className="text-lg font-bold text-slate-800">Global Pulse</h3>
            </div>
            <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
                {!isLoading && pulse.length === 0 && !error && (
                    <div className="text-xs text-slate-500 font-medium">No pulse data available from backend.</div>
                )}
                {pulse.map((m, i) => (
                    <div
                        key={i}
                        onClick={() => navigate('/investor-stock/' + encodeURIComponent(m.name.toUpperCase()))}
                        className="flex justify-between items-center group cursor-pointer hover:bg-slate-50/50 p-2 -mx-2 rounded-xl transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-lg border border-slate-100 group-hover:bg-white transition-colors">
                                {countryFlag(m.code)}
                            </div>
                            <div>
                                <div className="font-bold text-sm text-slate-700">{displaySymbol(m.name)}</div>
                                <div className={`text-[10px] font-bold ${m.change.includes('▲') ? 'text-blue-500' : 'text-rose-500'}`}>{m.change}</div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="font-black text-sm text-slate-800 font-mono tracking-tight">{m.val}</div>
                            <svg className="w-12 h-4 opacity-30" viewBox="0 0 60 30">
                                <path
                                    d={m.spark}
                                    fill="none"
                                    stroke={m.change.includes('▲') ? '#3E84F6' : '#ef4444'}
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
};

const DiscoveryShelves = ({ onShelfClick }) => {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let timer;

        const load = async () => {
            try {
                setIsLoading(true);
                setError(false);
                const response = await fetchDiscoveryShelves();

                const buildRow = (title, desc, stocks, icon, filter = {}) => ({
                    title,
                    desc,
                    icon,
                    filter,
                    picks: (stocks || []).slice(0, 4).map((stock, index) => ({
                        id: `${title}-${index}`,
                        sym: stock.symbol || stock.ticker || 'NA',
                    })),
                });

                const liveSymbols = await fetchMarketData({ type: 'STOCK', limit: 12 });
                const momentumBasket = (Array.isArray(liveSymbols) ? liveSymbols : []).slice(0, 8);

                const next = [
                    buildRow('Stock Of The Week', 'Highlighted by current fundamentals', response?.stockOfTheWeek ? [response.stockOfTheWeek] : [], '⭐', { mcap: 'Large' }),
                    buildRow('Dividend Leaders', 'Strong dividend profile', response?.topDividends, '📑', { yield: '> 2%', roe: '> 10%' }),
                    buildRow('Undervalued Gems', 'Lower valuation opportunities', response?.undervaluedGems, '💎', { pe: 'Low (<15)', roe: '> 10%' }),
                    buildRow('Momentum Leaders', 'Top names by current market action', response?.momentumLeaders?.length ? response.momentumLeaders : momentumBasket, '🚀', { change: '> 2%', volume: 'High' }),
                    buildRow('Most Active', 'Frequently traded names right now', momentumBasket, '🔥', { volume: 'Very High' }),
                ].filter((item) => item.picks.length > 0);

                setItems(next);
            } catch (e) {
                console.error('Discovery shelves fetch failed:', e);
                setError(true);
            } finally {
                setIsLoading(false);
            }
        };

        load();
        timer = setInterval(load, 120000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="investor-card p-6 h-full relative overflow-hidden">
            {isLoading && (
                <div className="absolute inset-0 bg-white/5 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 bg-white/5 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-4">
                    <span className="text-xl mb-2">🧭</span>
                    <span className="text-xs font-bold text-rose-600">Discovery feed unavailable</span>
                </div>
            )}

            <div className="card-header mb-6">
                <h3 className="text-lg font-bold text-slate-800">Discovery Shelves</h3>
            </div>

            <div className="space-y-4">
                {items.length === 0 && !isLoading && !error && (
                    <div className="text-xs text-slate-500 font-medium">No discovery ideas available right now.</div>
                )}
                {items.map((item, i) => (
                    <div
                        key={i}
                        onClick={() => onShelfClick && onShelfClick('SCREENERS', item.filter)}
                        className="feature-item group hover:bg-blue-500/10 p-4 rounded-xl cursor-pointer transition-all border border-transparent hover:border-slate-200 hover:shadow-sm"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="feature-icon bg-slate-500/10 group-hover:bg-white/10 p-2 rounded-lg w-12 h-12 flex items-center justify-center text-2xl shadow-sm">{item.icon}</div>
                                <div>
                                    <div className="font-bold text-base text-slate-800 group-hover:text-blue-600 transition-colors">{item.title}</div>
                                    <div className="text-xs text-slate-500">{item.desc}</div>
                                </div>
                            </div>
                            <span className="text-gray-300 group-hover:text-blue-600 transition-colors">›</span>
                        </div>

                        <div className="bg-slate-500/10 rounded-lg p-2.5 flex items-center gap-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Picks</span>
                            <div className="h-4 w-px bg-slate-200"></div>
                            <div className="flex -space-x-2">
                                {item.picks.map((pick) => (
                                    <div key={pick.id} className="w-7 h-7 rounded-full bg-slate-800 text-white border-2 border-white flex items-center justify-center text-[8px] font-bold shadow-sm z-0 hover:z-10 hover:scale-110 transition-transform">
                                        {displaySymbol(pick.sym).substring(0, 1)}
                                    </div>
                                ))}
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium ml-auto">{item.picks.map((pick) => displaySymbol(pick.sym)).join(', ')}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


const SectorLandscape = () => {
    const [timeframe, setTimeframe] = useState('1Y');
    const [viewType, setViewType] = useState('BEST');
    const [data, setData] = useState([]);
    const [error, setError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [reloadToken, setReloadToken] = useState(0);
    const chartTheme = {
        panel: 'from-white via-emerald-50/35 to-white',
        line: '#cbd5e1',
        grid: '#e2e8f0',
        xTick: '#334155',
        yTick: '#64748b',
        posLabel: '#059669',
        negLabel: '#dc2626',
        posGlow: '#86efac',
        negGlow: '#fda4af',
    };

    const formatPercent = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return '0.0%';
        return `${numeric > 0 ? '+' : ''}${numeric.toFixed(1)}%`;
    };

    const mapSectorRows = (rows) => {
        return rows
            .map((row) => {
                const rawReturn = Number(row?.return);
                if (!Number.isFinite(rawReturn)) return null;
                return {
                    name: String(row?.sector || 'Unknown Sector'),
                    index: String(row?.index || 'Broad Market'),
                    realValue: Number(rawReturn.toFixed(2)),
                };
            })
            .filter(Boolean);
    };

    const buildSectorView = (rows) => {
        const normalized = mapSectorRows(rows);
        if (!normalized.length) return [];
        if (viewType === 'BEST') {
            // Show only gainers, sorted highest → lowest
            const gainers = normalized.filter((r) => r.realValue > 0).sort((a, b) => b.realValue - a.realValue);
            return gainers.slice(0, 7);
        } else {
            // Show only losers, sorted worst → least-bad
            const losers = normalized.filter((r) => r.realValue < 0).sort((a, b) => a.realValue - b.realValue);
            return losers.slice(0, 7);
        }
    };

    const SectorValueLabel = ({ x, y, width, height, value }) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return null;

        const labelX = Number(x) + Number(width) / 2;
        const labelY = numeric >= 0 ? Number(y) - 10 : Number(y) + Number(height) + 15;

        return (
            <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                fill={numeric >= 0 ? chartTheme.posLabel : chartTheme.negLabel}
                fontSize={12}
                fontWeight={800}
            >
                {formatPercent(numeric)}
            </text>
        );
    };

    useEffect(() => {
        const load = async () => {
            try {
                setIsLoading(true);
                setError(false);
                const tf = timeframe.toLowerCase();
                const res = await fetchSectorPerformance(tf);
                const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
                setData(buildSectorView(rows));
            } catch (e) {
                console.error("Sector Landscape error:", e);
                setError(true);
                setData([]);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [timeframe, viewType, reloadToken]);

    const yExtent = Math.max(
        1,
        ...data.map((item) => Math.abs(Number(item.realValue) || 0))
    );
    const yPadding = Math.max(1.5, Number((yExtent * 0.18).toFixed(1)));
    const yDomain = [-(Math.ceil(yExtent + yPadding)), Math.ceil(yExtent + yPadding)];
    const breadth = data.reduce((acc, row) => {
        if (row.realValue > 0) acc.gainers += 1;
        if (row.realValue < 0) acc.losers += 1;
        return acc;
    }, { gainers: 0, losers: 0 });
    const averageReturn = data.length
        ? Number((data.reduce((sum, row) => sum + row.realValue, 0) / data.length).toFixed(2))
        : 0;

    return (
        <div className={`investor-card p-6 col-span-2 flex flex-col h-full relative overflow-hidden bg-gradient-to-br ${chartTheme.panel} border border-emerald-100/70`}>
            <div className="pointer-events-none absolute -top-20 -left-20 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl"></div>
            <div className="pointer-events-none absolute -bottom-16 -right-20 h-52 w-52 rounded-full bg-amber-200/20 blur-3xl"></div>
            {isLoading && (
                <div className="absolute inset-0 bg-white/40 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 bg-white/40 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-4">
                    <span className="text-3xl mb-3">📊</span>
                    <span className="text-sm font-bold text-rose-600">Sector Performance Unavailable</span>
                    <button onClick={() => setTimeframe(timeframe)} className="mt-4 text-xs bg-white/60 border border-current px-4 py-2 rounded-lg text-rose-600 font-bold hover:bg-rose-50 transition-colors uppercase tracking-wider">Reload Sectors</button>
                </div>
            )}
            <div className="card-header relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h3 className="text-lg font-black tracking-wide text-slate-800">Sector Landscape</h3>
                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5 uppercase tracking-[0.12em]">Relative performance by sector index</p>
                    </div>

                    <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1 shadow-sm">
                        <button
                            onClick={() => setViewType('BEST')}
                            className={`px-2.5 py-1.5 rounded-lg transition-all text-xs font-bold tracking-wide ${viewType === 'BEST' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Best Performing"
                        >
                            <span className="inline-flex items-center gap-1"><TrendingUp size={14} /> Best</span>
                        </button>
                        <button
                            onClick={() => setViewType('WORST')}
                            className={`px-2.5 py-1.5 rounded-lg transition-all text-xs font-bold tracking-wide ${viewType === 'WORST' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Worst Performing"
                        >
                            <span className="inline-flex items-center gap-1"><TrendingDown size={14} /> Worst</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {['1D', '1W', '1M', '3M', '6M', '1Y'].map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-bold ${timeframe === tf ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white/10 border border-slate-200/50 text-slate-600 hover:bg-slate-500/10'}`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative z-10 mb-3 flex flex-wrap gap-2">
                <span className="text-[11px] font-black text-emerald-700 bg-emerald-500/10 border border-emerald-200 px-2.5 py-1 rounded-full">Avg {timeframe}: {formatPercent(averageReturn)}</span>
                <span className="text-[11px] font-black text-slate-700 bg-slate-500/10 border border-slate-200 px-2.5 py-1 rounded-full">Gainers: {breadth.gainers}</span>
                <span className="text-[11px] font-black text-rose-700 bg-rose-500/10 border border-rose-200 px-2.5 py-1 rounded-full">Losers: {breadth.losers}</span>
            </div>

            <div className="relative z-10 w-full mt-2 flex-1 min-h-[340px]">
                {!isLoading && !error && data.length === 0 ? (
                    <div className="h-full w-full rounded-xl border border-slate-200 bg-white/10 flex items-center justify-center text-center px-6">
                        <div>
                            <p className="text-2xl mb-2">{viewType === 'BEST' ? '📈' : '📉'}</p>
                            <p className="text-sm font-bold text-slate-700">
                                {viewType === 'BEST' ? 'No gaining sectors today' : 'No losing sectors today'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                Switch to <strong>{viewType === 'BEST' ? 'Worst' : 'Best'}</strong> to see {viewType === 'BEST' ? 'underperformers' : 'outperformers'}.
                            </p>
                        </div>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 24, right: 18, left: 8, bottom: 20 }} barCategoryGap="14%">
                            <defs>
                                <linearGradient id="sectorBestGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.95} />
                                    <stop offset="100%" stopColor="#34D399" stopOpacity={0.88} />
                                </linearGradient>
                                <linearGradient id="sectorWorstGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.95} />
                                    <stop offset="100%" stopColor="#FB7185" stopOpacity={0.9} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                            <ReferenceLine y={0} stroke={chartTheme.line} strokeWidth={1.25} />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: chartTheme.xTick, fontSize: 12, fontWeight: 700 }}
                            />
                            <YAxis
                                domain={yDomain}
                                allowDataOverflow={false}
                                axisLine={false}
                                tickLine={false}
                                width={36}
                                tick={{ fill: chartTheme.yTick, fontSize: 11, fontWeight: 700 }}
                                tickFormatter={(value) => `${value}%`}
                            />
                            <Tooltip
                                cursor={false}
                                contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 12px 30px -20px rgba(15,23,42,0.55)', background: '#FFFFFF' }}
                                itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                                labelStyle={{ color: '#475569', fontWeight: 700 }}
                                formatter={(_value, _name, props) => [formatPercent(props.payload.realValue), `${props.payload.name} (${props.payload.index})`]}
                                labelFormatter={() => `${timeframe} performance`}
                            />
                            <Bar
                                dataKey="realValue"
                                radius={[4, 4, 4, 4]}
                                maxBarSize={72}
                            >
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.realValue >= 0
                                            ? 'url(#sectorBestGradient)'
                                            : 'url(#sectorWorstGradient)'}
                                        style={{ filter: `drop-shadow(0 0 8px ${entry.realValue >= 0 ? chartTheme.posGlow : chartTheme.negGlow})` }}
                                    />
                                ))}
                                <LabelList
                                    dataKey="realValue"
                                    content={(props) => <SectorValueLabel {...props} />}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            <div className="relative z-10 mt-3 text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 pt-3">
                <span className="font-bold text-slate-700">Mapped Sector Indices:</span>
                {data.slice(0, 4).map((item) => (
                    <span key={item.name}>{item.name}: <span className="font-bold text-slate-700">{item.index}</span></span>
                ))}
            </div>
        </div>
    );
};

const EconomicCalendar = () => {
    const [events, setEvents] = useState([]);
    const [error, setError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let timer;

        const load = async () => {
            try {
                setIsLoading(true);
                setError(false);
                const res = await fetchEconomicCalendar();
                if (res && res.length > 0) {
                    // No slice — show ALL events, the card itself scrolls
                    setEvents(
                        res.map((event, index) => ({
                            id: event.id || index + 1,
                            time: event.time || event.date || '-',
                            country: event.country || 'US',
                            event: event.event || event.title || 'Economic Event',
                            impact: event.impact || 'Medium',
                            actual: event.actual || '-',
                            forecast: event.forecast || event.previous || '-',
                        }))
                    );
                } else {
                    setEvents([]);
                }
            } catch (e) {
                console.error("Eco Calendar fetch error:", e);
                setError(true);
                setEvents([]);
            } finally {
                setIsLoading(false);
            }
        }

        load();
        timer = setInterval(load, 300000);
        return () => clearInterval(timer);
    }, []);

    const impactTone = (impact) => {
        const value = String(impact || '').toLowerCase();
        if (value === 'high') return 'text-rose-600 bg-rose-50 border-rose-100';
        if (value === 'medium') return 'text-amber-600 bg-amber-50 border-amber-100';
        return 'text-blue-600 bg-blue-50 border-blue-100';
    };

    const eventCountryFlag = (code) => {
        const upper = String(code || '').toUpperCase();
        if (upper === 'US') return '🇺🇸';
        if (upper === 'UK' || upper === 'GB') return '🇬🇧';
        if (upper === 'EU') return '🇪🇺';
        if (upper === 'JP') return '🇯🇵';
        return '🇮🇳';
    };

    return (
        <div className="investor-card p-4 h-full flex flex-col relative overflow-hidden">
            {isLoading && (
                <div className="absolute inset-0 bg-white/5 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 bg-white/5 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-4">
                    <span className="text-xl mb-2">📅</span>
                    <span className="text-xs font-bold text-rose-600">Calendar Error</span>
                </div>
            )}
            <div className="card-header mb-3 flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Economic Calendar</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Macro Pulse · High-impact events watchlist</p>
                </div>
                <div className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-1">{events.length} events</div>
            </div>
            {/* Scrollable list — fixed height so the card doesn't expand infinitely */}
            <div
                className="space-y-2 flex-1 pr-1"
                style={{ overflowY: 'auto', maxHeight: '340px', scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
            >
                {events.length === 0 && !isLoading && (
                    <div className="text-xs text-slate-400 text-center py-6">No upcoming events found.</div>
                )}
                {events.map((e) => (
                    <div key={e.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-500/10 border border-slate-100 hover:border-blue-200 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/10 border border-slate-200 flex items-center justify-center text-sm font-bold" title={e.country}>
                                {eventCountryFlag(e.country)}
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-800 line-clamp-1">{e.event}</div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                    <span>{e.time}</span>
                                    <span className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider ${impactTone(e.impact)}`}>{e.impact}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-black text-slate-800">{e.actual || '-'}</div>
                            <div className="text-[10px] text-slate-400">Est: {e.forecast || '-'}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Sector-specific icons for Trending Themes
const SECTOR_ICONS = {
    'Information Technology': '💻',
    'Technology':             '💻',
    'Financial Services':     '🏦',
    'Banking':                '🏦',
    'Healthcare':             '💊',
    'Pharmaceuticals':        '💊',
    'Energy':                 '⚡',
    'Oil & Gas':              '🛢️',
    'Industrials':            '🏭',
    'Consumer Cyclical':      '🚗',
    'Automobiles':            '🚗',
    'Consumer Defensive':     '🛒',
    'FMCG':                   '🛒',
    'Communication Services': '📡',
    'Telecom':                '📡',
    'Basic Materials':        '⛏️',
    'Metals':                 '⛏️',
    'Utilities':              '🔌',
    'Infrastructure':         '🏗️',
    'Real Estate':            '🏘️',
};

const FALLBACK_THEME_ROWS = {
    rising: [
        { name: 'Energy',              value: 2.6,  trend: '+2.6% wk', icon: '⚡' },
        { name: 'Consumer Defensive',  value: 2.2,  trend: '+2.2% wk', icon: '🛒' },
        { name: 'Healthcare',          value: 1.5,  trend: '+1.5% wk', icon: '💊' },
    ],
    falling: [
        { name: 'Information Technology', value: -3.1, trend: '-3.1% wk', icon: '💻' },
        { name: 'Consumer Cyclical',      value: -2.4, trend: '-2.4% wk', icon: '🚗' },
        { name: 'Basic Materials',        value: -1.0, trend: '-1.0% wk', icon: '⛏️' },
    ],
};

const TrendingThemes = () => {
    const [risingThemes, setRisingThemes]   = useState([]);
    const [fallingThemes, setFallingThemes] = useState([]);
    const [isLoading, setIsLoading]         = useState(true);

    useEffect(() => {
        let timer;

        const load = async () => {
            try {
                setIsLoading(true);
                // Same backend source as Sector Landscape — just hardcoded to 1W
                const response = await fetchSectorPerformance('1w');
                const rows = Array.isArray(response?.data) ? response.data
                           : Array.isArray(response)       ? response
                           : [];

                const normalized = rows
                    .map((s) => ({
                        name:  s.sector,
                        index: s.index || '',
                        value: Number(s.return) || 0,
                    }))
                    .filter((s) => s.name && s.name !== 'Unknown');

                const rising = normalized
                    .filter((s) => s.value > 0)
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 3)
                    .map((s) => ({
                        ...s,
                        trend: `+${s.value.toFixed(1)}% wk`,
                        icon:  SECTOR_ICONS[s.name] || '📊',
                    }));

                const falling = normalized
                    .filter((s) => s.value < 0)
                    .sort((a, b) => a.value - b.value)
                    .slice(0, 3)
                    .map((s) => ({
                        ...s,
                        trend: `${s.value.toFixed(1)}% wk`,
                        icon:  SECTOR_ICONS[s.name] || '📊',
                    }));

                setRisingThemes(rising.length   ? rising   : FALLBACK_THEME_ROWS.rising);
                setFallingThemes(falling.length ? falling  : FALLBACK_THEME_ROWS.falling);
            } catch (error) {
                console.error('Trending themes fetch failed:', error);
                setRisingThemes(FALLBACK_THEME_ROWS.rising);
                setFallingThemes(FALLBACK_THEME_ROWS.falling);
            } finally {
                setIsLoading(false);
            }
        };

        load();
        timer = setInterval(load, 15 * 60 * 1000); // refresh every 15 min (matches backend cache TTL)
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="investor-card p-4 h-full flex flex-col">
            <div className="card-header mb-3 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Trending Themes</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Sector momentum · This week vs last week</p>
                </div>
                <TrendingUp size={16} className="text-blue-500" />
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                /* No overflow-y-auto — card is fixed size, content fits naturally */
                <div className="space-y-3 flex-1">
                    {/* Rising */}
                    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <TrendingUp size={14} className="text-emerald-600" />
                                <span className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">Rising Themes</span>
                            </div>
                            <span className="text-[10px] text-emerald-600 font-bold">Top Gainers</span>
                        </div>
                        <div className="space-y-1.5">
                            {risingThemes.length === 0
                                ? <div className="text-xs text-slate-400 py-1">No gaining sectors this week.</div>
                                : risingThemes.map((theme, i) => (
                                    <div key={`${theme.name}-${i}`} className="group relative flex items-center justify-between rounded-lg px-2 py-1.5 pl-3 hover:bg-white/70 transition-colors">
                                        <span className="absolute left-0 top-1/2 h-0 w-1 -translate-y-1/2 rounded-full bg-emerald-500 opacity-0 transition-all duration-200 group-hover:h-4 group-hover:opacity-100" />
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-base">{theme.icon}</span>
                                            <div>
                                                <div className="text-xs font-bold text-slate-700 leading-tight">{theme.name}</div>
                                                {theme.index && <div className="text-[9px] text-slate-400 font-medium">{theme.index}</div>}
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-black text-emerald-600">{theme.trend}</span>
                                    </div>
                                ))
                            }
                        </div>
                    </div>

                    {/* Falling */}
                    <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-white p-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <TrendingDown size={14} className="text-rose-600" />
                                <span className="text-[11px] font-black text-rose-700 uppercase tracking-wider">Falling Themes</span>
                            </div>
                            <span className="text-[10px] text-rose-600 font-bold">Top Decliners</span>
                        </div>
                        <div className="space-y-1.5">
                            {fallingThemes.length === 0
                                ? <div className="text-xs text-slate-400 py-1">No declining sectors this week.</div>
                                : fallingThemes.map((theme, i) => (
                                    <div key={`${theme.name}-${i}`} className="group relative flex items-center justify-between rounded-lg px-2 py-1.5 pl-3 hover:bg-white/70 transition-colors">
                                        <span className="absolute left-0 top-1/2 h-0 w-1 -translate-y-1/2 rounded-full bg-rose-500 opacity-0 transition-all duration-200 group-hover:h-4 group-hover:opacity-100" />
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-base">{theme.icon}</span>
                                            <div>
                                                <div className="text-xs font-bold text-slate-700 leading-tight">{theme.name}</div>
                                                {theme.index && <div className="text-[9px] text-slate-400 font-medium">{theme.index}</div>}
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-black text-rose-600">{theme.trend}</span>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// News Tab has been extracted to InvestorNewsDashboard component

// News Tab logic has been moved to src/components/investor/InvestorNewsDashboard.jsx


// Helper components for the dashboard

const BreakingNewsTicker = () => {
    const headlines = [
        "Nifty 50 approaches record highs on positive global cues",
        "RBI expected to maintain status quo in upcoming policy meet",
        "IT sector stocks witness surge following strong Q3 earnings",
        "Global markets react to latest US inflation data release",
    ];

    return (
        <div className="px-6 lg:px-10 mt-4 mb-2">
            <div className="ticker-banner py-2.5 overflow-hidden sticky top-[calc(0.75rem+72px)] z-[90] shadow-sm flex items-center gap-4 px-6">
                <div className="flex items-center gap-1.5 shrink-0 bg-rose-50 px-2.5 py-1 rounded-md text-rose-600 font-black text-[10px] uppercase tracking-wider animate-pulse">
                    <Zap size={12} fill="currentColor" />
                    <span>Breaking</span>
                </div>
                <div className="ticker-wrapper relative flex-1">
                    <div className="ticker-scroll flex items-center gap-12 whitespace-nowrap animate-ticker">
                        {headlines.map((text, i) => (
                            <span key={i} className="text-[11px] font-bold text-slate-700 hover:text-blue-600 cursor-pointer transition-colors">
                                {text}
                            </span>
                        ))}
                        {headlines.map((text, i) => (
                            <span key={`dup-${i}`} className="text-[11px] font-bold text-slate-700 hover:text-blue-600 cursor-pointer transition-colors">
                                {text}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const NewsTypeFilters = ({ selected, onToggle }) => {
    const categories = ["Earnings", "Deals", "Policy", "Macro", "IPO"];
    const isAllSelected = selected.length === 0;

    return (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
                onClick={() => onToggle("All")}
                className={`px-4 py-1.5 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${isAllSelected
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                        : "bg-white text-slate-500 hover:bg-blue-50 hover:text-blue-600 border border-slate-100"
                    }`}
            >
                All
            </button>
            {categories.map((cat) => (
                <button
                    key={cat}
                    onClick={() => onToggle(cat)}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-black transition-all whitespace-nowrap flex items-center gap-1.5 ${selected.includes(cat)
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                            : "bg-white text-slate-500 hover:bg-blue-50 hover:text-blue-600 border border-slate-100"
                        }`}
                >
                    {cat}
                    {selected.includes(cat) && <CheckCircle size={10} />}
                </button>
            ))}
        </div>
    );
};

const AssetClassToggle = ({ active, onChange }) => {
    return (
        <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200 self-start">
            {["Stocks", "Crypto"].map((asset) => (
                <button
                    key={asset}
                    onClick={() => onChange(asset)}
                    className={`px-5 py-1.5 rounded-full text-[11px] font-black transition-all ${active === asset
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                >
                    {asset}
                </button>
            ))}
        </div>
    );
};

const RegionFilter = ({ active, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-700 hover:border-blue-300 transition-all shadow-sm min-w-[120px]"
            >
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                <span>{active} News</span>
                <ChevronDown size={14} className={`ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-100 rounded-xl shadow-2xl z-[9999] overflow-hidden py-1 transform-gpu">
                    {["India", "Global"].map((reg) => (
                        <button
                            key={reg}
                            onClick={() => {
                                onChange(reg);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-[11px] font-bold transition-colors ${active === reg ? "text-blue-600 bg-blue-50/50" : "text-slate-600 hover:bg-slate-50"
                                }`}
                        >
                            {reg}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};


const NewsCard = ({ item, isInitiallyExpanded = false }) => {
    const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);
    const impact = item.impact || "Neutral";
    const importance = item.importance || "Normal";
    const sectors = item.sectors || item.affectedSectors || [];
    const tags = item.tags || [];

    return (
        <div className={`news-intelligence-card transition-all duration-300 overflow-hidden group ${isExpanded ? 'ring-2 ring-blue-500/20 shadow-xl !bg-white' : 'hover:border-slate-300'}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4">
                <div className="flex-1 space-y-3">
                    {/* 1. Meta & Top Labels */}
                    <div className="flex items-center gap-2 text-[10px] font-bold">
                        <a
                            href={item.url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 hover:text-blue-600 flex items-center gap-1 transition-colors"
                        >
                            <span>{item.source || 'Reuters'}</span>
                            <ExternalLink size={9} className="stroke-[3]" />
                        </a>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-400 font-medium uppercase tracking-wider">{item.time || 'Just now'}</span>
                        {(importance === "High" || item.strategy === "AI Generated") && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase ring-1 ring-blue-100 shadow-sm ml-2">
                                <Zap size={10} className="fill-blue-500" />
                                <span>AI Analyzed</span>
                            </div>
                        )}
                    </div>

                    {/* 2. Headline */}
                    <a
                        href={item.url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group-hover:translate-x-0.5 transition-transform"
                    >
                        <h3 className="text-[18px] font-black headline-text leading-[1.3] pr-4 hover:text-blue-600 transition-colors cursor-pointer">
                            {item.title}
                        </h3>
                    </a>

                    {/* 3. Smart Tags: Sector | Impact | Type */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* High-Fidelity Sector Impact Tags */}
                        {sectors.slice(0, 3).map((sector, idx) => {
                            const name = typeof sector === 'string' ? sector : sector.name;
                            const sImpact = typeof sector === 'string' ? "Neutral" : (sector.impact || "Neutral");
                            const isUp = sImpact === "Positive";
                            const isDown = sImpact === "Negative";

                            return (
                                <div key={idx} className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all shadow-sm ${isUp ? "bg-green-600 text-white" :
                                        isDown ? "bg-red-600 text-white" :
                                            "bg-slate-700 text-white"
                                    }`}>
                                    <span>{name}</span>
                                    <span className="text-[11px] leading-none mb-0.5 font-normal">
                                        {isUp ? "↑" : isDown ? "↓" : "→"}
                                    </span>
                                </div>
                            );
                        })}

                        {/* Sentiment Tag */}
                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border ${impact === "Positive" ? "bg-green-50 text-green-700 border-green-100" :
                                impact === "Negative" ? "bg-red-50 text-red-700 border-red-100" :
                                    "bg-slate-100 text-slate-600 border-slate-200"
                            }`}>
                            {impact}
                        </span>

                        {/* Type Tag */}
                        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                            {item.category || "General"}
                        </span>

                        {/* Watchlist Symbol Tag — shown only in watchlist mode */}
                        {item.affectedSymbol && (
                            <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                <Star size={9} className="fill-amber-500 text-amber-500" />
                                {item.affectedSymbol}
                            </span>
                        )}

                        {/* Stock Snippets if available */}
                        {(item.affectedStocks || []).length > 0 && <div className="h-3 w-[1px] bg-slate-200 mx-1"></div>}
                        <div className="flex items-center gap-2.5">
                            {(item.affectedStocks || []).slice(0, 3).map((stock, idx) => (
                                <div key={idx} className="flex items-center gap-1 text-[10px] font-bold">
                                    <span className="text-slate-500">{stock.symbol}</span>
                                    <span className={stock.up ? "text-green-600" : "text-rose-600"}>
                                        {stock.up ? "↑" : "↓"}{stock.change}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Insight Toggle Button */}
                <div className="flex-shrink-0 md:pl-6 md:border-l border-slate-100">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-black tracking-tight transition-all ${isExpanded
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                : "text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-600 hover:text-white"
                            }`}
                    >
                        <span>{isExpanded ? "Hide Insight" : "View Insight"}</span>
                        <ChevronUp size={16} className={`transition-transform duration-300 ${isExpanded ? "" : "rotate-180"}`} />
                    </button>
                </div>
            </div>


            {isExpanded && (
                <div className="bg-white border-t border-slate-100 p-6 space-y-6 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {/* Left Column: Instant Summaries */}
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></div>
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">WHAT HAPPENED</span>
                                </div>
                                <p className="text-[16px] text-slate-800 font-medium leading-relaxed pl-5 tracking-tight">
                                    {item.whatHappened || "Processing core event details..."}
                                </p>
                            </div>

                            <div>
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></div>
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">WHY IT MATTERS</span>
                                </div>
                                <p className="text-[15px] text-slate-700 font-medium leading-relaxed pl-5 tracking-tight">
                                    {item.whyItMatters || "Strategic implications for current portfolio positions."}
                                </p>
                            </div>

                            {/* Sector Impact Tags */}
                            {sectors.length > 0 && (
                                <div className="pt-2 pl-5">
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-4">AFFECTED SECTORS</span>
                                    <div className="flex flex-wrap gap-2.5">
                                        {sectors.map((sector, idx) => {
                                            const name = typeof sector === 'string' ? sector : sector.name;
                                            const sImpact = typeof sector === 'string' ? "Neutral" : (sector.impact || "Neutral");
                                            const isUp = sImpact === "Positive";
                                            const isDown = sImpact === "Negative";

                                            return (
                                                <div key={idx} className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-[11px] font-black transition-all shadow-sm ${isUp ? "bg-green-600 text-white" :
                                                        isDown ? "bg-red-600 text-white" :
                                                            "bg-slate-700 text-white"
                                                    }`}>
                                                    <span>{name}</span>
                                                    <span className="text-[15px] leading-none mb-0.5 font-normal">
                                                        {isUp ? "↑" : isDown ? "↓" : "→"}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column: Market Impact Conclusion */}
                        <div className="flex items-end md:justify-end">
                            <div className={`p-6 rounded-3xl border flex gap-6 items-center w-full max-w-[420px] shadow-sm ${impact === "Positive" ? "bg-green-50/40 border-green-100" :
                                    impact === "Negative" ? "bg-red-50/40 border-red-100" :
                                        "bg-blue-50/40 border-blue-100"
                                }`}>
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${impact === "Positive" ? "bg-green-100 text-green-700" :
                                        impact === "Negative" ? "bg-red-100 text-red-700" :
                                            "bg-blue-100 text-blue-700"
                                    }`}>
                                    {impact === "Positive" ? <TrendingUp size={28} /> : impact === "Negative" ? <TrendingDown size={28} /> : <Activity size={28} />}
                                </div>
                                <div className="space-y-1.5">
                                    <span className={`text-[11px] font-black uppercase tracking-[0.25em] block ${impact === "Positive" ? "text-green-700" :
                                            impact === "Negative" ? "text-red-700" :
                                                "text-blue-700"
                                        }`}>MARKET IMPACT</span>
                                    <p className="text-[14px] text-slate-800 font-bold leading-tight">
                                        {impact === "Positive" ? `Positive driver for ${sectors.map(s => s.name || s).join(', ')} growth expectations.` :
                                            impact === "Negative" ? `Direct pressure detected for rate-sensitive sectors like ${sectors.map(s => s.name || s).join(', ')}.` :
                                                "Neutral consolidation expected with low direct volatility."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Checkpoints footer */}
                    {item.whatToWatch && item.whatToWatch.length > 0 && (
                        <div className="pt-5 border-t border-slate-50 flex items-center gap-5">
                            <span className="text-[11px] font-black text-indigo-500 uppercase tracking-widest whitespace-nowrap">CHECKPOINTS:</span>
                            <div className="text-[12px] font-bold text-slate-500 bg-slate-50 px-4 py-1.5 rounded-full">
                                {item.whatToWatch[0]}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


const InvestorNewsFeed = () => {
    const [region, setRegion] = useState("India");
    // Cache keyed by region so India and Global news don't overwrite each other
    const [rawNews, setRawNews] = useState(() => {
        const cached = localStorage.getItem('radar_investor_news_v2_india_stocks');
        return cached ? JSON.parse(cached) : [];
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [assetClass, setAssetClass] = useState("Stocks");
    const [isWatchlistOnly, setIsWatchlistOnly] = useState(false);

    // Cache key per region+assetClass — v2 busts old uncategorised cache entries
    const cacheKey = `radar_investor_news_v2_${region.toLowerCase()}_${assetClass.toLowerCase()}`;

    // Toggle multi-select category logic
    const toggleCategory = (cat) => {
        if (cat === "All") {
            setSelectedCategories([]);
            return;
        }

        setSelectedCategories(prev =>
            prev.includes(cat)
                ? prev.filter(c => c !== cat)
                : [...prev, cat]
        );
    };

    // Advanced Dynamic Filtering with Sorting
    const displayNews = useMemo(() => {
        let filtered = [...rawNews];

        // 1. Filter by categories (OR logic as requested)
        if (selectedCategories.length > 0) {
            filtered = filtered.filter(item =>
                selectedCategories.some(cat =>
                    item.category?.toLowerCase() === cat.toLowerCase()
                )
            );
        }

        // 2. Maintain strict chronological sorting (Latest First)
        return filtered.sort((a, b) => {
            const timeA = new Date(a.publishedAt || a.time || 0).getTime();
            const timeB = new Date(b.publishedAt || b.time || 0).getTime();
            return timeB - timeA;
        });
    }, [rawNews, selectedCategories]);

    const hasNoRecentUpdates = useMemo(() => {
        return displayNews.length > 0 && !displayNews.some(item => item.isToday);
    }, [displayNews]);

    const loadNews = async () => {
        try {
            setIsLoading(true);
            setError(null);

            let data;

            if (isWatchlistOnly) {
                // --- WATCHLIST MODE: fetch per-symbol news and merge ---
                const symbols = await fetchUserWatchlist();

                if (!symbols.length) {
                    // Empty watchlist — show friendly empty state
                    setRawNews([]);
                    setError("Your watchlist is empty. Add stocks to see watchlist-specific news.");
                    data = [];
                } else {
                    // Fire parallel requests for each symbol (cap at 5 to avoid rate limits)
                    const top5 = symbols.slice(0, 5);
                    const results = await Promise.allSettled(
                        top5.map(sym =>
                            fetchMarketNews({ symbol: sym, limit: 4 })
                        )
                    );

                    // Merge all articles, tag with symbol, deduplicate by title
                    const seen = new Set();
                    const merged = [];
                    results.forEach((res, idx) => {
                        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
                            res.value.forEach(article => {
                                const key = article.title?.toLowerCase().trim();
                                if (key && !seen.has(key)) {
                                    seen.add(key);
                                    merged.push({
                                        ...article,
                                        isToday: true,
                                        affectedSymbol: top5[idx],
                                    });
                                }
                            });
                        }
                    });
                    data = merged;
                }
            } else {
                // --- NORMAL MODE: fetch regional/asset news with higher limit ---
                data = await fetchMarketNews({
                    category: "all",
                    region: region.toLowerCase(),
                    assetClass: assetClass.toLowerCase(),
                    limit: 15,
                });
            }


            if (data && Array.isArray(data) && data.length > 0) {
                const processed = data.map(item => ({ ...item, isToday: true }));
                setRawNews(processed);
                if (!isWatchlistOnly) {
                    // Only cache non-watchlist results (watchlist changes frequently)
                    localStorage.setItem(cacheKey, JSON.stringify(processed));
                }
            } else if (!rawNews.length) {
                // High-fidelity fallback if everything fails and no cache
                const fallbacks = [
                    {
                        id: 'f1', title: 'Global Indices Pivot as Inflation Data Cools',
                        source: 'Radar Intelligence', time: '2h ago', category: 'Macro',
                        impact: 'Positive', whatHappened: 'US CPI data came in at 3.1% vs 3.2% expected.',
                        whyItMatters: 'Reduced pressure on central banks to hike rates.',
                        sectors: ['Financials', 'Technology'], isToday: false
                    },
                    {
                        id: 'f2', title: 'Banking Sector Resilience Amid Credit Cycle Shift',
                        source: 'Reuters', time: '5h ago', category: 'Deals',
                        impact: 'Neutral', whatHappened: 'Major private banks report strong loan growth.',
                        whyItMatters: 'Systemic stability remains high despite rate volatility.',
                        sectors: ['Banking'], isToday: false
                    }
                ];
                setRawNews(fallbacks);
            }
        } catch (err) {
            console.error("Failed to load live news:", err.message);
            if (!rawNews.length) {
                setError("Unable to sync live feed. Showing last available intelligence.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Clear stale news from previous region immediately, then fetch fresh
        const regionCache = localStorage.getItem(cacheKey);
        setRawNews(regionCache ? JSON.parse(regionCache) : []);
        loadNews();
    }, [region, assetClass, isWatchlistOnly]);

    return (
        <div className="flex flex-col w-full">
            <div className="dashboard-layout fade-in bg-transparent w-full px-4 md:px-10 py-6">
                <div className="main-content-area transition-all duration-300 w-full mb-10 max-w-[1400px] mx-auto">


                    {/* 1. LATEST HEADLINES HEADER */}
                    <div className="mb-6 px-1">
                        <div className="flex items-center gap-3 mb-1.5 group">
                            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-xl shadow-blue-500/30 ring-4 ring-blue-50 group-hover:scale-110 transition-transform">
                                <Newspaper size={20} />
                            </div>
                            <h1 className="text-[32px] font-black text-slate-900 tracking-tight leading-none">Latest Headlines</h1>
                        </div>
                        <p className="text-slate-500 font-semibold text-[15px] pl-1">Intelligent discovery of signals across global market assets.</p>
                    </div>

                    {/* 2. FILTER BAR / ACTION BUTTONS */}
                    <div className="flex flex-col gap-4 mb-4">
                        <div className="glass-filter-container rounded-[20px] p-4 border border-white/50 shadow-lg shadow-blue-500/5 flex items-center justify-start gap-8 relative z-[100] overflow-visible">
                            {/* Left: Tabs */}
                            <div className="flex-shrink-0 bg-slate-50/80 p-1 rounded-[14px] border border-slate-100 shadow-inner">
                                <NewsTypeFilters selected={selectedCategories} onToggle={toggleCategory} />
                            </div>

                            {/* Right: Controls */}
                            <div className="flex items-center gap-10 flex-shrink-0 bg-white/40 px-6 py-2 rounded-2xl border border-white/60 shadow-sm overflow-visible ml-auto">
                                <div className="flex items-center gap-3">
                                    <span className="section-label whitespace-nowrap">Asset Layer</span>
                                    <AssetClassToggle active={assetClass} onChange={setAssetClass} />
                                </div>
                                <div className="w-[1px] h-6 bg-slate-200/60 font-thin italic">|</div>
                                <div className="flex items-center gap-3">
                                    <span className="section-label whitespace-nowrap">Focus Region</span>
                                    <RegionFilter active={region} onChange={setRegion} />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-2">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                                        FEED CONTEXT: {region} • {assetClass}
                                    </span>
                                    {hasNoRecentUpdates && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 rounded border border-amber-100">
                                            <AlertTriangle size={10} className="text-amber-600" />
                                            <span className="text-[9px] font-bold text-amber-700 uppercase">Historical View</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 ml-auto">
                                <button
                                    onClick={loadNews}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-[11px] font-black shadow-lg shadow-blue-500/20 hover:scale-105 transition-all outline-none disabled:opacity-50"
                                >
                                    <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
                                    <span>{isLoading ? "Refreshing..." : "Refresh Feed"}</span>
                                </button>
                                <button
                                    onClick={() => setIsWatchlistOnly(!isWatchlistOnly)}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-black border transition-all outline-none ${isWatchlistOnly
                                            ? "bg-amber-100 border-amber-300 text-amber-700 shadow-md"
                                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                        }`}
                                >
                                    <Star size={13} className={isWatchlistOnly ? "text-amber-600 fill-amber-500" : "text-amber-400"} />
                                    <span>Watchlist</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedCategories([]);
                                        setAssetClass("Stocks");
                                        setRegion("India");
                                        setIsWatchlistOnly(false);
                                    }}
                                    className="flex items-center gap-2 px-3.5 py-1.5 bg-white text-slate-700 rounded-lg text-[11px] font-black border border-slate-200 hover:bg-slate-50 transition-all outline-none"
                                >
                                    <Compass size={13} className="text-blue-500" />
                                    <span>Clear Filters</span>
                                </button>
                                <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded">Total: {displayNews.length}</span>
                            </div>
                        </div>
                    </div>



                    <div className="news-feed-panel">
                        {isLoading ? (
                            <div className="space-y-4">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="bg-white/80 rounded-2xl p-6 border border-white/50 animate-pulse">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="space-y-3 flex-1">
                                                <div className="h-3 w-24 bg-slate-200 rounded"></div>
                                                <div className="h-5 w-3/4 bg-slate-200 rounded"></div>
                                                <div className="h-4 w-1/2 bg-slate-100 rounded"></div>
                                            </div>
                                            <div className="w-24 h-8 bg-slate-100 rounded-xl"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-10 bg-rose-50/30 rounded-3xl border border-dashed border-rose-200/60">
                                <AlertTriangle size={40} className="text-rose-400 mb-6" />
                                <h3 className="text-xl font-black text-slate-800 mb-2">Sync Interrupted</h3>
                                <p className="text-sm text-slate-500 max-w-sm font-medium leading-relaxed mb-6">{error}</p>
                                <button onClick={loadNews} className="px-6 py-2 bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-500/20 hover:scale-105 transition-all">Retry Connection</button>
                            </div>
                        ) : displayNews.length > 0 ? (
                            displayNews.map((item, i) => (
                                <NewsCard key={item.id || i} item={item} isInitiallyExpanded={i === 0 && !hasNoRecentUpdates} />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-10 bg-white/50 rounded-3xl border border-dashed border-blue-200/60">
                                <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-6 shadow-inner relative">
                                    <Search size={40} className="text-blue-200" />
                                    <div className="absolute inset-0 border-4 border-blue-100/30 rounded-full animate-ping opacity-20"></div>
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 mb-2">No Headlines Found</h3>
                                <p className="text-sm text-slate-500 max-w-sm font-medium leading-relaxed">
                                    No live headlines currently match your filters in the {region} region. Try broadening your criteria or selecting "All" categories.
                                </p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

// Helper components for the dashboard

function InvestorView({ activeModule, setActiveModule }) {
    const [screenerFilter, setScreenerFilter] = useState({});

    const handleShelfClick = (module, filter = {}) => {
        setScreenerFilter(filter);
        setActiveModule(module);
    };

    if (activeModule === 'WATCHLIST') {
        return <Watchlist />;
    }

    if (activeModule === 'PROFILE') {
        return <ProfilePage embedded />;
    }

    if (activeModule === 'SCREENERS') {
        return <Screeners initialFilters={screenerFilter} />;
    }

    if (activeModule === 'NEWS') {
        return <InvestorNewsFeed />;
    }

    if (activeModule === 'ACADEMY') {
        return <LearningAcademy />;
    }

    // Default: DASHBOARD
    return (
        <div className="dashboard-layout fade-in bg-transparent transition-all duration-500 py-4 w-full px-4 md:px-10">
            <div className="main-content-area transition-all duration-300 w-full mb-8">
                {/* Welcome Greeting */}

                <div className="flex justify-between items-center mb-6 px-1">
                    <div>
                        <h1 className="text-[34px] font-black text-[#1e293b] tracking-tight drop-shadow-sm">Welcome back, Captain.</h1>
                        <p className="text-[#64748b] font-semibold text-[15px]">At a glance overview of your portfolio and the global market pulse.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-1 mb-4">
                    <MarketMoodGauge />
                    <ValuationThermometer />
                    <YourInvestments onStartInvesting={() => setActiveModule('WATCHLIST')} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-stretch">
                    <div className="md:col-span-2 h-[580px]">
                        <MostBoughtStocks />
                    </div>
                    <div className="md:col-span-1 h-[580px]">
                        <GlobalPulse />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="md:col-span-1">
                        <DiscoveryShelves onShelfClick={(module, filter) => handleShelfClick(module, filter)} />
                    </div>
                    <div className="md:col-span-2">
                        <SectorLandscape />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                    <div className="md:col-span-1">
                        <EconomicCalendar />
                    </div>
                    <div className="md:col-span-1">
                        <TrendingThemes />
                    </div>
                </div>
            </div>
        </div>
    );
}
