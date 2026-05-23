import React, { useState } from 'react';
import { X, Check, Sun, Moon, Grid3x3, Volume2, Crosshair, RefreshCw, Globe, Clock } from 'lucide-react';

const Toggle = ({ checked, onChange, label, description, isDark }) => (
  <div className="flex items-center justify-between py-3">
    <div>
      <p className={`text-[11px] font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{label}</p>
      {description && (
        <p className={`text-[9px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{description}</p>
      )}
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${checked ? 'bg-blue-600' : isDark ? 'bg-slate-700' : 'bg-slate-200'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${checked ? 'left-5' : 'left-0.5'}`} />
    </button>
  </div>
);

const Select = ({ value, onChange, options, label, isDark }) => (
  <div className="flex items-center justify-between py-3">
    <p className={`text-[11px] font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{label}</p>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`text-[11px] font-medium rounded-lg px-2.5 py-1.5 border outline-none transition-all ${
        isDark
          ? 'bg-slate-800 border-slate-700 text-slate-200'
          : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-blue-300'
      }`}
    >
      {options.map(o => (
        <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
          {typeof o === 'string' ? o : o.label}
        </option>
      ))}
    </select>
  </div>
);

const SectionHeader = ({ icon: Icon, label, isDark }) => (
  <div className={`flex items-center gap-2 py-2 mb-1 border-b ${isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
    <Icon size={13} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
    <p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
  </div>
);

const SettingsDrawer = ({ isOpen, onClose, settings, setSettings }) => {
  const isDark = false; // Drawer UI stays light to match workstation
  const set = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="fixed inset-0 z-[150]" onClick={onClose} />}

      {/* Drawer */}
      <div className={`absolute top-full right-0 mt-3 w-72 rounded-2xl shadow-2xl border flex flex-col overflow-hidden z-[200] transition-all duration-200 ${
        isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
      } ${isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-100'}`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
          <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Settings</p>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
            <X size={16} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto px-5 py-2 divide-y ${isDark ? 'divide-slate-700/40' : 'divide-slate-50'}`}
          style={{ maxHeight: 'calc(100vh - 180px)' }}>

          {/* Appearance */}
          <div className="pb-3">
            <SectionHeader icon={Sun} label="Appearance" isDark={isDark} />
            <div className="flex items-center justify-between py-3">
              <p className={`text-[11px] font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Theme</p>
              <div className={`flex items-center rounded-lg p-1 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                {[{ val: 'light', icon: Sun }, { val: 'dark', icon: Moon }].map(({ val, icon: Icon }) => (
                  <button
                    key={val}
                    onClick={() => set('theme', val)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                      settings.theme === val
                        ? 'bg-white text-slate-900 shadow-sm'
                        : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Icon size={12} />
                    {val.charAt(0).toUpperCase() + val.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart Display */}
          <div className="py-3">
            <SectionHeader icon={Grid3x3} label="Chart Display" isDark={isDark} />
            <Toggle label="Show Grid"     checked={settings.showGrid}     onChange={v => set('showGrid', v)}     isDark={isDark} />
            <Toggle label="Show Volume"   checked={settings.showVolume}   onChange={v => set('showVolume', v)}   isDark={isDark} />
            <Toggle label="Show Crosshair" checked={settings.showCrosshair} onChange={v => set('showCrosshair', v)} isDark={isDark} />
            <Select label="Decimal Precision" value={settings.precision}
              onChange={v => set('precision', v)}
              options={['2', '3', '4']} isDark={isDark} />
          </div>

          {/* Sync */}
          <div className="py-3">
            <SectionHeader icon={Crosshair} label="Sync Interaction" isDark={isDark} />
            <Toggle label="Sync Crosshair" description="Sync cursor across charts"
              checked={settings.syncCrosshair} onChange={v => set('syncCrosshair', v)} isDark={isDark} />
            <Toggle label="Sync Timeframe" description="Change timeframe on all charts"
              checked={settings.syncTimeframe} onChange={v => set('syncTimeframe', v)} isDark={isDark} />
            <Toggle label="Sync Zoom"     description="Sync visible range across charts"
              checked={settings.syncZoom}     onChange={v => set('syncZoom', v)}     isDark={isDark} />
          </div>

          {/* Data */}
          <div className="py-3">
            <SectionHeader icon={RefreshCw} label="Data & Refresh" isDark={isDark} />
            <Toggle label="Auto Refresh" description="Periodically fetch new data"
              checked={settings.autoRefresh} onChange={v => set('autoRefresh', v)} isDark={isDark} />
            <Select label="Refresh Interval" value={settings.refreshInterval}
              onChange={v => set('refreshInterval', v)}
              options={['10s', '30s', '1min', '5min']} isDark={isDark} />
            <Select label="Exchange" value={settings.defaultExchange}
              onChange={v => set('defaultExchange', v)}
              options={['NSE', 'BSE']} isDark={isDark} />
          </div>

        </div>
      </div>
    </>
  );
};

export default SettingsDrawer;
