

const axios = require('axios');
const logger = require('../utils/logger');

class FinnhubService {
  constructor() {
    this.baseUrl = 'https://finnhub.io/api/v1';
    this.apiKey = process.env.FINNHUB_API_KEY || 'demo'; // Use demo key if not set
    this.requestCount = 0;
    this.requestWindow = 60000; // 1 minute
    this.maxRequestsPerWindow = 60;
    this.requestTimestamps = [];
  }

  
  canMakeRequest() {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.requestWindow
    );

    return this.requestTimestamps.length < this.maxRequestsPerWindow;
  }

  
  recordRequest() {
    this.requestTimestamps.push(Date.now());
    this.requestCount++;
  }

  
  async getQuote(symbol) {
    try {
      if (!this.canMakeRequest()) {
        logger.warn('Finnhub rate limit reached, skipping request');
        return {
          success: false,
          message: 'Rate limit exceeded',
          source: 'finnhub',
        };
      }

      const finnhubSymbol = this.convertToFinnhubSymbol(symbol);

      const response = await axios.get(`${this.baseUrl}/quote`, {
        params: {
          symbol: finnhubSymbol,
          token: this.apiKey,
        },
        timeout: 5000,
      });

      this.recordRequest();

      const data = response.data;

      if (!data || data.c === 0) {
        return {
          success: false,
          message: 'No data available for symbol',
          source: 'finnhub',
        };
      }

      return {
        success: true,
        source: 'finnhub',
        data: {
          symbol: symbol,
          current: data.c,  // Current price
          high: data.h,     // High price of the day
          low: data.l,      // Low price of the day
          open: data.o,     // Open price of the day
          previousClose: data.pc, // Previous close
          change: data.d,   // Change
          changePercent: data.dp, // Percent change
          timestamp: new Date(data.t * 1000), // Convert Unix to Date
          volume: null, // Not provided in quote endpoint
        },
      };
    } catch (error) {
      logger.error(`Finnhub API error for ${symbol}: ${error.message}`);
      return {
        success: false,
        message: error.message,
        source: 'finnhub',
      };
    }
  }

  
  async getCompanyProfile(symbol) {
    try {
      if (!this.canMakeRequest()) {
        return {
          success: false,
          message: 'Rate limit exceeded',
        };
      }

      const finnhubSymbol = this.convertToFinnhubSymbol(symbol);

      const response = await axios.get(`${this.baseUrl}/stock/profile2`, {
        params: {
          symbol: finnhubSymbol,
          token: this.apiKey,
        },
        timeout: 5000,
      });

      this.recordRequest();

      return {
        success: true,
        source: 'finnhub',
        data: response.data,
      };
    } catch (error) {
      logger.error(`Finnhub company profile error: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  
  convertToFinnhubSymbol(symbol) {
    return symbol;
  }

  
  getRateLimitStatus() {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.requestWindow
    );

    return {
      service: 'finnhub',
      requestsInWindow: this.requestTimestamps.length,
      maxRequests: this.maxRequestsPerWindow,
      remainingRequests: this.maxRequestsPerWindow - this.requestTimestamps.length,
      totalRequests: this.requestCount,
      windowMs: this.requestWindow,
    };
  }

  
  async testConnection() {
    try {
      // Use first active symbol from DB for connectivity test; fall back to AAPL
      let testSymbol = 'AAPL';
      try {
        const { getActiveSymbols } = require('../utils/symbolRegistry');
        const syms = await getActiveSymbols({ exchanges: ['NASDAQ', 'NYSE', 'NSE', 'BSE'] });
        if (syms.length > 0) testSymbol = syms[0];
      } catch (_) { /* keep default */ }

      const result = await this.getQuote(testSymbol);
      return result.success;
    } catch (error) {
      logger.error(`Finnhub connection test failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = new FinnhubService();
