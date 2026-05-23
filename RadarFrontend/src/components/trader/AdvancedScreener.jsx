import React, { useState, useEffect } from 'react';
import { 
    Filter, 
    Star, 
    TrendingUp, 
    Users, 
    Activity, 
    BarChart3, 
    Banknote, 
    ShieldCheck, 
    ChevronRight,
    Search,
    SlidersHorizontal,
    Plus,
    X,
    Info,
    Check,
    ChevronDown,
    Zap,
    LayoutDashboard,
    Trash2
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { runScreenerScan, createCustomFilter, getCustomFilters, deleteCustomFilter } from "../../api/screenerApi";

const mockReadyMade = [
    { id: 1, title: 'Consistent Growers', desc: '15%+ profit growth over 3 years.', icon: Activity, color: 'text-[#42C0A5]', bg: 'bg-[#42C0A5]/10' },
    { id: 2, title: 'Strong Financials', desc: 'Low debt, high cash flow.', icon: Banknote, color: 'text-[#42C0A5]', bg: 'bg-[#42C0A5]/10' },
    { id: 3, title: 'Value Picks', desc: 'Trading below intrinsic value.', icon: ShieldCheck, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { id: 4, title: 'High Yielders', desc: 'Top 5% dividend yield stocks.', icon: Star, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { id: 5, title: 'Institutional Favorites', desc: 'Highest FII/DII accumulation.', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
    { id: 6, title: 'Debt-Free Leaders', desc: 'Zero debt balance sheet giants.', icon: Zap, color: 'text-red-400', bg: 'bg-red-400/10' },
    { id: 7, title: 'ESG Score', desc: 'Leading sustainability scores.', icon: ShieldCheck, color: 'text-teal-400', bg: 'bg-teal-400/10' },
];

// Empty — live data is loaded from runScreenerScan() in the useEffect below
const mockResults = [];

const strategies = [
    { id: 'intra', label: 'Intraday Volatility', desc: 'High momentum stocks for quick trades', icon: Activity, color: 'text-[#42C0A5]', filters: { change: '> 2%', volume: 'High', rsi: 'Overbought' } },
    { id: 'lowrisk', label: 'Defensive Growth', desc: 'Stable, low beta picks for steady gains', icon: ShieldCheck, color: 'text-blue-400', filters: { beta: '< 0.8', yield: '> 2%', mcap: 'Large' } },
    { id: 'dip', label: 'Contrarian Buy', desc: 'Oversold bounces at critical support', icon: TrendingUp, color: 'text-amber-400', filters: { change: '< -3%', rsi: 'Oversold' } },
    { id: 'breakout', label: 'Momentum Breakout', desc: 'Riding the wave of volume breakouts', icon: BarChart3, color: 'text-purple-400', filters: { change: '> 1.5%', volume: 'Very High' } },
    { id: 'gappers', label: 'Volume Gappers', desc: 'Significant pre-market volume gaps', icon: Zap, color: 'text-orange-400', filters: { change: '> 3%', volume: 'Extreme' } },
    { id: 'orb', label: 'Opening Range Breakout', desc: 'Volatility spikes in early session', icon: Activity, color: 'text-pink-400', filters: { change: '> 1%', volume: 'High' } },
    { id: 'swing', label: 'Overnight Stars', desc: 'Strong closing with institutional accumulation', icon: Star, color: 'text-yellow-400', filters: { change: '> 0%', volume: 'High' } },
];

const allFilters = [
    { id: 'mcap', label: 'Market Cap', icon: BarChart3, options: ['Large', 'Mid', 'Small', 'Micro'] },
    { id: 'price', label: 'Price', icon: Banknote, options: ['Any', '< ?500', '?500 - ?2k', '> ?2k'] },
    { id: 'change', label: 'Change %', icon: TrendingUp, options: ['Any', '> 0%', '> 2%', '> 5%', '< 0%'] },
    { id: 'sector', label: 'Sector', icon: Search, options: ['All', 'IT', 'Finance', 'FMCG', 'Auto', 'Energy', 'Healthcare'] },
    { id: 'roe', label: 'ROE', icon: Activity, options: ['Any', '> 10%', '> 15%', '> 20%'] },
    { id: 'pe', label: 'P/E', icon: Filter, options: ['Any', 'Low (<15)', 'Medium', 'High'] },
    { id: 'yield', label: 'Div. Yield', icon: Banknote, options: ['Any', '> 1%', '> 2%', '> 3%'] },
    { id: 'volume', label: 'Volume', icon: Activity, options: ['Any', 'Low', 'Normal', 'High', 'Very High'] },
    { id: 'rsi', label: 'RSI', icon: BarChart3, options: ['Any', 'Oversold (<30)', 'Neutral', 'Overbought (>70)'] },
    { id: 'beta', label: 'Beta', icon: ShieldCheck, options: ['Any', '< 0.8', '0.8 - 1.2', '> 1.2'] },
    { id: 'debt', label: 'Debt/Eq', icon: Filter, options: ['Low (<0.5)', 'Moderate', 'High'] },
    { id: 'eps', label: 'EPS Growth', icon: TrendingUp, options: ['Any', '> 5%', '> 15%', '> 25%'] },
    { id: 'range', label: '52W Range', icon: SlidersHorizontal, options: ['Any', 'Near High', 'Near Low', 'Midway'] },
    { id: 'inst', label: 'Inst. Holding', icon: Users, options: ['Any', '> 50%', '> 70%', 'Increasing'] },
    { id: 'margin', label: 'Profit Margin', icon: Activity, options: ['Any', '> 10%', '> 20%', '> 30%'] },
    { id: 'peg', label: 'PEG Ratio', icon: Filter, options: ['Any', '< 1 (Cheap)', '1 - 2', '> 2'] },
    { id: 'pb', label: 'Price/Book', icon: Banknote, options: ['Any', '< 1', '< 3', '> 5'] },
];

const AdvancedScreener = () => {
    const [activeFilters, setActiveFilters] = useState({});
    const [visibleFilters, setVisibleFilters] = useState(['mcap', 'price', 'change', 'sector', 'roe', 'pe']);
    const [activeStrategy, setActiveStrategy] = useState(null);
    const [openFilter, setOpenFilter] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showSignalModal, setShowSignalModal] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // ── Custom Filters state ──────────────────────────────────
    const [myFilters, setMyFilters] = useState([]);
    const [newFilterName, setNewFilterName] = useState('');
    const [newFilterOptions, setNewFilterOptions] = useState('');
    const [newFilterQuery, setNewFilterQuery] = useState('SELECT * FROM market WHERE x > y');
    const [filterSaving, setFilterSaving] = useState(false);
    const [filterError, setFilterError] = useState('');

    useEffect(() => {
        const style = document.createElement('style');
        style.id = 'advanced-screener-styles';
        style.innerHTML = `
            .trader-theme .filter-dropdown {
                background: #161b22;
                border: 1px solid #30363d;
                box-shadow: 0 10px 40px rgba(0,0,0,0.4);
                animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .trader-theme .filter-chip {
                background: rgba(48, 54, 61, 0.4);
                border: 1px solid #30363d;
                color: #8b949e;
                transition: all 0.2s;
            }
            .trader-theme .filter-chip:hover {
                background: rgba(48, 54, 61, 0.8);
                color: #f0f6fc;
                border-color: #42C0A5;
            }
            .trader-theme .filter-chip.active {
                background: rgba(66, 192, 165, 0.1);
                border-color: #42C0A5;
                color: #42C0A5;
            }
            .trader-theme .custom-input-box {
                background: #0d1117;
                border: 1px solid #30363d;
                color: #f0f6fc;
            }
            .trader-theme .custom-input-box:focus {
                border-color: #42C0A5;
                box-shadow: 0 0 0 3px rgba(66, 192, 165, 0.15);
            }
            .trader-theme .horizontal-carousel::-webkit-scrollbar { display: none; }
            .trader-theme .strategy-chip {
                background: rgba(33, 38, 45, 0.5);
                border: 1px solid #30363d;
                color: #8b949e;
            }
            .trader-theme .strategy-chip.active {
                background: rgba(66, 192, 165, 0.1);
                border-color: #42C0A5;
                color: #42C0A5;
            }
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-8px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
        `;
        document.head.appendChild(style);
        return () => {
            const el = document.getElementById('advanced-screener-styles');
            if (el) document.head.removeChild(el);
        };
    }, []);

    const handleFilterChange = (id, value) => {
        setActiveFilters(prev => ({ ...prev, [id]: value }));
        setOpenFilter(null);
        setActiveStrategy(null);
    };

    const handleStrategySelect = (strat) => {
        setShowSignalModal(strat);
        setActiveStrategy(strat.id);
        setActiveFilters(prev => ({ ...prev, ...strat.filters }));
    };

    const addMoreFilter = (id) => {
        if (!visibleFilters.includes(id)) {
            setVisibleFilters(prev => [...prev, id]);
        }
        setOpenFilter(null);
    };

    // ── Custom filter helpers ─────────────────────────────────
    const loadMyFilters = async () => {
        try {
            const res = await getCustomFilters();
            const filters = res?.data || [];
            setMyFilters(filters);
            filters.forEach(f => {
                if (!allFilters.find(af => af.id === f._id)) {
                    allFilters.push({
                        id: f._id,
                        label: f.name,
                        icon: Filter,
                        options: f.options,
                        isCustom: true,
                    });
                }
            });
        } catch (_) {}
    };

    const handleCreateFilter = async () => {
        setFilterError('');
        if (!newFilterName.trim()) {
            setFilterError('Please enter a filter name.');
            return;
        }
        try {
            setFilterSaving(true);
            const res = await createCustomFilter({
                name: newFilterName.trim(),
                options: newFilterOptions,
                logicQuery: newFilterQuery,
            });
            const created = res.data;
            setMyFilters(prev => [created, ...prev]);
            allFilters.push({
                id: created._id,
                label: created.name,
                icon: Filter,
                options: created.options,
                isCustom: true,
            });
            setVisibleFilters(prev => [...prev, created._id]);
            setNewFilterName('');
            setNewFilterOptions('');
            setNewFilterQuery('SELECT * FROM market WHERE x > y');
            setShowCreateModal(false);
        } catch (err) {
            setFilterError(err?.response?.data?.message || 'Failed to create filter.');
        } finally {
            setFilterSaving(false);
        }
    };

    const handleDeleteMyFilter = async (id) => {
        try {
            await deleteCustomFilter(id);
            setMyFilters(prev => prev.filter(f => f._id !== id));
            setVisibleFilters(prev => prev.filter(vid => vid !== id));
        } catch (_) {}
    };

    useEffect(() => {
        loadMyFilters();
    }, []);

    // Live screener scan — replaces mockResults
    useEffect(() => {
        let active = true;
        const scan = async () => {
            setIsLoading(true);
            try {
                // Map UI filter strings to backend numeric filters
                const backendFilters = {};
                
                if (activeFilters.mcap && activeFilters.mcap !== 'Any') {
                    if (activeFilters.mcap === 'Large') backendFilters.minMarketCap = 10000000000;
                    if (activeFilters.mcap === 'Mid') { backendFilters.minMarketCap = 2000000000; backendFilters.maxMarketCap = 10000000000; }
                    if (activeFilters.mcap === 'Small') { backendFilters.minMarketCap = 300000000; backendFilters.maxMarketCap = 2000000000; }
                    if (activeFilters.mcap === 'Micro') backendFilters.maxMarketCap = 300000000;
                }
                if (activeFilters.change && activeFilters.change !== 'Any') {
                    if (activeFilters.change === '> 0%') backendFilters.minChange = 0;
                    if (activeFilters.change === '> 2%') backendFilters.minChange = 2;
                    if (activeFilters.change === '> 5%') backendFilters.minChange = 5;
                    if (activeFilters.change === '< 0%') backendFilters.maxChange = 0;
                    // Strategy filters
                    if (activeFilters.change === '< -3%') backendFilters.maxChange = -3;
                    if (activeFilters.change === '> 1.5%') backendFilters.minChange = 1.5;
                    if (activeFilters.change === '> 3%') backendFilters.minChange = 3;
                    if (activeFilters.change === '> 1%') backendFilters.minChange = 1;
                }
                if (activeFilters.sector && activeFilters.sector !== 'All') {
                    backendFilters.sectors = [activeFilters.sector];
                }
                if (activeFilters.pe && activeFilters.pe !== 'Any') {
                    if (activeFilters.pe.includes('Low')) backendFilters.maxPe = 15;
                    if (activeFilters.pe.includes('Medium')) { backendFilters.minPe = 15; backendFilters.maxPe = 30; }
                    if (activeFilters.pe.includes('High')) backendFilters.minPe = 30;
                }
                if (activeFilters.volume && activeFilters.volume !== 'Any') {
                    if (activeFilters.volume === 'Low') backendFilters.volumeStatus = 'low_volume';
                    if (activeFilters.volume === 'Normal') backendFilters.volumeStatus = 'average';
                    if (activeFilters.volume === 'High') backendFilters.volumeStatus = 'high_volume';
                    if (activeFilters.volume === 'Very High' || activeFilters.volume === 'Extreme') backendFilters.volumeStatus = 'high_volume';
                }
                if (activeFilters.rsi && activeFilters.rsi !== 'Any') {
                    if (activeFilters.rsi.includes('Oversold')) backendFilters.maxRsi = 30;
                    if (activeFilters.rsi.includes('Overbought')) backendFilters.minRsi = 70;
                    if (activeFilters.rsi.includes('Neutral')) { backendFilters.minRsi = 30; backendFilters.maxRsi = 70; }
                }

                const payload = { filters: backendFilters, limit: 50 };

                const raw = await runScreenerScan(payload);
                if (!active) return;
                // Backend wraps: { success, data: { results: [...] } }
                // Handle both wrapped and unwrapped shapes
                const inner = raw?.data ?? raw;
                const rows = inner?.results ?? inner?.stocks ?? (Array.isArray(inner) ? inner : []);
                
                setResults(rows.map((s, i) => ({
                    id: (s.displaySymbol || s.symbol || s.ticker || `r-${i}`).replace(/\.(NS|BO)$/i, ''),
                    name: s.name || s.displaySymbol || s.symbol || '',
                    price: (s.price != null && s.price !== 0)
                        ? `₹${Number(s.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        : '—',
                    change: s.change != null
                        ? `${Number(s.change) >= 0 ? '+' : ''}${Number(s.change).toFixed(2)}%`
                        : '0.00%',
                    isPositive: Number(s.change ?? 0) >= 0,
                    mcap: s.marketCapNumeric
                        ? `₹${(s.marketCapNumeric / 1e12).toFixed(2)}T`
                        : (s.marketCap || '—'),
                    sector: s.sector || 'Equity',
                    why: s.why || s.reason || 'Matched screener criteria.',
                    tags: Array.isArray(s.tags) && s.tags.length
                        ? s.tags
                        : [s.sector || 'Equity', s.signal || s.bias || 'equity'].filter(Boolean),
                    confidence: Number(s.confidence ?? s.score ?? 75),
                    yield: s.dividendYield ? `${s.dividendYield}%` : '—',
                    beta: Number(s.beta ?? 1),
                    volume: s.volume ? `${(Number(s.volume) / 1e6).toFixed(1)}M` : '—',
                    pe: Number(s.pe ?? 0),
                    roe: s.roe ? `${Number(s.roe).toFixed(1)}%` : '—',
                    trend: s.trend || Array.from({ length: 5 }, (_, k) =>
                        Number(s.price || 100) * (1 + (k - 2) * 0.01)
                    ),
                })));
            } catch (err) {
                console.warn('AdvancedScreener scan failed:', err.message);
            } finally {
                if (active) setIsLoading(false);
            }
        };
        scan();
        return () => { active = false; };
    }, [JSON.stringify(activeFilters)]);

    const filteredResults = results.filter(stock => {
        const id = stock.id || stock.symbol || '';
        if (searchTerm && !id.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (activeFilters.mcap && activeFilters.mcap !== 'Any') {
            if (activeFilters.mcap === 'Large' && !stock.mcap.includes('T')) return false;
        }
        if (activeFilters.sector && activeFilters.sector !== 'All') {
            if (!stock.sector.includes(activeFilters.sector)) return false;
        }
        return true;
    });

    return (
        <div className="trader-theme flex flex-col w-full min-h-screen bg-[#0b0f17] text-[#8b949e] p-4 md:p-8">
            <div className="max-w-[1700px] mx-auto w-full">
                
                {}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 px-2">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#42C0A5]/10 flex items-center justify-center text-[#42C0A5] border border-[#42C0A5]/20 shadow-[0_0_20px_rgba(66,192,165,0.1)]">
                            <Zap size={24} fill="currentColor" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-[#f0f6fc] tracking-tight">Advanced Smart Screener</h1>
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#42C0A5]">
                                <Activity size={12} />
                                Multi-dimensional Signal Discovery
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setShowCreateModal(true)}
                            className="bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] px-5 py-2.5 rounded-xl text-sm font-bold text-[#c9d1d9] transition-all flex items-center gap-2 group"
                        >
                            <Plus size={18} className="text-[#42C0A5] group-hover:scale-125 transition-transform" />
                            Create Filter
                        </button>
                        <button className="bg-[#42C0A5] hover:bg-[#36a68f] text-[#0b0f17] px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 shadow-lg shadow-[#42C0A5]/20">
                            <Star size={18} fill="#0b0f17" />
                            Save Configuration
                        </button>
                    </div>
                </div>

                {}
                <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 mb-8 shadow-2xl relative z-40 overflow-visible">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 pr-4 border-r border-[#30363d] text-[#c9d1d9] font-bold text-sm">
                            <SlidersHorizontal size={18} className="text-[#42C0A5]" />
                            Metrics
                        </div>
                        
                        {allFilters.filter(f => visibleFilters.includes(f.id)).map(f => {
                            const Icon = f.icon;
                            return (
                                <div key={f.id} className="relative">
                                    <div 
                                        onClick={() => setOpenFilter(openFilter === f.id ? null : f.id)}
                                        className={`filter-chip px-4 py-2 rounded-xl flex items-center gap-2.5 text-[13px] font-bold cursor-pointer transition-all ${activeFilters[f.id] ? 'active' : ''}`}
                                    >
                                        <Icon size={14} className="opacity-70" />
                                        <span>{f.label}:</span>
                                        <span className="text-[#f0f6fc]">{activeFilters[f.id] || 'Any'}</span>
                                        <ChevronDown size={14} className={`transition-transform duration-300 ${openFilter === f.id ? 'rotate-180' : ''}`} />
                                    </div>
                                    
                                    {openFilter === f.id && (
                                        <div className="filter-dropdown absolute top-full left-0 mt-2 p-3 min-w-[220px] rounded-xl z-50">
                                            <div className="mb-3">
                                                <div className="text-[10px] font-black uppercase tracking-wider mb-2 text-[#42C0A5]/70">Custom Input</div>
                                                <input 
                                                    type="text" 
                                                    className="custom-input-box"
                                                    placeholder={`Enter ${f.label}...`}
                                                    value={activeFilters[f.id] || ''}
                                                    onChange={(e) => handleFilterChange(f.id, e.target.value)}
                                                />
                                            </div>
                                            <div className="text-[10px] font-black uppercase tracking-wider mb-2 text-[#42C0A5]/70 border-t border-[#30363d] pt-2">Presets</div>
                                            <div className="space-y-1">
                                                {f.options.map(opt => (
                                                    <button 
                                                        key={opt}
                                                        onClick={() => handleFilterChange(f.id, opt)}
                                                        className={`w-full text-left px-3 py-2 rounded text-xs font-bold transition-colors ${activeFilters[f.id] === opt ? 'bg-[#42C0A5]/10 text-[#42C0A5]' : 'hover:bg-white/5 text-[#8b949e]'}`}
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        
                        <div className="relative">
                            <button 
                                onClick={() => setOpenFilter(openFilter === 'add' ? null : 'add')}
                                className="px-4 py-2 text-[13px] font-bold text-[#42C0A5] hover:bg-[#42C0A5]/5 rounded-xl transition-all flex items-center gap-2"
                            >
                                <Plus size={16} /> Add Filter
                            </button>
                            {openFilter === 'add' && (
                                <div className="filter-dropdown absolute top-full right-0 mt-2 p-2 min-w-[200px] rounded-xl z-50 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {allFilters.filter(f => !visibleFilters.includes(f.id)).map(f => {
                                        const Icon = f.icon;
                                        return (
                                            <button 
                                                key={f.id}
                                                onClick={() => addMoreFilter(f.id)}
                                                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-[#8b949e] hover:bg-white/5 hover:text-[#f0f6fc] flex items-center gap-3"
                                            >
                                                <Icon size={14} className="opacity-50" />
                                                {f.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {}
                    <div className="mt-4 pt-4 border-t border-[#30363d] flex items-center gap-4">
                        <span className="text-[10px] font-black text-[#8b949e] uppercase tracking-[0.2em] px-2">Market Signals</span>
                        <div className="flex gap-2.5">
                            {strategies.map(s => {
                                const Icon = s.icon;
                                return (
                                    <button 
                                        key={s.id}
                                        onClick={() => handleStrategySelect(s)}
                                        className={`strategy-chip px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2.5 transition-all ${activeStrategy === s.id ? 'active' : ''}`}
                                    >
                                        <Icon size={14} className={activeStrategy === s.id ? 'text-[#42C0A5]' : s.color} />
                                        {s.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                             <div className="flex items-center gap-2 font-black text-[#c9d1d9] text-sm">
                                <TrendingUp size={16} className="text-orange-400" />
                                EXPLODING THEMES
                             </div>
                             <ChevronRight size={16} className="text-[#8b949e]" />
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                            {[
                                { title: 'Intraday Highs', val: '+12%', sub: 'Active Scans: 12' },
                                { title: 'Bullish Crossover', val: '+5.5%', sub: 'Active Scans: 28' },
                                { title: 'Volume Spike', val: '+8.2%', sub: 'Active Scans: 44' },
                                { title: 'RSI Oversold', val: '+2.1%', sub: 'Active Scans: 19' },
                                { title: 'Golden Cross', val: '+14.2%', sub: 'Active Scans: 7' },
                                { title: 'High Vol Gappers', val: '+22.5%', sub: 'Active Scans: 15' },
                                { title: 'Opening Breakout', val: '+18.1%', sub: 'Active Scans: 32' },
                                { title: 'Crypto-related STK', val: '+31.4%', sub: 'Active Scans: 5' },
                            ].map((t, i) => (
                                <div key={i} className="min-w-[220px] bg-[#161b22] border border-[#30363d] p-5 rounded-2xl hover:border-[#42C0A5]/40 cursor-pointer transition-all group relative overflow-hidden">
                                     <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <TrendingUp size={40} className="text-[#42C0A5]" />
                                     </div>
                                     <div className="text-[10px] font-black text-[#42C0A5] mb-2 tracking-widest uppercase">Strategy {i+1}</div>
                                     <div className="text-sm font-bold text-[#f0f6fc] mb-1">{t.title}</div>
                                     <div className="flex items-center justify-between mt-4">
                                        <div className="text-[11px] text-[#8b949e] font-bold">{t.sub}</div>
                                        <span className="text-[10px] font-black text-[#42C0A5] bg-[#42C0A5]/10 px-2 py-0.5 rounded-full">{t.val}</span>
                                     </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                             <div className="flex items-center gap-2 font-black text-[#c9d1d9] text-sm">
                                <ShieldCheck size={16} className="text-blue-400" />
                                INSTITUTIONAL PICKS
                             </div>
                             <ChevronRight size={16} className="text-[#8b949e]" />
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                            {mockReadyMade.map(item => {
                                const Icon = item.icon;
                                return (
                                    <div key={item.id} className="min-w-[240px] bg-[#161b22] border border-[#30363d] p-4 rounded-xl hover:border-[#42C0A5]/40 cursor-pointer transition-all">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Icon size={18} className={item.color} />
                                            <span className="text-sm font-bold text-[#f0f6fc]">{item.title}</span>
                                        </div>
                                        <p className="text-[11px] text-[#8b949e] line-clamp-1">{item.desc}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {}
                <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-2xl">
                    <div className="p-5 border-b border-[#30363d] flex items-center justify-between bg-[#1c2128]">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" />
                                <input 
                                    type="text" 
                                    placeholder="Search Ticker..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-[#0b0f17] border border-[#30363d] rounded-lg pl-9 pr-4 py-2 text-xs font-bold text-[#f0f6fc] focus:border-[#42C0A5] outline-none transition-all w-64"
                                />
                            </div>
                            <div className="h-6 w-[1px] bg-[#30363d]"></div>
                            <span className="text-[11px] font-black text-[#8b949e] uppercase tracking-widest">Matches: <span className="text-[#42C0A5]">{filteredResults.length} Assets</span></span>
                        </div>
                        <div className="flex gap-3">
                            <button className="bg-[#21262d] text-[#c9d1d9] px-4 py-2 rounded-lg text-xs font-bold border border-[#30363d] hover:bg-[#30363d] transition-all">Settings</button>
                            <button className="bg-[#42C0A5] text-[#0b0f17] px-4 py-2 rounded-lg text-xs font-black shadow-lg shadow-[#42C0A5]/10">Export Dataset</button>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[#0b0f17]/50 border-b border-[#30363d]">
                                <tr className="text-[10px] font-black text-[#484f58] uppercase tracking-[0.2em]">
                                    <th className="p-4">Asset</th>
                                    <th className="p-4">Price</th>
                                    <th className="p-4">Change</th>
                                    <th className="p-4">Trend</th>
                                    <th className="p-4">Metrics</th>
                                    <th className="p-4">Diagnostic Insight</th>
                                    <th className="p-4 text-center">Confidence</th>
                                    <th className="p-4">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#30363d]">
                                {isLoading ? (
                                    <tr><td colSpan={8} className="p-8 text-center text-[#8b949e] text-sm font-bold animate-pulse">Scanning market data...</td></tr>
                                ) : filteredResults.length === 0 ? (
                                    <tr><td colSpan={8} className="p-8 text-center text-[#8b949e] text-sm font-bold">No results matched your filters.</td></tr>
                                ) : filteredResults.map(stock => (
                                    <tr key={stock.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-[#21262d] flex items-center justify-center text-[10px] font-black text-[#42C0A5]">STK</div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-[#f0f6fc] group-hover:text-[#42C0A5] transition-colors">{(stock.id || '').split('.')[0]}</span>
                                                    <span className="text-[10px] text-[#8b949e] font-bold uppercase">{stock.sector}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 font-mono text-sm text-[#f0f6fc]">{stock.price}</td>
                                        <td className="p-4 font-mono text-sm">
                                            <span className={`px-2 py-0.5 rounded text-[11px] font-black ${stock.isPositive ? 'text-[#42C0A5] bg-[#42C0A5]/10' : 'text-[#f85149] bg-[#f85149]/10'}`}>
                                                {stock.change}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="w-20 h-7">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={stock.trend.map((v, i) => ({ p: v, i }))}>
                                                        <defs>
                                                            <linearGradient id={`t-grad-${stock.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={stock.isPositive ? '#42C0A5' : '#f85149'} stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor={stock.isPositive ? '#42C0A5' : '#f85149'} stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <Area 
                                                            type="monotone" 
                                                            dataKey="p" 
                                                            stroke={stock.isPositive ? '#42C0A5' : '#f85149'} 
                                                            fill={`url(#t-grad-${stock.id})`}
                                                            strokeWidth={1.5}
                                                            isAnimationActive={false}
                                                        />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-0.5 min-w-[70px]">
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span className="text-[#484f58]">P/E</span>
                                                    <span className="text-[#c9d1d9]">{stock.pe}</span>
                                                </div>
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span className="text-[#484f58]">ROE</span>
                                                    <span className="text-[#c9d1d9]">{stock.roe}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 max-w-[450px]">
                                            <div className="flex flex-col gap-2">
                                                <p className="text-[13px] text-[#8b949e] font-medium leading-tight">{stock.why}</p>
                                                <div className="flex gap-2">
                                                    {stock.tags.map(t => (
                                                        <span key={t} className="text-[9px] font-black px-2 py-0.5 bg-[#21262d] text-[#c9d1d9] rounded uppercase tracking-wider">
                                                            {t}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="text-[11px] font-black text-[#f0f6fc]">{stock.confidence}%</span>
                                                <div className="w-20 h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-[#42C0A5] to-emerald-300" style={{ width: `${stock.confidence}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <button className="p-2 rounded-lg bg-[#21262d] text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#30363d] transition-all border border-[#30363d]">
                                                <Star size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Create Filter Modal ───────────────────────────── */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
                    <div className="bg-[#161b22] border border-[#30363d] rounded-3xl w-full max-w-md p-8 relative z-10 shadow-2xl">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-[#f0f6fc]">Create Filter</h2>
                                <p className="text-sm font-bold text-[#8b949e]">Define custom processing logic</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="text-[#8b949e] hover:text-white transition-colors"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-[#42C0A5] uppercase tracking-widest mb-1.5 ml-1">Filter Name</label>
                                <input
                                    type="text"
                                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-3 text-sm text-[#f0f6fc] outline-none focus:border-[#42C0A5] transition-all"
                                    placeholder="e.g. FII Holding %"
                                    value={newFilterName}
                                    onChange={e => setNewFilterName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-[#42C0A5] uppercase tracking-widest mb-1.5 ml-1">Options (comma separated)</label>
                                <textarea
                                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-3 text-sm text-[#f0f6fc] outline-none focus:border-[#42C0A5] h-20 transition-all"
                                    placeholder="Large, Mid, Small..."
                                    value={newFilterOptions}
                                    onChange={e => setNewFilterOptions(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-[#42C0A5] uppercase tracking-widest mb-1.5 ml-1">Logic Query</label>
                                <div className="p-4 bg-[#0d1117] border border-[#30363d] rounded-xl">
                                    <textarea
                                        className="w-full bg-transparent text-[#42C0A5] font-mono text-xs outline-none resize-none"
                                        rows={2}
                                        value={newFilterQuery}
                                        onChange={e => setNewFilterQuery(e.target.value)}
                                        spellCheck={false}
                                    />
                                </div>
                            </div>
                            {filterError && (
                                <p className="text-xs font-bold text-[#f85149] pl-1">{filterError}</p>
                            )}
                            <button
                                onClick={handleCreateFilter}
                                disabled={filterSaving}
                                className="w-full py-4 bg-[#42C0A5] text-[#0b0f17] rounded-xl font-black text-lg shadow-lg shadow-[#42C0A5]/10 mt-4 active:scale-95 transition-all disabled:opacity-60"
                            >
                                {filterSaving ? 'Saving...' : 'Create Filter Metric'}
                            </button>
                        </div>

                        {/* My saved filters */}
                        {myFilters.length > 0 && (
                            <div className="mt-6 pt-5 border-t border-[#30363d]">
                                <p className="text-[10px] font-black text-[#8b949e] uppercase tracking-widest mb-3">My Saved Filters</p>
                                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                    {myFilters.map(f => (
                                        <div key={f._id} className="flex items-center justify-between px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-xl">
                                            <div>
                                                <p className="text-sm font-black text-[#f0f6fc]">{f.name}</p>
                                                {f.options?.length > 0 && (
                                                    <p className="text-[10px] text-[#8b949e] font-bold">{f.options.join(', ')}</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteMyFilter(f._id)}
                                                className="p-1.5 text-[#8b949e] hover:text-[#f85149] hover:bg-[#f85149]/10 rounded-lg transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showSignalModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSignalModal(null)} />
                    <div className="bg-[#161b22] border border-[#30363d] rounded-3xl w-full max-w-sm p-8 relative z-10 shadow-2xl text-center">
                        {(() => {
                            const Icon = showSignalModal.icon || Activity;
                            return (
                                <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-2xl bg-[#42C0A5]/10 text-[#42C0A5] border border-[#42C0A5]/20`}>
                                    <Icon size={32} strokeWidth={3} />
                                </div>
                            );
                        })()}
                        <h2 className="text-xl font-black text-[#f0f6fc] mb-2">{showSignalModal.label}</h2>
                        <p className="text-[#8b949e] font-bold mb-6 text-sm leading-relaxed">{showSignalModal.desc}</p>
                        <div className="p-4 bg-[#0d1117] rounded-2xl text-left mb-6 border border-[#30363d]">
                            <span className="text-[10px] font-black text-[#42C0A5] uppercase tracking-widest block mb-2">Conditions</span>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(showSignalModal.filters).map(([k, v]) => (
                                    <span key={k} className="text-[11px] font-bold px-2 py-1 bg-[#161b22] border border-[#30363d] rounded text-[#c9d1d9] capitalize">
                                        {k}: <span className="text-[#42C0A5]">{v}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                        <button onClick={() => setShowSignalModal(null)} className="w-full py-3 bg-[#30363d] text-[#f0f6fc] rounded-xl font-black hover:bg-[#3d444d] transition-all">Close Pipeline</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdvancedScreener;
