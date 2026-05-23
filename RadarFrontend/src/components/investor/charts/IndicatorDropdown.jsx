import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown, CandlestickChart, LineChart, BarChart3,
  TrendingUp, Activity, Info, Check,
} from 'lucide-react';

const INDICATORS = [
  {
    category: 'Trend',
    items: [
      { id: 'sma',  label: 'SMA',            desc: 'Simple Moving Average (20)' },
      { id: 'ema',  label: 'EMA',            desc: 'Exponential Moving Average (9)' },
      { id: 'bb',   label: 'Bollinger Bands', desc: 'Upper/Middle/Lower bands (20,2)' },
      { id: 'vwap', label: 'VWAP',           desc: 'Volume Weighted Average Price' },
    ],
  },
  {
    category: 'Momentum',
    items: [
      { id: 'rsi',   label: 'RSI',                  desc: 'Relative Strength Index (14)' },
      { id: 'macd',  label: 'MACD',                 desc: 'MACD (12,26,9)' },
      { id: 'stoch', label: 'Stochastic Oscillator', desc: 'Stochastic (14,3)' },
    ],
  },
  {
    category: 'Volume',
    items: [
      { id: 'obv', label: 'OBV', desc: 'On-Balance Volume' },
    ],
  },
  {
    category: 'Volatility',
    items: [
      { id: 'atr', label: 'ATR', desc: 'Average True Range (14)' },
    ],
  },
];

const CHART_TYPES = [
  { id: 'candlestick',  label: 'Candles',        icon: CandlestickChart },
  { id: 'hollow_candle',label: 'Hollow Candles', icon: CandlestickChart },
  { id: 'heikinAshi',  label: 'Heikin Ashi',    icon: CandlestickChart },
  { id: 'bars',        label: 'OHLC Bars',       icon: BarChart3 },
  { id: 'line',        label: 'Line',            icon: LineChart },
  { id: 'area',        label: 'Area',            icon: TrendingUp },
  { id: 'baseline',    label: 'Baseline',        icon: Activity },
];

const Dropdown = ({ label, children, isDark }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
          open
            ? 'bg-blue-600 text-white shadow-md'
            : isDark
              ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
      >
        {label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute top-full left-0 mt-2 z-[200] rounded-2xl shadow-2xl border overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-100'
        }`}>
          {children}
        </div>
      )}
    </div>
  );
};

const IndicatorDropdown = ({ indicators, onToggle, chartType, onChartTypeChange, isDark }) => {
  return (
    <div className="flex items-center gap-2">
      {/* Chart type selector */}
      <Dropdown label={CHART_TYPES.find(t => t.id === chartType)?.label || 'Candles'} isDark={isDark}>
        <div className="py-1 min-w-[160px]">
          {CHART_TYPES.map(type => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => onChartTypeChange(type.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-semibold transition-all ${
                  chartType === type.id
                    ? 'bg-blue-50 text-blue-600'
                    : isDark
                      ? 'text-slate-300 hover:bg-slate-800'
                      : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon size={14} />
                {type.label}
                {chartType === type.id && <Check size={12} className="ml-auto text-blue-500" />}
              </button>
            );
          })}
        </div>
      </Dropdown>

      {/* Indicators selector */}
      <Dropdown label="Indicators" isDark={isDark}>
        <div className="py-2 min-w-[240px] max-h-[400px] overflow-y-auto">
          {INDICATORS.map(group => (
            <div key={group.category} className="mb-1">
              <p className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}>
                {group.category}
              </p>
              {group.items.map(item => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-all group ${
                    isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => onToggle(item.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                      indicators[item.id]
                        ? 'bg-blue-600 border-blue-600'
                        : isDark ? 'border-slate-600' : 'border-slate-300'
                    }`}>
                      {indicators[item.id] && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                    <div>
                      <p className={`text-[11px] font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        {item.label}
                      </p>
                    </div>
                  </div>
                  <div className="relative group/tooltip">
                    <Info size={13} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <div className={`absolute right-0 bottom-full mb-2 w-48 p-2.5 rounded-lg text-[9px] font-medium leading-relaxed z-50 pointer-events-none opacity-0 group-hover/tooltip:opacity-100 transition-opacity shadow-xl border ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-900 border-transparent text-white'
                    }`}>
                      {item.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Dropdown>
    </div>
  );
};

export default IndicatorDropdown;
