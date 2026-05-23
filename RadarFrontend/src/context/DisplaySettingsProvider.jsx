import React, { useEffect, useCallback } from 'react';
import useDisplaySettings from '../hooks/useDisplaySettings';

/**
 * Theme and Display Settings Provider
 * Applies display settings globally across the app
 */
export const DisplaySettingsProvider = ({ children }) => {
  const { theme, showGridLines, showCrosshair, chartType } = useDisplaySettings();

  // Apply theme to DOM
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (theme === 'dark') {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
      body.classList.add('dark-mode');
      body.classList.remove('light-mode');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
      body.classList.add('light-mode');
      body.classList.remove('dark-mode');
      root.style.colorScheme = 'light';
    }
  }, [theme]);

  // Create CSS variables for chart settings
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--chart-grid-lines', showGridLines ? '1' : '0');
    root.style.setProperty('--chart-crosshair', showCrosshair ? '1' : '0');
    root.style.setProperty('--chart-type', `"${chartType}"`);
  }, [showGridLines, showCrosshair, chartType]);

  return <>{children}</>;
};

/**
 * Hook to access display settings in components
 * Returns settings as CSS variables accessible via var() in stylesheets
 */
export const useChartDisplaySettings = () => {
  const { theme, showGridLines, showCrosshair, chartType } = useDisplaySettings();

  return {
    theme,
    showGridLines,
    showCrosshair,
    chartType,
    cssVariables: {
      '--theme': theme,
      '--chart-grid-lines': showGridLines ? '1' : '0',
      '--chart-crosshair': showCrosshair ? '1' : '0',
      '--chart-type': chartType,
    },
  };
};

export default DisplaySettingsProvider;
