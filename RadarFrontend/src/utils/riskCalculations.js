/**
 * Utility functions for calculating bracket orders based on risk settings
 * Ensures consistent risk management across the trading platform
 */

/**
 * Calculate stop loss and take profit prices based on entry price and risk percentages
 * @param {number} entryPrice - The entry price
 * @param {number} stopLossPct - Stop loss percentage (e.g., 2 for 2%)
 * @param {number} takeProfitPct - Take profit percentage (e.g., 5 for 5%)
 * @param {boolean} isShort - True for short positions, false for long
 * @returns {Object} { stopLoss, takeProfit } prices
 */
export const calculateBracketPrices = (
  entryPrice,
  stopLossPct,
  takeProfitPct,
  isShort = false
) => {
  const entry = Number(entryPrice);
  const slPct = Number(stopLossPct) / 100;
  const tpPct = Number(takeProfitPct) / 100;

  let stopLoss, takeProfit;

  if (isShort) {
    // For short positions: SL above entry, TP below entry
    stopLoss = Number((entry * (1 + slPct)).toFixed(2));
    takeProfit = Number((entry * (1 - tpPct)).toFixed(2));
  } else {
    // For long positions: SL below entry, TP above entry
    stopLoss = Number((entry * (1 - slPct)).toFixed(2));
    takeProfit = Number((entry * (1 + tpPct)).toFixed(2));
  }

  return { stopLoss, takeProfit };
};

/**
 * Calculate position size based on account risk and entry/stop loss prices
 * @param {number} accountSize - Total account size
 * @param {number} riskPercentage - Percentage of account to risk on trade (e.g., 2 for 2%)
 * @param {number} entryPrice - Entry price
 * @param {number} stopLossPrice - Stop loss price
 * @returns {number} Position size (quantity)
 */
export const calculatePositionSize = (
  accountSize,
  riskPercentage,
  entryPrice,
  stopLossPrice
) => {
  const account = Number(accountSize);
  const riskAmt = account * (Number(riskPercentage) / 100);
  const priceRisk = Math.abs(Number(entryPrice) - Number(stopLossPrice));

  if (priceRisk === 0) return 0;

  return Math.floor(riskAmt / priceRisk);
};

/**
 * Calculate maximum position size based on account and position limit percentage
 * @param {number} accountSize - Total account size
 * @param {number} positionSizeLimitPct - Maximum position size as % of account
 * @param {number} price - Current price of asset
 * @returns {number} Maximum position size (quantity)
 */
export const calculateMaxPositionSize = (
  accountSize,
  positionSizeLimitPct,
  price
) => {
  const account = Number(accountSize);
  const maxAllocation = account * (Number(positionSizeLimitPct) / 100);
  const unitPrice = Number(price);

  if (unitPrice === 0) return 0;

  return Math.floor(maxAllocation / unitPrice);
};

/**
 * Build a bracket order payload for API submission
 * @param {Object} params - Order parameters
 * @returns {Object} Order payload ready for API submission
 */
export const buildBracketOrderPayload = ({
  symbol,
  quantity,
  price,
  side = 'BUY',
  stopLossPct,
  takeProfitPct,
  orderType = 'LIMIT',
  productType = 'MIS',
  isShort = false,
}) => {
  const { stopLoss, takeProfit } = calculateBracketPrices(
    price,
    stopLossPct,
    takeProfitPct,
    isShort
  );

  return {
    symbol,
    quantity: Number(quantity),
    price: Number(price),
    side,
    orderType,
    productType,
    // Bracket orders
    stopLossPrice: stopLoss,
    takeProfitPrice: takeProfit,
    // Meta
    isShort,
    createdAt: new Date().toISOString(),
  };
};

/**
 * Validate order against risk limits
 * @param {Object} order - Order object
 * @param {Object} riskSettings - Risk settings from context
 * @param {number} accountSize - Current account size
 * @returns {Object} { isValid, errors: [] }
 */
export const validateOrderAgainstRiskLimits = (
  order,
  riskSettings,
  accountSize
) => {
  const errors = [];

  if (!riskSettings) {
    return { isValid: false, errors: ['Risk settings not loaded'] };
  }

  // Check position size limit
  const maxPositionSize = calculateMaxPositionSize(
    accountSize,
    riskSettings.positionSizeLimitPct,
    order.price
  );

  if (order.quantity > maxPositionSize) {
    errors.push(
      `Position size exceeds limit. Max: ${maxPositionSize}, Requested: ${order.quantity}`
    );
  }

  // Check stop loss is reasonable
  if (order.stopLossPrice) {
    const slPct = Math.abs(
      ((order.price - order.stopLossPrice) / order.price) * 100
    );
    if (slPct > 50) {
      errors.push(`Stop loss percentage (${slPct.toFixed(2)}%) seems excessive`);
    }
  }

  // Check take profit is reasonable
  if (order.takeProfitPrice) {
    const tpPct = Math.abs(
      ((order.takeProfitPrice - order.price) / order.price) * 100
    );
    if (tpPct > 200) {
      errors.push(
        `Take profit percentage (${tpPct.toFixed(2)}%) seems unrealistic`
      );
    }
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Format risk metrics for display
 * @param {Object} params
 * @returns {Object} Formatted display strings
 */
export const formatRiskMetrics = ({
  entryPrice,
  stopLossPrice,
  takeProfitPrice,
  quantity,
  accountSize,
}) => {
  const entry = Number(entryPrice);
  const sl = Number(stopLossPrice);
  const tp = Number(takeProfitPrice);
  const qty = Number(quantity);

  const riskPerShare = Math.abs(entry - sl);
  const rewardPerShare = Math.abs(tp - entry);
  const riskRewardRatio = riskPerShare > 0 ? rewardPerShare / riskPerShare : 0;

  const totalRisk = riskPerShare * qty;
  const totalReward = rewardPerShare * qty;

  const riskPct = accountSize > 0 ? (totalRisk / accountSize) * 100 : 0;
  const rewardPct = accountSize > 0 ? (totalReward / accountSize) * 100 : 0;

  return {
    riskPerShare: riskPerShare.toFixed(2),
    rewardPerShare: rewardPerShare.toFixed(2),
    riskRewardRatio: riskRewardRatio.toFixed(2),
    totalRisk: totalRisk.toFixed(2),
    totalReward: totalReward.toFixed(2),
    riskPct: riskPct.toFixed(2),
    rewardPct: rewardPct.toFixed(2),
  };
};

export default {
  calculateBracketPrices,
  calculatePositionSize,
  calculateMaxPositionSize,
  buildBracketOrderPayload,
  validateOrderAgainstRiskLimits,
  formatRiskMetrics,
};
