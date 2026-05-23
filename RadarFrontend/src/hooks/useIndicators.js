import { useMemo } from 'react';
import {
  SMA, EMA, MACD, RSI, BollingerBands,
  Stochastic, ATR, OBV, VWAP, HeikinAshi,
} from 'technicalindicators';

const safe = (arr) => Array.isArray(arr) ? arr : [];

const useIndicators = (data, activeIndicators) => {
  return useMemo(() => {
    if (!data || data.length < 30) return {};

    const closes  = data.map(d => d.close);
    const highs   = data.map(d => d.high);
    const lows    = data.map(d => d.low);
    const volumes = data.map(d => d.volume || 0);

    const mapToTime = (arr, offset = 0) =>
      safe(arr).map((value, i) => {
        const idx = i + offset;
        if (idx >= data.length) return null;
        return { time: data[idx].time, value: value ?? null };
      }).filter(Boolean);

    const result = {};

    try {
      // ── TREND ──────────────────────────────────────────────────────────
      if (activeIndicators.sma && data.length >= 20) {
        const period = 20;
        const sma = SMA.calculate({ period, values: closes });
        result.sma = mapToTime(sma, closes.length - sma.length);
      }

      if (activeIndicators.ema && data.length >= 9) {
        const period = 9;
        const ema = EMA.calculate({ period, values: closes });
        result.ema = mapToTime(ema, closes.length - ema.length);
      }

      if (activeIndicators.bb && data.length >= 20) {
        const bb = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 });
        const offset = closes.length - bb.length;
        result.bb = {
          upper:  bb.map((r, i) => ({ time: data[i + offset].time, value: r.upper  })),
          middle: bb.map((r, i) => ({ time: data[i + offset].time, value: r.middle })),
          lower:  bb.map((r, i) => ({ time: data[i + offset].time, value: r.lower  })),
        };
      }

      if (activeIndicators.vwap && data.length >= 1) {
        const vwap = VWAP.calculate({ high: highs, low: lows, close: closes, volume: volumes });
        result.vwap = mapToTime(vwap, 0);
      }

      // ── MOMENTUM ───────────────────────────────────────────────────────
      if (activeIndicators.rsi && data.length >= 15) {
        const period = 14;
        const rsi = RSI.calculate({ period, values: closes });
        result.rsi = mapToTime(rsi, closes.length - rsi.length);
      }

      if (activeIndicators.macd && data.length >= 35) {
        const macdResult = MACD.calculate({
          values: closes,
          fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
          SimpleMAOscillator: false, SimpleMASignal: false,
        });
        const offset = closes.length - macdResult.length;
        result.macd = {
          macd:   macdResult.map((r, i) => ({ time: data[i + offset].time, value: r.MACD    ?? null })),
          signal: macdResult.map((r, i) => ({ time: data[i + offset].time, value: r.signal  ?? null })),
          hist:   macdResult.map((r, i) => ({ time: data[i + offset].time, value: r.histogram ?? null })),
        };
      }

      if (activeIndicators.stoch && data.length >= 14) {
        const stoch = Stochastic.calculate({
          high: highs, low: lows, close: closes,
          period: 14, signalPeriod: 3,
        });
        const offset = data.length - stoch.length;
        result.stoch = {
          k: stoch.map((r, i) => ({ time: data[i + offset].time, value: r.k ?? null })),
          d: stoch.map((r, i) => ({ time: data[i + offset].time, value: r.d ?? null })),
        };
      }

      // ── VOLUME ─────────────────────────────────────────────────────────
      if (activeIndicators.obv && data.length >= 2) {
        const obv = OBV.calculate({ close: closes, volume: volumes });
        // OBV length = data.length (starts with first candle)
        result.obv = obv.map((value, i) => ({ time: data[i].time, value }));
      }

      // ── VOLATILITY ─────────────────────────────────────────────────────
      if (activeIndicators.atr && data.length >= 15) {
        const period = 14;
        const atr = ATR.calculate({ high: highs, low: lows, close: closes, period });
        result.atr = mapToTime(atr, closes.length - atr.length);
      }

    } catch (err) {
      console.error('[useIndicators]', err);
    }

    return result;
  }, [data, activeIndicators]);
};

export default useIndicators;
