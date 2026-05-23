import React, { useState } from 'react';
import { X, Search, Clock, Plus, Check } from 'lucide-react';

const POPULAR_STOCKS = [
  'RELIANCE','TCS','INFY','HDFCBANK','ICICIBANK',
  'BAJFINANCE','WIPRO','AXISBANK','KOTAKBANK','LT',
  'HINDUNILVR','ASIANPAINT','MARUTI','SUNPHARMA','TITAN',
];

const CompareModal = ({ currentSymbol, onClose, onCompare, isDark }) => {
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState([currentSymbol]);
  const [recent]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('radar_recent_symbols') || '[]'); } catch { return []; }
  });

  const filtered = (search
    ? POPULAR_STOCKS.filter(s => s.toLowerCase().includes(search.toLowerCase()))
    : POPULAR_STOCKS
  ).filter(s => true); // show all, toggle selection

  const toggle = (sym) => {
    setSelected(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  const handleApply = () => {
    if (selected.length < 1) return;
    // Save to recent
    const next = [...new Set([...selected, ...recent])].slice(0, 10);
    localStorage.setItem('radar_recent_symbols', JSON.stringify(next));
    onCompare(selected);
    onClose();
  };

  const base = isDark
    ? 'bg-slate-900 border-slate-700 text-white'
    : 'bg-white border-slate-200 text-slate-900';

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${base}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
          <h3 className="text-sm font-black uppercase tracking-wider">Compare Symbols</h3>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className={`px-6 py-3 border-b ${isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder="Search symbol (e.g. TATAMOTORS)…"
              value={search}
              onChange={e => setSearch(e.target.value.toUpperCase())}
              className={`w-full pl-9 pr-4 py-2.5 text-sm font-medium rounded-xl border outline-none transition-all ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:bg-white'
              }`}
              onKeyDown={e => {
                if (e.key === 'Enter' && search.trim()) {
                  toggle(search.trim());
                  setSearch('');
                }
              }}
            />
          </div>
        </div>

        {/* Symbol list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 max-h-72">
          {recent.length > 0 && !search && (
            <div className="mb-4">
              <p className={`text-[9px] font-black uppercase tracking-widest mb-2 px-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Recent
              </p>
              <div className="flex flex-wrap gap-2">
                {recent.slice(0, 6).map(sym => (
                  <button
                    key={sym}
                    onClick={() => toggle(sym)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                      selected.includes(sym)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : isDark
                          ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-400'
                    }`}
                  >
                    <Clock size={10} />
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className={`text-[9px] font-black uppercase tracking-widest mb-2 px-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {search ? 'Results' : 'Popular'}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {filtered.map(sym => {
              const isSel = selected.includes(sym);
              const isCur = sym === currentSymbol;
              return (
                <button
                  key={sym}
                  onClick={() => !isCur && toggle(sym)}
                  disabled={isCur}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold border transition-all ${
                    isCur
                      ? isDark ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-default' : 'bg-slate-100 border-slate-200 text-slate-400 cursor-default'
                      : isSel
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100/30'
                        : isDark
                          ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-blue-500 hover:bg-slate-800'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:shadow-sm'
                  }`}
                >
                  {sym}
                  {isSel && !isCur && <Check size={11} strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-between ${isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
          <p className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {selected.length} selected · max 8 charts
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={selected.length < 1}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-black transition-all shadow-md shadow-blue-200/40 disabled:opacity-50"
            >
              Apply Compare
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompareModal;
