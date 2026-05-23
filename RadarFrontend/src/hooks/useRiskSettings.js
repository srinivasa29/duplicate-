import { useContext, useEffect, useState } from 'react';
import { SettingsContext } from '../context/SettingsContext';

/**
 * Hook to access and subscribe to risk management settings
 * Used by order placement logic to auto-populate stop loss and take profit
 * @returns {Object} Risk settings and update function
 */
export const useRiskSettings = () => {
  const { settings, subscribe, saveSettings } = useContext(SettingsContext);
  const [riskSettings, setRiskSettings] = useState(null);

  useEffect(() => {
    if (settings?.risk) {
      setRiskSettings(settings.risk);
    }
  }, [settings?.risk]);

  // Subscribe to changes
  useEffect(() => {
    const unsubscribe = subscribe((newSettings) => {
      if (newSettings?.risk) {
        setRiskSettings(newSettings.risk);
      }
    });
    return unsubscribe;
  }, [subscribe]);

  const updateRiskSettings = async (updates) => {
    try {
      await saveSettings({
        risk: {
          ...riskSettings,
          ...updates,
        }
      });
    } catch (err) {
      console.error('Failed to update risk settings:', err);
      throw err;
    }
  };

  return {
    riskSettings,
    updateRiskSettings,
    stopLossPct: riskSettings?.defaultStopLossPct ?? 2,
    takeProfitPct: riskSettings?.defaultTakeProfitPct ?? 5,
    positionSizeLimitPct: riskSettings?.positionSizeLimitPct ?? 10,
    maxDrawdownTolerancePct: riskSettings?.maxDrawdownTolerancePct ?? 15,
  };
};

export default useRiskSettings;
