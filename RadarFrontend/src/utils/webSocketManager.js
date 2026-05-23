/**
 * WebSocket subscription manager with throttling based on data refresh settings
 * Respects the user's data refresh preferences to manage API costs and performance
 */

class SettingsAwareWebSocketManager {
  constructor(settings = null) {
    this.settings = settings;
    this.subscriptions = new Map();
    this.throttleTimers = new Map();
    this.lastUpdateTimes = new Map();
  }

  /**
   * Update settings and reconfigure throttling
   */
  updateSettings(settings) {
    this.settings = settings;
    this.reconfigureAllSubscriptions();
  }

  /**
   * Get throttle delay in milliseconds from settings
   */
  getThrottleDelay(type = 'realtime') {
    if (!this.settings?.data) return 1000; // Default 1s

    switch (type) {
      case 'realtime':
        return this.parseTimeString(this.settings.data.realtimeRefreshRate);
      case 'quote':
        return this.parseTimeString(this.settings.data.quoteUpdateFreq);
      case 'interval':
        return this.parseTimeString(this.settings.data.refreshInterval);
      default:
        return 1000;
    }
  }

  /**
   * Parse time strings like "1s", "5s", "1m" to milliseconds
   */
  parseTimeString(timeStr) {
    if (!timeStr) return 1000;
    const match = String(timeStr).match(/(\d+)([sm])/);
    if (!match) return 1000;

    const value = parseInt(match[1]);
    const unit = match[2];
    return unit === 'm' ? value * 60 * 1000 : value * 1000;
  }

  /**
   * Subscribe to a data stream with automatic throttling
   * @param {string} channel - Channel name (e.g., 'ticker:AAPL', 'alerts')
   * @param {Function} callback - Callback to invoke with data
   * @param {string} throttleType - Type of throttle to apply ('realtime', 'quote', 'interval')
   * @returns {Function} Unsubscribe function
   */
  subscribe(channel, callback, throttleType = 'realtime') {
    const throttleDelay = this.getThrottleDelay(throttleType);

    const subscription = {
      channel,
      callback,
      throttleType,
      throttleDelay,
      lastCall: 0,
      isThrottled: false,
    };

    this.subscriptions.set(channel, subscription);
    this.lastUpdateTimes.set(channel, 0);

    // Return unsubscribe function
    return () => this.unsubscribe(channel);
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel) {
    this.subscriptions.delete(channel);
    this.lastUpdateTimes.delete(channel);

    if (this.throttleTimers.has(channel)) {
      clearTimeout(this.throttleTimers.get(channel));
      this.throttleTimers.delete(channel);
    }
  }

  /**
   * Throttled emit - respects user's refresh rate settings
   * @param {string} channel - Channel name
   * @param {*} data - Data to emit
   */
  emit(channel, data) {
    const subscription = this.subscriptions.get(channel);
    if (!subscription) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - (this.lastUpdateTimes.get(channel) || 0);
    const throttleDelay = subscription.throttleDelay;

    if (timeSinceLastUpdate >= throttleDelay) {
      // Enough time has passed - call immediately
      this.lastUpdateTimes.set(channel, now);
      try {
        subscription.callback(data);
      } catch (err) {
        console.error(`Error in callback for ${channel}:`, err);
      }
    } else {
      // Too soon - schedule for later
      if (this.throttleTimers.has(channel)) {
        clearTimeout(this.throttleTimers.get(channel));
      }

      const timer = setTimeout(() => {
        this.lastUpdateTimes.set(channel, Date.now());
        try {
          subscription.callback(data);
        } catch (err) {
          console.error(`Error in callback for ${channel}:`, err);
        }
        this.throttleTimers.delete(channel);
      }, throttleDelay - timeSinceLastUpdate);

      this.throttleTimers.set(channel, timer);
    }
  }

  /**
   * Get current throttle delay for a channel
   */
  getChannelThrottleDelay(channel) {
    const subscription = this.subscriptions.get(channel);
    return subscription?.throttleDelay || this.getThrottleDelay('realtime');
  }

  /**
   * Reconfigure all subscriptions based on updated settings
   */
  reconfigureAllSubscriptions() {
    for (const [channel, subscription] of this.subscriptions) {
      subscription.throttleDelay = this.getThrottleDelay(subscription.throttleType);
    }
  }

  /**
   * Get subscription channels based on alert settings
   * @param {Object} alertSettings - Settings from useAlertSettings hook
   * @returns {Array} List of channels to subscribe to
   */
  getActiveAlertChannels(alertSettings) {
    const channels = [];
    if (alertSettings?.priceAlerts) channels.push('alerts:price');
    if (alertSettings?.volumeSpikes) channels.push('alerts:volume');
    if (alertSettings?.technicalSignals) channels.push('alerts:technical');
    return channels;
  }

  /**
   * Determine if watchlist auto-refresh should be enabled
   * @returns {boolean}
   */
  shouldAutoRefreshWatchlist() {
    return this.settings?.data?.autoRefreshWatchlist !== false;
  }

  /**
   * Get watchlist refresh interval
   * @returns {number} Milliseconds
   */
  getWatchlistRefreshInterval() {
    return this.getThrottleDelay('interval');
  }

  /**
   * Clear all subscriptions and timers
   */
  destroy() {
    for (const timer of this.throttleTimers.values()) {
      clearTimeout(timer);
    }
    this.subscriptions.clear();
    this.lastUpdateTimes.clear();
    this.throttleTimers.clear();
  }
}

export default SettingsAwareWebSocketManager;
