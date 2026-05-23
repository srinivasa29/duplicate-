import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MinimalTraderChart from '../components/trader/stockResearch/MinimalTraderChart';
import api from '../api/api';
import { SettingsContext } from '../context/SettingsContext';
import { isValidSymbolSync } from '../services/universeService';
import { fetchLiveUniversePrices } from '../services/apiHelpers';
import { ChevronLeft, BarChart2, TrendingUp, TrendingDown, Layers, Zap, Clock, ShieldAlert, Activity } from 'lucide-react';

// Reusable Antigravity Card ensuring solid dark UI with no transparency
const AntigravityCard = ({ children, className = '', noPadding = false }) => (
    <div
        className={`rounded-[14px] overflow-hidden ${noPadding ? '' : 'p-4'} ${className}`}
        style={{
            background: '#0B1220',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.04)',
            opacity: 1,
        }}
    >
        {children}
    </div>
);

export default function TradeTerminalPage({ overrideSymbol, onBack }) {
    const navigate = useNavigate();
    const { symbol: routeSymbol } = useParams();
    const symbol = overrideSymbol || routeSymbol || 'RELIANCE';

    const { settings } = useContext(SettingsContext);

    const [isLoading, setIsLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('5m');
    const [chartType, setChartType] = useState('candles');
    const [orderType, setOrderType] = useState('BUY');
    const [orderCategory, setOrderCategory] = useState('MARKET');
    const [qty, setQty] = useState(1);
    const [priceInput, setPriceInput] = useState('');
    const [stopLoss, setStopLoss] = useState('');
    const [takeProfit, setTakeProfit] = useState('');
    const [stock, setStock] = useState({ symbol, price: 0, changePercent: 0, name: '' });
    const [quickWatchlist, setQuickWatchlist] = useState([]);
    const [marketDepth, setMarketDepth] = useState({ bids: [], asks: [] });

    const isPositive = Number(stock.changePercent || 0) >= 0;

    useEffect(() => {
        setIsLoading(true);
        let active = true;

        Promise.allSettled([
            api.get(`/market?symbols=${encodeURIComponent(symbol)}`),
            api.get('/watchlist', { params: { mode: 'trader' } }),
            api.get(`/market/depth?symbol=${encodeURIComponent(symbol)}`),
        ]).then(([mktRes, wlRes, depthRes]) => {
            if (!active) return;

            // Stock quote
            const mktArr = mktRes.status === 'fulfilled' ? (mktRes.value?.data?.data ?? mktRes.value?.data ?? []) : [];
            const mkt = Array.isArray(mktArr) ? mktArr[0] : mktArr;
            if (mkt) {
                const price = Number(mkt.price ?? mkt.ltp ?? 0);
                setStock({ symbol: symbol.replace(/\.(NS|BO)$/i, ''), name: mkt.name ?? mkt.companyName ?? symbol, price, changePercent: Number(mkt.changePercent ?? mkt.pChange ?? 0), dayHigh: mkt.dayHigh, dayLow: mkt.dayLow, volume: mkt.volume, vwap: mkt.vwap });
                setPriceInput(String(price));
            }

            // Watchlist
            if (wlRes.status === 'fulfilled') {
                const wlData = wlRes.value?.data?.data ?? wlRes.value?.data;
                const syms = (Array.isArray(wlData) ? wlData.flatMap(w => (w.items ?? []).map(i => i?.symbol ?? i)) : [])
                    .filter(s => isValidSymbolSync(s)) // Only include universe symbols
                    .slice(0, 8);
                
                if (syms.length > 0) {
                    // Use batched fetch for universe validation
                    fetchLiveUniversePrices({ suffix: '' })
                        .then(arr => {
                            if (Array.isArray(arr) && arr.length && active) {
                                const symbolMap = new Map(arr.map(item => [
                                    String(item.symbol || '').replace(/\.(NS|BO)$/i, '').toUpperCase(),
                                    item
                                ]));
                                
                                const quickList = syms.map(s => {
                                    const upper = String(s).toUpperCase();
                                    const found = symbolMap.get(upper);
                                    return found ? {
                                        symbol: upper,
                                        price: Number(found.price ?? found.ltp ?? 0),
                                        change: Number(found.changePercent ?? found.pChange ?? 0),
                                    } : null;
                                }).filter(Boolean);
                                
                                if (quickList.length > 0) {
                                    setQuickWatchlist(quickList);
                                }
                            }
                        })
                        .catch(() => {});
                }
            }

            // Depth
            if (depthRes.status === 'fulfilled') {
                const d = depthRes.value?.data?.data ?? depthRes.value?.data;
                if (d?.bids && d?.asks) setMarketDepth(d);
            }

            setIsLoading(false);
        });

        return () => { active = false; };
    }, [symbol]);

    // Auto-calculate bracket defaults from settings when price or settings change
    useEffect(() => {
        if (!stock.price || !settings?.risk) return;
        const entryPrice = Number(priceInput || stock.price);
        const slPct = settings.risk.defaultStopLossPct || 2;
        const tpPct = settings.risk.defaultTakeProfitPct || 5;
        const slPrice = +(entryPrice * (1 - slPct / 100)).toFixed(2);
        const tpPrice = +(entryPrice * (1 + tpPct / 100)).toFixed(2);
        setStopLoss(slPrice);
        setTakeProfit(tpPrice);
    }, [stock.price, priceInput, settings]);

    const maxDepthQty = Math.max(
        ...( marketDepth.bids.length ? marketDepth.bids.map(b => b.qty) : [1]),
        ...( marketDepth.asks.length ? marketDepth.asks.map(a => a.qty) : [1])
    );

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#050B14' }}>
                <div className="flex flex-col items-center gap-3 text-cyan-200">
                    <div className="w-10 h-10 border-2 border-cyan-400/30 border-t-cyan-300 rounded-full animate-spin" />
                    <p className="text-xs uppercase tracking-widest font-bold">Initializing Execution Terminal...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen text-slate-200 font-sans p-4" style={{ background: '#050B14' }}>
            {/* Global Header */}
            <div className="max-w-[1920px] mx-auto mb-4 flex items-center justify-between bg-[#0B1220] border border-white/5 rounded-xl px-4 py-2.5 shadow-lg">
                <button
                    onClick={onBack || (() => navigate('/dashboard'))}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                    <ChevronLeft size={18} />
                    <span className="font-bold text-xs uppercase tracking-widest">Exit Terminal</span>
                </button>
                <div className="flex items-center gap-3 text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                        <Activity size={14} /> SYSTEM: LIVE
                    </span>
                    <div className="h-4 w-px bg-white/10 mx-2"></div>
                    <span className="text-slate-400">MARGIN AVAILABLE:</span>
                    <span className="text-white">₹ 4,50,000.00</span>
                </div>
            </div>

            {/* Main 3-Column Layout */}
            <div className="max-w-[1920px] mx-auto grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_340px] gap-4">
                
                {/* LEFT COLUMN: Watchlist */}
                <div className="hidden lg:flex flex-col gap-4">
                    <AntigravityCard className="flex flex-col h-[calc(100vh-100px)]">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                                <Layers size={14} /> Watchlist
                            </h2>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">NIFTY 50</span>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-1 space-y-1.5" style={{ scrollbarWidth: 'none' }}>
                            {quickWatchlist.map((item) => (
                                <div 
                                    key={item.symbol}
                                    onClick={() => navigate(`/trade/${item.symbol}`)}
                                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer border transition-colors ${item.symbol === stock.symbol ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-transparent hover:bg-white/5'}`}
                                >
                                    <div>
                                        <div className="font-bold text-xs text-white">{item.symbol}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-xs text-white">{item.price.toFixed(2)}</div>
                                        <div className={`text-[10px] font-bold ${item.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {item.change >= 0 ? '+' : ''}{item.change}%
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </AntigravityCard>
                </div>

                {/* CENTER COLUMN: Chart & Signals */}
                <div className="flex flex-col gap-4">
                    {/* Stock Header Top Stats */}
                    <AntigravityCard className="flex flex-wrap items-center justify-between gap-4 py-3">
                        <div className="flex items-center gap-4">
                            <h1 className="text-2xl font-black text-white">{stock.symbol}</h1>
                            <div className="flex items-center gap-2">
                                <div className="text-2xl font-black text-white font-mono">
                                    {Number(stock.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                                <div className={`text-sm font-bold flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    {isPositive ? '+' : ''}{Number(stock.changePercent).toFixed(2)}%
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div>
                                <div className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Open</div>
                                <div className="text-sm font-semibold text-white mt-0.5">₹{Number(stock.price * 0.99).toFixed(2)}</div>
                            </div>
                            <div>
                                <div className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">High</div>
                                <div className="text-sm font-semibold text-emerald-400 mt-0.5">₹{Number(stock.price * 1.02).toFixed(2)}</div>
                            </div>
                            <div>
                                <div className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Low</div>
                                <div className="text-sm font-semibold text-rose-400 mt-0.5">₹{Number(stock.price * 0.98).toFixed(2)}</div>
                            </div>
                            <div>
                                <div className="text-[9px] font-bold uppercase text-slate-500 tracking-widest">Volume</div>
                                <div className="text-sm font-semibold text-white mt-0.5 font-mono">3.2M</div>
                            </div>
                        </div>
                    </AntigravityCard>

                    {/* Chart Container */}
                    <AntigravityCard className="flex flex-col flex-1" noPadding>
                        <div className="p-3">
                            <MinimalTraderChart 
                                symbol={stock.symbol} 
                                price={stock.price} 
                                isPositive={isPositive}
                            />
                        </div>
                    </AntigravityCard>

                    {/* Below Chart: Signal Summary & Extra Trader Features */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AntigravityCard className="flex items-center justify-between">
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5">
                                    <Zap size={14} className="text-amber-400" /> Active Signal
                                </h3>
                                <div className="text-xl font-black text-slate-500 italic">No active signal</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Trend Strength</div>
                                <div className="w-32 h-2 bg-[#101828] rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-700" style={{ width: '0%' }}></div>
                                </div>
                            </div>
                        </AntigravityCard>

                        <AntigravityCard className="flex items-center justify-between">
                             <div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5">
                                    <ShieldAlert size={14} className="text-cyan-400" /> Price Alerts
                                </h3>
                                <div className="text-sm font-bold text-slate-500 italic">No alerts set</div>
                            </div>
                            <button className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold hover:bg-white/10 transition-colors">
                                Set Alert
                            </button>
                        </AntigravityCard>
                    </div>
                </div>

                {/* RIGHT COLUMN: Execution Panel */}
                <div className="flex flex-col gap-4">
                    
                    {/* Order Panel */}
                    <AntigravityCard className="border-t-2 border-t-cyan-500">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Execution Panel</h3>
                        
                        <div className="flex bg-[#101828] rounded-lg p-1 mb-4 border border-white/5">
                            <button 
                                onClick={() => setOrderType('BUY')}
                                className={`flex-1 py-1.5 text-xs font-black rounded-md transition-all ${orderType === 'BUY' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                BUY
                            </button>
                            <button 
                                onClick={() => setOrderType('SELL')}
                                className={`flex-1 py-1.5 text-xs font-black rounded-md transition-all ${orderType === 'SELL' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                SELL
                            </button>
                        </div>

                        <div className="flex gap-2 mb-4">
                            {['MARKET', 'LIMIT', 'SL'].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setOrderCategory(cat)}
                                    className={`flex-1 py-1 border text-[10px] font-bold rounded-lg transition-colors ${orderCategory === cat ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-3 mb-5">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Quantity</label>
                                <input 
                                    type="number" 
                                    value={qty} 
                                    onChange={e => setQty(Number(e.target.value))}
                                    className="w-full bg-[#101828] border border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-cyan-500/50"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex justify-between">
                                    Price 
                                    {orderCategory === 'MARKET' && <span className="text-cyan-400">AT MARKET</span>}
                                </label>
                                <input 
                                    type="number" 
                                    value={orderCategory === 'MARKET' ? stock.price : priceInput} 
                                    onChange={e => setPriceInput(e.target.value)}
                                    disabled={orderCategory === 'MARKET'}
                                    className="w-full bg-[#101828] border border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
                                />
                            </div>
                            
                            {/* Bracket Orders */}
                            <div className="pt-3 border-t border-white/5">
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bracket Orders</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[9px] font-bold text-rose-500/80 uppercase tracking-wider mb-1 block">Stop Loss</label>
                                        <input 
                                            type="number" 
                                            value={stopLoss} 
                                            onChange={e => setStopLoss(Number(e.target.value))}
                                            className="w-full bg-[#101828] border border-rose-500/20 rounded-lg px-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-rose-500/50"
                                            step="0.01"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-bold text-emerald-500/80 uppercase tracking-wider mb-1 block">Take Profit</label>
                                        <input 
                                            type="number" 
                                            value={takeProfit} 
                                            onChange={e => setTakeProfit(Number(e.target.value))}
                                            className="w-full bg-[#101828] border border-emerald-500/20 rounded-lg px-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-widest">
                            <span>Req. Margin</span>
                            <span className="text-white">₹ {(qty * stock.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>

                        <button 
                            className={`w-full py-3 rounded-lg text-sm font-black uppercase tracking-widest transition-transform active:scale-95 ${orderType === 'BUY' ? 'bg-emerald-500 hover:bg-emerald-400 text-[#050B14]' : 'bg-rose-500 hover:bg-rose-400 text-[#050B14]'}`}
                        >
                            {orderType} {stock.symbol}
                        </button>
                    </AntigravityCard>

                    {/* Market Depth */}
                    <AntigravityCard className="flex-1">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Market Depth</h3>
                        <div className="grid grid-cols-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1 border-b border-white/5 pb-1.5">
                            <div>Bid (Buy)</div>
                            <div className="text-right">Ask (Sell)</div>
                        </div>
                        
                        <div className="flex pt-1">
                            {/* Bids */}
                            <div className="flex-1 border-r border-white/5 pr-2 space-y-0.5">
                                {marketDepth.bids.map((b, i) => (
                                    <div key={i} className="relative flex justify-between items-center py-0.5 text-[11px] font-mono">
                                        <div className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 rounded-sm" style={{ width: `${(b.qty / maxDepthQty) * 100}%` }} />
                                        <span className="text-emerald-400 relative z-10">{b.price.toFixed(2)}</span>
                                        <span className="text-white relative z-10">{b.qty}</span>
                                    </div>
                                ))}
                            </div>
                            {/* Asks */}
                            <div className="flex-1 pl-2 space-y-0.5">
                                {marketDepth.asks.map((a, i) => (
                                    <div key={i} className="relative flex justify-between items-center py-0.5 text-[11px] font-mono">
                                        <div className="absolute left-0 top-0 bottom-0 bg-rose-500/15 rounded-sm" style={{ width: `${(a.qty / maxDepthQty) * 100}%` }} />
                                        <span className="text-white relative z-10">{a.qty}</span>
                                        <span className="text-rose-400 relative z-10">{a.price.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </AntigravityCard>

                    {/* Quick Stats */}
                    <AntigravityCard>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Quick Stats</h3>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {[
                                { label: 'Volume', val: '4.2M' },
                                { label: 'VWAP', val: '₹2,980.15' },
                                { label: 'Day High', val: '₹3,005.00' },
                                { label: 'Day Low', val: '₹2,965.40' },
                            ].map(stat => (
                                <div key={stat.label}>
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</div>
                                    <div className="text-xs font-bold text-white mt-0.5">{stat.val}</div>
                                </div>
                            ))}
                        </div>
                    </AntigravityCard>

                </div>
            </div>
        </div>
    );
}
