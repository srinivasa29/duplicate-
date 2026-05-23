import { useContext, useEffect, useState } from 'react';
import { SettingsContext } from '../context/SettingsContext';

/**
 * Hook to access and subscribe to alert settings
 * Used to determine which WebSocket channels to subscribe to
 * @returns {Object} Alert settings and utilities
 */
export const useAlertSettings = () => {
  const { settings, subscribe, saveSettings } = useContext(SettingsContext);
  const [alertSettings, setAlertSettings] = useState(null);

  useEffect(() => {
    if (settings?.alerts) {
      setAlertSettings(settings.alerts);
    }
  }, [settings?.alerts]);

  // Subscribe to changes
  useEffect(() => {
    const unsubscribe = subscribe((newSettings) => {
      if (newSettings?.alerts) {
        setAlertSettings(newSettings.alerts);
      }
    });
    return unsubscribe;
  }, [subscribe]);

  /**
   * Get list of active alert channels to subscribe to via WebSocket
   * @returns {Array} Array of channel names to subscribe
   */
  const getActiveChannels = () => {
    const channels = [];
    if (alertSettings?.priceAlerts) channels.push('price_alerts');
    if (alertSettings?.volumeSpikes) channels.push('volume_spikes');
    if (alertSettings?.technicalSignals) channels.push('technical_signals');
    return channels;
  };

  const updateAlertSettings = async (updates) => {
    try {
      await saveSettings({
        alerts: {
          ...alertSettings,
          ...updates,
        }
      });
    } catch (err) {
      console.error('Failed to update alert settings:', err);
      throw err;
    }
  };

  return {
    alertSettings,
    updateAlertSettings,
    priceAlerts: alertSettings?.priceAlerts ?? true,
    volumeSpikes: alertSettings?.volumeSpikes ?? true,
    technicalSignals: alertSettings?.technicalSignals ?? true,
    notificationMethod: alertSettings?.method ?? 'in-app',
    soundEnabled: alertSettings?.soundEnabled ?? true,
    getActiveChannels, // Subscribe to these WebSocket channels
  };
};

export default useAlertSettings;
