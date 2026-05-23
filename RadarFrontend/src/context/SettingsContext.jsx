import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../api/api';

export const SettingsContext = createContext({
  settings: null,
  setSettings: () => {},
  reloadSettings: () => Promise.resolve(),
  saveSettings: () => Promise.resolve(),
  loading: false,
  error: null,
  subscribe: () => () => {},
});

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subscribers, setSubscribers] = useState([]);

  const load = useCallback(async () => {
    // Only fetch if there's a token — avoids 401s on public pages
    const token = typeof window !== 'undefined' && localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/user/settings');
      const data = res.data?.data || res.data;
      setSettings(data);
      // Notify subscribers of new settings
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('Error in settings subscriber:', err);
        }
      });
    } catch (err) {
      console.error('Failed to load settings:', err);
      // Don't set error state — silently fall back so the app still renders
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [subscribers]);

  const saveSettings = useCallback(async (partial) => {
    const token = typeof window !== 'undefined' && localStorage.getItem('token');
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.patch('/user/settings', partial);
      const data = res.data?.data || res.data;
      setSettings(data);
      // Notify subscribers of updated settings
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('Error in settings subscriber:', err);
        }
      });
      return data;
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [subscribers]);

  const subscribe = useCallback((callback) => {
    setSubscribers(prev => [...prev, callback]);
    // Return unsubscribe function
    return () => {
      setSubscribers(prev => prev.filter(cb => cb !== callback));
    };
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = {
    settings,
    setSettings,
    reloadSettings: load,
    saveSettings,
    loading,
    error,
    subscribe,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export default SettingsProvider;
