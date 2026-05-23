import { useContext, useEffect, useState } from 'react';
import { SettingsContext } from '../context/SettingsContext';

/**
 * Hook to access and subscribe to display settings
 * Used by charting libraries and UI components for theme/display preferences
 * @returns {Object} Display settings
 */
export const useDisplaySettings = () => {
  const { settings, subscribe, saveSettings } = useContext(SettingsContext);
  const [displaySettings, setDisplaySettings] = useState(null);

  useEffect(() => {
    if (settings?.display) {
      setDisplaySettings(settings.display);
    }
  }, [settings?.display]);

  // Subscribe to changes
  useEffect(() => {
    const unsubscribe = subscribe((newSettings) => {
      if (newSettings?.display) {
        setDisplaySettings(newSettings.display);
        // Apply theme changes immediately
        applyTheme(newSettings.display.theme);
      }
    });
    return unsubscribe;
  }, [subscribe]);

  const applyTheme = (theme) => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
    } else {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
    }
  };

  const updateDisplaySettings = async (updates) => {
    try {
      await saveSettings({
        display: {
          ...displaySettings,
          ...updates,
        }
      });
    } catch (err) {
      console.error('Failed to update display settings:', err);
      throw err;
    }
  };

  return {
    displaySettings,
    updateDisplaySettings,
    chartType: displaySettings?.chartType ?? 'candlestick',
    defaultTimeframe: displaySettings?.defaultTimeframe ?? '5m',
    theme: displaySettings?.theme ?? 'dark',
    showGridLines: displaySettings?.showGridLines ?? true,
    showCrosshair: displaySettings?.showCrosshair ?? true,
    applyTheme,
  };
};

export default useDisplaySettings;
