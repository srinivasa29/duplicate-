import React, { useState } from 'react';
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
    ChevronDown,
    Search,
    SlidersHorizontal,
    Plus,
    X,
    Info,
    Check,
    ArrowUpRight,
    Zap,
    RefreshCw,
    Trash2,
    Download
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { runScreenerScan, createCustomFilter, getCustomFilters, deleteCustomFilter } from '../../api/screenerApi';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const MOCK_READY_MADE = [
    { id: 'div', title: 'Dividend Giants', desc: 'Top yield names with stable cash flows and 5Y growth.', icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50', filters: { yield: '> 3%', mcap: 'Large' } },
    { id: 'it', title: 'IT Breakouts', desc: 'Volume leaders in tech with RSI momentum signals.', icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50', filters: { sector: 'IT', volume: 'High' } },
    { id: 'value', title: 'Deep Value Gems', desc: 'Lowest P/E stocks with positive earnings surprises.', icon: ShieldCheck, color: 'text-purple-600', bg: 'bg-purple-50', filters: { pe: 'Low (<15)', roe: '> 15%' } }
];

const MOCK_FALLBACK_RESULTS = [
    { 
        id: 'HDFCBANK.NS', price: '₹1,652', change: '+0.4%', isPositive: true, sector: 'Finance', mcap: '12.5T', pe: '18.2', roe: '16.5%', yield: '1.2%', confidence: 92,
        why: 'Price testing major demand zone with high institutional delivery.', 
        tags: ['Value', 'Large Cap'], trend: [1640, 1645, 1642, 1650, 1648, 1652]
    },
    { 
        id: 'RELIANCE.NS', price: '₹2,985', change: '+1.1%', isPositive: true, sector: 'Energy', mcap: '20.1T', pe: '24.5', roe: '14.2%', yield: '0.8%', confidence: 85,
        why: 'Breakout above 20-day EMA on increased relative volume.', 
        tags: ['Momentum', 'Bluechip'], trend: [2950, 2960, 2975, 2980, 2970, 2985]
    }
];

const strategies = [
    { id: 'intra', label: 'Intraday Volatility', desc: 'High momentum stocks for quick trades', icon: Activity, color: 'text-emerald-500', filters: { change: '> 2%', volume: 'High' } },
    { id: 'lowrisk', label: 'Low Risk Portfolio', desc: 'Stable, low beta picks for steady gains', icon: ShieldCheck, color: 'text-blue-500', filters: { beta: '< 0.8', yield: '> 2%' } },
    { id: 'dip', label: 'Buy the Dip', desc: 'Oversold bounces at critical support', icon: TrendingUp, color: 'text-amber-500', filters: { change: '< -3%', rsi: 'Oversold' } },
    { id: 'breakout', label: 'Breakouts', desc: 'Riding the wave of volume breakouts', icon: ArrowUpRight, color: 'text-purple-500', filters: { change: '> 1.5%', volume: 'Very High' } },
    { id: 'gappers', label: 'Volume Gappers', desc: 'Stocks with significant pre-market volume gaps', icon: Zap, color: 'text-orange-500', filters: { volume: 'Extreme', change: '> 3%' } },
    { id: 'orb', label: 'Opening Range Breakout', desc: 'Strategic filters for the first 15m breakout', icon: Activity, color: 'text-pink-500', filters: { change: '> 1%', volume: 'High' } },
    { id: 'reversal', label: 'Mean Reversion', desc: 'Statistical pullbacks to critical moving averages', icon: TrendingUp, color: 'text-teal-500', filters: { rsi: 'Neutral', change: '< 0%' } },
];

const allFilters = [
    { id: 'mcap', label: 'Market Cap', icon: BarChart3, options: ['Large', 'Mid', 'Small', 'Micro'] },
    { id: 'price', label: 'Price', icon: Banknote, options: ['Any', '< ₹500', '₹500 - ₹2k', '> ₹2k'] },
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


// ── Translate human-readable UI filter values → backend numeric format ──────
const translateFilters = (uiFilters) => {
    const out = {};

    // Change %
    const changeMap = { '> 0%': { minChange: 0 }, '> 2%': { minChange: 2 }, '> 5%': { minChange: 5 }, '< 0%': { maxChange: -0.01 } };
    if (uiFilters.change && changeMap[uiFilters.change]) Object.assign(out, changeMap[uiFilters.change]);

    // P/E
    const peMap = { 'Low (<15)': { maxPe: 15 }, 'Medium': { minPe: 15, maxPe: 30 }, 'High': { minPe: 30 } };
    if (uiFilters.pe && peMap[uiFilters.pe]) Object.assign(out, peMap[uiFilters.pe]);

    // Price
    const priceMap = { '< ₹500': { maxPrice: 500 }, '₹500 - ₹2k': { minPrice: 500, maxPrice: 2000 }, '> ₹2k': { minPrice: 2000 } };
    if (uiFilters.price && priceMap[uiFilters.price]) Object.assign(out, priceMap[uiFilters.price]);

    // Market Cap (in INR)
    const mcapMap = { 'Large': { minMarketCap: 200_000_000_000 }, 'Mid': { minMarketCap: 20_000_000_000, maxMarketCap: 200_000_000_000 }, 'Small': { minMarketCap: 1_000_000_000, maxMarketCap: 20_000_000_000 }, 'Micro': { maxMarketCap: 1_000_000_000 } };
    if (uiFilters.mcap && mcapMap[uiFilters.mcap]) Object.assign(out, mcapMap[uiFilters.mcap]);

    // Sector
    if (uiFilters.sector && uiFilters.sector !== 'All') out.sectors = [uiFilters.sector];

    // ROE (minChange uses score as proxy here; ROE isn't in backend directly)
    const roeMap = { '> 10%': { minScore: 50 }, '> 15%': { minScore: 60 }, '> 20%': { minScore: 70 } };
    if (uiFilters.roe && roeMap[uiFilters.roe]) Object.assign(out, roeMap[uiFilters.roe]);

    // RSI
    const rsiMap = { 'Oversold (<30)': { maxRsi: 30 }, 'Neutral': { minRsi: 40, maxRsi: 60 }, 'Overbought (>70)': { minRsi: 70 } };
    if (uiFilters.rsi && rsiMap[uiFilters.rsi]) Object.assign(out, rsiMap[uiFilters.rsi]);

    // Strategy-level quick signals (already in numeric form)
    if (uiFilters.minChange !== undefined) out.minChange = uiFilters.minChange;
    if (uiFilters.maxChange !== undefined) out.maxChange = uiFilters.maxChange;
    if (uiFilters.minRsi !== undefined) out.minRsi = uiFilters.minRsi;
    if (uiFilters.maxRsi !== undefined) out.maxRsi = uiFilters.maxRsi;
    if (uiFilters.minScore !== undefined) out.minScore = uiFilters.minScore;
    if (uiFilters.volume) {
        const volMap = { 'High': 'high', 'Very High': 'very_high', 'Extreme': 'very_high', 'Low': 'low', 'Normal': 'normal' };
        out.volumeStatus = volMap[uiFilters.volume] || uiFilters.volume.toLowerCase();
    }

    return out;
};


const Screeners = ({ isHero = false, initialFilters = {} }) => {
    const [activeFilters, setActiveFilters] = useState(initialFilters);
    const [visibleFilters, setVisibleFilters] = useState(['mcap', 'price', 'change', 'sector', 'roe', 'pe']);
    const [activeStrategy, setActiveStrategy] = useState(null);
    const [openFilter, setOpenFilter] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showSignalModal, setShowSignalModal] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState(() => {
        const cached = localStorage.getItem('radar_screener_results');
        return cached ? JSON.parse(cached) : MOCK_FALLBACK_RESULTS;
    });
    const [readyMade, setReadyMade] = useState(MOCK_READY_MADE);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const userMode = localStorage.getItem('mode') || 'INVESTOR';

    // ── Custom Filters state ──────────────────────────────────
    const [myFilters, setMyFilters] = useState([]);
    const [newFilterName, setNewFilterName] = useState('');
    const [newFilterOptions, setNewFilterOptions] = useState('');
    const [newFilterQuery, setNewFilterQuery] = useState('SELECT * FROM market WHERE x > y');
    const [filterSaving, setFilterSaving] = useState(false);
    const [filterError, setFilterError] = useState('');

    const handleFilterChange = (id, value) => {
        setActiveFilters(prev => ({ ...prev, [id]: value }));
        setOpenFilter(null);
        setActiveStrategy(null);
    };

    const handleStrategySelect = (strat) => {
        setShowSignalModal(strat);
        setActiveStrategy(strat.id);
        const newFilters = { ...strat.filters };
        setActiveFilters(newFilters);
        // Immediately trigger a scan with the strategy filters
        setTimeout(() => runScanWithFilters(newFilters), 0);
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
            // Surface them as additional filter chips
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
        } catch (_) {
            // silently ignore — user might not be logged in yet
        }
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
            // Add to live filter chips
            allFilters.push({
                id: created._id,
                label: created.name,
                icon: Filter,
                options: created.options,
                isCustom: true,
            });
            setVisibleFilters(prev => [...prev, created._id]);
            // Reset
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

    const filteredResults = results.filter(stock => {
        const stockId = stock.id || '';
        if (searchTerm && !stockId.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (activeFilters.mcap && activeFilters.mcap !== 'Any') {
            if (activeFilters.mcap === 'Large' && !stock.mcap?.includes('T')) return false;
        }
        if (activeFilters.sector && activeFilters.sector !== 'All') {
            if (!stock.sector?.includes(activeFilters.sector)) return false;
        }
        return true;
    });

    const runScanWithFilters = async (filtersToUse) => {
        try {
            setIsLoading(true);
            const backendFilters = translateFilters(filtersToUse || activeFilters);
            const response = await runScreenerScan({ filters: backendFilters });
            const data = response?.data?.results || [];

            if (data && Array.isArray(data)) {
                const formatted = data.map(stock => ({
                    id: stock.symbol,
                    price: `₹${stock.price}`,
                    change: `${stock.change > 0 ? '+' : ''}${stock.change}%`,
                    isPositive: stock.change >= 0,
                    sector: stock.sector,
                    mcap: stock.marketCap || '-',
                    pe: stock.pe != null ? stock.pe : '-',
                    roe: '-',
                    yield: '-',
                    confidence: stock.confidence,
                    why: stock.why,
                    tags: stock.tags,
                    trend: [stock.price * 0.98, stock.price * 0.99, stock.price, stock.price * 1.01, stock.price]
                }));
                setResults(formatted);
                localStorage.setItem('radar_screener_results', JSON.stringify(formatted));
            }
        } catch (err) {
            console.error('Screener scan failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const runScan = () => runScanWithFilters(activeFilters);

    const exportToExcel = () => {
        if (!filteredResults.length) return;

        // Build rows
        const rows = filteredResults.map(s => ({
            'Ticker':       (s.id || '').split('.')[0],
            'Sector':       s.sector        || '—',
            'Price':        s.price         || '—',
            'Change %':     s.change        || '—',
            'Market Cap':   s.mcap          || '—',
            'P/E Ratio':    s.pe            || '—',
            'ROE':          s.roe           || '—',
            'Div. Yield':   s.yield         || '—',
            'Signal %':     s.confidence != null ? `${s.confidence}%` : '—',
            'Tags':         Array.isArray(s.tags) ? s.tags.join(', ') : '—',
            'Insight':      s.why           || '—',
        }));

        const ws = XLSX.utils.json_to_sheet(rows);

        // Column widths
        ws['!cols'] = [
            { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
            { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
            { wch: 10 }, { wch: 20 }, { wch: 50 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Screener Results');

        const timestamp = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `RADAR_Screener_${timestamp}.xlsx`);
    };

    React.useEffect(() => {
        // Auto-scan on mount to populate results
        runScan();
    }, []);


    React.useEffect(() => {
        loadMyFilters();
    }, []);

    React.useEffect(() => {
        const style = document.createElement('style');
        style.id = 'screeners-component-styles';
        style.innerHTML = `
            .filter-dropdown {
                animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                box-shadow: 0 12px 30px rgba(0,0,0,0.1), 0 0 1px rgba(0,0,0,0.1);
                min-width: 240px;
            }
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-8px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .filter-chip { position: relative; }
            .filter-value-list { max-height: 250px; overflow-y: auto; }
            .filter-value-list::-webkit-scrollbar { width: 4px; }
            .filter-value-list::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }
            .filter-chip:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(59, 130, 246, 0.12); }
            .filter-chip.active { background: white; border-color: #3b82f6; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.1); }
            .strategy-chip { transition: all 0.2s ease; cursor: pointer; }
            .strategy-chip.active { background: #eff6ff; border-color: #3b82f6; color: #2563eb; }
            .custom-table th { text-align: left; padding: 16px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 800; border-bottom: 1px solid #f1f5f9; }
            .custom-table td { padding: 16px; font-size: 14px; color: #1e293b; border-bottom: 1px solid #f8fafc; }
            .modal-overlay { background: rgba(15, 23, 42, 0.6); backdrop-blur: 4px; }
            .horizontal-carousel {
                display: flex;
                overflow-x: auto;
                gap: 1.5rem;
                padding: 4px 0 20px 0;
                scroll-behavior: smooth;
            }
            .horizontal-carousel::-webkit-scrollbar { display: none; }
            .custom-input-box {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 13px;
                font-weight: 600;
                width: 100%;
                outline: none;
                transition: all 0.2s;
            }
            .custom-input-box:focus {
                border-color: #3b82f6;
                background: white;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }
            .fade-in-up { animation: fadeInUp 0.3s ease-out; }
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .scale-in { animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
            @keyframes scaleIn {
                from { opacity: 0; transform: scale(0.9); }
                to { opacity: 1; transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
        return () => {
            const el = document.getElementById('screeners-component-styles');
            if (el) document.head.removeChild(el);
        };
    }, []);

    const baseCardClass = "bg-[rgba(255,255,255,0.7)] backdrop-blur-[12px] rounded-[24px] border border-[rgba(255,255,255,0.4)] shadow-[0_8px_32px_rgba(0,0,0,0.05)] p-6 mb-8";
    const filterChipClass = "filter-chip px-4 py-2 rounded-full border border-slate-200 bg-white/60 text-slate-600 font-bold text-[13px] flex items-center gap-2 cursor-pointer z-40 transition-all";

    return (
        <div className={`w-full ${isHero ? '' : 'min-h-screen py-8 px-4 md:px-10 bg-[#f8fafc]/50'}`}>
            <div className={`mx-auto fade-in ${isHero ? '' : 'max-w-[1600px]'}`}>
                
                {}
                <div className="mb-6 flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg">
                            <Activity size={20} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800">Smart Market Screener</h1>
                            <p className="text-[12px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                                <ShieldCheck size={14} className="text-blue-500" />
                                <Zap size={13} className="text-amber-500 fill-amber-400" />
                                Tailored for you: {userMode === 'TRADER' ? 'Active Trader' : 'Long-term Investor'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            className="bg-white border border-slate-200 px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                            onClick={() => setShowCreateModal(true)}
                        >
                            <Plus size={18} strokeWidth={3} className="text-blue-500" />
                            Create Filter
                        </button>
                        <button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold transition-all hover:scale-105 shadow-lg shadow-blue-200">
                            <Star size={18} strokeWidth={3} />
                            Save Screener
                        </button>
                    </div>
                </div>

                {}
                <div className={`${baseCardClass} !p-4 !mb-6 bg-white overflow-visible relative z-30`}>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 px-3 border-r border-slate-200">
                            <SlidersHorizontal size={18} className="text-slate-400" />
                            <span className="text-[14px] font-black text-slate-800 mr-2">Filters</span>
                        </div>

                        {allFilters.filter(f => visibleFilters.includes(f.id)).map(f => {
                            const Icon = f.icon;
                            return (
                                <div key={f.id} className="relative">
                                    <div 
                                        className={`${filterChipClass} ${openFilter === f.id ? 'active' : ''}`}
                                        onClick={() => setOpenFilter(openFilter === f.id ? null : f.id)}
                                    >
                                        <span className="opacity-70"><Icon size={15} /></span>
                                        <span>{f.label}</span>
                                        <span className="text-blue-600 font-black ml-1 line-clamp-1 max-w-[80px]">{activeFilters[f.id] || 'Any'}</span>
                                        <ChevronDown size={14} strokeWidth={3} className={`mt-0.5 transition-transform ${openFilter === f.id ? 'rotate-180 text-blue-500' : 'opacity-40'}`} />
                                    </div>

                                    {openFilter === f.id && (
                                        <div className="filter-dropdown absolute top-full left-0 mt-2 bg-white rounded-xl border border-slate-200 p-3 min-w-[240px] z-50">
                                            <div className="p-1 text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Custom Value</div>
                                            <div className="px-1 mb-3">
                                                <input 
                                                    type="text" 
                                                    className="custom-input-box text-slate-800" 
                                                    placeholder={`Enter ${f.label}...`}
                                                    value={activeFilters[f.id] || ''}
                                                    onChange={(e) => setActiveFilters(prev => ({...prev, [f.id]: e.target.value}))}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <div className="p-1 text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1 border-t border-slate-50 pt-2">Presets</div>
                                            <div className="filter-value-list">
                                                {f.options.map(opt => (
                                                    <button 
                                                        key={opt}
                                                        onClick={() => handleFilterChange(f.id, opt)}
                                                        className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-bold flex items-center justify-between transition-colors ${activeFilters[f.id] === opt ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                                    >
                                                        {opt}
                                                        {activeFilters[f.id] === opt && <Check size={14} strokeWidth={3} />}
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
                                className="flex items-center gap-2 text-[13px] font-black text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-full transition-all"
                            >
                                <Plus size={16} strokeWidth={3} />
                                Add Filter
                            </button>
                            {openFilter === 'add' && (
                                <div className="filter-dropdown absolute top-full right-0 mt-2 bg-white rounded-xl border border-slate-200 p-2 min-w-[220px] z-50 filter-value-list shadow-2xl">
                                    <div className="p-2 text-[11px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-50 mb-1 text-center">Available Metrics</div>
                                    {allFilters.filter(f => !visibleFilters.includes(f.id)).map(f => {
                                        const Icon = f.icon;
                                        return (
                                            <button 
                                                key={f.id}
                                                onClick={() => addMoreFilter(f.id)}
                                                className="w-full text-left px-3 py-2.5 rounded-lg text-[13.5px] font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 transition-all"
                                            >
                                                <Icon size={16} className="opacity-50" />
                                                {f.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-2">Quick Signals</span>
                        <div className="flex gap-2">
                            {strategies.map(s => {
                                const Icon = s.icon;
                                return (
                                    <button 
                                        key={s.id}
                                        onClick={() => handleStrategySelect(s)}
                                        className={`strategy-chip px-4 py-1.5 rounded-full border border-slate-100 bg-slate-50/50 text-[12px] font-bold flex items-center gap-2 transition-all ${activeStrategy === s.id ? 'active' : 'text-slate-500'}`}
                                    >
                                        <Icon size={14} className={s.color} />
                                        {s.label}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={runScan}
                            disabled={isLoading}
                            className="ml-auto bg-blue-600 text-white px-5 py-1.5 rounded-full text-[12px] font-black flex items-center gap-2 shadow-md hover:bg-blue-700 transition-all disabled:opacity-60"
                        >
                            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                            {isLoading ? 'Scanning...' : 'Run Scan'}
                        </button>
                    </div>
                </div>

                <div className="mb-10 space-y-8">
                    <div>
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h2 className="text-[16px] font-black text-slate-800 flex items-center gap-2">
                                <TrendingUp size={18} className="text-orange-500" />
                                Trending Screeners
                            </h2>
                            <button className="text-[12px] font-black text-blue-600 uppercase tracking-widest hover:underline">Explore More</button>
                        </div>
                        <div className="horizontal-carousel">
                            {[
                                { title: 'IT Sector Breakouts', users: '2.4k', growth: '+12%', color: 'border-blue-100' },
                                { title: 'High Dividend Giants', users: '1.8k', growth: '+4.2%', color: 'border-emerald-100' },
                                { title: 'FMCG Defensive Play', users: '950', growth: '+1.5%', color: 'border-amber-100' },
                                { title: 'Midcap Growth Alpha', users: '3.1k', growth: '+22%', color: 'border-purple-100' },
                                { title: 'Nifty 50 Rebound', users: '1.2k', growth: '+5.4%', color: 'border-slate-100' },
                                { title: 'AI Momentum Scans', users: '4.2k', growth: '+18.4%', color: 'border-cyan-100' },
                                { title: 'SmallCap Rockets', users: '6.5k', growth: '+31%', color: 'border-rose-100' },
                                { title: 'Pharma Recovery', users: '800', growth: '+2.1%', color: 'border-teal-100' },
                                { title: 'EV Supply Chain', users: '2.9k', growth: '+14%', color: 'border-lime-100' },
                                { title: 'Banking Consolidation', users: '1.5k', growth: '+3.8%', color: 'border-indigo-100' },
                            ].map((scr, i) => (
                                <div key={i} className={`min-w-[280px] bg-white border ${scr.color} p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-black text-[15px] text-slate-800 group-hover:text-blue-600">{scr.title}</h3>
                                        <span className="text-[11px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">{scr.growth}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[12px] font-bold text-slate-400">
                                        <span className="flex items-center gap-1.5"><Users size={14} /> {scr.users} users</span>
                                        <ChevronRight size={16} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h2 className="text-[16px] font-black text-slate-800 flex items-center gap-2">
                                <Star size={18} className="text-amber-500" />
                                Ready-made Expert Screeners
                            </h2>
                            <button className="text-[12px] font-black text-blue-600 uppercase tracking-widest hover:underline">View All</button>
                        </div>
                        <div className="horizontal-carousel">
                            {readyMade.map(item => {
                                const Icon = item.icon || Activity;
                                return (
                                    <div 
                                        key={item.id} 
                                        onClick={() => {
                                            const newFilters = { ...item.filters };
                                            setActiveFilters(newFilters);
                                            runScanWithFilters(newFilters);
                                        }}
                                        className="min-w-[300px] bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-4 mb-3">
                                            <div className={`p-2.5 rounded-xl ${item.bg} ${item.color} group-hover:scale-110 transition-transform shadow-sm`}>
                                                <Icon size={20} strokeWidth={3} />
                                            </div>
                                            <h3 className="font-black text-[15px] text-slate-800">{item.title}</h3>
                                        </div>
                                        <p className="text-[12px] font-bold text-slate-400 leading-relaxed mb-4">{item.desc}</p>
                                        <button className="w-full py-2 bg-slate-50 text-slate-400 font-black text-[11px] uppercase tracking-widest rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">Launch Preview</button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
                    <div className="lg:col-span-12">
                        <div className={`${baseCardClass} !p-0 overflow-hidden bg-white`}>
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                                <div>
                                    <h2 className="text-lg font-black text-slate-800">Screener Insights</h2>
                                    <p className="text-[12px] font-bold text-slate-500">Live results matching your active criteria</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="text" 
                                            placeholder="Find ticker..." 
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-xs font-bold w-48 focus:ring-2 focus:ring-blue-50 outline-none"
                                        />
                                    </div>
                                    <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm text-xs font-bold text-slate-600">
                                        Matches: <span className="text-blue-600">{filteredResults.length}</span>
                                    </div>
                                    <button 
                                        onClick={runScan}
                                        disabled={isLoading}
                                        className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                                    >
                                        <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                                        {isLoading ? "Scanning..." : "Refresh Results"}
                                    </button>
                                    <button
                                        onClick={exportToExcel}
                                        disabled={filteredResults.length === 0}
                                        className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-blue-700 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Download size={13} />
                                        Export Report
                                    </button>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full custom-table">
                                    <thead className="bg-slate-50/50">
                                        <tr>
                                            <th>Ticker</th>
                                            <th>Price</th>
                                            <th>Change</th>
                                            <th>Trend</th>
                                            <th>Mcap</th>
                                            <th>Metrics</th>
                                            <th>Insight (Behavioral Diagnostics)</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredResults.map(stock => (
                                            <tr key={stock.id} className="hover:bg-slate-50/80 transition-colors group">
                                                <td>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-400 text-center uppercase p-1">Stock</div>
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{(stock.id || '').split('.')[0]}</span>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{stock.sector}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="font-bold text-slate-700">{stock.price}</td>
                                                <td>
                                                    <span className={`px-2 py-0.5 rounded text-[12px] font-black ${stock.isPositive ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                                                        {stock.change}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="w-24 h-8">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <AreaChart data={stock.trend.map((v, i) => ({ price: v, i }))}>
                                                                <defs>
                                                                    <linearGradient id={`grad-${stock.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="5%" stopColor={stock.isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.3} />
                                                                        <stop offset="95%" stopColor={stock.isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0} />
                                                                    </linearGradient>
                                                                </defs>
                                                                <Area 
                                                                    type="monotone" 
                                                                    dataKey="price" 
                                                                    stroke={stock.isPositive ? '#10b981' : '#f43f5e'} 
                                                                    fill={`url(#grad-${stock.id})`}
                                                                    strokeWidth={2}
                                                                    isAnimationActive={false}
                                                                />
                                                            </AreaChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </td>
                                                <td className="text-slate-500 font-bold">{stock.mcap}</td>
                                                <td>
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center justify-between text-[11px] font-bold">
                                                            <span className="text-slate-400">P/E:</span>
                                                            <span className="text-slate-600">{stock.pe}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-[11px] font-bold">
                                                            <span className="text-slate-400">ROE:</span>
                                                            <span className="text-slate-600">{stock.roe}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-[11px] font-bold">
                                                            <span className="text-slate-400">Yield:</span>
                                                            <span className="text-slate-600">{stock.yield}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="max-w-[400px]">
                                                    <div className="flex flex-col gap-2">
                                                        <p className="text-[13px] text-slate-600 font-medium leading-tight">{stock.why}</p>
                                                        <div className="flex gap-1.5">
                                                            {stock.tags.map(t => (
                                                                <span key={t} className="text-[10px] font-black px-2 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100/50 uppercase">
                                                                    {t}
                                                                </span>
                                                            ))}
                                                            <div className="flex items-center gap-2 ml-2">
                                                                <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-emerald-500" style={{ width: `${stock.confidence}%` }}></div>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-400">{stock.confidence}% Signal</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <button className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-slate-100">
                                                        <Star size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredResults.length === 0 && (
                                            <tr>
                                                <td colSpan="6" className="text-center py-20">
                                                    <div className="flex flex-col items-center gap-3 opacity-30">
                                                        <Search size={48} />
                                                        <p className="font-black text-lg">No matches found</p>
                                                        <button onClick={() => setActiveFilters({})} className="text-blue-600 font-black">Reset filters</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Create Filter Modal ───────────────────────────── */}
                {showCreateModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 modal-overlay" onClick={() => setShowCreateModal(false)} />
                        <div className="bg-white rounded-3xl w-full max-w-md p-8 relative z-10 shadow-2xl fade-in-up">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800">Create New Filter</h2>
                                    <p className="text-sm font-bold text-slate-400">Add a custom metric to your radar.</p>
                                </div>
                                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Filter Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-800 focus:bg-white focus:border-blue-500 transition-all"
                                        placeholder="e.g. FII Holding %"
                                        value={newFilterName}
                                        onChange={e => setNewFilterName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Options (comma separated)</label>
                                    <textarea
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-800 h-20 focus:bg-white focus:border-blue-500 transition-all"
                                        placeholder="Large, Mid, Small..."
                                        value={newFilterOptions}
                                        onChange={e => setNewFilterOptions(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Logic Query</label>
                                    <div className="p-4 bg-slate-900 rounded-xl">
                                        <textarea
                                            className="w-full bg-transparent text-emerald-400 font-mono text-xs outline-none resize-none"
                                            rows={2}
                                            value={newFilterQuery}
                                            onChange={e => setNewFilterQuery(e.target.value)}
                                            spellCheck={false}
                                        />
                                    </div>
                                </div>
                                {filterError && (
                                    <p className="text-xs font-bold text-rose-500 pl-1">{filterError}</p>
                                )}
                                <button
                                    onClick={handleCreateFilter}
                                    disabled={filterSaving}
                                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-lg shadow-xl shadow-blue-200 mt-4 active:scale-95 transition-all disabled:opacity-60"
                                >
                                    {filterSaving ? 'Saving...' : 'Create Filter Metric'}
                                </button>
                            </div>

                            {/* My saved filters */}
                            {myFilters.length > 0 && (
                                <div className="mt-6 pt-5 border-t border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">My Saved Filters</p>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {myFilters.map(f => (
                                            <div key={f._id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl">
                                                <div>
                                                    <p className="text-sm font-black text-slate-700">{f.name}</p>
                                                    {f.options?.length > 0 && (
                                                        <p className="text-[10px] text-slate-400 font-bold">{f.options.join(', ')}</p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteMyFilter(f._id)}
                                                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
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
                        <div className="absolute inset-0 modal-overlay" onClick={() => setShowSignalModal(null)} />
                        <div className="bg-white rounded-3xl w-full max-w-sm p-8 relative z-10 shadow-2xl scale-in text-center">
                            {(() => {
                                const Icon = showSignalModal.icon || Activity;
                                return (
                                    <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg bg-blue-50 text-blue-600`}>
                                        <Icon size={32} strokeWidth={3} />
                                    </div>
                                );
                            })()}
                            <h2 className="text-xl font-black text-slate-800 mb-2">{showSignalModal.label}</h2>
                            <p className="text-slate-500 font-bold mb-6 text-sm leading-relaxed">{showSignalModal.desc}</p>
                            <div className="p-4 bg-slate-50 rounded-2xl text-left mb-6">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Metrics Configured</span>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(showSignalModal.filters).map(([k, v]) => (
                                        <span key={k} className="text-[11px] font-black px-2 py-1 bg-white border border-slate-100 rounded text-slate-600 capitalize">
                                            {k}: <span className="text-blue-600">{v}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <button onClick={() => setShowSignalModal(null)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black shadow-lg">Close Explanation</button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Screeners;
