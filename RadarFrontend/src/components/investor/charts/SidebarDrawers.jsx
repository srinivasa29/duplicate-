import React, { useEffect, useState } from 'react';
import { Star, Newspaper, Bell, Edit3, BarChart2, X, Loader2, ExternalLink, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import api from '../../../api/api';
import useStockDetails from '../../../hooks/useStockDetails';

// ── News Drawer ─────────────────────────────────────────────────────────────────
export const NewsDrawer = ({ symbol, isDark }) => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/stocks/${symbol}/news-sentiment`)
      .then(r => {
        const data = r.data?.data;
        setNews(Array.isArray(data?.articles) ? data.articles : (Array.isArray(data) ? data : []));
      })
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
    </div>
  );

  if (!news.length) return (
    <div className="py-16 text-center">
      <p className={`text-[11px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No news available for {symbol}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {news.slice(0, 20).map((item, i) => {
        const sentiment = item.sentiment || item.overall_sentiment_label || 'neutral';
        const isPos = sentiment.toLowerCase() === 'positive' || sentiment.toLowerCase() === 'bullish';
        const isNeg = sentiment.toLowerCase() === 'negative' || sentiment.toLowerCase() === 'bearish';
        return (
          <a
            key={i}
            href={item.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={`block p-4 rounded-xl border transition-all hover:shadow-md ${
              isDark
                ? 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
                : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-slate-100'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'
              }`}>{item.source || 'News'}</span>
              {sentiment !== 'neutral' && (
                <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded ${
                  isPos ? 'bg-green-50 text-green-600' : isNeg ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'
                }`}>
                  {isPos ? <TrendingUp size={9} /> : isNeg ? <TrendingDown size={9} /> : null}
                  {sentiment}
                </span>
              )}
            </div>
            <p className={`text-[12px] font-semibold leading-snug line-clamp-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              {item.headline || item.title}
            </p>
            <p className={`text-[9px] mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {item.datetime || item.publishedAt || item.time}
            </p>
          </a>
        );
      })}
    </div>
  );
};

// ── Fundamentals Drawer ────────────────────────────────────────────────────────
export const FundamentalsDrawer = ({ symbol, isDark }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/stocks/${symbol}/fundamentals`)
      .then(r => setData(r.data?.data || r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
    </div>
  );

  const metrics = data ? [
    { label: 'Market Cap',     value: data.marketCapitalization ? `₹${(data.marketCapitalization / 100).toFixed(0)} Cr` : data.marketCap || '—' },
    { label: 'P/E Ratio',      value: data.peRatio ?? data.pe ?? '—' },
    { label: 'EPS',            value: data.eps ? `₹${data.eps}` : '—' },
    { label: 'Revenue (TTM)',  value: data.revenue ? `₹${data.revenue} Cr` : '—' },
    { label: 'Net Profit',     value: data.netProfit ? `₹${data.netProfit} Cr` : '—' },
    { label: 'Debt/Equity',   value: data.debtToEquity ?? '—' },
    { label: 'ROE',            value: data.roe ? `${data.roe}%` : '—' },
    { label: 'Dividend Yield', value: data.dividendYield ? `${data.dividendYield}%` : '—' },
    { label: '52W High',       value: data.week52High ? `₹${data.week52High}` : '—' },
    { label: '52W Low',        value: data.week52Low  ? `₹${data.week52Low}`  : '—' },
  ] : [];

  return (
    <div>
      {data ? (
        <>
          <div className={`flex items-center gap-3 p-4 rounded-xl mb-4 ${isDark ? 'bg-slate-800/60' : 'bg-blue-50'}`}>
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg">
              {symbol[0]}
            </div>
            <div>
              <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{data.name || symbol}</p>
              <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{data.exchange || 'NSE'} · {data.finnhubIndustry || data.sector || 'Equity'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {metrics.map((m, i) => (
              <div key={i} className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-100'}`}>
                <p className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{m.label}</p>
                <p className={`text-[12px] font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{m.value}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="py-16 text-center">
          <p className={`text-[11px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Fundamentals unavailable for {symbol}
          </p>
        </div>
      )}
    </div>
  );
};

// ── Alerts Drawer ──────────────────────────────────────────────────────────────
export const AlertsDrawer = ({ symbol, isDark }) => {
  const [alerts, setAlerts] = useState(() => {
    try { 
      const parsed = JSON.parse(localStorage.getItem('radar_active_alerts') || '[]'); 
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });
  const [type, setType]     = useState('price');
  const [value, setValue]   = useState('');
  const [delivery, setDel]  = useState('in-app');

  const stockDetails = useStockDetails(symbol);

  const addAlert = () => {
    if (!value.trim()) return;
    const currentAlerts = Array.isArray(alerts) ? alerts : [];
    const newAlert = { id: Date.now(), symbol, type, value, delivery, active: true };
    const nextAlerts = [newAlert, ...currentAlerts];
    setAlerts(nextAlerts);
    localStorage.setItem('radar_active_alerts', JSON.stringify(nextAlerts));
    setValue('');
    window.dispatchEvent(new Event('radar_alerts_updated'));
  };

  const deleteAlert = (id) => {
    const currentAlerts = Array.isArray(alerts) ? alerts : [];
    const nextAlerts = currentAlerts.filter(a => a?.id !== id);
    setAlerts(nextAlerts);
    localStorage.setItem('radar_active_alerts', JSON.stringify(nextAlerts));
    window.dispatchEvent(new Event('radar_alerts_updated'));
  };

  const inp = `w-full text-[11px] font-medium rounded-xl border outline-none px-3 py-2.5 transition-all ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:bg-white'
  }`;

  const sel = `text-[11px] font-medium rounded-xl border outline-none px-3 py-2.5 cursor-pointer ${
    isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
  }`;

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-100'}`}>
        <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>New Alert · {symbol}</p>
        <div className="space-y-2.5">
          <select value={type} onChange={e => setType(e.target.value)} className={sel}>
            <option value="price">Price Alert</option>
            <option value="percent">% Change Alert</option>
            <option value="indicator">Indicator Crossover</option>
          </select>
          {stockDetails && type !== 'indicator' && (
            <div className={`text-[10px] font-medium px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Current {type === 'price' ? 'Price' : '% Change'}: <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>
                {type === 'price' ? `₹${stockDetails.currentPrice || 0}` : `${stockDetails.changePercent > 0 ? '+' : ''}${stockDetails.changePercent || 0}%`}
              </strong>
            </div>
          )}
          <input
            type="text" value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={type === 'price' ? 'Target price e.g. 2450' : type === 'percent' ? 'e.g. +5 or -3' : 'Condition description'}
            className={inp}
          />
          <select value={delivery} onChange={e => setDel(e.target.value)} className={sel}>
            <option value="in-app">In-App</option>
            <option value="email">Email</option>
            <option value="both">Both</option>
          </select>
          <button
            onClick={addAlert}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-black transition-colors"
          >
            Create Alert
          </button>
        </div>
      </div>

      {(() => {
        const companyAlerts = Array.isArray(alerts) ? alerts.filter(a => a?.symbol === symbol) : [];
        if (companyAlerts.length === 0) return null;
        
        return (
          <div className="space-y-2">
            <p className={`text-[9px] font-black uppercase tracking-widest px-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Active Alerts for {symbol}</p>
            {companyAlerts.map(a => (
              <div key={a?.id || Math.random()} className={`flex items-center justify-between p-3 rounded-xl border group/alert transition-all ${isDark ? 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                <div>
                  <p className={`text-[11px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{a?.symbol || 'STOCK'} · {a?.value || 'Alert'}</p>
                  <p className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{a?.type || 'price'} · {a?.delivery || 'in-app'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse group-hover/alert:hidden" />
                  <button
                    onClick={() => deleteAlert(a?.id)}
                    className="hidden group-hover/alert:flex items-center justify-center w-6 h-6 rounded-lg bg-rose-50/80 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                    title="Delete Alert"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

// ── Notes Drawer ───────────────────────────────────────────────────────────────
export const NotesDrawer = ({ symbol, isDark }) => {
  const storageKey = `radar_notes_${symbol}`;
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  });
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);

  const save = () => {
    if (!text.trim()) return;
    
    let next;
    if (editingId) {
      next = notes.map(n => n.id === editingId ? { ...n, content: text, at: new Date().toISOString() } : n);
    } else {
      next = [{ id: Date.now(), content: text, at: new Date().toISOString() }, ...notes];
    }
    
    setNotes(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setText('');
    setEditingId(null);
  };

  const startEdit = (note) => {
    setText(note.content);
    setEditingId(note.id);
  };

  const cancelEdit = () => {
    setText('');
    setEditingId(null);
  };

  const del = (id) => {
    if (!window.confirm('Delete this note?')) return;
    const next = notes.filter(n => n.id !== id);
    setNotes(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    if (editingId === id) cancelEdit();
  };

  const ta = `w-full text-[11px] font-medium rounded-xl border outline-none px-3 py-2.5 resize-none transition-all min-h-[90px] ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:bg-white'
  }`;

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-100'}`}>
        <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {editingId ? 'Edit Research Note' : 'Research Note'} · {symbol}
        </p>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Write your analysis…" className={ta} />
        <div className="flex gap-2 mt-2">
          <button onClick={save} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-black transition-colors shadow-sm">
            {editingId ? 'Update Note' : 'Save Note'}
          </button>
          {editingId && (
            <button onClick={cancelEdit} className={`px-4 py-2.5 rounded-xl text-[11px] font-black transition-colors ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
              Cancel
            </button>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {notes.map(n => (
          <div key={n.id} className={`p-4 rounded-xl border group transition-all ${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex items-start justify-between mb-3">
              <p className={`text-[9px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {new Date(n.at).toLocaleDateString()} {new Date(n.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => startEdit(n)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-blue-600'}`}>
                  <Edit3 size={12} />
                </button>
                <button onClick={() => del(n.id)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-red-500'}`}>
                  <X size={12} />
                </button>
              </div>
            </div>
            <p className={`text-[12px] leading-relaxed whitespace-pre-wrap font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{n.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Watchlist Drawer ─────────────────────────────────────────────────────────────
export const WatchlistDrawer = ({ symbol, isDark }) => {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const fetchWatchlist = async () => {
    setLoading(true);
    try {
      const res = await api.get('/watchlist').catch(() => null);
      if (res && res.data) {
        const list = Array.isArray(res.data) ? res.data[0] : res.data;
        const symbols = list?.items ? list.items.map(i => i.symbol) : (list?.symbols || []);
        setWatchlist(symbols);
      } else {
        setWatchlist([]);
      }
    } catch (e) {
      setWatchlist([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const onAdd = async () => {
    setIsAdding(true);
    try {
      let res = await api.get('/watchlist').catch(() => null);
      let list = res && res.data ? (Array.isArray(res.data) ? res.data[0] : res.data) : null;
      
      if (!list || !list._id) {
        // Fallback: If no watchlist exists, create one first
        const createRes = await api.post('/watchlist', { name: 'My Watchlist' }).catch(() => null);
        list = createRes && createRes.data ? (Array.isArray(createRes.data) ? createRes.data[0] : createRes.data) : null;
      }

      if (list && list._id) {
        await api.post(`/watchlist/${list._id}/add`, { symbol });
        setWatchlist(prev => [...new Set([...prev, symbol])]);
      } else {
        throw new Error("Could not find or create a watchlist");
      }
    } catch (e) {
      console.error('Failed to add to watchlist', e);
    } finally {
      setIsAdding(false);
    }
  };

  const onRemove = async (s) => {
    try {
      const res = await api.get('/watchlist').catch(() => null);
      if (res && res.data) {
        const list = Array.isArray(res.data) ? res.data[0] : res.data;
        await api.delete(`/watchlist/${list._id}/remove/${s}`);
        setWatchlist(prev => prev.filter(x => x !== s));
      }
    } catch (e) {
      console.error('Failed to remove from watchlist', e);
    }
  };

  const isInWatchlist = watchlist.includes(symbol);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Current Stock Section */}
      <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-blue-50 border-blue-100'}`}>
        <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? 'text-slate-400' : 'text-blue-600'}`}>Current Focus</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg">
              {symbol[0]}
            </div>
            <div>
              <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{symbol}</p>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>NSE · Equity</p>
            </div>
          </div>
          <button
            disabled={isInWatchlist || isAdding}
            onClick={onAdd}
            className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${
              isInWatchlist 
                ? 'bg-green-100 text-green-600 cursor-default' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200/40'
            }`}
          >
            {isInWatchlist ? 'In Watchlist' : isAdding ? 'Adding...' : 'Add to Watchlist'}
          </button>
        </div>
      </div>

      {/* Watchlist Section */}
      <div className="space-y-3">
        <p className={`text-[10px] font-black uppercase tracking-widest px-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Your Watchlist</p>
        {watchlist.length === 0 ? (
          <div className={`py-12 text-center rounded-2xl border border-dashed ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <p className={`text-[11px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No companies in watchlist</p>
          </div>
        ) : (
          <div className="space-y-2">
            {watchlist.map((s) => (
              <div 
                key={s} 
                className={`flex items-center justify-between p-3 rounded-xl border group transition-all ${
                  isDark ? 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600' : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${
                    isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {s[0]}
                  </div>
                  <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{s}</p>
                </div>
                <button 
                  onClick={() => onRemove(s)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDark ? 'hover:bg-slate-700 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                  }`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
