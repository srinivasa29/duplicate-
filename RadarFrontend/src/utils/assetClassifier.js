export const getAssetMetadata = (symbol) => {
  if (!symbol) return {
    type: 'Equity',
    exchange: 'NSE',
    currency: 'INR',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
    icon: '🏢'
  };

  const upperSymbol = symbol.toUpperCase();

  // 1. Check Crypto (e.g., BTC, ETH-USD)
  const cryptoList = ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'SHIB', 'ADA', 'AVAX']; 
  if (cryptoList.includes(upperSymbol) || upperSymbol.endsWith('-USD')) {
    return {
      type: 'Crypto',
      exchange: 'Crypto 24/7',
      currency: 'USD',
      badgeColor: 'bg-orange-500/20 text-orange-400',
      icon: '₿'
    };
  }

  // 2. Check Forex (e.g., USDINR, EURUSD)
  if ((upperSymbol.length === 6 && upperSymbol.includes('USD')) || upperSymbol.includes('INR')) {
    // Exclude symbols that might be regular stocks that happen to have USD/INR but aren't strictly FX
    // For our specific use case, USDINR, EURUSD, GBPINR, etc.
    const fxPairs = ['USDINR', 'EURUSD', 'GBPUSD', 'EURINR', 'GBPINR', 'JPYINR'];
    if (fxPairs.includes(upperSymbol) || (upperSymbol.length === 6 && (upperSymbol.endsWith('INR') || upperSymbol.endsWith('USD')))) {
      return {
        type: 'Forex',
        exchange: 'FX',
        currency: upperSymbol.slice(3, 6), // Gets the quote currency
        badgeColor: 'bg-blue-500/20 text-blue-400',
        icon: '💱'
      };
    }
  }

  // 3. Check Indices (e.g., NIFTY, BANKNIFTY, SENSEX)
  const indexList = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCPNIFTY', 'INDIAVIX'];
  if (indexList.includes(upperSymbol)) {
    return {
      type: 'Index',
      exchange: 'NSE',
      currency: 'INR',
      badgeColor: 'bg-purple-500/20 text-purple-400',
      icon: '📊'
    };
  }

  // 4. Default to Equity/Stock
  return {
    type: 'Equity',
    exchange: 'NSE',
    currency: 'INR',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
    icon: '🏢'
  };
};
