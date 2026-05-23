import React from 'react';
import ChartPane from './ChartPane';

const GRID_STYLES = {
  single:  'grid-cols-1 grid-rows-1',
  vsplit:  'grid-cols-2 grid-rows-1',
  hsplit:  'grid-cols-1 grid-rows-2',
  '2x2':   'grid-cols-2 grid-rows-2',
  '3grid': 'grid-cols-3 grid-rows-1',
  '4grid': 'grid-cols-2 grid-rows-2',
  '6grid': 'grid-cols-3 grid-rows-2',
  '8grid': 'grid-cols-4 grid-rows-2',
};

const ChartWorkspace = ({
  interval,
  historyRange,
  //timeframe,
  layout,
  panels,
  activePanelId,
  onSelectPanel,
  settings,
  crosshairSync,
  onCrosshairMove,
  rangeSync,
  onRangeChange,
  customFrom,
  customTo,
}) => {
  const gridClass = GRID_STYLES[layout] || GRID_STYLES.single;

  return (
    <div className={`grid ${gridClass} w-full h-full gap-1`}>
      {panels.map(panel => (
        <ChartPane
          key={panel.id}
          panel={panel}
          interval={panel.interval || interval}
          historyRange={panel.historyRange || historyRange}
          //timeframe={timeframe}
          isActive={panel.id === activePanelId}
          onSelect={() => onSelectPanel(panel.id)}
          settings={settings}
          crosshairSync={panel.id !== activePanelId && settings.syncCrosshair ? crosshairSync : null}
          onCrosshairMove={onCrosshairMove}
          rangeSync={panel.id !== activePanelId && settings.syncZoom ? rangeSync : null}
          onRangeChange={onRangeChange}
          customFrom={panel.customFrom || customFrom}
          customTo={panel.customTo || customTo}
        />
      ))}
    </div>
  );
};

export default ChartWorkspace;
