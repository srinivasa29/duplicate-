const NodeCache = require('node-cache');
const { fetchCryptoData } = require('../services/cryptoService');
const { fetchStockData } = require('../services/stockService');
const { fetchForexData } = require('../services/forexService');
const { normalizeCrypto, normalizeStock, normalizeForex } = require('../utils/normalizer');
const { searchSymbolRegistry, syncSymbolRegistry } = require('../services/symbolRegistryService');
const { getActiveSymbols } = require('../utils/symbolRegistry');

const cache = new NodeCache({ stdTTL: 60 });
const DEFAULT_MARKET_REGION = String(process.env.DEFAULT_MARKET_REGION || 'IN').toUpperCase();
const stripStockSuffix = (value) => String(value || '').replace(/\.(NS|BO)$/i, '');

const getMarketData = async (req, res) => {
    const { type, search, minPrice, maxPrice, minChange, sort, symbols } = req.query;

    try {
        let combinedData = cache.get("allMarketData");

        if (!combinedData) {
            const [cryptoResult, stockResult, forexResult] = await Promise.allSettled([
                fetchCryptoData(),
                fetchStockData(),
                fetchForexData()
            ]);

            const rawCrypto = cryptoResult.status === 'fulfilled' ? cryptoResult.value : [];
            const rawStocks = stockResult.status === 'fulfilled' ? stockResult.value : [];
            const rawForex  = forexResult.status === 'fulfilled'  ? forexResult.value  : [];

            if (stockResult.status === 'rejected') {
                console.error('[marketController] fetchStockData failed:', stockResult.reason?.message);
            }

            const cleanCrypto = normalizeCrypto(rawCrypto);
            const cleanStocks = normalizeStock(rawStocks);
            const cleanForex  = normalizeForex(rawForex);

            combinedData = [...cleanCrypto, ...cleanStocks, ...cleanForex];
            // Only cache when we have reasonable data; don't cache an empty result
            if (combinedData.length > 0) {
                cache.set("allMarketData", combinedData);
            }
        }

        let result = combinedData;

        if (type) {
            result = result.filter(item => item.type === type.toUpperCase());
        }

        if (symbols) {
            const symList = symbols.split(',').map(s => s.trim().toUpperCase());
            result = result.filter(item => {
                const sym = String(item.symbol || '').toUpperCase();
                return symList.includes(sym) || symList.includes(stripStockSuffix(sym));
            });

            // Fetch any missing stocks dynamically
            const foundSymbols = new Set(result.flatMap(item => {
                const sym = String(item.symbol || '').toUpperCase();
                return [sym, stripStockSuffix(sym)];
            }));
            const missingStocks = symList.filter(s => !foundSymbols.has(s) && !s.includes('-')); // Avoid forex/crypto pairs
            
            if (missingStocks.length > 0) {
                try {
                    // Attempt to resolve suffixes for missing stocks
                    const resolvedMissingPromises = missingStocks.map(async s => {
                        const searchRes = await searchSymbolRegistry({ q: s, limit: 1 });
                        if (searchRes && searchRes.length > 0) {
                            return searchRes[0].symbol; 
                        }
                        // Default to appending .NS if it looks like an Indian stock request with no suffix
                        return s.includes('.') ? s : `${s}.NS`;
                    });

                    const resolvedMissing = await Promise.all(resolvedMissingPromises);
                    const missingData = await fetchStockData(resolvedMissing);
                    
                    if (missingData && missingData.length > 0) {
                        const cleanMissing = normalizeStock(missingData);
                        
                        // Only add to result if they were found
                        const actuallyFound = cleanMissing.filter(m => {
                            const sym = String(m.symbol || '').toUpperCase();
                            return symList.includes(sym) || 
                                   symList.includes(stripStockSuffix(sym)) ||
                                   resolvedMissing.includes(sym);
                        });
                        
                        result = [...result, ...actuallyFound];
                        
                        // Update the cache so subsequent requests for these custom stocks are fast
                        if (combinedData) {
                            const newCombined = [...combinedData, ...cleanMissing].filter((v, i, a) => a.findIndex(t => t.symbol === v.symbol) === i);
                            cache.set("allMarketData", newCombined);
                        }
                    }
                } catch (err) {
                    console.error("[marketController] Failed to fetch missing stocks:", err.message);
                }
            }
        }

        if (search) {
            const term = search.toLowerCase().replace('$', '').replace('#', '');
            result = result.filter(item => 
                String(item.name || '').toLowerCase().includes(term) || 
                String(item.symbol || '').toLowerCase().includes(term)
            );
        }

        if (minPrice) result = result.filter(item => item.price >= parseFloat(minPrice));
        if (maxPrice) result = result.filter(item => item.price <= parseFloat(maxPrice));
        if (minChange) result = result.filter(item => item.change_24h >= parseFloat(minChange));

        if (sort === 'gainers') {
            result.sort((a, b) => b.change_24h - a.change_24h);
        } else if (sort === 'losers') {
            result.sort((a, b) => a.change_24h - b.change_24h);
        }

        res.json(result);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch market data" });
    }
};
const getCryptoBySymbol = async (req, res) => {
    try {
        const { symbol } = req.params;
        const allCrypto = await fetchCryptoData();
        const found = allCrypto.find(c =>
            c.symbol?.toLowerCase() === symbol.toLowerCase() ||
            c.id?.toLowerCase() === symbol.toLowerCase()
        );
        if (!found) {
            return res.status(404).json({ success: false, message: `Crypto symbol '${symbol}' not found` });
        }
        res.json({ success: true, data: found });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
const getTrendingSearches = async (req, res) => {
    try {
        const region = String(DEFAULT_MARKET_REGION || 'IN').toUpperCase();

        // Fetch up to 8 active equity symbols for the current region from DB
        const exchangeMap = { IN: ['NSE', 'BSE'], US: ['NASDAQ', 'NYSE'], GLOBAL: ['NSE', 'BSE', 'NASDAQ', 'NYSE', 'CRYPTO'] };
        const exchanges = exchangeMap[region] || exchangeMap.IN;

        const dbSymbols = await getActiveSymbols({ exchanges });
        const topStocks = dbSymbols.slice(0, 6).map(stripStockSuffix);

        // Always include index + BTC for IN, just BTC+ETH for global
        const pinned = region === 'US'
            ? ['BTC', 'ETH']
            : region === 'GLOBAL'
            ? ['BTC', 'NIFTY']
            : ['NIFTY', 'BTC', 'USDINR'];

        const trending = [...new Set([...pinned, ...topStocks])].slice(0, 10);

        res.json({ success: true, trending });
    } catch (error) {
        console.error('Failed to get trending searches:', error);
        res.status(200).json({
            success: true,
            trending: ['NIFTY', 'BTC'],
            message: 'Fallback active',
        });
    }
};
const logSearchEndpoint = (req, res) => {
    res.json({ success: true });
};
const getSearchHistory = (req, res) => {
    res.json({ success: true, history: [] });
};

const searchUniversalSymbols = async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const type = req.query.type ? String(req.query.type).toLowerCase() : undefined;
        const limit = Number.parseInt(req.query.limit || '20', 10);

        if (!q) {
            return res.json({ success: true, data: [] });
        }

        const data = await searchSymbolRegistry({ q, type, limit });
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Universal symbol search failed:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to search symbols' });
    }
};

const syncUniversalSymbols = async (_req, res) => {
    try {
        const result = await syncSymbolRegistry();
        return res.json({ success: true, ...result });
    } catch (error) {
        console.error('Symbol registry sync failed:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to sync symbol registry' });
    }
};

module.exports = {
    getMarketData,
    getCryptoBySymbol,
    getTrendingSearches,
    logSearchEndpoint,
    getSearchHistory,
    searchUniversalSymbols,
    syncUniversalSymbols,
};