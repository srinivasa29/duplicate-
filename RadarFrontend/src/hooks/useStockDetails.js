import { useEffect, useState } from 'react';
import api from '../api/api';

const useStockDetails = (symbol) => {

  const [data, setData] = useState(null);

  useEffect(() => {

    if (!symbol) return;

    const INDEX_MAP = {
      NIFTY: '^NSEI',
      SENSEX: '^BSESN',
      BANKNIFTY: '^NSEBANK'
    };

    const yahooSymbol =
      INDEX_MAP[symbol.toUpperCase()] || symbol;

    api
      .get(`/ohlc/${encodeURIComponent(yahooSymbol)}/details`)
      .then(res => {
        setData(res.data.data);
      })
      .catch(console.error);

  }, [symbol]);

  return data;
};

export default useStockDetails;