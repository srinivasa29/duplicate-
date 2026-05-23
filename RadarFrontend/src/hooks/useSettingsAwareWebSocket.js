import { useEffect, useRef } from 'react';
import useDataRefreshSettings from './useDataRefreshSettings';
import SettingsAwareWebSocketManager from '../utils/webSocketManager';

/**
 * Custom hook for settings-aware WebSocket management
 * Automatically respects data refresh rate settings
 * @returns {Object} WebSocket manager instance
 */
export const useSettingsAwareWebSocket = () => {
  const { dataSettings } = useDataRefreshSettings();
  const managerRef = useRef(null);

  // Initialize or update manager based on settings
  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = new SettingsAwareWebSocketManager(dataSettings);
    } else {
      managerRef.current.updateSettings(dataSettings);
    }
  }, [dataSettings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.destroy();
      }
    };
  }, []);

  return managerRef.current;
};

export default useSettingsAwareWebSocket;
