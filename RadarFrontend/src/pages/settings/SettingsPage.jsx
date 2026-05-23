import React, { useState, useEffect, useContext } from 'react';
import { ArrowLeft, Monitor, Bell, Shield, LayoutGrid, CheckCircle2, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SettingsContext } from '../../context/SettingsContext';
import './SettingsPage.css';

const SettingsPage = ({ embedded = false } = {}) => {
  const navigate = useNavigate();
  const { settings: ctxSettings, saveSettings: saveToServer } = useContext(SettingsContext);

  const [settings, setSettings] = useState({
    // Chart & Display
    defaultTimeframe: '15m',
    defaultLayout: '4-grid',
    showGridLines: true,
    showIndicators: false,

    // Dashboard Preferences
    defaultModule: 'DASHBOARD',
    autoRefreshWatchlist: true,

    // Risk Defaults
    defaultStopLoss: 2.0,
    defaultTakeProfit: 5.0,

    // Alerts
    priceAlerts: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  // Load saved settings from context on mount
  useEffect(() => {
    if (!ctxSettings) return;
    try {
      setSettings(prev => ({
        ...prev,
        defaultTimeframe:     ctxSettings.display?.defaultTimeframe     ?? prev.defaultTimeframe,
        defaultLayout:        ctxSettings.display?.defaultLayout        ?? prev.defaultLayout,
        showGridLines:        ctxSettings.display?.showGridLines        ?? prev.showGridLines,
        showIndicators:       ctxSettings.display?.showIndicators       ?? prev.showIndicators,
        defaultModule:        ctxSettings.dashboard?.defaultModule      ?? prev.defaultModule,
        autoRefreshWatchlist: ctxSettings.dashboard?.autoRefreshWatchlist ?? prev.autoRefreshWatchlist,
        defaultStopLoss:      ctxSettings.risk?.defaultStopLossPct      ?? prev.defaultStopLoss,
        defaultTakeProfit:    ctxSettings.risk?.defaultTakeProfitPct    ?? prev.defaultTakeProfit,
        priceAlerts:          ctxSettings.alerts?.priceAlerts           ?? prev.priceAlerts,
      }));
    } catch (e) { /* ignore mapping errors */ }
  }, [ctxSettings]);

  // Warn on unsaved changes
  useEffect(() => {
    const handler = (e) => { if (isDirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleSave = async () => {
    const payload = {
      display: {
        defaultTimeframe: settings.defaultTimeframe,
        defaultLayout:    settings.defaultLayout,
        showGridLines:    !!settings.showGridLines,
        showIndicators:   !!settings.showIndicators,
      },
      dashboard: {
        defaultModule:        settings.defaultModule,
        autoRefreshWatchlist: !!settings.autoRefreshWatchlist,
      },
      risk: {
        defaultStopLossPct:   Number(settings.defaultStopLoss)  || 2,
        defaultTakeProfitPct: Number(settings.defaultTakeProfit) || 5,
      },
      alerts: {
        priceAlerts: !!settings.priceAlerts,
      },
    };
    setIsSaving(true);
    try {
      await saveToServer(payload);
      setLastSaved(new Date());
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    navigate('/trader/dashboard');
  };

  const set = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };
  const toggle = (key) => set(key, !settings[key]);

  const timeframeOptions  = ['1m', '5m', '15m', '1h', '1D'];
  const layoutOptions     = [
    { value: '1-grid', label: '1 Chart' },
    { value: '2-grid', label: '2 Charts' },
    { value: '4-grid', label: '4 Charts' },
  ];
  const moduleOptions     = [
    { value: 'DASHBOARD',    label: 'Dashboard' },
    { value: 'MULTI-CHART',  label: 'Multi-Chart' },
    { value: 'WATCHLIST',    label: 'Watchlist' },
    { value: 'SCREENERS',    label: 'Screeners' },
  ];

  return (
    <div className="settings-page">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="settings-header"
      >
        <div className="settings-header-content">
          {!embedded && (
            <button onClick={handleBack} className="back-btn">
              <ArrowLeft size={20} /> Back to Dashboard
            </button>
          )}
          <div className="settings-title-section">
            <h1 className="settings-title">Settings</h1>
            <p className="settings-subtitle">Customize your trading dashboard experience</p>
          </div>
        </div>
      </motion.div>

      <div className="settings-container">
        <div className="settings-grid">

          {/* ── 1. Chart & Display ─────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="settings-card"
          >
            <div className="card-header">
              <Monitor size={24} />
              <div>
                <h2 className="card-title">1. Chart &amp; Display</h2>
                <p className="card-description">Controls the workspace charts directly.</p>
              </div>
            </div>

            <div className="card-content">
              {/* Default Timeframe */}
              <div className="setting-item">
                <label className="setting-label">Default Timeframe</label>
                <div className="button-group">
                  {timeframeOptions.map(tf => (
                    <button
                      key={tf}
                      className={`button-option ${settings.defaultTimeframe === tf ? 'active' : ''}`}
                      onClick={() => set('defaultTimeframe', tf)}
                    >{tf}</button>
                  ))}
                </div>
              </div>

              {/* Default Chart Layout */}
              <div className="setting-item">
                <label className="setting-label">Default Chart Layout</label>
                <div className="button-group">
                  {layoutOptions.map(l => (
                    <button
                      key={l.value}
                      className={`button-option ${settings.defaultLayout === l.value ? 'active' : ''}`}
                      onClick={() => set('defaultLayout', l.value)}
                    >{l.label}</button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="toggle-row">
                <div className="toggle-item">
                  <label>Show Grid Lines</label>
                  <button
                    type="button"
                    className={`toggle-switch ${settings.showGridLines ? 'active' : ''}`}
                    onClick={() => toggle('showGridLines')}
                  ><span className="toggle-circle" /></button>
                </div>
                <div className="toggle-item">
                  <label>Show MA Indicators</label>
                  <button
                    type="button"
                    className={`toggle-switch ${settings.showIndicators ? 'active' : ''}`}
                    onClick={() => toggle('showIndicators')}
                  ><span className="toggle-circle" /></button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── 2. Dashboard Preferences ───────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="settings-card"
          >
            <div className="card-header">
              <LayoutGrid size={24} />
              <div>
                <h2 className="card-title">2. Dashboard Preferences</h2>
                <p className="card-description">Controls what loads when you open the dashboard.</p>
              </div>
            </div>

            <div className="card-content">
              {/* Default Landing Module */}
              <div className="setting-item">
                <label htmlFor="defaultModule" className="setting-label">Default Landing Module</label>
                <select
                  id="defaultModule"
                  value={settings.defaultModule}
                  onChange={e => set('defaultModule', e.target.value)}
                  className="select-input"
                >
                  {moduleOptions.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Auto-refresh Watchlist */}
              <div className="toggle-item">
                <label>Auto-refresh Watchlist</label>
                <button
                  className={`toggle-switch ${settings.autoRefreshWatchlist ? 'active' : ''}`}
                  onClick={() => toggle('autoRefreshWatchlist')}
                ><span className="toggle-circle" /></button>
              </div>
            </div>
          </motion.div>

          {/* ── 3. Risk Defaults ───────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="settings-card"
          >
            <div className="card-header">
              <Shield size={24} />
              <div>
                <h2 className="card-title">3. Risk Defaults</h2>
                <p className="card-description">Pre-fills your Trade Decision Zone automatically.</p>
              </div>
            </div>

            <div className="card-content">
              <div className="number-input-group">
                <div className="number-input-item">
                  <label htmlFor="stopLoss" className="setting-label">Default Stop Loss (%)</label>
                  <div className="number-input-wrapper">
                    <input
                      id="stopLoss" type="number" step="0.1" min="0.1" max="20"
                      value={settings.defaultStopLoss}
                      onChange={e => set('defaultStopLoss', parseFloat(e.target.value))}
                      className="number-input"
                    />
                    <span className="input-suffix">%</span>
                  </div>
                </div>
                <div className="number-input-item">
                  <label htmlFor="takeProfit" className="setting-label">Default Take Profit (%)</label>
                  <div className="number-input-wrapper">
                    <input
                      id="takeProfit" type="number" step="0.1" min="0.1" max="50"
                      value={settings.defaultTakeProfit}
                      onChange={e => set('defaultTakeProfit', parseFloat(e.target.value))}
                      className="number-input"
                    />
                    <span className="input-suffix">%</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── 4. Alerts ──────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="settings-card"
          >
            <div className="card-header">
              <Bell size={24} />
              <div>
                <h2 className="card-title">4. Alerts</h2>
                <p className="card-description">Manage alert preferences (in-app delivery).</p>
              </div>
            </div>

            <div className="card-content">
              <div className="toggle-item">
                <label>Price Alerts</label>
                <button
                  className={`toggle-switch ${settings.priceAlerts ? 'active' : ''}`}
                  onClick={() => toggle('priceAlerts')}
                ><span className="toggle-circle" /></button>
              </div>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
                Triggers in-app notifications when a watchlist stock crosses a price threshold.
              </p>
            </div>
          </motion.div>

        </div>

        {/* Save Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="tip-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Info size={20} />
              <div>
                <p className="tip-text">Changes to Chart &amp; Display take effect immediately after saving.</p>
                <div className="save-status">
                  {isSaving ? (
                    <span className="saving-indicator"><span className="spinner" /> Saving…</span>
                  ) : lastSaved ? (
                    <span className="saved-indicator"><CheckCircle2 size={16} /> Saved at {lastSaved.toLocaleTimeString()}</span>
                  ) : isDirty ? (
                    <span className="waiting-indicator" style={{ color: '#f59e0b' }}>Unsaved changes</span>
                  ) : (
                    <span className="waiting-indicator">Ready</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className={`px-6 py-2 rounded-lg font-bold transition-all ${
                isDirty && !isSaving
                  ? 'bg-[#10706B] text-white hover:bg-[#0D5C58]'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              Save Settings
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsPage;
