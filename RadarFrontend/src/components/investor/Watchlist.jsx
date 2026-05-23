import React, { useState, useEffect, useCallback } from 'react';
import { Search, ChevronDown, CheckCircle, AlertTriangle, Eye, ShieldAlert, Plus, Bell, Activity, TrendingUp, TrendingDown, Info, ArrowRight, CornerRightDown, AlignLeft, Filter, BookOpen, Bookmark, SlidersHorizontal, Trash2, PieChart, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell, CartesianGrid } from 'recharts';
import api from '../../api/api';
import { createWatchlist as createBackendWatchlist } from '../../api/watchlistApi';
import { useSocket } from '../../hooks/useSocket';

const mockSparklinePositive = Array.from({ length: 15 }, (_, i) => ({ value: 60 + Math.sin(i / 2) * 20 }));
const mockSparklineNegative = Array.from({ length: 15 }, (_, i) => ({ value: 60 - Math.sin(i / 2) * 20 }));

const MOCK_WATCHLIST_EMPTY = false; 

const mockAttentionStocks = [
    { name: 'Nifty 50', price: '22,450', change: '+0.8%', isPositive: true, tagTop: 'Market Index', tagTopColor: 'blue', insight: 'Trading near psychological resistance of 22,500.' },
    { name: 'HDFC Bank', price: '1,652', change: '+0.4%', isPositive: true, tagTop: 'High Delivery', tagTopColor: 'blue', insight: 'Significant institutional accumulation detected at support.' }
];
const mockRecentChanges = [
    { title: 'Market Sentiment Shift', desc: 'Overall market bias shifted from Neutral to Bullish based on index internals.', type: 'positive', date: 'Today', time: '10:45 AM' },
    { title: 'Banking Sector Breakout', desc: 'Major private banks showing volume breakout patterns on daily charts.', type: 'positive', date: 'Today', time: '09:15 AM' }
];
const mockWatchlistGrid = [];

const mockWhyThisMatters = [];
const mockCompareAndReflect = [];

const TooltipInfo = ({ text }) => (
    <div className="relative group/tooltip inline-flex items-center ml-2 align-middle">
        <Info size={14} className="text-slate-400 hover:text-blue-600 cursor-pointer transition-colors" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-[12px] font-medium leading-relaxed rounded-xl shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none text-center normal-case tracking-normal">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
    </div>
);

const EmptyState = ({ onAdd }) => (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[20px] border border-slate-100/50 shadow-sm text-center">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-sm ring-4 ring-blue-50/50">
            <BookOpen size={32} />
        </div>
        <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Build Your Intelligence Hub</h3>
        <p className="text-slate-500 mb-8 max-w-md text-[15px] leading-relaxed">
            Your watchlist acts as your personal decision-support system. Track stocks, get smart signals, and cut through the noise.
        </p>
        
        <div className="w-full max-w-2xl bg-slate-50 border border-slate-100 rounded-2xl p-6 text-left mb-8">
            <div className="flex items-center gap-2 text-slate-700 font-bold mb-4">
                <TrendingUp size={16} className="text-blue-600" />
                Getting Started: Beginner-Friendly Compounders
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                    { name: 'HDFC Bank', sym: 'HDFCBANK.NS' },
                    { name: 'Reliance Ind', sym: 'RELIANCE.NS' },
                    { name: 'TCS', sym: 'TCS.NS' },
                    { name: 'ITC', sym: 'ITC.NS' }
                ].map(stock => (
                    <div key={stock.sym} className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors shadow-sm">
                        <span className="font-bold text-slate-800">{stock.name}</span>
                        <button 
                            onClick={() => onAdd && onAdd(stock.sym)}
                            className="text-[11px] font-bold text-blue-600 flex items-center gap-1.5 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                            <Plus size={14} /> Add
                        </button>
                    </div>
                ))}
            </div>
        </div>

        <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-xl shadow-md transition-all hover:shadow-lg flex items-center gap-2">
            <Search size={18} /> Explore All Stocks
        </button>
    </div>
);

const AttentionCard = ({ stock }) => (
    <div className="bg-white rounded-[16px] p-5 border border-slate-100 hover:border-blue-100 transition-all flex flex-col justify-between shadow-sm relative group h-full">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h4 className="font-bold text-slate-800 text-base">{stock.name}</h4>
                <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-xl font-black text-slate-900">{stock.price}</span>
                    <span className={`text-[11px] font-bold ${stock.isPositive ? 'text-blue-600' : 'text-rose-500'}`}>
                        {stock.change} today
                    </span>
                </div>
            </div>
            {stock.tagTop && (
                <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1.5 ${
                    stock.tagTopColor === 'amber' ? 'bg-amber-50 text-amber-700 border border-amber-100/50' : 
                    stock.tagTopColor === 'rose' ? 'bg-rose-50 text-rose-700 border border-rose-100/50' : 'bg-blue-50 text-blue-700 border border-blue-100/50'
                }`}>
                    {stock.tagTop}
                </div>
            )}
        </div>
        
        <div className="bg-slate-50/80 rounded-xl p-3 mb-3 text-[13px] text-slate-600 font-medium leading-relaxed border border-slate-100/50">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block mb-1">Alert Trigger</span>
            {stock.insight}
        </div>
        
        <div className="flex justify-end mt-auto">
            <button className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors shadow-sm border border-slate-100 group-hover:border-blue-100" title="View Stock Data">
                 <ArrowRight size={14} />
            </button>
        </div>
    </div>
);

const AlertModal = ({ stock, onClose, onSave, existingAlertPrice }) => {
    const [price, setPrice] = useState(() => {
        if (existingAlertPrice) return existingAlertPrice;
        const rawPrice = stock.price.replace(/[^0-9.]/g, '');
        return Math.floor(parseFloat(rawPrice) * 0.95);
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!price || isNaN(price)) return;
        setIsSubmitting(true);
        try {
            await api.post('/alerts', { symbol: stock.name, targetPrice: parseFloat(price) });
            onSave(parseFloat(price));
        } catch (err) {
            console.error(err);
            alert('Failed to set alert.');
        } finally {
            setIsSubmitting(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-[15px] font-black text-slate-800 flex items-center gap-2">
                        <Bell size={18} className="text-blue-600" /> Set Price Alert
                    </h3>
                    <button onClick={onClose} className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 shadow-sm">
                        <Trash2 size={14} className="rotate-45" />
                    </button>
                </div>
                <div className="p-6">
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{stock.name}</div>
                            <div className="text-[20px] font-black text-slate-800 leading-none">{stock.price}</div>
                        </div>
                    </div>
                    
                    <div className="relative mb-6">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Target Price (₹)</label>
                        <input 
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[16px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            autoFocus
                        />
                    </div>
                    
                    <div className="flex gap-2">
                        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-[13px] hover:bg-slate-50 transition-colors">
                            Cancel
                        </button>
                        <button 
                            onClick={handleSubmit} 
                            disabled={isSubmitting}
                            className="flex-[2] py-2.5 rounded-xl bg-blue-600 text-white font-bold text-[13px] hover:bg-blue-700 transition-colors shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Saving...
                                </>
                            ) : 'Create Alert'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const GridCard = ({ stock, onRemove }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [thesis, setThesis] = useState(stock.note || '');
    const [hasNote, setHasNote] = useState(stock.hasNote || false);
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
    const [alertSuccess, setAlertSuccess] = useState(false);
    const [activeAlertPrice, setActiveAlertPrice] = useState(null);

    const handleSave = () => {
        if (thesis.trim()) {
            setHasNote(true);
        } else {
            setHasNote(false);
        }
        setIsEditing(false);
    };

    return (
        <div className="bg-white rounded-[16px] p-5 border border-slate-100 hover:shadow-md transition-shadow flex flex-col relative shadow-sm h-full group/card">
            
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h4 className="font-black text-slate-800 text-[17px] leading-none mb-1.5">{stock.name}</h4>
                    <div className="flex items-baseline gap-2">
                        <span className="text-[22px] font-bold text-slate-900 leading-none">{stock.price}</span>
                        <span className={`text-[12px] font-bold flex items-center gap-0.5 ${stock.isPositive ? 'text-blue-600' : 'text-rose-600'}`}>
                            {stock.isPositive ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} {stock.changeToday}
                        </span>
                    </div>
                </div>
                
                <div className="flex flex-col items-end gap-1.5">
                    <div className="h-[20px] mb-1">
                        {stock.tagTopRight && (
                            <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 ${
                                stock.tagTopRightColor === 'rose' ? 'bg-rose-50 text-rose-600 border border-rose-100/60' : 'bg-slate-100 text-slate-600'
                            }`}>
                               {stock.tagTopRight}
                            </div>
                        )}
                    </div>
                    <div className="w-[85px] h-10 mt-1 opacity-70">
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stock.sparkline}>
                                <defs>
                                    <linearGradient id={`grad-grid-${stock.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={stock.isPositive ? '#3E84F6' : '#e11d48'} stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor={stock.isPositive ? '#3E84F6' : '#e11d48'} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="value" stroke={stock.isPositive ? '#3E84F6' : '#e11d48'} strokeWidth={1.5} fillOpacity={1} fill={`url(#grad-grid-${stock.id})`} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 mb-4 mt-2">
                <div className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 ${
                    stock.pe.color === 'teal' ? 'bg-blue-50 text-blue-700' : 
                    stock.pe.color === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                }`}>
                   {stock.pe.label} : {stock.pe.value}
                </div>
                 <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                     Stable
                 </div>
            </div>

            {activeAlertPrice && (
                <div className="bg-slate-50 border border-emerald-100 rounded-xl p-3 mb-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Bell size={14} className="text-emerald-500" />
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">Active Alert</span>
                    </div>
                    <div className="text-[13px] font-black text-emerald-600">
                        ₹{activeAlertPrice}
                    </div>
                </div>
            )}

            <div className="flex items-center gap-2 mt-auto">
                <button 
                    onClick={() => setIsAlertModalOpen(true)}
                    className={`flex-1 border py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                        alertSuccess 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                        : 'bg-white border-slate-200 hover:border-blue-500 hover:text-blue-700 text-slate-600'
                    }`}
                >
                    {alertSuccess ? (
                        <><CheckCircle size={14} /> Alert Set</>
                    ) : (
                        <><Bell size={14} className="opacity-70" /> {activeAlertPrice ? 'Edit Alert' : 'Set Alert'}</>
                    )}
                </button>

                <button 
                    onClick={(e) => { e.stopPropagation(); onRemove && onRemove(stock.id); }}
                    className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200 rounded-xl transition-all shadow-sm flex items-center justify-center group/trash"
                    title="Remove from Watchlist"
                >
                    <Trash2 size={15} className="group-hover/trash:scale-110 transition-transform"/>
                </button>
            </div>

            {hasNote && !isEditing && (
                <div className="mt-4 bg-blue-50/30 border border-blue-100/50 rounded-xl p-3 relative group/note transition-all hover:bg-blue-50/50">
                    <div className="flex items-start gap-2">
                        <div className="mt-0.5"><BookOpen size={12} className="text-blue-600/60"/></div>
                        <div className="text-[11px] text-blue-900/80 leading-snug pr-6 font-medium">
                            <span className="font-bold text-blue-800">Your Thesis:</span> {thesis}
                        </div>
                    </div>
                    <button onClick={() => setIsEditing(true)} className="text-[10px] text-blue-700 hover:bg-blue-100 bg-white shadow-sm px-2 py-1 rounded font-bold absolute top-2 right-2 opacity-0 group-hover/note:opacity-100 transition-opacity">
                        Edit
                    </button>
                </div>
            )}

            {isEditing && (
                <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3">
                     <textarea 
                        value={thesis} 
                        onChange={e => setThesis(e.target.value)} 
                        autoFocus
                        placeholder="Why are you tracking this stock?"
                        className="w-full bg-transparent border border-slate-200 rounded-md p-2 text-[12px] text-slate-700 font-medium focus:ring-1 focus:ring-blue-500 resize-none h-16 mb-2"
                     />
                     <div className="flex justify-end gap-2 text-[11px] font-bold">
                         <button onClick={() => setIsEditing(false)} className="text-slate-500 hover:text-slate-700 px-3 py-1">Cancel</button>
                         <button onClick={handleSave} className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md shadow-sm">Save Note</button>
                     </div>
                </div>
            )}

            {!hasNote && !isEditing && (
                <div className="mt-4 flex items-center justify-center">
                     <button onClick={() => setIsEditing(true)} className="text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors cursor-pointer w-full text-center py-1">
                         + Add investment thesis
                     </button>
                </div>
            )}
            
            {isAlertModalOpen && (
                <AlertModal 
                    stock={stock} 
                    existingAlertPrice={activeAlertPrice}
                    onClose={() => setIsAlertModalOpen(false)} 
                    onSave={(price) => {
                        setActiveAlertPrice(price);
                        setAlertSuccess(true);
                        setTimeout(() => setAlertSuccess(false), 3000);
                    }}
                />
            )}
        </div>
    );
};
const DrillDownModal = ({ isOpen, onClose, metric, stockList }) => {
    if (!isOpen || !metric) return null;

    const chartData = stockList.map(s => {
        let val = 0;
        if (metric.key === 'pe') {
            val = parseFloat(s.pe?.value?.replace(/[^0-9.]/g, '') || 0);
        } else {
            val = s[metric.key];
        }
        
        return {
            name: s.name,
            value: isNaN(val) ? 0 : val
        };
    }).sort((a, b) => metric.higherBetter ? b.value - a.value : a.value - b.value);

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                           {metric.icon && <metric.icon size={20} className={metric.colorClass}/>}
                           {metric.name} Comparison
                        </h3>
                        <p className="text-xs font-medium text-slate-500 mt-1">Comparing all stocks in your watchlist</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shadow-sm">
                        <Trash2 size={16} className="rotate-45" />
                    </button>
                </div>
                
                <div className="p-8">
                    <div className="h-[300px] w-full mb-8">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500, fill: '#94a3b8' }} />
                                <RechartsTooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 800 }}
                                />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? metric.colorHex : '#e2e8f0'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-blue-50/50 border border-blue-100/50 rounded-2xl p-5 flex gap-4 items-start">
                        <div className="w-10 h-10 rounded-xl bg-white border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <div className="text-[11px] font-black uppercase text-blue-600 tracking-wider mb-1">Stock Intelligence Insight</div>
                            <div className="text-[14px] font-bold text-slate-700 leading-relaxed">
                                <span className="text-blue-700">{chartData[0]?.name || 'N/A'}</span> {metric.insightPrefix} indicating {metric.insightSuffix} compared to others on your watchlist.
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors shadow-sm">
                        Close Analysis
                    </button>
                </div>
            </div>
        </div>
    );
};

const HeatmapTile = ({ metric, leader, onClick }) => (
    <div 
        onClick={() => onClick(metric)}
        className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col justify-between hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden h-full"
    >
        <div 
            className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity"
            style={{ backgroundColor: metric.colorHex }}
        ></div>
        
        <div className="flex justify-between items-start mb-2 relative z-10">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{metric.name}</span>
            <metric.icon size={14} className={metric.colorClass + " opacity-60"} />
        </div>
        
        <div className="relative z-10">
            <div className="text-[13px] font-black text-slate-800 mb-0.5 group-hover:text-blue-700 transition-colors">{leader ? leader.name : 'N/A'}</div>
            <div className="flex items-baseline gap-1.5">
                <span className={`text-[17px] font-black ${metric.colorClass}`}>
                    {leader ? (
                        metric.key === 'pe'
                            ? (leader.pe?.value && leader.pe.value !== '...' ? leader.pe.value : '-')
                            : (leader[metric.key] != null && leader[metric.key] !== '' ? leader[metric.key] : '-')
                    ) : '-'}
                    <span className="text-[10px] ml-0.5 opacity-70">{metric.unit}</span>
                </span>
            </div>
        </div>

        <div className="mt-3 flex items-center justify-between relative z-10">
            <span className={`text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md ${metric.labelBg}`}>
                {metric.label}
            </span>
            <div className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all border border-slate-100">
                <ArrowRight size={10} />
            </div>
        </div>
    </div>
);

const WatchlistHeatmap = ({ watchlist }) => {
    const [selectedMetric, setSelectedMetric] = useState(null);

    const displayData = watchlist;

    const metrics = [
        { 
            key: 'delivery', 
            name: 'Delivery %', 
            icon: CheckCircle, 
            colorClass: 'text-blue-600', 
            colorHex: '#3E84F6', 
            labelBg: 'bg-blue-50 text-blue-700',
            higherBetter: true, 
            unit: '%', 
            label: 'High Conviction',
            insightPrefix: 'shows the highest delivery volume',
            insightSuffix: 'strong investor willingness to hold for delivery'
        },
        { 
            key: 'pe', 
            name: 'P/E Ratio', 
            icon: ShieldAlert, 
            colorClass: 'text-rose-600', 
            colorHex: '#e11d48', 
            labelBg: 'bg-rose-50 text-rose-700',
            higherBetter: false, 
            unit: 'x', 
            label: 'Value Pick',
            insightPrefix: 'is trading at the lowest P/E multiplier',
            insightSuffix: 'a potential valuation advantage'
        },
        { 
            key: 'beta', 
            name: 'Beta (Risk)', 
            icon: Activity, 
            colorClass: 'text-amber-600', 
            colorHex: '#f59e0b', 
            labelBg: 'bg-amber-50 text-amber-700',
            higherBetter: true, 
            unit: 'x', 
            label: 'High Beta',
            insightPrefix: 'exhibits the highest beta on the watchlist',
            insightSuffix: 'significant volatility and market reactivity'
        },
        { 
            key: 'momentum', 
            name: '1M Momentum', 
            icon: TrendingUp, 
            colorClass: 'text-blue-600', 
            colorHex: '#3E84F6', 
            labelBg: 'bg-blue-50 text-blue-700',
            higherBetter: true, 
            unit: '%', 
            label: 'Strong Trend',
            insightPrefix: 'leads the watchlist in monthly momentum',
            insightSuffix: 'a clear sustained bullish trend'
        },
        { 
            key: 'volumeScore', 
            name: 'Volume Score', 
            icon: Filter, 
            colorClass: 'text-blue-500', 
            colorHex: '#3b82f6', 
            labelBg: 'bg-blue-50 text-blue-600',
            higherBetter: true, 
            unit: 'x', 
            label: 'High Activity',
            insightPrefix: 'is showing exceptional volume spikes',
            insightSuffix: 'increased institutional or retail interest'
        },
        { 
            key: 'roe', 
            name: 'ROE %', 
            icon: Activity, 
            colorClass: 'text-blue-700', 
            colorHex: '#1d4ed8', 
            labelBg: 'bg-blue-50 text-blue-800',
            higherBetter: true, 
            unit: '%', 
            label: 'Efficient Cap',
            insightPrefix: 'commands the highest Return on Equity',
            insightSuffix: 'superior capital efficiency and profitability'
        }
    ];

    const getLeader = (metricKey, higherBetter) => {
        if (!displayData.length) return null;
        return [...displayData].sort((a, b) => {
            let valA = 0;
            let valB = 0;
            
            if (metricKey === 'pe') {
                valA = parseFloat(a.pe?.value?.replace(/[^0-9.]/g, '') || 0);
                valB = parseFloat(b.pe?.value?.replace(/[^0-9.]/g, '') || 0);
            } else {
                valA = a[metricKey];
                valB = b[metricKey];
            }
            
            valA = isNaN(valA) ? 0 : valA;
            valB = isNaN(valB) ? 0 : valB;
            
            return higherBetter ? valB - valA : valA - valB;
        })[0];
    };

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 h-full">
            {metrics.map(m => (
                <HeatmapTile 
                    key={m.key} 
                    metric={m} 
                    leader={getLeader(m.key, m.higherBetter)}
                    onClick={(metric) => setSelectedMetric(metric)}
                />
            ))}
            
            <DrillDownModal 
                isOpen={!!selectedMetric} 
                onClose={() => setSelectedMetric(null)} 
                metric={selectedMetric} 
                stockList={displayData}
            />
        </div>
    );
};

const MarketBehaviorMirror = ({ stats }) => {
    if (!stats || !stats.marketMirror) return null;

    const { volatility, sector, valuation } = stats.marketMirror;

    return (
        <div className="bg-white rounded-[20px] shadow-sm border border-slate-100 p-5 md:p-6 opacity-95">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-slate-800 font-black text-[15px]">
                    <Activity size={18} className="text-blue-600" />
                    Market Behavior Mirror
                    <TooltipInfo text="Objective comparison of your watchlist metrics against broader market benchmarks (Indices)." />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Market Sync</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 mb-5">How your tracking list mirrors the broader index</div>
            
            <div className="grid grid-cols-1 gap-4">
                {}
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 hover:border-blue-200 transition-all">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-tighter mb-0.5">Volatility vs Market</div>
                            <div className="text-[13px] font-bold text-slate-800">{volatility.label}</div>
                        </div>
                        <div className={`px-2 py-0.5 rounded text-[10px] font-black ${volatility.isHigher ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                            Beta: {volatility.user}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                            <div 
                                className={`h-full ${volatility.isHigher ? 'bg-rose-500' : 'bg-blue-500'}`} 
                                style={{ width: `${Math.min(parseFloat(volatility.user) * 50, 100)}%` }}
                            ></div>
                        </div>
                        <span className="text-[10px] font-black text-slate-400">Idx: 1.0</span>
                    </div>
                </div>

                {}
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 hover:border-blue-200 transition-all">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-tighter mb-0.5">Sector Mix vs Index</div>
                            <div className="text-[13px] font-bold text-slate-800">{sector.label}</div>
                        </div>
                        <PieChart size={16} className="text-blue-500 opacity-60" />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-[11px] font-bold text-slate-500">Concentration:</div>
                        <div className="flex gap-1.5">
                            <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-black text-slate-700">{sector.top} ({sector.perc}%)</span>
                        </div>
                    </div>
                </div>

                {}
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 hover:border-blue-200 transition-all">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-tighter mb-0.5">Valuation vs Benchmark</div>
                            <div className="text-[13px] font-bold text-slate-800">{valuation.label}</div>
                        </div>
                        <BarChart3 size={16} className="text-blue-500 opacity-60" />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Watchlist P/E</span>
                            <span className="text-[14px] font-black text-slate-800">{valuation.userPE}x</span>
                        </div>
                        <div className="h-8 w-[1px] bg-slate-200"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Market Avg</span>
                            <span className="text-[14px] font-black text-slate-500">{valuation.marketPE}x</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Watchlist = () => {
    const [activeTab, setActiveTab] = useState('all');
    const [watchlist, setWatchlist] = useState([]);
    const [isLoadingLive, setIsLoadingLive] = useState(true);
    const [watchlistId, setWatchlistId] = useState(null);

    const { on } = useSocket(['ticker']);

    // Normalizes a live market quote into the GridCard-compatible shape
    const normalizeToGridCard = (quote, idx) => {
        const sym = String(quote.symbol || '').replace(/\.(NS|BO)$/i, '');
        const price = Number(quote.price ?? quote.ltp ?? quote.lastPrice ?? 0);
        const changePercent = Number(quote.changePercent ?? quote.change ?? 0);
        const isPositive = changePercent >= 0;
        const sparkline = Array.from({ length: 15 }, (_, i) => ({
            value: Math.max(1, price * (1 + (i % 3 - 1) * 0.003))
        }));
        return {
            id: `live-${idx}`,
            name: sym,
            price: `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            changeToday: `${isPositive ? '+' : ''}${changePercent.toFixed(2)}%`,
            changeTotal: `${isPositive ? '+' : ''}${changePercent.toFixed(2)}%`,
            isPositive,
            sparkline,
            sector: quote.sector || 'Equity',
            pe: { label: 'P/E', value: quote.pe ? String(Number(quote.pe).toFixed(1)) : 'N/A', color: 'blue' },
            valStatus: quote.valStatus || 'fair',
            beta: Number(quote.beta ?? 1),
            delivery: Number(quote.deliveryPct ?? 45),
            momentum: Number(quote.momentum ?? changePercent),
            volumeScore: Number(quote.volumeRatio ?? 1),
            roe: Number(quote.roe ?? 0),
            metrics: [],
            verdict: quote.verdict || '',
            hasNote: false,
        };
    };

    useEffect(() => {
        let active = true;
        const load = async () => {
            setIsLoadingLive(true);
            try {
                // 1. Fetch user's watchlist symbols - Investor mode
                const wlRes = await api.get('/watchlist', { params: { mode: 'investor' } });
                const wlData = wlRes.data?.data ?? wlRes.data;
                
                // The Watchlist model stores items as objects: {symbol: "RELIANCE.NS", addedAt: ...}
                // Handle both plain strings and {symbol: string} objects
                const extractSymbol = (item) => {
                    if (!item) return null;
                    if (typeof item === 'string') return item;
                    if (typeof item === 'object') return item.symbol || item.sym || null;
                    return null;
                };

                const symbols = (Array.isArray(wlData)
                    ? wlData.flatMap(w => (w.items ?? w.symbols ?? w.stocks ?? []).map(extractSymbol))
                    : []).filter(Boolean);
                
                if (Array.isArray(wlData) && wlData.length > 0) {
                    setWatchlistId(wlData[0]._id || wlData[0].id);
                } else if (Array.isArray(wlData) && wlData.length === 0) {
                    const created = await createBackendWatchlist('Investor Portfolio', 'investor');
                    if (created?._id || created?.id) {
                        setWatchlistId(created._id || created.id);
                    }
                }

                if (!symbols.length || !active) { setIsLoadingLive(false); return; }

                // 2. Fetch live quotes for all symbols
                const symbolStr = symbols.join(',');
                const mktRes = await api.get(`/market/quotes?symbols=${encodeURIComponent(symbolStr)}`);
                const quotes = mktRes.data?.data ?? mktRes.data;

                if (Array.isArray(quotes) && quotes.length && active) {
                    setWatchlist(quotes.map(normalizeToGridCard));
                } else if (active && (!symbols.length || !quotes.length)) {
                    // Keep the default mocks if no symbols found in backend
                    console.log("No symbols in backend, keeping mocks.");
                }
            } catch (err) {
                console.warn('Investor Watchlist live load failed, keeping mock data:', err.message);
                // We don't call setWatchlist([]) here, so the initial mocks stay visible
            } finally {
                if (active) setIsLoadingLive(false);
            }
        };
        load();
        return () => { active = false; };
    }, []);

    // Handle real-time WebSocket updates
    useEffect(() => {
        on('price_update', (event) => {
            if (!event.symbol) return;
            
            const eventSym = String(event.symbol).replace(/\.(NS|BO)$/i, '').toUpperCase();
            
            setWatchlist(prev => {
                const targetIdx = prev.findIndex(s => s.name.toUpperCase() === eventSym);
                if (targetIdx === -1) return prev;

                const next = [...prev];
                const item = next[targetIdx];
                const price = Number(event.price);
                const change = Number(event.change || item.changeToday.replace(/[^0-9.-]/g, ''));
                const isPositive = change >= 0;

                next[targetIdx] = {
                    ...item,
                    price: `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    changeToday: `${isPositive ? '+' : ''}${change.toFixed(2)}%`,
                    isPositive,
                };
                return next;
            });
        });
    }, [on]);
    
    const stats = React.useMemo(() => {
        const displayData = watchlist;

        if (displayData.length === 0) {
            return {
                total: 0,
                avgPE: 'N/A',
                gains: 0,
                losses: 0,
                valuation: { label: 'N/A', breakdown: 'ADD STOCKS TO VIEW', color: 'slate' },
                risk: { label: 'N/A', avgBeta: 'N/A', insight: 'No data available', color: 'slate' },
                marketMirror: {
                    volatility: {
                        user: 'N/A',
                        market: "1.00",
                        isHigher: false,
                        label: 'Add stocks to view'
                    },
                    sector: {
                        top: 'N/A',
                        perc: 0,
                        isConcentrated: false,
                        label: 'Add stocks to view'
                    },
                    valuation: {
                        userPE: 'N/A',
                        marketPE: 22.5,
                        isHigher: false,
                        label: 'Add stocks to view'
                    }
                }
            };
        }

        const total = displayData.length;
        const counts = { undervalued: 0, fair: 0, overvalued: 0 };
        let totalPE = 0;
        let validPECount = 0;

        displayData.forEach(s => {
            if (counts[s.valStatus] !== undefined) counts[s.valStatus]++;
            else counts.fair++;

            const peValue = s.pe?.value ? parseFloat(s.pe.value.replace(/[^0-9.]/g, '')) : NaN;
            if (!isNaN(peValue)) {
                totalPE += peValue;
                validPECount++;
            }
        });

        const avgPE = validPECount > 0 ? (totalPE / validPECount).toFixed(1) : "21.5";

        const percs = {
            undervalued: Math.round((counts.undervalued / total) * 100),
            fair: Math.round((counts.fair / total) * 100),
            overvalued: Math.round((counts.overvalued / total) * 100)
        };

        let valStatusLabel = "Mixed Valuation";
        let valColorKey = "amber";
        if (percs.undervalued > 50) { valStatusLabel = "Undervalued Opportunity"; valColorKey = "blue"; }
        else if (counts.fair > total / 2) { valStatusLabel = "Fairly Valued"; valColorKey = "amber"; }
        else if (percs.overvalued > 50) { valStatusLabel = "Overvalued Zone"; valColorKey = "rose"; }

        const avgBeta = displayData.reduce((acc, s) => acc + (s.beta || 1), 0) / total;
        let riskLabel = "Moderate Risk";
        let riskColorKey = "amber";
        if (avgBeta < 0.8) { riskLabel = "Low Risk"; riskColorKey = "blue"; }
        else if (avgBeta > 1.2) { riskLabel = "High Risk"; riskColorKey = "rose"; }

        const sectorCounts = {};
        displayData.forEach(s => {
            const sec = s.sector || 'Others';
            sectorCounts[sec] = (sectorCounts[sec] || 0) + 1;
        });
        const topSector = Object.keys(sectorCounts).reduce((a, b) => sectorCounts[a] > sectorCounts[b] ? a : b);
        const topSectorPerc = Math.round((sectorCounts[topSector] / total) * 100);

        const benchmarkPE = 22.5;
        const benchmarkTopSector = "Banking";
        
        return {
            total: watchlist.length,
            avgPE,
            gains: displayData.filter(s => s.isPositive).length,
            losses: displayData.filter(s => !s.isPositive).length,
            valuation: {
                label: valStatusLabel,
                colorKey: valColorKey,
                breakdown: `${percs.fair}% Fair • ${percs.overvalued}% Over • ${percs.undervalued}% Under`
            },
            risk: {
                label: riskLabel,
                colorKey: riskColorKey,
                avgBeta: avgBeta.toFixed(2),
                insight: avgBeta > 1.05 ? "More volatile than market" : (avgBeta < 0.95 ? "Less volatile than market" : "Market-aligned volatility")
            },
            marketMirror: {
                volatility: {
                    user: avgBeta.toFixed(2),
                    market: "1.00",
                    isHigher: avgBeta > 1.0,
                    label: avgBeta > 1.05 ? "More volatile than market" : (avgBeta < 0.95 ? "Lower volatility vs Index" : "Market Neutral")
                },
                sector: {
                    top: topSector,
                    perc: topSectorPerc,
                    isConcentrated: topSector === benchmarkTopSector ? false : topSectorPerc > 30,
                    label: topSectorPerc > 30 ? `${topSector}-heavy compared to index` : "Diversified sector mix"
                },
                valuation: {
                    userPE: avgPE,
                    marketPE: benchmarkPE,
                    isHigher: parseFloat(avgPE) > benchmarkPE,
                    label: parseFloat(avgPE) > benchmarkPE ? "Premium valuation vs Market" : "Discounted P/E vs Benchmark"
                }
            }
        };
    }, [watchlist]);

    const dynamicAttentionStocks = React.useMemo(() => {
        if (!watchlist.length) return [];
        return [...watchlist]
            .filter(s => !s.isPositive || (s.beta > 1.2) || parseFloat(s.pe?.value || '0') > 30)
            .sort((a, b) => {
                const aChange = parseFloat(a.changeToday?.replace(/[^0-9.-]/g, '') || 0);
                const bChange = parseFloat(b.changeToday?.replace(/[^0-9.-]/g, '') || 0);
                return aChange - bChange;
            })
            .slice(0, 3)
            .map(s => ({
                id: s.id,
                name: s.name,
                price: s.price,
                change: s.changeToday,
                isPositive: s.isPositive,
                tagTop: !s.isPositive ? 'Price Drop' : (s.beta > 1.2 ? 'High Volatility' : 'Valuation Alert'),
                tagTopColor: !s.isPositive ? 'rose' : (s.beta > 1.2 ? 'amber' : 'amber'),
                insight: !s.isPositive ? `Stock has dropped ${s.changeToday} today, breaking recent support levels.` : `Trading at elevated risk metrics compared to historical averages.`
            }));
    }, [watchlist]);

    const dynamicRecentChanges = React.useMemo(() => {
        if (!watchlist.length) return [];
        return [...watchlist]
            .sort((a, b) => {
                const aChange = Math.abs(parseFloat(a.changeToday?.replace(/[^0-9.-]/g, '') || 0));
                const bChange = Math.abs(parseFloat(b.changeToday?.replace(/[^0-9.-]/g, '') || 0));
                return bChange - aChange;
            })
            .slice(0, 2)
            .map(s => ({
                title: `${s.name} ${s.isPositive ? 'Momentum Shift' : 'Volume Breakout'}`,
                desc: s.isPositive ? `Strong upward movement of ${s.changeToday} observed in recent sessions.` : `Significant downward pressure of ${s.changeToday} triggering volume alerts.`,
                type: s.isPositive ? 'positive' : 'negative',
                date: 'Today',
                time: 'Live'
            }));
    }, [watchlist]);

    const holdingsGridClass = watchlist.length <= 1
        ? 'grid grid-cols-1 gap-6'
        : watchlist.length === 2
            ? 'grid grid-cols-1 lg:grid-cols-2 gap-6'
            : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6';

    const handleRemoveFromWatchlist = async (stockSymbol) => {
        // Optimistic UI update
        const backup = [...watchlist];
        setWatchlist(prev => prev.filter(s => s.name !== stockSymbol && s.sym !== stockSymbol));

        if (!watchlistId) return;
        try {
            await api.delete(`/watchlist/${watchlistId}/remove/${encodeURIComponent(stockSymbol)}`);
        } catch (err) {
            console.error('Failed to remove stock from backend:', err);
            // Optional: revert if absolutely necessary, but usually better to stay optimistic
            // setWatchlist(backup);
        }
    };

    const handleAddToWatchlist = async (stockSymbol) => {
        // Optimistic UI: Add a placeholder immediately
        const placeholder = { 
            id: Date.now(), 
            name: stockSymbol.split('.')[0], 
            sym: stockSymbol, 
            price: '₹...', 
            changeToday: '...', 
            isPositive: true, 
            pe: { value: '...' }, 
            valStatus: 'fair', 
            beta: 1.0, 
            delivery: null,
            momentum: null,
            volumeScore: null,
            roe: null,
            sector: 'Equity',
            sparkline: mockSparklinePositive 
        };
        setWatchlist(prev => [...prev, placeholder]);

        if (!watchlistId) return;
        try {
            await api.post(`/watchlist/${watchlistId}/add`, { symbol: stockSymbol });
            // Fetch live data to replace placeholder
            const mktRes = await api.get(`/market/quotes?symbols=${encodeURIComponent(stockSymbol)}`);
            const quotes = mktRes.data?.data ?? mktRes.data;
            if (Array.isArray(quotes) && quotes.length > 0) {
                setWatchlist(prev => prev.map(s => s.id === placeholder.id ? normalizeToGridCard(quotes[0], prev.length) : s));
            }
        } catch (err) {
            console.error('Failed to add stock to backend:', err);
            // Optional: revert placeholder on failure
            // setWatchlist(prev => prev.filter(s => s.id !== placeholder.id));
        }
    };

    const [isHeatmapOpen, setIsHeatmapOpen] = useState(false);
    
    return (
        <div className="w-full min-h-screen py-6">
            {}

            <div className="fade-in w-full min-h-screen relative px-4 md:px-10">
            
                <div className="mb-16">
                {}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 px-2">
                    <div>
                        <h2 className="text-[26px] font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <Bookmark size={24} className="text-blue-600 hidden sm:block" /> 
                            Intelligence Watchlist
                        </h2>
                        <p className="text-sm font-medium text-slate-500 mt-1">Your decision-support command center.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Find within watchlist..." 
                                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-[220px] focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 shadow-sm transition-all text-slate-800 font-medium"
                            />
                        </div>
                    </div>
                </div>

            <div className="space-y-6">

                {/* Loading state */}
                {isLoadingLive && (
                    <div className="flex flex-col items-center justify-center p-16 bg-white rounded-[20px] border border-slate-100 shadow-sm min-h-[400px]">
                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <div className="text-slate-800 font-bold mb-1">Syncing Intelligence Hub</div>
                        <div className="text-slate-500 text-[12px]">Connecting to live market feeds...</div>
                    </div>
                )}

                {/* Empty state — no stocks tracked */}
                {!isLoadingLive && watchlist.length === 0 && (
                    <EmptyState onAdd={handleAddToWatchlist} />
                )}

                {/* Full dashboard — only shown when stocks exist */}
                {!isLoadingLive && watchlist.length > 0 && (
                    <>
                    {/* Watchlist Overview */}
                    <div className="bg-white rounded-[20px] shadow-sm border border-slate-100 p-5 md:p-6">
                        <div className="text-[11px] font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center">
                            Watchlist Overview
                            <TooltipInfo text="High-level aggregate metrics representing the overall performance and status of all stocks currently in your watchlist." />
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between">
                                <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Tracked</div>
                                    <div className="text-2xl font-black text-slate-800">{stats?.total || 0} <span className="text-xs font-bold text-slate-500">Stk</span></div>
                                </div>
                                <div className="flex items-end gap-1 flex-col text-[10px] font-bold">
                                    <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{stats?.gains || 0} Gain</span>
                                    <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{stats?.losses || 0} Loss</span>
                                </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between">
                                <div className="flex flex-col">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center">
                                        Watchlist Valuation Snapshot
                                        <TooltipInfo text="Based on valuation classification of tracked stocks" />
                                    </div>
                                    <div className="text-lg font-black text-slate-800">{stats?.valuation?.label}</div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{stats?.valuation?.breakdown}</div>
                                </div>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                                    stats?.valuation?.colorKey === 'blue' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                    stats?.valuation?.colorKey === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                }`}>
                                    {stats?.valuation?.label === "Undervalued Opportunity" ? <TrendingUp size={18}/> : stats?.valuation?.label === "Overvalued Zone" ? <TrendingDown size={18}/> : <CheckCircle size={18}/>}
                                </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between">
                                <div className="flex flex-col">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center">
                                        Watchlist Risk Level
                                        <TooltipInfo text="Based on average beta (volatility vs market)" />
                                    </div>
                                    <div className="text-lg font-black text-slate-800">
                                        {stats?.risk?.label} <span className="text-xs font-bold text-slate-500">({stats?.risk?.avgBeta}x beta)</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 italic pr-2">"{stats?.risk?.insight}"</div>
                                </div>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                                    stats?.risk?.colorKey === 'blue' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                    stats?.risk?.colorKey === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                }`}>
                                   <Activity size={18}/>
                                </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-slate-200 transition-colors group">
                                <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Needs Attention</div>
                                    <div className="text-2xl font-black text-amber-600">{dynamicAttentionStocks.length} <span className="text-[11px] font-bold opacity-70 text-slate-500">Stocks</span></div>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform border border-amber-100/50">
                                    <AlertTriangle size={18} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* What Needs Attention + Recent Changes */}
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="lg:w-[65%] bg-white rounded-[20px] shadow-sm border border-slate-100 p-5 md:p-6 transition-all">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-[15px] font-black text-slate-800 flex items-center gap-2">
                                    <AlertTriangle size={18} className="text-amber-500" />
                                    What Needs Attention
                                    <TooltipInfo text="Stocks that have triggered a predefined manual or system-level alert requiring immediate review by the investor." />
                                </h3>
                                <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md">Priority Review</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {dynamicAttentionStocks.length > 0 ? dynamicAttentionStocks.map(stock => (
                                    <AttentionCard key={stock.id} stock={stock} />
                                )) : (
                                    <div className="col-span-1 md:col-span-3 py-8 text-center text-slate-500 text-[13px] font-medium border border-dashed border-slate-200 rounded-xl">
                                        All clear — no stocks require immediate attention.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="lg:w-[35%] bg-white rounded-[20px] shadow-sm border border-slate-100 p-6 md:p-8 flex flex-col h-full min-h-[260px] lg:min-h-[320px]">
                            <h3 className="text-[16px] font-black text-slate-800 mb-6 flex items-center gap-2">
                                <Activity size={18} className="text-blue-500" />
                                Recent Changes
                                <TooltipInfo text="A chronological activity log of objective, factual events affecting the stocks on your watchlist." />
                            </h3>
                            <div className="flex-grow space-y-6">
                                {dynamicRecentChanges.map((change, i) => (
                                    <div key={i} className="flex gap-4 relative">
                                        <div className="mt-1.5 flex flex-col items-center">
                                            {change.type === 'positive' ? <div className="w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-50 relative z-10"></div> :
                                             change.type === 'negative' ? <div className="w-3 h-3 rounded-full bg-rose-500 ring-4 ring-rose-50 relative z-10"></div> :
                                             <div className="w-3 h-3 rounded-full bg-amber-500 ring-4 ring-amber-50 relative z-10"></div>}
                                            {i !== dynamicRecentChanges.length - 1 && <div className="w-px h-full bg-slate-100 absolute top-4"></div>}
                                        </div>
                                        <div className="pb-2 w-full">
                                            <div className="flex justify-between items-start w-full">
                                                <div className="text-[14px] font-bold text-slate-800">{change.title}</div>
                                                <div className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wide">{change.date}, {change.time}</div>
                                            </div>
                                            <div className="text-[12px] font-medium text-slate-500 leading-relaxed mt-1.5 pr-2">{change.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-auto pt-6">
                                <button className="w-full text-[12px] font-bold text-blue-700 bg-blue-50/50 border border-blue-100/60 py-3 rounded-[12px] hover:bg-blue-50 hover:border-blue-200 transition-colors">
                                    View Full Activity Log
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Watchlist Holdings grid */}
                    <div className="bg-white rounded-[20px] shadow-sm border border-slate-100 p-5 md:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                            <h3 className="text-[15px] font-black text-slate-800 flex items-center">
                                Watchlist Holdings
                                <TooltipInfo text="Your primary grid of tracked stocks, displaying real-time technicals, valuations, and customized target proximity bars." />
                            </h3>
                            <div className="flex items-center gap-3">
                                <div className="relative group">
                                    <button className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 text-[11px] font-bold hover:bg-slate-50 hover:text-blue-700 hover:border-blue-200 transition-all shadow-sm">
                                        <Filter size={13} className="text-slate-400 group-hover:text-blue-500" />
                                        Tags
                                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px] ml-1 group-hover:bg-blue-50 group-hover:text-blue-700">All Tracks</span>
                                        <ChevronDown size={14} className="ml-1 opacity-60" />
                                    </button>
                                </div>
                                <div className="relative group">
                                    <button className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 text-[11px] font-bold hover:bg-slate-100 transition-colors shadow-sm">
                                        Sort: <span className="text-blue-700">Valuation Gap</span>
                                        <ChevronDown size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className={holdingsGridClass}>
                            {watchlist.map(stock => (
                                <GridCard
                                    key={stock.id}
                                    stock={stock}
                                    onRemove={() => handleRemoveFromWatchlist(stock.sym)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Market Behavior Mirror + Heatmap */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <MarketBehaviorMirror stats={stats} />

                        <div className="bg-white rounded-[20px] shadow-sm border border-slate-100 p-5 md:p-6 opacity-95">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 text-slate-800 font-black text-[15px]">
                                    <SlidersHorizontal size={18} className="text-slate-500" />
                                    Watchlist Heatmap Insights
                                    <TooltipInfo text="A compact, interactive comparison of your watchlist stocks across key fundamental and technical metrics." />
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Research Tool</span>
                            </div>
                            <div className="text-[11px] font-medium text-slate-500 mb-5">Click any tile to compare all tracked stocks</div>
                            <div className="h-[250px] sm:h-[300px]">
                                <WatchlistHeatmap watchlist={watchlist} />
                            </div>
                        </div>
                    </div>
                    </>
                )}
            </div>
        </div>
        </div>
        </div>
    );
};

export default Watchlist;
