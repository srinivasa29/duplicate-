const { fetchStockHistory } = require('./stockService');
const { calculateRSI, calculateMACD, calculateEMA, calculateBollinger, getVolumeStatus } = require('../utils/indicators');
const incrementalUpdateService = require('./incrementalUpdateService');
const logger = require('../utils/logger');

// Store events in memory to maintain recency logic, timestamps, and deduplication
// Key: `${symbol}-${eventType}`, Value: { title, desc, type, date, time, priority, timestamp }
const eventStore = new Map();

let lastCalculationTime = 0;
let isCalculating = false;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to format relative time
const getRelativeTime = (timestamp) => {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHrs = Math.floor(diffMins / 60);

    if (diffMins < 5) return 'Live';
    if (diffMins < 60) return `${diffMins} Mins ago`;
    if (diffHrs < 24) return `${diffHrs} Hrs ago`;
    return '1 Day ago';
};

// Helper to clean up expired events (older than 24 hours)
const cleanExpiredEvents = () => {
    const now = Date.now();
    const TTL = 24 * 60 * 60 * 1000;
    for (const [key, event] of eventStore.entries()) {
        if (now - event.timestamp > TTL) {
            eventStore.delete(key);
        }
    }
};

const evaluateRecentChanges = async (watchlistSymbols = [], forceRecalculate = false) => {
    cleanExpiredEvents();

    const now = Date.now();

    // If cache is fresh and we are not forcing recalculation, return existing events instantly!
    if (!forceRecalculate && eventStore.size > 0 && (now - lastCalculationTime < CACHE_TTL || isCalculating)) {
        const requestedSet = Array.isArray(watchlistSymbols) && watchlistSymbols.length > 0 
            ? new Set(watchlistSymbols.map(s => String(s || '').toUpperCase().replace(/\.(NS|BO)$/i, '')))
            : new Set(['NIFTY', 'BANKNIFTY', 'SENSEX', 'RELIANCE', 'TCS', 'INFY', 'HDFC']);

        const filteredEvents = Array.from(eventStore.entries())
            .filter(([key]) => requestedSet.has(key.split('-')[0]))
            .map(([key, event]) => ({
                ...event,
                symbol: key.split('-')[0],
                time: getRelativeTime(event.timestamp)
            })).sort((a, b) => b.timestamp - a.timestamp);

        return filteredEvents;
    }

    // Determine symbols to monitor: if forcing recalculate (e.g. from cron), get all DB symbols!
    let symbolsToMonitor = [];
    if (forceRecalculate) {
        const dbSymbols = await incrementalUpdateService.fetchSymbolsFromDB().catch(() => []);
        symbolsToMonitor = dbSymbols.length > 0 ? dbSymbols : ['NIFTY', 'BANKNIFTY', 'SENSEX', 'RELIANCE', 'TCS', 'INFY', 'HDFC'];
    } else {
        symbolsToMonitor = Array.isArray(watchlistSymbols) && watchlistSymbols.length > 0 
            ? [...new Set(watchlistSymbols)]
            : ['NIFTY', 'BANKNIFTY', 'SENSEX', 'RELIANCE', 'TCS', 'INFY', 'HDFC'];
    }

    isCalculating = true;

    for (const rawSym of symbolsToMonitor) {
        const sym = String(rawSym || '').toUpperCase().replace(/\.(NS|BO)$/i, '');
        if (!sym) continue;

        try {
            const history = await fetchStockHistory(sym, '1D', { allowSynthetic: true }).catch(() => []);
            if (!history || history.length < 30) continue;

            const prices = history.map(h => Number(h.price));
            const currPrice = prices[prices.length - 1];
            const prevPrice = prices[prices.length - 2];

            // 1. RSI Events
            const rsiRaw = calculateRSI(history, 14);
            if (rsiRaw.length >= 2) {
                const currRSI = rsiRaw[rsiRaw.length - 1].value;
                const prevRSI = rsiRaw[rsiRaw.length - 2].value;

                if (prevRSI < 70 && currRSI >= 70) {
                    const key = `${sym}-RSI_OVERBOUGHT`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} RSI Overbought`,
                            desc: `RSI (14) entered overbought territory above 70 (${currRSI}), indicating intense buying momentum but potential overextension.`,
                            type: 'positive',
                            date: 'Today',
                            priority: 'Medium',
                            timestamp: now
                        });
                    }
                } else if (prevRSI > 30 && currRSI <= 30) {
                    const key = `${sym}-RSI_OVERSOLD`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} RSI Oversold`,
                            desc: `RSI (14) dropped into oversold territory below 30 (${currRSI}), highlighting heavy selling pressure and a potential reversal zone.`,
                            type: 'amber',
                            date: 'Today',
                            priority: 'Medium',
                            timestamp: now
                        });
                    }
                } else if (prevRSI >= 70 && currRSI < 70) {
                    const key = `${sym}-RSI_EXIT_OVERBOUGHT`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Exited Overbought`,
                            desc: `RSI pulled back below 70 (${currRSI}), suggesting bullish momentum is cooling off after a strong rally.`,
                            type: 'amber',
                            date: 'Today',
                            priority: 'Low',
                            timestamp: now
                        });
                    }
                } else if (prevRSI <= 30 && currRSI > 30) {
                    const key = `${sym}-RSI_EXIT_OVERSOLD`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Recovered from Oversold`,
                            desc: `RSI crossed back above 30 (${currRSI}), signaling early buying interest and recovery from oversold levels.`,
                            type: 'positive',
                            date: 'Today',
                            priority: 'Medium',
                            timestamp: now
                        });
                    }
                }
            }

            // 2. MACD Events
            const macdRaw = calculateMACD(history);
            if (macdRaw.length >= 2) {
                const currMACD = macdRaw[macdRaw.length - 1];
                const prevMACD = macdRaw[macdRaw.length - 2];

                if (prevMACD.value <= prevMACD.signal && currMACD.value > currMACD.signal) {
                    const key = `${sym}-MACD_BULLISH_CROSS`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Positive MACD`,
                            desc: `Bullish MACD crossover detected as the MACD line crossed above the signal line, confirming building upward momentum.`,
                            type: 'positive',
                            date: 'Today',
                            priority: 'High',
                            timestamp: now
                        });
                    }
                } else if (prevMACD.value >= prevMACD.signal && currMACD.value < currMACD.signal) {
                    const key = `${sym}-MACD_BEARISH_CROSS`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Bearish MACD Crossover`,
                            desc: `MACD line crossed below the signal line on the daily chart, indicating a shift toward bearish momentum.`,
                            type: 'negative',
                            date: 'Today',
                            priority: 'High',
                            timestamp: now
                        });
                    }
                } else if (prevMACD.value <= 0 && currMACD.value > 0) {
                    const key = `${sym}-MACD_ZERO_CROSS_UP`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} MACD Crossed Above Zero`,
                            desc: `MACD histogram moved into positive territory above the zero line, confirming a macro trend transition to bullish.`,
                            type: 'positive',
                            date: 'Today',
                            priority: 'High',
                            timestamp: now
                        });
                    }
                } else if (prevMACD.value >= 0 && currMACD.value < 0) {
                    const key = `${sym}-MACD_ZERO_CROSS_DOWN`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} MACD Crossed Below Zero`,
                            desc: `MACD fell below the zero line, signaling strengthening negative momentum and macro bearish transition.`,
                            type: 'negative',
                            date: 'Today',
                            priority: 'High',
                            timestamp: now
                        });
                    }
                }
            }

            // 3. EMA Crossover Events
            const ema20Raw = calculateEMA(prices, 20);
            const ema50Raw = calculateEMA(prices, 50);
            if (ema20Raw.length >= 2 && ema50Raw.length >= 2) {
                const currEMA20 = ema20Raw[ema20Raw.length - 1];
                const prevEMA20 = ema20Raw[ema20Raw.length - 2];
                const currEMA50 = ema50Raw[ema50Raw.length - 1];
                const prevEMA50 = ema50Raw[ema50Raw.length - 2];

                if (prevEMA20 <= prevEMA50 && currEMA20 > currEMA50) {
                    const key = `${sym}-EMA_GOLDEN_CROSS`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Bullish EMA Crossover`,
                            desc: `Confirmed bullish crossover as the 20 EMA crossed above the 50 EMA, indicating a powerful upward structural trend.`,
                            type: 'positive',
                            date: 'Today',
                            priority: 'High',
                            timestamp: now
                        });
                    }
                } else if (prevEMA20 >= prevEMA50 && currEMA20 < currEMA50) {
                    const key = `${sym}-EMA_DEATH_CROSS`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Bearish EMA Crossover`,
                            desc: `20 EMA crossed below the 50 EMA, confirming a bearish trend transition and institutional distribution.`,
                            type: 'negative',
                            date: 'Today',
                            priority: 'High',
                            timestamp: now
                        });
                    }
                } else if (prevPrice <= prevEMA20 && currPrice > currEMA20) {
                    const key = `${sym}-PRICE_ABOVE_EMA20`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Price Reclaimed 20 EMA`,
                            desc: `Stock price surged back above the 20-day exponential moving average (₹${currEMA20}), showing renewed short-term buyer strength.`,
                            type: 'positive',
                            date: 'Today',
                            priority: 'Medium',
                            timestamp: now
                        });
                    }
                } else if (prevPrice >= prevEMA50 && currPrice < currEMA50) {
                    const key = `${sym}-PRICE_BELOW_EMA50`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Price Moved Below 50 EMA`,
                            desc: `Price broke below the key 50 EMA support level (₹${currEMA50}), signaling intermediate-term weakness.`,
                            type: 'negative',
                            date: 'Today',
                            priority: 'Medium',
                            timestamp: now
                        });
                    }
                }
            }

            // 4. Bollinger %B Events
            const bBands = calculateBollinger(history, 20, 2);
            if (bBands.length >= 2) {
                const currB = bBands[bBands.length - 1];
                const prevB = bBands[bBands.length - 2];
                
                const calcPercentB = (p, band) => band.upper === band.lower ? 0.5 : (p - band.lower) / (band.upper - band.lower);
                const currPercentB = calcPercentB(currPrice, currB);
                const prevPercentB = calcPercentB(prevPrice, prevB);

                if (currPercentB > 1 && prevPercentB <= 1) {
                    const key = `${sym}-BOLLINGER_BREAKOUT_UP`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Bollinger Band Breakout`,
                            desc: `Price broke out above the upper Bollinger Band (₹${currB.upper}), indicating extreme volatility expansion and upside momentum.`,
                            type: 'positive',
                            date: 'Today',
                            priority: 'High',
                            timestamp: now
                        });
                    }
                } else if (currPercentB < 0 && prevPercentB >= 0) {
                    const key = `${sym}-BOLLINGER_BREAKDOWN_DOWN`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Bollinger Band Breakdown`,
                            desc: `Price plunged below the lower Bollinger Band (₹${currB.lower}), highlighting severe downside momentum and oversold conditions.`,
                            type: 'negative',
                            date: 'Today',
                            priority: 'High',
                            timestamp: now
                        });
                    }
                } else if (currPercentB > 0.95 && currPercentB <= 1 && prevPercentB <= 0.95) {
                    const key = `${sym}-BOLLINGER_NEAR_UPPER`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Pushing Upper Bollinger Band`,
                            desc: `Stock is testing the upper volatility boundary (%B > 0.95), showing persistent buying pressure.`,
                            type: 'positive',
                            date: 'Today',
                            priority: 'Medium',
                            timestamp: now
                        });
                    }
                } else if (currPercentB < 0.05 && currPercentB >= 0 && prevPercentB >= 0.05) {
                    const key = `${sym}-BOLLINGER_NEAR_LOWER`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Testing Lower Volatility Boundary`,
                            desc: `Bollinger %B dropped below 0.05, suggesting the stock is testing critical lower band support.`,
                            type: 'amber',
                            date: 'Today',
                            priority: 'Medium',
                            timestamp: now
                        });
                    }
                }
            }

            // 5. ATR / Volatility Events
            if (prices.length >= 28) {
                const calcATR = (slice) => {
                    let trSum = 0;
                    for (let i = 1; i < slice.length; i++) {
                        trSum += Math.abs(slice[i] - slice[i - 1]);
                    }
                    return trSum / (slice.length - 1);
                };
                const currATR = calcATR(prices.slice(-14));
                const prevATR = calcATR(prices.slice(-28, -14));

                if (currATR > prevATR * 1.2) {
                    const key = `${sym}-ATR_EXPANSION`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Volatility Expanding Rapidly`,
                            desc: `14-day Average True Range (ATR) surged by over 20% vs its rolling average, indicating a major expansion in market volatility.`,
                            type: 'amber',
                            date: 'Today',
                            priority: 'High',
                            timestamp: now
                        });
                    }
                } else if (currATR < prevATR * 0.75) {
                    const key = `${sym}-ATR_CONTRACTION`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Volatility Contracting`,
                            desc: `ATR dropped significantly, showing volatility contraction and potential consolidation before the next major breakout.`,
                            type: 'positive',
                            date: 'Today',
                            priority: 'Low',
                            timestamp: now
                        });
                    }
                }
            }

            // 6. Volume Events
            const volumes = history.map(h => Number(h.volume || 0));
            if (volumes.length >= 20) {
                const currVol = volumes[volumes.length - 1];
                const avgVol = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;

                if (avgVol > 0) {
                    const volRatio = currVol / avgVol;
                    if (volRatio > 2) {
                        const key = `${sym}-VOLUME_SURGE_2X`;
                        if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                            eventStore.set(key, {
                                title: `${sym} Massive Volume Surge`,
                                desc: `Trading volume spiked to over 2x the 20-day average, signaling heavy institutional activity and strong conviction.`,
                                type: currPrice > prevPrice ? 'positive' : 'negative',
                                date: 'Today',
                                priority: 'High',
                                timestamp: now
                            });
                        }
                    } else if (volRatio > 1.5 && currPrice > prevPrice * 1.015) {
                        const key = `${sym}-INSTITUTIONAL_ACCUMULATION`;
                        if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                            eventStore.set(key, {
                                title: `${sym} Institutional Accumulation`,
                                desc: `Elevated volume (>1.5x average) accompanied by a solid price surge, indicating institutional buying and accumulation.`,
                                type: 'positive',
                                date: 'Today',
                                priority: 'High',
                                timestamp: now
                            });
                        }
                    }
                }
            }

            // 7. Support / Resistance Events
            if (prices.length >= 20) {
                const recent20 = prices.slice(-21, -1);
                const support = Math.min(...recent20);
                const resistance = Math.max(...recent20);

                if (prevPrice <= resistance && currPrice > resistance) {
                    const key = `${sym}-RESISTANCE_BREAKOUT`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Resistance Breakout`,
                            desc: `Price decisively broke above the recent ₹${resistance.toFixed(2)} resistance ceiling, confirming a new bullish structural breakout.`,
                            type: 'positive',
                            date: 'Today',
                            priority: 'High',
                            timestamp: now
                        });
                    }
                } else if (prevPrice >= support && currPrice < support) {
                    const key = `${sym}-SUPPORT_BREAKDOWN`;
                    if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                        eventStore.set(key, {
                            title: `${sym} Support Breakdown`,
                            desc: `Price fell below the critical ₹${support.toFixed(2)} support floor, signaling structural breakdown and further downside risk.`,
                            type: 'negative',
                            date: 'Today',
                            priority: 'High',
                            timestamp: now
                        });
                    }
                }
            }

            // 8. Trend Structure Events
            if (prices.length >= 10) {
                const sma10Raw = calculateEMA(prices, 10);
                if (sma10Raw.length >= 2) {
                    const currSMA10 = sma10Raw[sma10Raw.length - 1];
                    const prevSMA10 = sma10Raw[sma10Raw.length - 2];
                    if (currSMA10 > prevSMA10 && currPrice > currSMA10 && prevPrice <= prevSMA10) {
                        const key = `${sym}-TREND_TURN_BULLISH`;
                        if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                            eventStore.set(key, {
                                title: `${sym} Trend Turned Bullish`,
                                desc: `Short-term trend structure shifted to bullish as price reclaimed the upward-sloping 10-period moving average.`,
                                type: 'positive',
                                date: 'Today',
                                priority: 'Medium',
                                timestamp: now
                            });
                        }
                    } else if (currSMA10 < prevSMA10 && currPrice < currSMA10 && prevPrice >= prevSMA10) {
                        const key = `${sym}-TREND_TURN_BEARISH`;
                        if (!eventStore.has(key) || (now - eventStore.get(key).timestamp > 4 * 3600 * 1000)) {
                            eventStore.set(key, {
                                title: `${sym} Bearish Structure Shift`,
                                desc: `Trend structure turned bearish as price broke below the declining short-term moving average.`,
                                type: 'negative',
                                date: 'Today',
                                priority: 'Medium',
                                timestamp: now
                            });
                        }
                    }
                }
            }

        } catch (err) {
            logger.warn(`Recent changes evaluation failed for ${sym}: ${err.message}`);
        }
    }

    lastCalculationTime = Date.now();
    isCalculating = false;

    // Convert eventStore to array, sort by timestamp descending, update relative time
    const requestedSet = Array.isArray(watchlistSymbols) && watchlistSymbols.length > 0 
        ? new Set(watchlistSymbols.map(s => String(s || '').toUpperCase().replace(/\.(NS|BO)$/i, '')))
        : new Set(['NIFTY', 'BANKNIFTY', 'SENSEX', 'RELIANCE', 'TCS', 'INFY', 'HDFC']);

    const filteredEvents = Array.from(eventStore.entries())
        .filter(([key]) => requestedSet.has(key.split('-')[0]))
        .map(([key, event]) => ({
            ...event,
            symbol: key.split('-')[0],
            time: getRelativeTime(event.timestamp)
        })).sort((a, b) => b.timestamp - a.timestamp);

    return filteredEvents;
};

module.exports = { evaluateRecentChanges };
