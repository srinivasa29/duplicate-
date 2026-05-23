import React from 'react';
import { Check } from 'lucide-react';

const LAYOUTS = [
  {
    category: 'Basic',
    items: [
      { id: 'single', label: 'Single',    count: 1, svg: [[0,0,2,2]] },
    ],
  },
  {
    category: 'Split',
    items: [
      { id: 'vsplit', label: 'V-Split',   count: 2, svg: [[0,0,1,2],[1,0,2,2]] },
      { id: 'hsplit', label: 'H-Split',   count: 2, svg: [[0,0,2,1],[0,1,2,2]] },
    ],
  },
  {
    category: 'Grid',
    items: [
      { id: '3grid', label: '3 Panel',    count: 3, svg: [[0,0,0.67,2],[0.67,0,1.33,2],[1.33,0,2,2]] },
      { id: '4grid', label: '2×2 Grid',   count: 4, svg: [[0,0,1,1],[1,0,2,1],[0,1,1,2],[1,1,2,2]] },
      { id: '6grid', label: '6 Panel',    count: 6, svg: [[0,0,0.67,1],[0.67,0,1.33,1],[1.33,0,2,1],[0,1,0.67,2],[0.67,1,1.33,2],[1.33,1,2,2]] },
      { id: '8grid', label: '8 Panel',    count: 8, svg: [[0,0,0.5,1],[0.5,0,1,1],[1,0,1.5,1],[1.5,0,2,1],[0,1,0.5,2],[0.5,1,1,2],[1,1,1.5,2],[1.5,1,2,2]] },
    ],
  },
];

const MiniGrid = ({ rects, active, isDark }) => (
  <svg viewBox="0 0 2 2" className="w-9 h-9 rounded-md overflow-hidden shrink-0">
    {rects.map(([x1, y1, x2, y2], i) => (
      <rect
        key={i}
        x={x1 + 0.04} y={y1 + 0.04}
        width={x2 - x1 - 0.08} height={y2 - y1 - 0.08}
        rx={0.08}
        fill={active ? '#3b82f6' : isDark ? '#334155' : '#e2e8f0'}
      />
    ))}
  </svg>
);

const LayoutPicker = ({ isOpen, onClose, currentLayout, onSelect, isDark }) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[150]" onClick={onClose} />
      <div className={`absolute top-full right-0 mt-3 w-72 rounded-2xl shadow-2xl border z-[200] overflow-hidden ${
        isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-100'
      }`}>
        <div className={`px-5 py-3.5 border-b text-[10px] font-black uppercase tracking-widest ${isDark ? 'border-slate-700/60 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
          Workspace Layout
        </div>
        <div className="p-3 space-y-4">
          {LAYOUTS.map(group => (
            <div key={group.category}>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-2 px-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {group.category}
              </p>
              <div className="space-y-1">
                {group.items.map(item => {
                  const isActive = currentLayout === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onSelect(item.id); onClose(); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : isDark
                            ? 'hover:bg-slate-800 text-slate-300'
                            : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <MiniGrid rects={item.svg} active={isActive} isDark={isDark} />
                      <div className="text-left">
                        <p className={`text-[11px] font-bold ${isActive ? 'text-blue-700' : ''}`}>{item.label}</p>
                        <p className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.count} chart{item.count > 1 ? 's' : ''}</p>
                      </div>
                      {isActive && <Check size={14} className="ml-auto text-blue-600" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default LayoutPicker;
