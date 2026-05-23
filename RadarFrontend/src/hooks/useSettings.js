import { useContext } from 'react';
import { SettingsContext } from '../context/SettingsContext';

/**
 * Hook to access all settings and methods
 * @returns {Object} Settings context value with all settings and save methods
 */
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

export default useSettings;
