/**
 * Alert subscription manager
 * Manages WebSocket subscriptions and notifications based on user alert preferences
 */

class AlertSubscriptionManager {
  constructor(socket = null, alertSettings = null) {
    this.socket = socket;
    this.alertSettings = alertSettings;
    this.activeChannels = new Set();
    this.handlers = new Map();
    this.notificationQueue = [];
    this.soundEnabled = alertSettings?.soundEnabled ?? true;
    this.notificationMethod = alertSettings?.method ?? 'in-app';
  }

  /**
   * Update alert settings and reconfigure subscriptions
   */
  updateSettings(alertSettings) {
    this.alertSettings = alertSettings;
    this.soundEnabled = alertSettings?.soundEnabled ?? true;
    this.notificationMethod = alertSettings?.method ?? 'in-app';
    this.reconfigureSubscriptions();
  }

  /**
   * Update socket instance
   */
  setSocket(socket) {
    if (this.socket) {
      this.detachAllHandlers();
    }
    this.socket = socket;
    if (socket) {
      this.attachHandlers();
    }
  }

  /**
   * Get active channels based on alert settings
   * @returns {Array} List of channel names to subscribe
   */
  getActiveChannels() {
    const channels = [];
    if (this.alertSettings?.priceAlerts) channels.push('price_alerts');
    if (this.alertSettings?.volumeSpikes) channels.push('volume_spikes');
    if (this.alertSettings?.technicalSignals) channels.push('technical_signals');
    return channels;
  }

  /**
   * Reconfigure WebSocket subscriptions based on settings
   */
  reconfigureSubscriptions() {
    if (!this.socket) return;

    // Unsubscribe from inactive channels
    for (const channel of this.activeChannels) {
      if (!this.getActiveChannels().includes(channel)) {
        this.socket.emit('unsubscribe', { channel });
        this.activeChannels.delete(channel);
      }
    }

    // Subscribe to active channels
    for (const channel of this.getActiveChannels()) {
      if (!this.activeChannels.has(channel)) {
        this.socket.emit('subscribe', { channel });
        this.activeChannels.add(channel);
      }
    }
  }

  /**
   * Attach event handlers to socket
   */
  attachHandlers() {
    if (!this.socket) return;

    this.socket.on('price_alert', (data) => this.handleAlert('price', data));
    this.socket.on('volume_spike', (data) => this.handleAlert('volume', data));
    this.socket.on('technical_signal', (data) =>
      this.handleAlert('technical', data)
    );
  }

  /**
   * Detach all event handlers from socket
   */
  detachAllHandlers() {
    if (!this.socket) return;
    this.socket.off('price_alert');
    this.socket.off('volume_spike');
    this.socket.off('technical_signal');
  }

  /**
   * Handle incoming alert
   */
  handleAlert(type, data) {
    // Check if this alert type is enabled
    const isEnabled =
      (type === 'price' && this.alertSettings?.priceAlerts) ||
      (type === 'volume' && this.alertSettings?.volumeSpikes) ||
      (type === 'technical' && this.alertSettings?.technicalSignals);

    if (!isEnabled) return;

    // Play sound if enabled
    if (this.soundEnabled) {
      this.playAlertSound();
    }

    // Handle notification based on method
    this.handleNotification(type, data);

    // Invoke registered handlers
    const handler = this.handlers.get(type);
    if (handler) {
      try {
        handler(data);
      } catch (err) {
        console.error(`Error in alert handler for ${type}:`, err);
      }
    }
  }

  /**
   * Handle notification delivery based on method setting
   */
  handleNotification(type, data) {
    const notification = {
      type,
      data,
      timestamp: new Date(),
      method: this.notificationMethod,
    };

    if (this.notificationMethod === 'in-app' || this.notificationMethod === 'both') {
      this.showInAppNotification(notification);
    }

    if (this.notificationMethod === 'email' || this.notificationMethod === 'both') {
      this.queueEmailNotification(notification);
    }
  }

  /**
   * Show in-app toast notification
   */
  showInAppNotification(notification) {
    // This will be implemented by the app consuming this manager
    // Usually through a toast/snackbar library
    console.log('[IN-APP ALERT]', notification);
    // Dispatch event that UI can listen to
    window.dispatchEvent(
      new CustomEvent('alert:notification', { detail: notification })
    );
  }

  /**
   * Queue email notification (to be sent to backend)
   */
  queueEmailNotification(notification) {
    this.notificationQueue.push(notification);
    // Send in batch periodically or immediately
    this.flushEmailNotifications();
  }

  /**
   * Send queued email notifications to backend
   */
  async flushEmailNotifications() {
    if (this.notificationQueue.length === 0) return;

    const notifications = [...this.notificationQueue];
    this.notificationQueue = [];

    try {
      // This would typically call an API endpoint
      // await api.post('/notifications/send-batch', { notifications });
      console.log('[EMAIL NOTIFICATIONS QUEUED]', notifications);
    } catch (err) {
      console.error('Failed to send email notifications:', err);
      // Re-queue for retry
      this.notificationQueue.push(...notifications);
    }
  }

  /**
   * Play alert sound
   */
  playAlertSound() {
    try {
      // Use Web Audio API or HTML5 audio element
      const audioContext =
        window.AudioContext || window.webkitAudioContext;
      if (audioContext) {
        const ctx = new audioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = 1000; // 1kHz
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
      }
    } catch (err) {
      console.error('Failed to play alert sound:', err);
    }
  }

  /**
   * Register a handler for a specific alert type
   */
  onAlert(type, handler) {
    this.handlers.set(type, handler);
    // Return unregister function
    return () => {
      this.handlers.delete(type);
    };
  }

  /**
   * Check if a specific alert type is enabled
   */
  isAlertTypeEnabled(type) {
    switch (type) {
      case 'price':
        return this.alertSettings?.priceAlerts ?? true;
      case 'volume':
        return this.alertSettings?.volumeSpikes ?? true;
      case 'technical':
        return this.alertSettings?.technicalSignals ?? true;
      default:
        return false;
    }
  }

  /**
   * Get alert settings summary
   */
  getSummary() {
    return {
      priceAlerts: this.alertSettings?.priceAlerts ?? true,
      volumeSpikes: this.alertSettings?.volumeSpikes ?? true,
      technicalSignals: this.alertSettings?.technicalSignals ?? true,
      soundEnabled: this.soundEnabled,
      notificationMethod: this.notificationMethod,
      activeChannels: Array.from(this.activeChannels),
      pendingNotifications: this.notificationQueue.length,
    };
  }

  /**
   * Cleanup and destroy manager
   */
  destroy() {
    this.detachAllHandlers();
    this.notificationQueue = [];
    this.handlers.clear();
    this.activeChannels.clear();
  }
}

export default AlertSubscriptionManager;
