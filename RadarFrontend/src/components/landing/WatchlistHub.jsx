import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { fetchLiveUniversePrices } from '../../services/apiHelpers';

const fallbackWatchlistItems = [
    { symbol: 'BTC-USD', price: 42505.2, change_24h: 2.4, type: 'CRYPTO' },
    { symbol: 'AAPL', price: 185.92, change_24h: 0.5, type: 'STOCK' },
    { symbol: 'EUR/USD', price: 1.095, change_24h: -0.1, type: 'FOREX' },
    { symbol: 'GOLD', price: 2045, change_24h: 0.2, type: 'COMMODITY' },
];

const formatSignedPercent = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0.00%';
    return `${numeric > 0 ? '+' : ''}${numeric.toFixed(2)}%`;
};

export default function WatchlistHub() {
    const [watchlistItems, setWatchlistItems] = useState(fallbackWatchlistItems);

    useEffect(() => {
        let isMounted = true;

        const loadWatchlist = async () => {
            try {
                // Fetch the batched universe prices and pick top 6
                const rows = await fetchLiveUniversePrices({ suffix: '.NSE' });
                const marketRows = Array.isArray(rows) ? rows : [];
                const picked = marketRows.slice(0, 6).map(r => ({
                    symbol: String(r.symbol || r.symbols || r.ticker || '').replace(/\.(NS|BO)$/i, ''),
                    price: Number(r.price ?? r.close ?? r.last_price ?? r.ltp ?? 0),
                    change_24h: Number(r.percent_change ?? r.change_percent ?? r.pChange ?? 0),
                    type: 'STOCK'
                }));

                if (isMounted && picked.length) {
                    setWatchlistItems(picked);
                }
            } catch (error) {
                console.error('Failed to load watchlist hub:', error);
                if (isMounted) {
                    setWatchlistItems(fallbackWatchlistItems);
                }
            }
        };

        loadWatchlist();
        const intervalId = setInterval(loadWatchlist, 30000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    return (
        <div className="bg-[#0b1d21] rounded-3xl border border-white/10 p-6 overflow-hidden relative">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white font-['Plus_Jakarta_Sans']">Watchlist Hub</h3>
                <button className="text-[#42C0A5] text-sm hover:underline">View All</button>
            </div>

            <div className="space-y-3">
                {watchlistItems.map((item, i) => (
                    <div key={i} className="group relative flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-[#42C0A5]/30 transition-all">

                        {}
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-8 rounded-full bg-[#42C0A5]/50"></div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white">{item.symbol}</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white/10 text-white/50 rounded">{item.type}</span>
                                </div>
                                <div className="text-white/40 text-xs mt-0.5">{Number(item?.price || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                            </div>
                        </div>

                        {}
                        <div className="flex items-center gap-4">
                            <span className={`font-mono text-sm font-bold ${Number(item?.change_24h || 0) >= 0 ? 'text-[#42C0A5]' : 'text-red-400'}`}>
                                {formatSignedPercent(item?.change_24h)}
                            </span>

                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-[#42C0A5]">
                                    <Bell size={14} />
                                </button>
                                <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-red-400">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                    </div>
                ))}
            </div>

            {}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-[#42C0A5]/20 rounded-full blur-3xl pointer-events-none"></div>
        </div>
    );
}
