/**
 * FundamentalsCompactSection
 * Thin wrapper around the shared StockFundamentalsPanel (compact mode).
 * Used in the Trader stock research sidebar.
 */
import StockFundamentalsPanel from '../../shared/StockFundamentalsPanel';

const FundamentalsCompactSection = ({ symbol }) => {
  if (!symbol) return null;
  return <StockFundamentalsPanel symbol={symbol} compact={true} />;
};

export default FundamentalsCompactSection;
