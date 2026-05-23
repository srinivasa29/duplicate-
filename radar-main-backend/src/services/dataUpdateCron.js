

const cron = require('node-cron');
const incrementalUpdateService = require('./incrementalUpdateService');
const marketHoursService = require('./marketHoursService');
const { invalidateSectorCache } = require('./sectorService');
const logger = require('../utils/logger');

class DataUpdateCron {
  constructor() {
    this.cronJob = null;
    this.isInitialized = false;
    this.cronExpression = '*/5 * * * *'; // Every 5 minutes
  }

  
  start() {
    if (this.isInitialized) {
      logger.warn('Data update cron already initialized');
      return;
    }

    logger.info('Initializing data update cron job...');

    this.cronJob = cron.schedule(this.cronExpression, async () => {
      await this.runUpdate();
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata',
    });

    this.isInitialized = true;
    logger.info('Data update cron job started', {
      schedule: this.cronExpression,
      timezone: 'Asia/Kolkata',
    });

    setTimeout(() => {
      this.runInitialUpdate();
    }, 5000); // Wait 5 seconds after server start
  }

  
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isInitialized = false;
      logger.info('Data update cron job stopped');
    }
  }

  
  async runUpdate() {
    try {
      const marketStatus = marketHoursService.getMarketStatus();
      
      logger.info('Cron: Checking if update is needed', {
        isMarketOpen: marketStatus.isOpen,
        isPostMarket: marketHoursService.isPostMarket(),
        currentTime: marketStatus.currentTime,
      });

      if (!marketHoursService.isPostMarket()) {
        logger.info('Cron: Active market hours - skipping heavy backfill, but running recent changes engine');
        const { evaluateRecentChanges } = require('./recentChangesEngine');
        await evaluateRecentChanges([], true).catch(err => logger.error('Cron: recent changes error:', err));
        return;
      }

      if (!incrementalUpdateService.isUpdateNeeded(5)) {
        logger.info('Cron: Recent update exists - skipping');
        return;
      }

      logger.info('Cron: Starting incremental update...');
      const result = await incrementalUpdateService.updateAllSymbols();

      if (result.success && !result.skipped) {
        logger.info('Cron: Update completed successfully', {
          symbolsProcessed: result.symbolsProcessed,
          newCandles: result.newCandles,
          time: `${Math.round(result.totalTime / 1000)}s`,
        });
        // Invalidate sector cache so next request reflects fresh backfilled data
        invalidateSectorCache();
        logger.info('Cron: Sector performance cache invalidated');
        const { evaluateRecentChanges } = require('./recentChangesEngine');
        await evaluateRecentChanges([], true).catch(err => logger.error('Cron: recent changes error:', err));
      } else if (result.skipped) {
        logger.info('Cron: Update skipped', { reason: result.message });
      } else {
        logger.error('Cron: Update failed', { error: result.message });
      }
    } catch (error) {
      logger.error('Cron: Error during scheduled update:', error);
    }
  }

  
  async runInitialUpdate() {
    try {
      const marketStatus = marketHoursService.getMarketStatus();
      
      logger.info('Running initial data check on startup', {
        isMarketOpen: marketStatus.isOpen,
        isPostMarket: marketHoursService.isPostMarket(),
      });

      if (marketHoursService.isPostMarket()) {
        logger.info('Nighttime detected - running initial backfill update...');
        const result = await incrementalUpdateService.updateAllSymbols();
        
        if (result.success && !result.skipped) {
          logger.info('Initial update completed', {
            newCandles: result.newCandles,
            symbolsProcessed: result.symbolsProcessed,
          });
          // Invalidate sector cache after initial backfill
          invalidateSectorCache();
        }
      } else {
        logger.info('Active market hours - skipping initial heavy backfill', {
          nextClose: marketStatus.nextClose,
        });
      }
    } catch (error) {
      logger.error('Error during initial update:', error);
    }
  }

  
  getStatus() {
    return {
      isRunning: this.isInitialized && this.cronJob !== null,
      schedule: this.cronExpression,
      timezone: 'Asia/Kolkata',
      updateStats: incrementalUpdateService.getStats(),
      marketStatus: marketHoursService.getMarketStatus(),
    };
  }

  
  async triggerManualUpdate(options = {}) {
    logger.info('Manual update triggered');
    return await incrementalUpdateService.forceUpdate(options);
  }
}

module.exports = new DataUpdateCron();
