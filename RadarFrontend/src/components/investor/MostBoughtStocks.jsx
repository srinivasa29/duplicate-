import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { fetchPulse } from '../../api/analyticsApi';
import api, { toggleWatchlist } from '../../api/api';

const displaySymbol = (value) => String(value || '').replace(/\.(NS|BO)$/i, '');

// Empty — real data comes from fetchPulse() via the analytics API
const mockMostBought = [];

const MostBoughtStocks = () => {
    const navigate = useNavigate();
    const [pulse, setPulse] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    // Watchlist state
    const [watchlistId, setWatchlistId] = useState(null);
    const [savedSymbols, setSavedSymbols] = useState(new Set());  // symbol strings (no suffix)
    const [loadingSymbol, setLoadingSymbol] = useState(null);     // which symbol is mid-request
    const [toast, setToast] = useState(null);                     // { msg, type }

    // Load user's watchlist membership once on mount
    useEffect(() => {
        api.get('/watchlist')
            .then(res => {
                const lists = Array.isArray(res.data) ? res.data : [];
                if (lists.length > 0) {
                    const first = lists[0];
                    setWatchlistId(first._id);
                    const syms = new Set(
                        (first.items || []).map(s =>
                            displaySymbol(s?.symbol || s).toUpperCase()
                        )
                    );
                    setSavedSymbols(syms);
                }
            })
            .catch(() => {}); // not logged in — silent
    }, []);

    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const handleBookmark = useCallback(async (e, rawSymbol) => {
        e.stopPropagation();
        const sym = displaySymbol(rawSymbol).toUpperCase();
        if (loadingSymbol === sym) return;

        // Pre-flight: require auth before any network call
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Please log in to save to your watchlist', 'info');
            return;
        }

        setLoadingSymbol(sym);
        try {
            await toggleWatchlist(sym, 'investor');
            if (savedSymbols.has(sym)) {
                setSavedSymbols(prev => { const next = new Set(prev); next.delete(sym); return next; });
                showToast(`${sym} removed from watchlist`, 'info');
            } else {
                setSavedSymbols(prev => new Set([...prev, sym]));
                showToast(`${sym} added to watchlist ✓`, 'success');
            }
        } catch (err) {
            const status = err?.response?.status;
            if (status === 401 || status === 403) {
                showToast('Session expired. Please log in again.', 'error');
            } else if (status === 400 && err?.response?.data?.error?.includes('already')) {
                showToast(`${sym} is already in your watchlist`, 'info');
                setSavedSymbols(prev => new Set([...prev, sym]));
            } else {
                showToast('Failed to update watchlist. Try again.', 'error');
            }
        } finally {
            setLoadingSymbol(null);
        }
    }, [savedSymbols, watchlistId, loadingSymbol, showToast]);


    useEffect(() => {
        const loadPulse = async () => {
            try {
                setIsLoading(true);
                setHasError(false);
                const response = await fetchPulse();
                setPulse(response);
            } catch (error) {
                console.error('Failed to load market pulse:', error);
                setHasError(true);
            } finally {
                setIsLoading(false);
            }
        };

        loadPulse();
    }, []);

    const cards = useMemo(() => {
        const gapUp = (pulse?.gapUp ?? []).map((item, index) => ({
            id: `gap-up-${item.symbol}-${index}`,
            name: item.symbol,
            price: `₹${Number(item.price || 0).toLocaleString()}`,
            change: item.change,
            isPositive: true,
            logo: displaySymbol(item.symbol || '?').slice(0, 1),
            tag: 'Gap Up'
        }));

        const gapDown = (pulse?.gapDown ?? []).map((item, index) => ({
            id: `gap-down-${item.symbol}-${index}`,
            name: item.symbol,
            price: `₹${Number(item.price || 0).toLocaleString()}`,
            change: item.change,
            isPositive: false,
            logo: displaySymbol(item.symbol || '?').slice(0, 1),
            tag: 'Gap Down'
        }));

        const volumeShockers = (pulse?.volumeShockers ?? []).map((item, index) => ({
            id: `volume-${item.symbol}-${index}`,
            name: item.symbol,
            price: `${item.volume} vol`,
            change: item.shock,
            isPositive: true,
            logo: displaySymbol(item.symbol || '?').slice(0, 1),
            tag: 'Volume'
        }));

        const liveCards = [...gapUp, ...gapDown, ...volumeShockers].slice(0, 8);

        if (liveCards.length > 0) {
            return liveCards;
        }

        return mockMostBought;
    }, [pulse]);

    const openStockPage = (name) => {
        const symbol = String(name || '').trim().toUpperCase().replace(/\.(NS|BO)$/i, '');
        if (!symbol) return;
        navigate(`/investor/advanced-charts?symbol=${encodeURIComponent(symbol)}`);
    };

    return (
        <div className="investor-card p-6 h-full flex flex-col relative overflow-visible">
            {isLoading && (
                <div className="absolute inset-0 bg-white/5 backdrop-blur-sm z-20 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-primary-500 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {/* Global toast */}
            {toast && (
                <div style={{
                    position: 'absolute', top: '12px', right: '12px',
                    background: toast.type === 'error' ? '#fee2e2' : toast.type === 'info' ? '#eff6ff' : '#d1fae5',
                    color: toast.type === 'error' ? '#991b1b' : toast.type === 'info' ? '#1e40af' : '#065f46',
                    border: `1px solid ${toast.type === 'error' ? '#fca5a5' : toast.type === 'info' ? '#93c5fd' : '#6ee7b7'}`,
                    borderRadius: '10px', padding: '6px 14px',
                    fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    zIndex: 50,
                }}>
                    {toast.msg}
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Market Pulse</h3>
                    <p className="text-[11px] text-slate-400 mt-1">Gap movers and volume shockers from the analytics feed</p>
                </div>
                <div className="text-[10px] font-bold text-blue-600 bg-blue-50/70 px-2 py-1 rounded inline-flex items-center gap-1 border border-blue-100/50">
                    <Activity size={11} />
                    {hasError ? 'Fallback mode' : 'Live feed'}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
                {cards.map((stock) => {
                    const sym = displaySymbol(stock.name).toUpperCase();
                    const isSaved = savedSymbols.has(sym);
                    const isUpdating = loadingSymbol === sym;

                    return (
                        <div
                            key={stock.id}
                            onClick={() => openStockPage(stock.name)}
                            className="p-4 relative group hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-500 border border-slate-200/80 rounded-2xl bg-white/10 backdrop-blur-sm shadow-sm cursor-pointer"
                        >
                            {/* Bookmark button */}
                            <button
                                className="absolute top-3 right-3 transition-colors"
                                style={{
                                    color: isSaved ? '#3b82f6' : undefined,
                                    opacity: isUpdating ? 0.5 : 1,
                                    background: 'none',
                                    border: 'none',
                                    cursor: isUpdating ? 'wait' : 'pointer',
                                    padding: 0,
                                    lineHeight: 0,
                                }}
                                onClick={(e) => handleBookmark(e, stock.name)}
                                title={isSaved ? 'Remove from watchlist' : 'Add to watchlist'}
                                disabled={isUpdating}
                            >
                                <Bookmark
                                    size={15}
                                    fill={isSaved ? 'currentColor' : 'none'}
                                    className={isSaved ? 'text-blue-500' : 'text-slate-300 group-hover:text-blue-500'}
                                />
                            </button>

                            <div className="w-9 h-9 rounded-xl bg-blue-50/50 border border-blue-100/50 flex items-center justify-center font-black text-blue-600/70 mb-4 shadow-sm group-hover:bg-blue-100 transition-colors">
                                {stock.logo}
                            </div>

                            <h4 className="text-xs font-bold text-slate-700 mb-5 line-clamp-2 h-8 leading-tight group-hover:text-blue-700 transition-colors">{displaySymbol(stock.name)}</h4>

                            {stock.tag && (
                                <div className={`inline-flex items-center mb-4 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${stock.isPositive ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                                    {stock.tag}
                                </div>
                            )}

                            <div className="mt-auto border-t border-slate-50 pt-3">
                                <div className="text-sm font-black text-slate-800">{stock.price}</div>
                                <div className={`text-[10px] font-bold flex items-center gap-1 mt-1 ${stock.isPositive ? 'text-blue-500' : 'text-rose-500'}`}>
                                    {stock.isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                    {stock.change}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MostBoughtStocks;
