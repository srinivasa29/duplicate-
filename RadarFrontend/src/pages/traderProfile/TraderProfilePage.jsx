import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BrainCircuit, ShieldAlert, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHeaderData } from '../../hooks/useHeaderData';
import ProfileHeader from './components/ProfileHeader';
import MetricsCard from './components/MetricsCard';
import RiskBar from './components/RiskBar';
import TimelineItem from './components/TimelineItem';
import InsightCard from './components/InsightCard';
import { fetchWatchlistLiveData } from '../../api/watchlistApi';
import './TraderProfilePage.css';

import api from '../../api/api';

const TWELVE_DATA_API_BASE = 'https://api.twelvedata.com/price';

const TraderProfilePage = ({ embedded = false } = {}) => {
  const navigate = useNavigate();
  const { profile } = useHeaderData();
  const [quotes, setQuotes] = useState([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const sessionScores = useMemo(() => {
    const sp = summary?.sessionPerformance || {};
    return [
      { key: 'Opening', value: sp.opening || 0 },
      { key: 'Mid-day', value: sp.midDay || 0 },
      { key: 'Closing', value: sp.closing || 0 },
    ];
  }, [summary]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, activityRes, strengthsRes] = await Promise.all([
        api.get('/trader/metrics'),
        api.get('/trader/activity'),
        api.get('/trader/strengths'),
      ]);

      const metrics = metricsRes.data?.data || metricsRes.data || {};
      const activity = activityRes.data?.data?.activity || activityRes.data || [];
      const strengths = strengthsRes.data?.data || strengthsRes.data || {};

      setSummary({
        metrics: metrics.metrics || {},
        risk: metrics.risk || {},
        sessionPerformance: metrics.sessionPerformance || {},
        totals: metrics.totals || {},
        activityTimeline: activity,
        strengths: strengths.strengths || [],
        weaknesses: strengths.weaknesses || [],
        personality: summary?.personality || {},
      });
    } catch (e) {
      setSummary(null);
      setError(e?.response?.data?.message || e.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }

    setQuotesLoading(true);
    try {
      const data = await fetchWatchlistLiveData('trader');
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.slice(0, 6).map((r) => ({ symbol: r.symbol, price: Number(r.price) || null }));
        setQuotes(mapped.filter((q) => q.symbol));
      }
    } catch (_err) {
      setQuotes([]);
    } finally {
      setQuotesLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <main className="trader-profile-page">
      <div className="trader-profile-shell">
        {loading && (
          <div className="profile-loading" style={{padding: 24}}>
            <strong>Loading profile…</strong>
          </div>
        )}
        {!loading && error && (
          <div className="profile-error" style={{padding: 24}}>
            <div style={{marginBottom: 8}}><strong>Error:</strong> {error}</div>
            <button onClick={() => fetchData()}>Retry</button>
          </div>
        )}
        {(!loading && !error) && (
        <>
        <ProfileHeader
          name={profile?.username || summary?.profile?.name || 'Trader'}
          email={profile?.email || summary?.profile?.email || ''}
          status={summary?.profile?.status || 'Active'}
        />

        <section className="profile-grid top-grid">
          <InsightCard title="Trader Personality" className="personality-card">
            <div className="personality-pills">
              <span className="profile-pill">Trading Style: {summary?.personality?.tradingStyle || '—'}</span>
              <span className="profile-pill">Risk Type: {summary?.personality?.riskType || '—'}</span>
            </div>
            <p className="profile-description">{summary?.personality?.description || ''}</p>
            <p className="profile-pattern">Best Pattern: {summary?.personality?.bestPattern || '—'}</p>
          </InsightCard>

          <InsightCard title="Research Metrics" className="metrics-wrap">
            <div className="metrics-grid">
              <MetricsCard label="Total Signals" value={summary?.metrics?.totalSignals || 0} hint="Signals generated" />
              <MetricsCard label="Accuracy" value={summary?.metrics?.accuracy || 0} suffix="%" hint="Winning setup quality" />
              <MetricsCard label="Consistency" value={summary?.metrics?.consistency || 0} suffix="%" hint="Stable performance" />
              <MetricsCard label="Screens Analyzed" value={summary?.metrics?.screensAnalyzed || 0} hint="Universe coverage" />
            </div>
          </InsightCard>
        </section>

        <section className="profile-grid middle-grid">
          <InsightCard title="Risk Behavior" className="risk-card">
            <RiskBar value={summary?.risk?.score || 0} label={summary?.risk?.label || '—'} />
            <p className="risk-insight">
              <ShieldAlert size={16} />
              {summary?.risk?.insight || ''}
            </p>
          </InsightCard>

          <InsightCard title="Session Performance" className="session-card">
            <div className="session-list">
              {sessionScores.map((session) => (
                <div key={session.key} className="session-row">
                  <span>{session.key}</span>
                  <span>{session.value}%</span>
                </div>
              ))}
            </div>
            <p className="best-session">
              <TrendingUp size={16} />
              Best Session: {summary?.sessionPerformance?.bestSession || '—'}
            </p>
          </InsightCard>
        </section>

        <section className="profile-grid lower-grid">
          <InsightCard title="Strengths" className="list-card">
            <ul className="bullet-list positive">
              {(summary?.strengths || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </InsightCard>

          <InsightCard title="Weaknesses" className="list-card">
            <ul className="bullet-list warning">
              {(summary?.weaknesses || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </InsightCard>

        </section>

        <section className="profile-grid bottom-grid">
          <InsightCard title="Activity Timeline" className="timeline-card">
              <ul className="timeline-list">
              {(summary?.activityTimeline || []).map((entry) => (
                <TimelineItem key={`${entry.symbol}-${entry.time}`} {...entry} />
              ))}
              </ul>
          </InsightCard>

          <InsightCard title="Live Watchlist Snapshot" className="quotes-card">
            <p className="quotes-note">
              <Activity size={16} />
              {quotesLoading ? 'Loading watchlist snapshot...' : 'Live watchlist snapshot from backend.'}
            </p>
            <div className="quote-list">
              {!quotesLoading && quotes.length === 0 && (
                <div className="empty-state text-sm text-slate-400 py-4 text-center">
                  Your watchlist is empty. Add symbols to see them here.
                </div>
              )}
              {quotes.map((quote) => (
                <div className="quote-row" key={quote.symbol}>
                  <span>{quote.symbol}</span>
                  <strong>{quote.price != null ? `₹${Number(quote.price).toFixed(2)}` : '—'}</strong>
                </div>
              ))}
            </div>
          </InsightCard>
        </section>

        <footer className="profile-footer-note">
          <BrainCircuit size={16} />
          Profile insights powered by backend analytics and live watchlist data.
        </footer>
        </>
        )}
      </div>
    </main>
  );
};

export default TraderProfilePage;
