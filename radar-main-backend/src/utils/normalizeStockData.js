const normalizeStockData = (quote, summary) => ({
  symbol: quote.symbol,

  companyName:
    quote.longName ||
    quote.shortName ||
    quote.symbol,

  currentPrice:
    quote.regularMarketPrice || 0,

  open:
    quote.regularMarketOpen || 0,

  high:
    quote.regularMarketDayHigh || 0,

  low:
    quote.regularMarketDayLow || 0,

  prevClose:
    quote.regularMarketPreviousClose || 0,

  volume:
    quote.regularMarketVolume || 0,

  marketCap:
    quote.marketCap || 0,

  peRatio:
    summary?.defaultKeyStatistics?.forwardPE || 0,

  roe:
    summary?.financialData?.returnOnEquity || 0,

  debtToEquity:
    summary?.financialData?.debtToEquity || 0,

  revenueGrowth:
    summary?.financialData?.revenueGrowth || 0,

  profitMargin:
    summary?.defaultKeyStatistics?.profitMargins || 0,

  fiftyTwoWeekHigh:
    quote.fiftyTwoWeekHigh || 0,

  fiftyTwoWeekLow:
    quote.fiftyTwoWeekLow || 0,

  sector:
    summary?.assetProfile?.sector || '-',

  industry:
    summary?.assetProfile?.industry || '-',

  description:
    summary?.assetProfile?.longBusinessSummary ||
    `${quote.symbol} is listed on the exchange.`,
});

module.exports = normalizeStockData;