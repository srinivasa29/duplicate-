// src/config/marketUniverse.js

export const INDICES = {
  SENSEX_30: [
    "ADANIPORTS", "ASIANPAINT", "AXISBANK", "BAJFINANCE", "BAJAJFINSV", 
    "BHARTIARTL", "HCLTECH", "HDFCBANK", "HINDUNILVR", "ICICIBANK", 
    "INDUSINDBK", "INFY", "ITC", "JSWSTEEL", "KOTAKBANK", 
    "LT", "M&M", "MARUTI", "NESTLEIND", "NTPC", 
    "POWERGRID", "RELIANCE", "SBIN", "SUNPHARMA", "TCS", 
    "TATAMOTORS", "TATASTEEL", "TECHM", "TITAN", "ULTRACEMCO"
  ],
  
  NIFTY_50: [
    "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK", 
    "BAJAJ-AUTO", "BAJFINANCE", "BAJAJFINSV", "BEL", "BPCL", 
    "BHARTIARTL", "BRITANNIA", "CIPLA", "COALINDIA", "DIVISLAB", 
    "DRREDDY", "EICHERMOT", "GRASIM", "HCLTECH", "HDFCBANK", 
    "HDFCLIFE", "HINDALCO", "HINDUNILVR", "ICICIBANK", "INDUSINDBK", 
    "INFY", "ITC", "JSWSTEEL", "KOTAKBANK", "LT", 
    "LTIM", "M&M", "MARUTI", "NESTLEIND", "NTPC", 
    "ONGC", "POWERGRID", "RELIANCE", "SBILIFE", "SHRIRAMFIN", 
    "SBIN", "SUNPHARMA", "TCS", "TATACONSUM", "TATAMOTORS", 
    "TATASTEEL", "TECHM", "TITAN", "TRENT", "ULTRACEMCO"
  ]
};

// Helper function to get a deduplicated list of all your supported stocks
export const getUniqueUniverse = () => {
  const combined = [...INDICES.SENSEX_30, ...INDICES.NIFTY_50];
  return [...new Set(combined)]; // Removes duplicates
};

// Helper to check if a user is searching for a valid stock
export const isValidSymbol = (symbol) => {
  if (!symbol) return false;
  const universe = getUniqueUniverse();
  return universe.includes(String(symbol).toUpperCase());
};

export default {
  INDICES,
  getUniqueUniverse,
  isValidSymbol,
};
