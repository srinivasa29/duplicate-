import { useContext, useEffect, useState } from 'react';
import { SettingsContext } from '../context/SettingsContext';

/**
 * Hook to access and subscribe to data refresh settings
 * Used to throttle WebSocket updates and manage API refresh rates
 * @returns {Object} Data refresh settings and utilities
 */
export const useDataRefreshSettings = () => {
  const { settings, subscribe, saveSettings } = useContext(SettingsContext);
  const [dataSettings, setDataSettings] = useState(null);

  useEffect(() => {
    if (settings?.data) {
      setDataSettings(settings.data);
    }
  }, [settings?.data]);

  // Subscribe to changes
  useEffect(() => {
    const unsubscribe = subscribe((newSettings) => {
      if (newSettings?.data) {
        setDataSettings(newSettings.data);
      }
    });
    return unsubscribe;
  }, [subscribe]);

  // Convert refresh rate strings to milliseconds
  const getRefreshRateMs = (rateString) => {
    if (!rateString) return 1000;
    const match = rateString.match(/(\d+)(s|m)/);
    if (!match) return 1000;
    const value = parseInt(match[1]);
    const unit = match[2];
    return unit === 'm' ? value * 60 * 1000 : value * 1000;
  };

  const updateDataSettings = async (updates) => {
    try {
      await saveSettings({
        data: {
          ...dataSettings,
          ...updates,
        }
      });
    } catch (err) {
      console.error('Failed to update data refresh settings:', err);
      throw err;
    }
  };

  return {
    dataSettings,
    updateDataSettings,
    realtimeRefreshRateMs: getRefreshRateMs(dataSettings?.realtimeRefreshRate),
    quoteUpdateFreqMs: getRefreshRateMs(dataSettings?.quoteUpdateFreq),
    autoRefreshWatchlist: dataSettings?.autoRefreshWatchlist ?? true,
    refreshIntervalMs: getRefreshRateMs(dataSettings?.refreshInterval),
    getRefreshRateMs, // Utility function for consumers
  };
};

export default useDataRefreshSettings;
