import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/api';

/*const TIMEFRAME_MAP = {
  '1D':  { resolution: 'D',  daysBack: 365 },
  '5D':  { resolution: '5',  daysBack: 5 },
  '1M':  { resolution: '60', daysBack: 30 },
  '3M':  { resolution: 'D',  daysBack: 90 },
  '6M':  { resolution: 'D',  daysBack: 180 },
  '1Y':  { resolution: 'D',  daysBack: 365 },
  '5Y':  { resolution: 'W',  daysBack: 1825 },
  'ALL': { resolution: 'M',  daysBack: 3650 },
};*/

const RANGE_MAP = {
  '1D': 1,
  '5D': 5,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  '5Y': 1825,
  'ALL': 3650,
};
const useChartData = (symbol, interval,
  historyRange, customFrom = null, customTo = null) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const cache = useRef({});

  const fetchData = useCallback(async () => {
    //if (!symbol || !timeframe) return;
    if (!symbol || !interval || !historyRange) return;

    const now = Math.floor(Date.now() / 1000);
    /*const tf = TIMEFRAME_MAP[timeframe] || TIMEFRAME_MAP['1Y'];
    const toTs = customTo ? Math.floor(new Date(customTo).getTime() / 1000) : now;
    const fromTs = customFrom
      ? Math.floor(new Date(customFrom).getTime() / 1000)
      : now - tf.daysBack * 86400;
    */

    const toTs = customTo
      ? Math.floor(new Date(customTo).getTime() / 1000)
      : now;

    // ALWAYS FETCH 1 YEAR HISTORY
    /*const fromTs = customFrom
      ? Math.floor(new Date(customFrom).getTime() / 1000)
      : now - 365 * 86400;*/
    

    

    const daysBack =
      RANGE_MAP[historyRange] || 365;

    const fromTs = customFrom
      ? Math.floor(new Date(customFrom).getTime() / 1000)
      : now - daysBack * 86400;

    //const cacheKey = `${symbol}__${timeframe}__${fromTs}__${toTs}`;
    const cacheKey = `${symbol}__${interval}__${historyRange}__${fromTs}__${toTs}`;
    if (cache.current[cacheKey]) {
      setData(cache.current[cacheKey]);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const res = await api.get(`/stocks/${symbol}/chart`, {
        /*params: {
          timeframe
        },*/
        params: {
          interval,
          daysBack,
          ...(customFrom && { period1: fromTs }),
          ...(customTo && { period2: toTs })
        },
        signal: abortRef.current.signal,
      });

      let raw = res.data?.data || [];

      // Fallback removed: Returning empty data is better than ignoring user's interval/range and showing 1 year of daily data.

      // Normalize to TV format
      const normalized = raw
        .map(d => ({
          time: typeof d.time === 'number' && d.time < 1e10
            ? d.time
            : d.timestamp
              ? Math.floor(new Date(d.timestamp).getTime() / 1000)
              : d.date
                ? Math.floor(new Date(d.date).getTime() / 1000)
                : Math.floor(new Date(d.time).getTime() / 1000),
          open: +(d.open || 0),
          high: +(d.high || 0),
          low: +(d.low || 0),
          close: +(d.close || 0),
          volume: +(d.volume || 0),
        }))
        .filter(d => d.time && d.close > 0)
        .sort((a, b) => a.time - b.time);

      // Deduplicate by time
      const deduped = [];
      const seen = new Set();
      for (const d of normalized) {
        if (!seen.has(d.time)) { deduped.push(d); seen.add(d.time); }
      }

      cache.current[cacheKey] = deduped;
      setData(deduped);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.error(`[useChartData] Error fetching ${symbol}:`, err.message);
      setError(err.message);
      // Return empty — ChartPane will handle fallback mock
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [
  symbol,
  interval,
  historyRange,
  customFrom,
  customTo
]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};

export default useChartData;

