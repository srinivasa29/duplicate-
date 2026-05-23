import { useState, useEffect } from 'react';

export const useMarketStatus = (assetType = 'Equity') => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkMarket = () => {
      // Crypto is 24/7
      if (assetType === 'Crypto') {
        setIsOpen(true);
        return;
      }

      const now = new Date();
      // IST is UTC + 5:30
      const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const day = ist.getUTCDay(); // 0=Sunday, 6=Saturday
      
      if (day === 0 || day === 6) {
        setIsOpen(false);
        return;
      }

      const h = ist.getUTCHours();
      const m = ist.getUTCMinutes();
      const mins = h * 60 + m;
      
      // NSE Trading Hours: 09:15 to 15:30 IST (555 to 930 minutes)
      setIsOpen(mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30);
    };

    checkMarket();
    // Update every minute to keep UI in sync
    const interval = setInterval(checkMarket, 60000);
    return () => clearInterval(interval);
  }, [assetType]);

  return { isOpen, isCrypto: assetType === 'Crypto' };
};
