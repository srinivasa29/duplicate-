import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import api from '../api/api';
import { fetchCourses, getProgressKey } from '../api/learningApi';
import { submitSupportMessage } from '../api/supportApi';
import Header from '../components/common/Header';
import InvestorWatchlist from '../components/investor/Watchlist';
import TraderWatchlist from '../components/trader/AdvancedWatchlist';
import './Profile.css';
import './InvestorDashboard.css';
import { 
    Bell, 
    MessageCircle, 
    ChevronRight, 
    Zap, 
    Activity, 
    User,
    Clock, 
    CheckCircle, 
    Shield, 
    AlertCircle,
    ArrowRight,
    ArrowLeft,
    LayoutDashboard,
    Globe,
    MapPin,
    Star,
    Filter,
    Newspaper,
    Search,
    Settings,
    LogOut,
    RefreshCw,
    Info,
    AlertTriangle,
    TrendingUp,
    Calendar,
    BarChart2,
    ShieldCheck,
    PieChart as PieChartIcon,
    Award,
    BookOpen,
    Mail,
    Phone,
    ChevronDown,
    ChevronUp,
    Send,
    Target,
    Lock,
    Trash2,
    HelpCircle,
    Headset,
    Copy,
    Check,
    Camera,
    Monitor,
    Smartphone,
    Laptop
} from 'lucide-react';
import { 
    AreaChart, 
    Area, 
    ResponsiveContainer, 
    PieChart, 
    Pie, 
    Cell,
    XAxis,
    YAxis,
    Tooltip
} from 'recharts';

const toPayload = (value, fallback = null) => {
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'data')) {
        return value.data ?? fallback;
    }
    return value ?? fallback;
};

const PageShell = ({ title, subtitle, children }) => (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h1 className="text-2xl font-black tracking-tight">{title}</h1>
                <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
            </div>
            {children}
        </div>
    </div>
);

const scheduleAsync = (fn) => {
    Promise.resolve().then(fn);
};

const formatDateTime = (value) => {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not recorded';
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getCurrentSession = () => {
    if (typeof window === 'undefined') {
        return {
            id: 'current',
            device: 'Current browser',
            location: 'This device',
            active: 'Active now',
            current: true,
            iconType: 'desktop'
        };
    }

    const ua = window.navigator.userAgent || '';
    const platform = window.navigator.platform || 'Unknown platform';
    const browser = ua.includes('Edg/')
        ? 'Microsoft Edge'
        : ua.includes('Chrome/')
            ? 'Chrome'
            : ua.includes('Firefox/')
                ? 'Firefox'
                : ua.includes('Safari/')
                    ? 'Safari'
                    : 'Browser';
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);

    return {
        id: 'current',
        device: `${browser} on ${platform}`,
        location: 'Current authenticated session',
        active: 'Active now',
        current: true,
        iconType: isMobile ? 'mobile' : 'desktop'
    };
};

const SessionIcon = ({ type, size = 14 }) => (
    type === 'mobile' ? <Smartphone size={size} /> : <Monitor size={size} />
);

const getStoredInvestorDNA = () => {
    if (typeof window === 'undefined') return null;

    try {
        return JSON.parse(localStorage.getItem('investorDNA') || 'null');
    } catch (_error) {
        return null;
    }
};

export function VerifyEmailPage() {
    const location = useLocation();
    const token = useMemo(() => new URLSearchParams(location.search).get('token'), [location.search]);

    return (
        <PageShell
            title="Email Verification"
            subtitle="Confirm your email address to activate all account features."
        >
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-sm">
                    {token
                        ? 'Verification token detected. Your email verification has been acknowledged.'
                        : 'No verification token found. Please open this page using the link from your email.'}
                </p>
            </div>
        </PageShell>
    );
}

export function ResetPasswordPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const onSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setMessage('');

        if (!email || !password) {
            setError('Email and new password are required.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.post('/auth/reset-password', { email, password });
            setMessage('Password updated successfully. You can now log in.');
            setPassword('');
            setConfirmPassword('');
        } catch (submitError) {
            setError(submitError?.response?.data?.message || submitError?.response?.data?.error || 'Failed to reset password.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <PageShell
            title="Reset Password"
            subtitle="Set a new password for your account."
        >
            <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
                {error ? <div className="text-sm text-rose-300">{error}</div> : null}
                {message ? <div className="text-sm text-emerald-300">{message}</div> : null}

                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm"
                />
                <input
                    type="password"
                    placeholder="New Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm"
                />
                <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm"
                />

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-cyan-400 text-slate-950 px-4 py-2 font-bold text-sm"
                >
                    {isSubmitting ? 'Updating...' : 'Update Password'}
                </button>
            </form>
        </PageShell>
    );
}

export function GlobalSearchPage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const value = query.trim();
        if (!value) {
            setResults([]);
            return undefined;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const response = await api.get('/search', { params: { q: value } });
                const payload = toPayload(response.data, []);
                setResults(Array.isArray(payload) ? payload : []);
            } catch (_error) {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    return (
        <PageShell
            title="Global Symbol Search"
            subtitle="Debounced search across stocks, crypto, and forex symbols."
        >
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search symbol or company name..."
                    className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm"
                />
                {loading ? <div className="text-xs text-slate-400">Searching...</div> : null}
                <div className="space-y-2">
                    {results.map((row) => (
                        <div key={`${row.symbol}-${row.exchange}`} className="rounded-lg border border-white/10 p-3 text-sm">
                            <div className="font-black">{row.symbol}</div>
                            <div className="text-slate-300">{row.name}</div>
                            <div className="text-xs text-slate-400">{row.type || row.assetType} • {row.exchange}</div>
                        </div>
                    ))}
                </div>
            </div>
        </PageShell>
    );
}

export function DiscoveryPage() {
    const [bullFlags, setBullFlags] = useState([]);
    const [doubleBottoms, setDoubleBottoms] = useState([]);

    useEffect(() => {
        const load = async () => {
            const [bullRes, dblRes] = await Promise.all([
                api.get('/discovery/patterns/bull-flag').catch(() => ({ data: [] })),
                api.get('/discovery/patterns/double-bottom').catch(() => ({ data: [] })),
            ]);
            const bullPayload = toPayload(bullRes.data, []);
            const dblPayload = toPayload(dblRes.data, []);
            setBullFlags(Array.isArray(bullPayload) ? bullPayload : []);
            setDoubleBottoms(Array.isArray(dblPayload) ? dblPayload : []);
        };

        load();
    }, []);

    return (
        <PageShell
            title="Discovery"
            subtitle="Pattern highlights for Bull Flag and Double Bottom setups."
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h2 className="font-black mb-3">Bull Flag</h2>
                    <ul className="space-y-2 text-sm">
                        {bullFlags.map((item) => <li key={item.symbol}>{item.symbol} - {item.name}</li>)}
                    </ul>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h2 className="font-black mb-3">Double Bottom</h2>
                    <ul className="space-y-2 text-sm">
                        {doubleBottoms.map((item) => <li key={item.symbol}>{item.symbol} - {item.name}</li>)}
                    </ul>
                </div>
            </div>
        </PageShell>
    );
}

export function CalendarPage() {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        const load = async () => {
            const response = await api.get('/calendar/events').catch(() => ({ data: [] }));
            const payload = toPayload(response.data, []);
            setEvents(Array.isArray(payload) ? payload : []);
        };
        load();
    }, []);

    return (
        <PageShell
            title="Economic Calendar"
            subtitle="Timeline of upcoming macro and policy events."
        >
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="text-left text-slate-400">
                            <th className="py-2 pr-4">Date</th>
                            <th className="py-2 pr-4">Country</th>
                            <th className="py-2 pr-4">Event</th>
                            <th className="py-2 pr-4">Impact</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.map((item, index) => (
                            <tr key={`${item.event}-${index}`} className="border-t border-white/10">
                                <td className="py-2 pr-4">{item.date}</td>
                                <td className="py-2 pr-4">{item.country}</td>
                                <td className="py-2 pr-4">{item.event}</td>
                                <td className="py-2 pr-4">{item.impact}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </PageShell>
    );
}

export function NewsPage() {
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('live');
    const [sortBy, setSortBy] = useState('latest');
    const [selectedSource, setSelectedSource] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [region, setRegion] = useState(() => localStorage.getItem('news_region') || 'IN');
    const [watchlistNews, setWatchlistNews] = useState([]);
    const [watchlistLoading, setWatchlistLoading] = useState(false);
    const [watchlistError, setWatchlistError] = useState('');

    const userMode = localStorage.getItem('mode') || 'INVESTOR';
    const dashboardPath = userMode === 'TRADER' ? '/trader/dashboard' : '/investor/dashboard';

    // Fetch main news feed whenever region changes
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setSelectedSource('all');
            try {
                const response = await api.get('/news', { params: { region } }).catch(() => ({ data: [] }));
                const payload = toPayload(response.data, []);
                setRows(Array.isArray(payload) ? payload : []);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [region]);

    const handleRegionChange = (newRegion) => {
        setRegion(newRegion);
        localStorage.setItem('news_region', newRegion);
    };

    // Load watchlist news when that tab is selected
    useEffect(() => {
        if (activeTab !== 'watchlist') return;
        const loadWatchlist = async () => {
            setWatchlistLoading(true);
            setWatchlistError('');
            try {
                const wlRes = await api.get('/watchlist').catch(() => ({ data: [] }));
                const lists = Array.isArray(wlRes.data) ? wlRes.data : [];
                const symbols = lists.length > 0
                    ? (lists[0].items || []).map(i => {
                        const sym = typeof i === 'string' ? i : (i?.symbol || i?.sym || '');
                        return sym.replace(/\.(NS|BO)$/i, '');
                    }).filter(Boolean)
                    : [];

                if (!symbols.length) {
                    setWatchlistError('Your watchlist is empty. Add stocks to see symbol-specific news.');
                    setWatchlistNews([]);
                    return;
                }

                const top5 = symbols.slice(0, 5);
                const results = await Promise.allSettled(
                    top5.map(sym => api.get('/news', { params: { symbol: sym, region, limit: 4 } }).catch(() => ({ data: [] })))
                );

                const seen = new Set();
                const merged = [];
                results.forEach((res, idx) => {
                    if (res.status === 'fulfilled') {
                        const articles = Array.isArray(res.value.data) ? res.value.data : (toPayload(res.value.data, []) || []);
                        articles.forEach(article => {
                            const key = article.title?.toLowerCase().trim();
                            if (key && !seen.has(key)) {
                                seen.add(key);
                                merged.push({ ...article, affectedSymbol: top5[idx] });
                            }
                        });
                    }
                });
                setWatchlistNews(merged);
            } catch (err) {
                setWatchlistError('Failed to load watchlist news.');
            } finally {
                setWatchlistLoading(false);
            }
        };
        loadWatchlist();
    }, [activeTab, region]);

    // Compute display rows based on active tab
    const baseRows = activeTab === 'watchlist' ? watchlistNews : rows;

    const filteredNews = baseRows.filter(item => {
        const matchesSource = selectedSource === 'all' || item.source === selectedSource;
        const matchesSearch = searchQuery === '' || item.title?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSource && matchesSearch;
    }).sort((a, b) => {
        if (activeTab === 'top news') {
            const score = (item) => item.sentiment === 'positive' ? 2 : item.sentiment === 'negative' ? 0 : 1;
            const diff = score(b) - score(a);
            if (diff !== 0) return diff;
        }
        if (sortBy === 'latest') {
            return new Date(b.publishedAt || b.time || 0) - new Date(a.publishedAt || a.time || 0);
        }
        return 0;
    });

    const uniqueSources = ['all', ...Array.from(new Set(baseRows.map(item => item.source).filter(Boolean)))];

    const getImpactBadge = (item) => {
        if (item.sentiment === 'positive') return { text: 'Bullish', color: 'emerald' };
        if (item.sentiment === 'negative') return { text: 'Bearish', color: 'rose' };
        return { text: 'Neutral', color: 'slate' };
    };

    const TABS = ['live', 'top news', 'watchlist'];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Page Header */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            {/* Back to Dashboard */}
                            <button
                                onClick={() => navigate(dashboardPath)}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-400/40 hover:bg-cyan-400/5 transition-all text-sm font-semibold"
                            >
                                <ArrowLeft size={16} strokeWidth={2.5} />
                                <LayoutDashboard size={15} className="opacity-70" />
                                <span>Dashboard</span>
                            </button>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight">Financial News</h1>
                                <p className="mt-0.5 text-sm text-slate-400">Aggregated market feed from configured news providers.</p>
                            </div>
                        </div>

                        {/* India / Global Region Toggle */}
                        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-white/10">
                            <button
                                onClick={() => handleRegionChange('IN')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                    region === 'IN'
                                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <MapPin size={14} strokeWidth={2.5} />
                                🇮🇳 India
                            </button>
                            <button
                                onClick={() => handleRegionChange('GLOBAL')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                    region === 'GLOBAL'
                                        ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Globe size={14} strokeWidth={2.5} />
                                Global
                            </button>
                        </div>
                    </div>
                </div>
            <div className="space-y-6">
                {/* Controls Section */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
                    {/* Search Bar */}
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search news, symbols, sources..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/10 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400/50"
                            />
                        </div>
                    </div>

                    {/* Tabs and Filters */}
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex gap-2">
                            {TABS.map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                                        activeTab === tab
                                            ? 'bg-cyan-500 text-slate-950'
                                            : 'bg-white/5 border border-white/10 text-slate-300 hover:border-white/20'
                                    }`}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            {/* Sort Dropdown */}
                            <div>
                                <label className="text-xs text-slate-400">Sort:</label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="ml-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/50"
                                >
                                    <option value="latest">Latest</option>
                                    <option value="trending">Trending</option>
                                    <option value="impact">Impact</option>
                                </select>
                            </div>

                            {/* Source Filter */}
                            <div>
                                <label className="text-xs text-slate-400">Source:</label>
                                <select
                                    value={selectedSource}
                                    onChange={(e) => setSelectedSource(e.target.value)}
                                    className="ml-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/50"
                                >
                                    {uniqueSources.map((source) => (
                                        <option key={source} value={source}>
                                            {source.charAt(0).toUpperCase() + source.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Tab context hint */}
                    {activeTab === 'top news' && (
                        <p className="text-xs text-cyan-400/70 font-semibold">
                            Showing highest-impact stories sorted by market sentiment
                        </p>
                    )}
                    {activeTab === 'watchlist' && (
                        <p className="text-xs text-amber-400/70 font-semibold">
                            News filtered to your watchlist stocks only
                        </p>
                    )}
                </div>

                {/* News Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main News Column */}
                    <div className="lg:col-span-2 space-y-3">
                        {/* Main feed loading state (region change) */}
                        {loading && activeTab !== 'watchlist' && (
                            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                                <p className="text-slate-400 text-sm">Loading {region === 'IN' ? '🇮🇳 India' : '🌐 Global'} news...</p>
                            </div>
                        )}
                        {/* Watchlist loading / error states */}
                        {activeTab === 'watchlist' && watchlistLoading && (
                            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                                <p className="text-slate-400 text-sm">Fetching watchlist news...</p>
                            </div>
                        )}
                        {activeTab === 'watchlist' && !watchlistLoading && watchlistError && (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Star size={40} className="text-amber-400/40 mb-3" />
                                <p className="text-slate-400 text-sm">{watchlistError}</p>
                            </div>
                        )}
                        {(!watchlistLoading || activeTab !== 'watchlist') && !watchlistError && filteredNews.length > 0 ? (
                            filteredNews.map((item, index) => {
                                const impactBadge = getImpactBadge(item);
                                return (
                                    <article
                                        key={`${item.title}-${index}`}
                                        className="group rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] hover:border-cyan-500/30 hover:bg-white/10 transition-all p-5 cursor-pointer"
                                    >
                                        <div className="flex gap-4">
                                            {/* Icon/Avatar */}
                                            <div className="flex-shrink-0">
                                                <div className="w-12 h-12 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center">
                                                    <span className="text-lg font-black text-cyan-400">
                                                        {item.source?.charAt(0).toUpperCase() || 'N'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1">
                                                        <h3 className="font-black text-base leading-snug group-hover:text-cyan-300 transition-colors">
                                                            {item.title}
                                                        </h3>
                                                        <p className="text-xs text-slate-400 mt-2">
                                                            {item.source} • {item.time || item.publishedAt || '-'}
                                                        </p>
                                                    </div>
                                                    <a
                                                        href={item.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                    </a>
                                                </div>

                                                {item.description && (
                                                    <p className="text-sm text-slate-300 mt-3 line-clamp-2">
                                                        {item.description}
                                                    </p>
                                                )}

                                                {/* Tags and Impact */}
                                                <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-${impactBadge.color}-500/20 text-${impactBadge.color}-300 border border-${impactBadge.color}-500/30`}>
                                                        {impactBadge.text}
                                                    </span>
                                                    {/* Watchlist symbol tag */}
                                                    {item.affectedSymbol && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                                            <Star size={10} className="fill-amber-400" />
                                                            {item.affectedSymbol}
                                                        </span>
                                                    )}
                                                    {item.symbols && item.symbols.length > 0 && (
                                                        <div className="flex gap-1">
                                                            {item.symbols.slice(0, 3).map((symbol) => (
                                                                <span key={symbol} className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 border border-white/10 text-cyan-400">
                                                                    {symbol}
                                                                </span>
                                                            ))}
                                                            {item.symbols.length > 3 && (
                                                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 border border-white/10 text-slate-400">
                                                                    +{item.symbols.length - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })
                        ) : (!watchlistLoading && !watchlistError) ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <svg className="w-12 h-12 text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-slate-400 text-sm">No news found matching your criteria</p>
                            </div>
                        ) : null}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Top Stories Widget */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
                            <h3 className="font-black text-sm">TOP STORIES</h3>
                            <div className="space-y-3">
                                {rows.slice(0, 5).map((item, index) => (
                                    <div key={`top-${index}`} className="pb-3 border-b border-white/10 last:pb-0 last:border-0">
                                        <p className="text-xs font-bold text-cyan-400 mb-1">{index + 1}</p>
                                        <p className="text-xs line-clamp-2 leading-snug text-slate-200 font-semibold">
                                            {item.title}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">{item.source}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Sources Widget */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
                            <h3 className="font-black text-sm">SOURCES</h3>
                            <div className="space-y-2">
                                {uniqueSources.slice(1, 6).map((source) => {
                                    const count = baseRows.filter(item => item.source === source).length;
                                    return (
                                        <div
                                            key={source}
                                            onClick={() => setSelectedSource(source)}
                                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/30 hover:bg-slate-900/60 cursor-pointer transition-colors"
                                        >
                                            <span className="text-xs font-semibold text-slate-300">{source}</span>
                                            <span className="text-xs font-bold text-cyan-400">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
}

export function InvestorWatchlistsPage() {
    return <InvestorWatchlist />;
}

export function TraderWatchlistsPage() {
    return <TraderWatchlist />;
}

export function PortfolioPage() {
    const [portfolio, setPortfolio] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [form, setForm] = useState({ symbol: '', side: 'BUY', quantity: '', price: '' });

    const load = async () => {
        const [portfolioRes, analyticsRes] = await Promise.all([
            api.get('/user/portfolio').catch(() => ({ data: null })),
            api.get('/user/portfolio/analytics').catch(() => ({ data: null })),
        ]);
        setPortfolio(toPayload(portfolioRes.data, null));
        setAnalytics(toPayload(analyticsRes.data, null));
    };

    useEffect(() => {
        scheduleAsync(load);
    }, []);

    const submitTrade = async (event) => {
        event.preventDefault();
        await api.post('/user/portfolio/transactions', {
            symbol: form.symbol,
            side: form.side,
            quantity: Number(form.quantity),
            price: Number(form.price),
            assetType: 'STOCK',
        }).catch(() => null);
        setForm({ symbol: '', side: 'BUY', quantity: '', price: '' });
        load();
    };

    const holdings = Array.isArray(portfolio?.holdings) ? portfolio.holdings : [];

    return (
        <PageShell
            title="Portfolio"
            subtitle="Holdings and portfolio analytics."
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="text-xs text-slate-400">Total Value</div>
                    <div className="text-xl font-black mt-1">{analytics?.totalValue ?? '-'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="text-xs text-slate-400">Cash</div>
                    <div className="text-xl font-black mt-1">{analytics?.cashBalance ?? '-'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="text-xs text-slate-400">Holdings</div>
                    <div className="text-xl font-black mt-1">{analytics?.holdingsCount ?? holdings.length}</div>
                </div>
            </div>

            <form onSubmit={submitTrade} className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3">
                <h2 className="font-black">Add Transaction</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input value={form.symbol} onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value }))} placeholder="Symbol" className="rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm" />
                    <select value={form.side} onChange={(event) => setForm((prev) => ({ ...prev, side: event.target.value }))} className="rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm">
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                    </select>
                    <input value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))} placeholder="Quantity" className="rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm" />
                    <input value={form.price} onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))} placeholder="Price" className="rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm" />
                </div>
                <button type="submit" className="rounded-lg bg-cyan-400 text-slate-950 px-4 py-2 font-bold text-sm">Submit</button>
            </form>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="text-left text-slate-400">
                            <th className="py-2 pr-4">Symbol</th>
                            <th className="py-2 pr-4">Quantity</th>
                            <th className="py-2 pr-4">Avg Price</th>
                            <th className="py-2 pr-4">Current Price</th>
                            <th className="py-2 pr-4">PnL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {holdings.map((row) => (
                            <tr key={row.symbol} className="border-t border-white/10">
                                <td className="py-2 pr-4">{row.symbol}</td>
                                <td className="py-2 pr-4">{row.quantity}</td>
                                <td className="py-2 pr-4">{row.avgBuyPrice}</td>
                                <td className="py-2 pr-4">{row.currentPrice}</td>
                                <td className="py-2 pr-4">{row.unrealizedPnL}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </PageShell>
    );
}

export function AlertsPage() {
    const [activeAlerts, setActiveAlerts] = useState([]);
    const [history, setHistory] = useState([]);
    const [form, setForm] = useState({ symbol: '', type: 'TRADER', condition: 'PRICE_ABOVE', threshold: '' });

    const load = async () => {
        const [activeRes, historyRes] = await Promise.all([
            api.get('/alerts').catch(() => ({ data: [] })),
            api.get('/alerts/history').catch(() => ({ data: [] })),
        ]);
        setActiveAlerts(Array.isArray(toPayload(activeRes.data, [])) ? toPayload(activeRes.data, []) : []);
        setHistory(Array.isArray(toPayload(historyRes.data, [])) ? toPayload(historyRes.data, []) : []);
    };

    useEffect(() => {
        scheduleAsync(load);
    }, []);

    const createAlert = async (event) => {
        event.preventDefault();
        await api.post('/alerts', {
            symbol: form.symbol,
            type: form.type,
            condition: form.condition,
            threshold: Number(form.threshold),
        }).catch(() => null);
        setForm({ symbol: '', type: 'TRADER', condition: 'PRICE_ABOVE', threshold: '' });
        load();
    };

    const deleteAlert = async (id) => {
        await api.delete(`/alerts/${id}`).catch(() => null);
        load();
    };

    return (
        <PageShell
            title="Alerts"
            subtitle="Configure and monitor price/indicator alerts."
        >
            <form onSubmit={createAlert} className="rounded-2xl border border-white/10 bg-white/5 p-6 grid grid-cols-1 md:grid-cols-4 gap-2">
                <input value={form.symbol} onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value }))} placeholder="Symbol" className="rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm" />
                <select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))} className="rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm">
                    <option value="TRADER">TRADER</option>
                    <option value="INVESTOR">INVESTOR</option>
                </select>
                <select value={form.condition} onChange={(event) => setForm((prev) => ({ ...prev, condition: event.target.value }))} className="rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm">
                    <option value="PRICE_ABOVE">PRICE_ABOVE</option>
                    <option value="PRICE_BELOW">PRICE_BELOW</option>
                    <option value="RSI_ABOVE">RSI_ABOVE</option>
                    <option value="RSI_BELOW">RSI_BELOW</option>
                    <option value="PE_ABOVE">PE_ABOVE</option>
                    <option value="PE_BELOW">PE_BELOW</option>
                </select>
                <input value={form.threshold} onChange={(event) => setForm((prev) => ({ ...prev, threshold: event.target.value }))} placeholder="Threshold" className="rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm" />
                <button type="submit" className="md:col-span-4 rounded-lg bg-cyan-400 text-slate-950 px-4 py-2 font-bold text-sm">Create Alert</button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h2 className="font-black mb-3">Active Alerts</h2>
                    <div className="space-y-2 text-sm">
                        {activeAlerts.map((row) => (
                            <div key={row._id} className="border border-white/10 rounded-lg px-3 py-2 flex items-center justify-between">
                                <div>{row.symbol} • {row.condition} • {row.threshold}</div>
                                <button onClick={() => deleteAlert(row._id)} className="text-rose-300 text-xs font-bold">Delete</button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h2 className="font-black mb-3">Triggered History</h2>
                    <div className="space-y-2 text-sm">
                        {history.map((row) => (
                            <div key={row._id} className="border border-white/10 rounded-lg px-3 py-2">
                                {row.symbol} • {row.status}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </PageShell>
    );
}

export function ReportsExportPage() {
    const [status, setStatus] = useState('');

    const download = (content, filename, mimeType) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const exportCsv = async () => {
        const response = await api.get('/reports/csv');
        const payload = response.data;
        const body = payload?.data || '';
        download(String(body), 'portfolio-report.csv', 'text/csv');
        setStatus('CSV report exported.');
    };

    const exportPdf = async () => {
        const response = await api.get('/reports/pdf');
        download(JSON.stringify(response.data, null, 2), 'portfolio-report.pdf.json', 'application/json');
        setStatus('PDF export payload downloaded.');
    };

    return (
        <PageShell
            title="Reports Export"
            subtitle="Generate PDF/CSV portfolio reports."
        >
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
                <div className="flex gap-3">
                    <button onClick={exportPdf} className="rounded-lg bg-cyan-400 text-slate-950 px-4 py-2 font-bold text-sm">Export PDF</button>
                    <button onClick={exportCsv} className="rounded-lg bg-emerald-400 text-slate-950 px-4 py-2 font-bold text-sm">Export CSV</button>
                </div>
                {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
            </div>
        </PageShell>
    );
}

export function ProfilePage({ embedded = false } = {}) {
    const [profile, setProfile] = useState(null);
    const [portfolio, setPortfolio] = useState(null);
    const [insights, setInsights] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState({
        priceAlerts:     { enabled: true },
        earningsUpdates: { enabled: true },
        importantNews:   { enabled: true }
    });

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editData, setEditData] = useState({
        username: '',
        email: '',
        sectors: ['Technology', 'Finance'],
        riskLevel: 'Moderate',
        style: 'Growth'
    });

    const navigate = useNavigate();

    useEffect(() => {
        if (profile) {
            setEditData({
                username: profile.username || '',
                email: profile.email || '',
                sectors: ['Technology', 'Finance'],
                riskLevel: 'Moderate',
                style: 'Growth'
            });
        }
    }, [profile]);

    const isGoogleUser = profile?.authProvider === 'google';

    const handleEditSave = async (e) => {
        e.preventDefault();
        const username = editData.username.trim();
        const email = editData.email.trim();

        try {
            const response = await api.patch('/user/profile', { username, email });
            if (response.data?.success) {
                setProfile(prev => ({
                    ...prev,
                    username: response.data.data.username,
                    email: response.data.data.email
                }));
            }
            setIsEditModalOpen(false);
        } catch (error) {
            console.error('Profile update failed', error);
        }
    };

    const [academyProgress, setAcademyProgress] = useState(0);
    const [academyCourses, setAcademyCourses] = useState([]);

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                const [profileRes, portfolioRes, insightsRes, eventsRes] = await Promise.all([
                    api.get('/user/profile').catch(() => ({ data: null })),
                    api.get('/user/portfolio').catch(() => ({ data: null })),
                    api.get('/user/insights').catch(() => ({ data: [] })),
                    api.get('/user/events').catch(() => ({ data: [] }))
                ]);

                // Load courses for this persona (investor profile = investor audience)
                const coursesPayload = await fetchCourses('investor');

                const storedDNA = getStoredInvestorDNA();
                const profilePayload = toPayload(profileRes.data, null);
                
                let mergedDNA = storedDNA;
                let needsSync = false;

                if (profilePayload) {
                    if (profilePayload.investorDNA && profilePayload.investorDNA.dominant) {
                        mergedDNA = profilePayload.investorDNA;
                    } else if (storedDNA && storedDNA.dominant) {
                        mergedDNA = storedDNA;
                        needsSync = true;
                    }
                }

                setProfile(profilePayload
                    ? {
                        ...profilePayload,
                        investorDNA: mergedDNA
                    }
                    : {
                        username: localStorage.getItem('userEmail')?.split('@')[0] || 'Investor',
                        email: localStorage.getItem('userEmail') || 'Signed-in user',
                        joinedDate: 'Joined Recently',
                        investorDNA: storedDNA
                    }
                );

                // Load notification preferences
                if (profilePayload?.notificationPreferences) {
                    setNotifications({
                        priceAlerts:     { enabled: Boolean(profilePayload.notificationPreferences.priceAlerts) },
                        earningsUpdates: { enabled: Boolean(profilePayload.notificationPreferences.earningsUpdates) },
                        importantNews:   { enabled: Boolean(profilePayload.notificationPreferences.importantNews) }
                    });
                }

                if (needsSync && mergedDNA) {
                    api.post('/user/dna', mergedDNA).catch(err => {
                        console.error('Background DNA sync failed:', err);
                    });
                }

                setPortfolio(toPayload(portfolioRes.data, null));
                setInsights(toPayload(insightsRes.data, []));
                setEvents(toPayload(eventsRes.data, []));

                // Set courses + compute academy progress
                setAcademyCourses(coursesPayload);
                if (coursesPayload.length > 0) {
                    const totalChapters = coursesPayload.reduce((sum, c) => sum + (c.chapters?.length || 0), 0);
                    let doneChapters = 0;
                    coursesPayload.forEach(c => {
                        try {
                            const progress = JSON.parse(localStorage.getItem(getProgressKey(c.id, 'investor')) || '{}');
                            doneChapters += Object.values(progress?.chapters || {}).filter(Boolean).length;
                        } catch (e) { /* ignore */ }
                    });
                    setAcademyProgress(totalChapters > 0 ? Math.round((doneChapters / totalChapters) * 100) : 0);
                }

            } catch (error) {
                console.error("Failed to load profile data", error);
            } finally {
                setLoading(false);
            }
        };

        loadDashboardData();
    }, []);

    const initial = profile?.username?.[0]?.toUpperCase() || 'U';

    useEffect(() => {
        const fullBackground = 'linear-gradient(180deg, #f0f9ff 0%, #e1effe 100%)';
        document.documentElement.style.setProperty('--investor-bg', fullBackground);
        document.body.style.backgroundColor = '#f0f9ff';
        document.body.style.backgroundImage = fullBackground;
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundSize = 'cover';
        return () => {
            document.documentElement.style.removeProperty('--investor-bg');
            document.body.style.backgroundColor = '';
            document.body.style.backgroundImage = '';
            document.body.style.backgroundAttachment = '';
            document.body.style.backgroundSize = '';
        };
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-white text-blue-600 font-black">
            LOADING INVESTOR IDENTITY...
        </div>
    );

    const dna = profile?.investorDNA || null;
    const hasDNA = dna && dna.dominant;
    const assessmentTakenAt = hasDNA ? formatDateTime(dna.completedAt) : null;

    const personaName = hasDNA ? dna.personaName : 'No Assessment Yet';
    const personaBlurb = hasDNA ? dna.personaDescription : 'Take the assessment to generate your investor identity.';
    const investorPct = hasDNA ? dna.investorPercent : null;
    const traderPct   = hasDNA ? dna.traderPercent   : null;
    const dnaTraits   = hasDNA ? dna.traits : [];
    const riskLabel   = hasDNA
        ? (dna.metrics?.risk >= 75 ? 'High' : dna.metrics?.risk >= 40 ? 'Moderate' : 'Conservative')
        : 'Unknown';
    const riskDesc    = hasDNA
        ? (dna.metrics?.risk >= 75 ? 'High comfort with market volatility and short-term swings.' : dna.metrics?.risk >= 40 ? 'Balanced approach between capital preservation and growth.' : 'Strong preference for capital preservation over speculative returns.')
        : 'Complete the assessment to determine your risk profile.';
    const strategyLabel = hasDNA
        ? (dna.dominant === 'INVESTOR' ? 'Growth' : 'Active Trading')
        : '-';
    const horizonLabel = hasDNA
        ? (dna.metrics?.patience >= 75 ? '5-10 Years' : dna.metrics?.patience >= 40 ? '1-5 Years' : '< 1 Year')
        : '-';
    const marketBehaviorRows = hasDNA
        ? [
            { label: 'Investor Tilt', value: investorPct || 0, color: 'bg-blue-600' },
            { label: 'Trader Tilt', value: traderPct || 0, color: 'bg-cyan-500' }
        ]
        : [];

    const profileContent = (
        <main className="max-w-[1400px] mx-auto px-6 py-12">
            
            {/* Unified Profile Container */}
            <div className="bg-white rounded-[32px] border border-blue-100/50 shadow-sm p-8 md:p-12 space-y-12">
                
                {/* Header Section (Inline) */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pb-10 border-b border-slate-50">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-blue-100 border-4 border-white">
                            {initial}
                        </div>
                        <div className="user-meta">
                            <h1 className="text-3xl font-black text-slate-800 tracking-tight">{profile?.username}</h1>
                            <p className="text-sm font-bold text-slate-500">{profile?.email}</p>
                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-wider">
                                <Clock size={12} /> {profile?.joinedDate || 'Joined Recently'} • <Zap size={12} className="text-blue-500" fill="currentColor" /> Investor Mode
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold mt-3 italic">Manage your account settings in <span className="text-blue-500 cursor-pointer hover:underline" onClick={() => navigate('/investor/settings')}>Settings</span></p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        <button className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2" onClick={() => navigate('/onboarding')}>
                            <RefreshCw size={14} /> Retake Assessment
                        </button>
                        <button className="px-6 py-3 bg-slate-50 text-slate-600 rounded-xl text-xs font-black border border-slate-200 hover:bg-slate-100 transition-all flex items-center gap-2" onClick={() => navigate('/investor/settings')}>
                            <Settings size={14} /> Go to Settings
                        </button>
                    </div>
                </div>


                {/* DNA HERO */}
                <div className="bg-blue-50/50 rounded-[28px] p-10 border border-blue-100/50">
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Investor Identity</span>
                        <h2 className="text-2xl font-black text-slate-800">{personaName}</h2>
                        <p className="text-slate-500 font-medium max-w-2xl leading-relaxed mt-2">
                            {hasDNA ? (
                                <>You are a <strong className="text-slate-800">{dna.dominant === 'INVESTOR' ? 'Growth-focused' : 'Active Trader'}</strong> with a <strong className="text-slate-800">{riskLabel} risk appetite</strong> and a <strong className="text-slate-800">{horizonLabel} horizon</strong>. {dna.hybridLine}</>
                            ) : personaBlurb}
                        </p>
                        <div className={`mt-4 inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest ${hasDNA ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                            <CheckCircle size={14} />
                            {hasDNA ? `Assessment taken: ${assessmentTakenAt}` : 'Assessment not taken yet'}
                        </div>
                        {dnaTraits.length > 0 && (
                            <div className="flex gap-2 mt-4">
                                {dnaTraits.map((t, i) => (
                                    <span key={i} className="px-4 py-2 bg-white text-blue-600 rounded-lg text-xs font-black border border-blue-100 shadow-sm">{t}</span>
                                ))}
                            </div>
                        )}
                        {!hasDNA && (
                            <button onClick={() => navigate('/onboarding')} className="mt-4 self-start px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black shadow hover:bg-blue-700 transition-all">
                                Take Assessment →
                            </button>
                        )}
                    </div>
                </div>

                {/* INSIGHTS GRID — driven by real DNA */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <div className="p-8 rounded-[24px] bg-slate-50/50 border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center text-slate-400">
                            <h3 className="text-[10px] font-black uppercase tracking-widest">Behavior Profile</h3>
                            <BarChart2 size={16} />
                        </div>
                        <div className="space-y-4 pt-4">
                            {marketBehaviorRows.length > 0 ? marketBehaviorRows.map((row) => (
                                <div key={row.label} className="space-y-2">
                                    <div className="flex justify-between items-center"><span className="text-[11px] font-black text-slate-800">{row.label}</span><span className="text-[11px] font-black text-blue-600">{row.value}%</span></div>
                                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden"><div className={`${row.color} h-full rounded-full shadow-sm`} style={{ width: `${row.value}%` }} /></div>
                                </div>
                            )) : (
                                <div className="flex justify-between items-center"><span className="text-[11px] font-black text-slate-800">UNKNOWN</span><span className="text-[11px] font-black text-blue-600">-</span></div>
                            )}
                            <p className="text-[11px] text-slate-500 font-bold leading-relaxed pt-2">{hasDNA ? dna.hybridLine : 'Complete the assessment to see your behavior breakdown.'}</p>
                        </div>
                    </div>
                    <div className="p-8 rounded-[24px] bg-slate-50/50 border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center text-slate-400">
                            <h3 className="text-[10px] font-black uppercase tracking-widest">Sector Allocation</h3>
                            <PieChartIcon size={16} />
                        </div>
                        <div className="flex items-center gap-4 h-[120px]">
                            <div className="w-1/2 h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={portfolio?.sectorWeights?.length > 0 ? portfolio.sectorWeights : [{ name: 'None', value: 1 }]} 
                                            cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value"
                                        >
                                            <Cell fill="#3b82f6" />
                                            <Cell fill="#60a5fa" />
                                            <Cell fill="#93c5fd" />
                                            <Cell fill="#bfdbfe" />
                                            <Cell fill="#dbeafe" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="w-1/2">
                                <p className="text-[9px] font-black text-slate-400 uppercase">Top Sector</p>
                                <p className="text-[13px] font-black text-slate-800 truncate">{portfolio?.sectorWeights?.[0]?.name || 'Diversified'}</p>
                                <p className="text-[11px] text-blue-600 font-bold mt-0.5">{portfolio?.sectorWeights?.[0]?.weightPct || 0}% weight</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-8 rounded-[24px] bg-slate-50/50 border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center text-emerald-500">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Risk Profile</h3>
                            <ShieldCheck size={16} />
                        </div>
                        <div className="pt-6">
                            <p className="text-2xl font-black text-slate-800 tracking-tight">{riskLabel}</p>
                            <p className="text-[11px] text-slate-500 font-bold mt-2">{riskDesc}</p>
                        </div>
                    </div>
                    <div className="p-8 rounded-[24px] bg-slate-50/50 border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center text-slate-400">
                            <h3 className="text-[10px] font-black uppercase tracking-widest">Preferences</h3>
                            <Settings size={16} />
                        </div>
                        <div className="space-y-4 pt-4">
                            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Horizon</span><span className="text-[11px] font-black text-slate-800">{horizonLabel}</span></div>
                            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Strategy</span><span className="text-[11px] font-black text-slate-800">{strategyLabel}</span></div>
                            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Confidence</span><span className="text-[11px] font-black text-slate-800">{hasDNA ? dna.confidence : '-'}</span></div>
                        </div>
                    </div>
                </div>

                {/* LEARNING JOURNEY */}
                <div className="pt-12 border-t border-slate-50">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">Learning Journey</h2>
                            <p className="text-xs text-slate-500 font-bold mt-1">Progress through financial intelligence modules</p>
                        </div>
                        <button onClick={() => navigate('/investor/dashboard/academy')} className="px-3 py-1 bg-blue-50 rounded-lg text-[10px] font-black text-blue-600 hover:bg-blue-100 transition-all">
                            {academyProgress}% TOTAL PROGRESS • OPEN ACADEMY
                        </button>
                    </div>

                    {academyCourses.length === 0 ? (
                        <div className="flex items-center gap-3 p-5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 text-sm font-bold">
                            <BookOpen size={16} /> No courses loaded. <button onClick={() => navigate('/investor/dashboard/academy')} className="text-blue-500 hover:underline ml-1">Open Academy →</button>
                        </div>
                    ) : (
                        <div
                            className="flex gap-5 overflow-x-auto pb-3"
                            style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
                        >
                            {academyCourses.map((course, idx) => {
                                let done = 0;
                                try {
                                    const p = JSON.parse(localStorage.getItem(getProgressKey(course.id, 'investor')) || '{}');
                                    done = Object.values(p?.chapters || {}).filter(Boolean).length;
                                } catch (e) { /* ignore */ }
                                const total = course.chapters?.length || 0;
                                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                                const status = pct === 100 ? 'Completed' : pct > 0 ? 'In Progress' : 'Not Started';
                                const statusColor = pct === 100
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : pct > 0
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'bg-slate-100 text-slate-500';
                                return (
                                    <div
                                        key={course.id || idx}
                                        onClick={() => navigate('/investor/dashboard/academy')}
                                        className="flex-shrink-0 w-56 p-5 rounded-[20px] bg-white border border-slate-100 shadow-sm flex flex-col gap-4 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                                                <BookOpen size={16} />
                                            </div>
                                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${statusColor}`}>
                                                {status}
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-black text-slate-800 leading-snug">{course.title}</h4>
                                            <p className="text-[10px] text-slate-400 font-bold mt-1">{total} chapters</p>
                                        </div>
                                        <div>
                                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                <div className="bg-blue-500 h-full rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold mt-1">{pct}% complete</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        </main>
    );

    if (embedded) {
        return profileContent;
    }

    return (
        <div className="dashboard-container investor-theme pt-2 min-h-screen">
            <Header />
            {profileContent}
        </div>
    );
}

export function SettingsPage() {
    const [status, setStatus] = useState('');
    const [profile, setProfile] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);


    const [sessions, setSessions] = useState(() => [getCurrentSession()]);
    
    const [notifications, setNotifications] = useState({
        priceAlerts: { enabled: true },
        earningsUpdates: { enabled: true },
        importantNews: { enabled: true }
    });

    useEffect(() => {
        const fullBackground = 'linear-gradient(180deg, #f0f9ff 0%, #e1effe 100%)';
        document.documentElement.style.setProperty('--investor-bg', fullBackground);
        document.body.style.backgroundColor = '#f0f9ff';
        document.body.style.backgroundImage = fullBackground;
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundSize = 'cover';
        
        const load = async () => {
            try {
                const res = await api.get('/user/profile');
                const data = res.data;
                setProfile(data);
                // Load persisted notification prefs
                if (data.notificationPreferences) {
                    setNotifications({
                        priceAlerts:     { enabled: Boolean(data.notificationPreferences.priceAlerts) },
                        earningsUpdates: { enabled: Boolean(data.notificationPreferences.earningsUpdates) },
                        importantNews:   { enabled: Boolean(data.notificationPreferences.importantNews) }
                    });
                }
            } catch (err) { console.error(err); }
        };
        load();
        setSessions([getCurrentSession()]);

        return () => {
            document.documentElement.style.removeProperty('--investor-bg');
            document.body.style.backgroundColor = '';
            document.body.style.backgroundImage = '';
            document.body.style.backgroundAttachment = '';
            document.body.style.backgroundSize = '';
        };
    }, []);

    // Toggle a notification key and persist immediately
    const handleNotificationToggle = async (key) => {
        const newEnabled = !notifications[key].enabled;
        setNotifications(prev => ({ ...prev, [key]: { enabled: newEnabled } }));
        try {
            await api.patch('/user/notifications', { [key]: newEnabled });
        } catch (err) {
            // Revert on failure
            setNotifications(prev => ({ ...prev, [key]: { enabled: !newEnabled } }));
            console.error('Failed to save notification preference', err);
        }
    };

    const isGoogleUser = profile?.authProvider === 'google';

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newPassword = String(formData.get('newPassword') || '');
        const confirmPassword = String(formData.get('confirmPassword') || '');

        if (newPassword !== confirmPassword) {
            setStatus('New passwords do not match.');
            setTimeout(() => setStatus(''), 3000);
            return;
        }

        try {
            if (isGoogleUser) {
                await api.post('/user/set-password', { newPassword });
                setStatus('Password set! You can now also log in with email.');
            } else {
                const currentPassword = String(formData.get('currentPassword') || '');
                await api.patch('/user/password', { currentPassword, newPassword });
                setStatus('Password updated successfully.');
            }
            e.target.reset();
            setIsPasswordModalOpen(false);
        } catch (err) {
            setStatus(err?.response?.data?.error || 'Password update failed.');
        } finally {
            setTimeout(() => setStatus(''), 3000);
        }
    };

    return (
        <div className="dashboard-container investor-theme pt-2 min-h-screen">
            <Header />
            <main className="max-w-[1400px] mx-auto px-6 py-12">
                
                {/* Unified Settings Container */}
                <div className="bg-white rounded-[32px] border border-blue-100/50 shadow-sm p-8 md:p-12 space-y-12">
                    
                    <div className="text-center md:text-left border-b border-slate-50 pb-8">
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Platform Settings</h1>
                        <p className="text-slate-500 font-medium mt-1">Manage your account and notification delivery.</p>
                    </div>

                    {/* 1. ACCOUNT INFORMATION SECTION */}
                    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 border border-blue-100/80 bg-white shadow-sm p-8 rounded-[24px]">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                    <User size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800">Account Information</h2>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Primary Identity Details</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsEditModalOpen(true)}
                                className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2"
                            >
                                <Settings size={14} /> Edit Details
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-50">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Full Name</label>
                                <p className="text-sm font-bold text-slate-800">{profile?.username || 'Investor'}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email Address</label>
                                <p className="text-sm font-bold text-slate-800">{profile?.email || 'guest@radar.com'}</p>
                            </div>
                        </div>
                    </section>

                    {/* 2. NOTIFICATIONS SECTION */}
                    <section className="pt-12 border-t border-slate-50 space-y-8 animate-in fade-in slide-in-from-bottom-4 delay-100 duration-500 border border-blue-100/80 bg-white shadow-sm p-8 rounded-[24px]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                <Bell size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800">Notification Channels</h2>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Updates & Alerts</p>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-slate-50">
                            {[
                                { id: 'priceAlerts', label: 'Price Alerts', desc: 'Real-time notifications for watchlist price crossing' },
                                { id: 'earningsUpdates', label: 'Earnings Updates', desc: 'Alerts for upcoming and released quarterly results' },
                                { id: 'importantNews', label: 'Market Intelligence', desc: 'Curated news headlines based on your sector DNA' }
                            ].map(n => (
                                <div key={n.id} className="flex items-center justify-between p-5 rounded-2xl bg-slate-50/50 border border-slate-100 group hover:bg-slate-50 transition-all">
                                    <div>
                                        <p className="text-sm font-black text-slate-800">{n.label}</p>
                                        <p className="text-[11px] text-slate-400 font-bold">{n.desc}</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={notifications[n.id].enabled}
                                            onChange={() => handleNotificationToggle(n.id)}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 3. SECURITY SECTION */}
                    <section className="pt-12 border-t border-slate-50 space-y-10 animate-in fade-in slide-in-from-bottom-4 delay-200 duration-500 border border-blue-100/80 bg-white shadow-sm p-8 rounded-[24px]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
                                <Lock size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800">Security & Privacy</h2>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Authorization & Access</p>
                            </div>
                        </div>

                        {/* Password Subsection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-50">
                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Password Management</h3>
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase mb-1">
                                            {isGoogleUser ? 'Password Status' : 'Current Password'}
                                        </p>
                                        {isGoogleUser ? (
                                            <p className="text-sm font-bold text-amber-600">Signed in via Google — no password set</p>
                                        ) : (
                                            <p className="text-sm font-bold text-slate-800 tracking-tighter">••••••••••••</p>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => setIsPasswordModalOpen(true)}
                                        className="text-[10px] font-black text-blue-600 hover:underline"
                                    >
                                        {isGoogleUser ? 'Set Password' : 'Change Password'}
                                    </button>
                                </div>
                                <p className="text-[11px] text-slate-400 font-bold leading-relaxed px-1">
                                    {isGoogleUser
                                        ? 'Set a password to enable email + password login in addition to Google.'
                                        : 'Use a strong password that includes symbols and numbers to protect your account insights.'}
                                </p>
                            </div>

                            {/* Active Sessions Subsection */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Device Sessions</h3>
                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                                            <Monitor size={14} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-black uppercase">Active Sessions</p>
                                            <p className="text-sm font-bold text-slate-800 tracking-tighter">{sessions.length} Active Session</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setIsSessionsModalOpen(true)}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 hover:bg-slate-100 transition-all"
                                    >
                                        Manage Sessions
                                    </button>
                                </div>
                                <p className="text-[11px] text-slate-400 font-bold leading-relaxed px-1">
                                    Showing your current browser session. Sign out to invalidate the active token.
                                </p>
                                <p className="text-[10px] text-slate-300 font-bold px-1 mt-1 italic">
                                    Note: Only the current session is tracked — multi-device session management is not yet available.
                                </p>
                            </div>
                        </div>
                    </section>

                </div>

            </main>

            {/* A. SIMPLIFIED EDIT DETAILS MODAL (Identity & Photo) */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
                    <div className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl p-10 border border-blue-50 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-lg font-black text-slate-800">Edit Account Details</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Manage your platform identity</p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        
                        <form className="space-y-8" onSubmit={async (e) => {
                            e.preventDefault();
                            const formData = new FormData(e.target);
                            const username = formData.get('username')?.trim();
                            const email    = formData.get('email')?.trim();
                            try {
                                const res = await api.patch('/user/profile', { username, email });
                                if (res.data?.success) {
                                    setProfile(prev => ({ ...prev, username: res.data.data.username, email: res.data.data.email }));
                                    setStatus('Changes Saved!');
                                    setTimeout(() => setStatus(''), 3000);
                                }
                            } catch (err) {
                                console.error('Profile update failed', err);
                                setStatus('Save failed. Please try again.');
                                setTimeout(() => setStatus(''), 3000);
                            }
                            setIsEditModalOpen(false);
                        }}>
                            
                            {/* Avatar Initial Display */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-xl shadow-blue-100 border-4 border-white">
                                    {profile?.username?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold">Profile photo upload coming soon</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Full Name</label>
                                    <input type="text" name="username" defaultValue={profile?.username} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Email Address</label>
                                    <input type="email" name="email" defaultValue={profile?.email} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all" />
                                </div>
                            </div>

                            <div className="pt-6 flex gap-3">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 rounded-2xl border border-slate-200 text-xs font-black text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
                                <button type="submit" className="flex-1 py-4 rounded-2xl bg-blue-600 text-white text-xs font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* B. SECURE PASSWORD CHANGE MODAL */}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsPasswordModalOpen(false)} />
                    <div className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl p-10 border border-blue-50 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-lg font-black text-slate-800">
                                    {isGoogleUser ? 'Set a Password' : 'Change Password'}
                                </h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    {isGoogleUser ? 'Enable email login' : 'Strengthen your account'}
                                </p>
                            </div>
                            <button onClick={() => setIsPasswordModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        
                        {isGoogleUser && (
                            <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                                <span className="text-amber-500 mt-0.5">ℹ️</span>
                                <p className="text-[11px] text-amber-700 font-bold leading-relaxed">
                                    You signed in with Google. Setting a password lets you also log in with your email and this new password.
                                </p>
                            </div>
                        )}

                        <form className="space-y-6" onSubmit={handlePasswordChange}>
                            {!isGoogleUser && (
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Current Password</label>
                                    <input type="password" name="currentPassword" required placeholder="Current password" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all" />
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">New Password</label>
                                <input type="password" name="newPassword" required minLength={8} placeholder="Min. 8 characters" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Confirm New Password</label>
                                <input type="password" name="confirmPassword" required minLength={8} placeholder="Repeat new password" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all" />
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl border border-dotted border-slate-200">
                                <p className="text-[10px] text-slate-400 font-bold leading-tight">Must contain at least 8 characters, one number, and one special symbol.</p>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="flex-1 py-4 rounded-2xl border border-slate-200 text-xs font-black text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
                                <button type="submit" className="flex-1 py-4 rounded-2xl bg-blue-600 text-white text-xs font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">
                                    {isGoogleUser ? 'Set Password' : 'Update'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* C. MANAGE SESSIONS MODAL */}
            {isSessionsModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsSessionsModalOpen(false)} />
                    <div className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl p-10 border border-blue-50 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-lg font-black text-slate-800">Manage Active Sessions</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Active Browser Sessions ({sessions.length})</p>
                            </div>
                            <button onClick={() => setIsSessionsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        
                        <div className="space-y-4">
                            {sessions.map(s => (
                                <div key={s.id} className="p-5 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-blue-100 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.current ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                                            <SessionIcon type={s.iconType} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                                                {s.device}
                                                {s.current && <span className="bg-emerald-50 text-emerald-600 text-[8px] px-1.5 py-0.5 rounded uppercase">Active Now</span>}
                                            </p>
                                            <p className="text-xs text-slate-400 font-medium">
                                                {s.location} • {s.active}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="pt-8 border-t border-slate-50 flex flex-col gap-4">
                                <button 
                                    onClick={() => { localStorage.removeItem('token'); setIsSessionsModalOpen(false); setStatus('Signed out from this device'); setTimeout(() => { setStatus(''); window.location.href = '/login'; }, 800); }}
                                    className="w-full py-4 rounded-2xl bg-slate-100 text-slate-600 text-xs font-black hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <LogOut size={14} /> Sign Out from This Device
                                </button>
                                <button 
                                    onClick={() => setIsSessionsModalOpen(false)}
                                    className="w-full py-4 rounded-2xl border border-slate-200 text-xs font-black text-slate-500 hover:bg-slate-50 transition-all"
                                >
                                    Close Window
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {status && (
                <div className="fixed bottom-10 right-10 bg-slate-900/90 backdrop-blur-md text-white px-8 py-4 rounded-2xl text-xs font-black shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
                    {status}
                </div>
            )}
        </div>
    );
}

export function InvestorFilingsPage() {
    const [symbol, setSymbol] = useState('AAPL');
    const [rows, setRows] = useState([]);

    const fetchFilings = async () => {
        const target = symbol.trim().toUpperCase();
        if (!target) return;
        const response = await api.get(`/fundamental/${encodeURIComponent(target)}/filings`).catch(() => ({ data: [] }));
        const payload = toPayload(response.data, []);
        setRows(Array.isArray(payload) ? payload : []);
    };

    useEffect(() => {
        scheduleAsync(fetchFilings);
    }, []);

    return (
        <PageShell
            title="Investor Filings"
            subtitle="SEC EDGAR filings table for the selected symbol."
        >
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
                <div className="flex gap-2">
                    <input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="Symbol (e.g. AAPL)" className="flex-1 rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm" />
                    <button onClick={fetchFilings} className="rounded-lg bg-cyan-400 text-slate-950 px-4 py-2 font-bold text-sm">Load</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="text-left text-slate-400">
                                <th className="py-2 pr-4">Form</th>
                                <th className="py-2 pr-4">Filing Date</th>
                                <th className="py-2 pr-4">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => (
                                <tr key={`${row.accessionNumber || row.form}-${index}`} className="border-t border-white/10">
                                    <td className="py-2 pr-4">{row.form}</td>
                                    <td className="py-2 pr-4">{row.filingDate}</td>
                                    <td className="py-2 pr-4">{row.description || row.primaryDocument}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </PageShell>
    );
}

export function HelpSupportPage() {
    const [openFaq, setOpenFaq] = useState(null);
    const [formStatus, setFormStatus] = useState(null);
    const [copied, setCopied] = useState(false);
    const [toast, setToast] = useState(null);
    const contactRef = useRef(null);

    const faqs = [
        { q: "How are signals and recommendations generated?", a: "Radar uses a proprietary blend of technical indicators, fundamental health scores, and real-time news sentiment to calculate behavioral alignment and investment signals." },
        { q: "How often is the market data updated?", a: "Our price feeds and basic stats are updated in real-time. Core fundamental analysis and behavioral scores are recalculated every 24 hours." },
        { q: "Is Radar a registered advisor? Is this financial advice?", a: "No. Radar is an intelligence platform designed for education and research. All data provided is for informational purposes only and does not constitute financial advice." },
        { q: "How can I update my profile or investment preferences?", a: "You can update your investor DNA by clicking 'Edit Profile' on your Profile page or by retaking the assessment to recalibrate your persona." }
    ];

    useEffect(() => {
        const fullBackground = 'linear-gradient(180deg, #f0f9ff 0%, #e1effe 100%)';
        document.documentElement.style.setProperty('--investor-bg', fullBackground);
        document.body.style.backgroundColor = '#f0f9ff';
        document.body.style.backgroundImage = fullBackground;
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundSize = 'cover';
        return () => {
            document.documentElement.style.removeProperty('--investor-bg');
            document.body.style.backgroundColor = '';
            document.body.style.backgroundImage = '';
            document.body.style.backgroundAttachment = '';
            document.body.style.backgroundSize = '';
        };
    }, []);

    const scrollToContact = () => {
        contactRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const copyEmail = () => {
        navigator.clipboard.writeText('support@radar.com');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);

        setFormStatus('loading');

        submitSupportMessage({
            name: String(formData.get('name') || '').trim(),
            email: String(formData.get('email') || '').trim(),
            subject: String(formData.get('subject') || '').trim(),
            message: String(formData.get('message') || '').trim(),
            page: 'contact-form',
        })
            .then(() => {
                setFormStatus('success');
                setToast({ type: 'success', message: 'Message sent successfully.' });
                form.reset();
                setTimeout(() => setFormStatus(null), 5000);
                setTimeout(() => setToast(null), 5000);
            })
            .catch((submitError) => {
                setFormStatus('error');
                setToast({ type: 'error', message: submitError?.response?.data?.error || submitError?.response?.data?.message || 'Failed to send message' });
                setTimeout(() => setFormStatus(null), 5000);
                setTimeout(() => setToast(null), 5000);
            });
    };

    return (
        <div className="dashboard-container investor-theme pt-2 min-h-screen">
            <Header />
            <main className="max-w-[1400px] mx-auto px-6 py-6 pb-20">
                
                {/* Unified Main Container */}
                <div className="bg-white rounded-[24px] border border-blue-100/50 shadow-sm p-8 md:p-12 space-y-12">
                    
                    {/* 1. HEADER SECTION */}
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 p-6 rounded-[20px] border border-blue-100 bg-blue-50/20">
                        <div 
                            onClick={scrollToContact}
                            className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-blue-600 cursor-pointer shadow-sm border border-blue-100 hover:bg-blue-50 transition-all group relative"
                            title="Support Center"
                        >
                            <Headset size={32} />
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-black uppercase whitespace-nowrap">
                                Support Center
                            </div>
                        </div>
                        <div className="text-center md:text-left">
                            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Help & Support</h1>
                            <p className="text-slate-500 mt-2 max-w-xl font-medium leading-relaxed">
                                We’re here to help you make the most of Radar. Find answers, get in touch, or explore our resources.
                            </p>
                        </div>
                    </div>

                    {/* 2. SUPPORT CHANNELS (2-column grid) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-8 rounded-[20px] bg-slate-50/50 border border-slate-200 hover:border-blue-300 transition-all h-full flex flex-col group">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                                <Mail size={24} />
                            </div>
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-lg font-black text-slate-800">Email Support</h3>
                                <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[9px] font-black rounded-full uppercase tracking-widest">Active</span>
                            </div>
                            <p className="text-slate-500 text-xs font-medium mb-4">Typical response time: Within 24 hours.</p>
                            <div className="mt-auto flex items-center justify-between bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                                <span className="text-sm font-black text-slate-700">support@radar.com</span>
                                <button 
                                    onClick={copyEmail}
                                    className="p-2 hover:bg-slate-50 rounded-lg transition-all text-blue-600 flex items-center gap-2"
                                >
                                    {copied ? <CheckCircle size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                    <span className="text-[10px] font-black uppercase">{copied ? 'Copied' : 'Copy'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="p-8 rounded-[20px] bg-slate-50/50 border border-slate-200 hover:border-emerald-300 transition-all h-full flex flex-col">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
                                <Phone size={24} />
                            </div>
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-lg font-black text-slate-800">Phone Support</h3>
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-full uppercase tracking-widest">Available</span>
                            </div>
                            <p className="text-slate-500 text-xs font-medium mb-4">Mon–Sat, 10:00 AM – 6:00 PM IST</p>
                            <div className="mt-auto bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                                <div className="text-sm font-black text-slate-700">+91 98765 43210</div>
                                <div className="text-[9px] text-slate-400 font-bold italic mt-0.5">Note: (For demo purposes only)</div>
                            </div>
                        </div>
                    </div>

                    {/* 3. CONTACT FORM (Full Width) */}
                    <div ref={contactRef} className="p-8 rounded-[24px] border border-slate-200 bg-slate-50/30">
                        <div className="mb-8">
                            <h2 className="text-2xl font-black text-slate-800">Send us a Message</h2>
                            <p className="text-sm text-slate-500 font-medium">Have a specific inquiry? Fill out the form below.</p>
                        </div>

                        {toast && (
                            <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold flex items-center gap-3 ${
                                toast.type === 'success'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-rose-200 bg-rose-50 text-rose-700'
                            }`}>
                                {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                                <span>{toast.message}</span>
                            </div>
                        )}

                        {formStatus === 'success' ? (
                            <div className="bg-emerald-50 border border-emerald-100 p-10 rounded-[20px] flex flex-col items-center text-center gap-4 animate-in zoom-in duration-300">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-50">
                                    <CheckCircle size={32} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-emerald-800">Message Received!</h4>
                                    <p className="text-sm text-emerald-600 font-bold">Our team will get back to you shortly.</p>
                                </div>
                            </div>
                        ) : formStatus === 'error' ? (
                            <div className="bg-rose-50 border border-rose-100 p-10 rounded-[20px] rounded-[20px] flex flex-col items-center text-center gap-4 animate-in zoom-in duration-300">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-rose-600 shadow-sm border border-rose-50">
                                    <AlertTriangle size={32} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-rose-800">Message Failed</h4>
                                    <p className="text-sm text-rose-600 font-bold">Please try again in a moment.</p>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Name</label>
                                        <input name="name" type="text" required placeholder="John Doe" className="w-full px-5 py-4 rounded-xl bg-white border border-slate-200 text-xs font-bold outline-none focus:border-blue-500 transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email Address</label>
                                        <input name="email" type="email" required placeholder="john@example.com" className="w-full px-5 py-4 rounded-xl bg-white border border-slate-200 text-xs font-bold outline-none focus:border-blue-500 transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Subject</label>
                                    <input name="subject" type="text" required placeholder="How can we help?" className="w-full px-5 py-4 rounded-xl bg-white border border-slate-200 text-xs font-bold outline-none focus:border-blue-500 transition-all" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Message</label>
                                    <textarea name="message" required rows="5" placeholder="Tell us more about your issue..." className="w-full px-5 py-4 rounded-xl bg-white border border-slate-200 text-xs font-bold outline-none focus:border-blue-500 transition-all resize-none" />
                                </div>
                                <button type="submit" className="w-full md:w-auto px-10 py-4 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-200 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all" disabled={formStatus === 'loading'}>
                                    {formStatus === 'loading' ? 'Sending...' : <>Send Message <Send size={14} /></>}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* 4. FAQ SECTION */}
                    <div className="p-8 rounded-[24px] border border-slate-200 bg-white">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800">Common Questions</h2>
                                <p className="text-sm text-slate-500 font-medium">Quick answers from our knowledge base.</p>
                            </div>
                            <button className="text-blue-600 text-xs font-black flex items-center gap-1 hover:underline">
                                View all articles <ArrowRight size={14} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {faqs.map((faq, idx) => (
                                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden group">
                                    <button 
                                        onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                        className="w-full px-6 py-5 flex justify-between items-center text-left hover:bg-slate-100/50 transition-colors"
                                    >
                                        <span className="text-[13px] font-black text-slate-800">{faq.q}</span>
                                        {openFaq === idx ? <ChevronUp size={18} className="text-blue-600" /> : <ChevronDown size={18} className="text-slate-400" />}
                                    </button>
                                    {openFaq === idx && (
                                        <div className="px-6 pb-6 text-xs text-slate-500 font-medium leading-relaxed animate-in slide-in-from-top-2">
                                            {faq.a}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
