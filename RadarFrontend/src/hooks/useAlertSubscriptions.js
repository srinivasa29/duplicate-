import { useEffect, useRef } from 'react';
import useAlertSettings from './useAlertSettings';
import AlertSubscriptionManager from '../utils/alertSubscriptionManager';

/**
 * Custom hook for managing alert subscriptions based on user settings
 * Automatically subscribes/unsubscribes from WebSocket channels
 * @param {Object} socket - Socket.io instance
 * @returns {Object} Alert manager instance
 */
export const useAlertSubscriptions = (socket) => {
  const { alertSettings } = useAlertSettings();
  const managerRef = useRef(null);

  // Initialize alert subscription manager
  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = new AlertSubscriptionManager(socket, alertSettings);
    } else {
      managerRef.current.setSocket(socket);
      managerRef.current.updateSettings(alertSettings);
    }
  }, [socket, alertSettings]);

  // Reconfigure subscriptions when alert settings change
  useEffect(() => {
    if (managerRef.current && alertSettings) {
      managerRef.current.updateSettings(alertSettings);
    }
  }, [alertSettings]);

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

export default useAlertSubscriptions;
