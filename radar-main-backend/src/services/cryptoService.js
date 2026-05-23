const axios = require('axios');

const BINANCE_BASE_URL = 'https://api.binance.com';
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const COINMARKETCAP_BASE_URL = 'https://pro-api.coinmarketcap.com/v1';

// Fallback pairs — only used when DB Symbol collection has no crypto records
const FALLBACK_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'ADAUSDT', 'DOTUSDT', 'DOGEUSDT', 'MATICUSDT', 'LINKUSDT', 'AVAXUSDT', 'UNIUSDT', 'ATOMUSDT', 'LTCUSDT', 'SHIBUSDT', 'NEARUSDT'];
const PAIR_META = {
    BTCUSDT: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
    ETHUSDT: { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
    SOLUSDT: { id: 'solana', symbol: 'sol', name: 'Solana' },
    XRPUSDT: { id: 'ripple', symbol: 'xrp', name: 'XRP' },
    BNBUSDT: { id: 'binancecoin', symbol: 'bnb', name: 'BNB' },
    ADAUSDT: { id: 'cardano', symbol: 'ada', name: 'Cardano' },
    DOTUSDT: { id: 'polkadot', symbol: 'dot', name: 'Polkadot' },
    DOGEUSDT: { id: 'dogecoin', symbol: 'doge', name: 'Dogecoin' },
    MATICUSDT: { id: 'matic-network', symbol: 'matic', name: 'Polygon' },
    LINKUSDT: { id: 'chainlink', symbol: 'link', name: 'Chainlink' },
    AVAXUSDT: { id: 'avalanche-2', symbol: 'avax', name: 'Avalanche' },
    UNIUSDT: { id: 'uniswap', symbol: 'uni', name: 'Uniswap' },
    ATOMUSDT: { id: 'cosmos', symbol: 'atom', name: 'Cosmos' },
    LTCUSDT: { id: 'litecoin', symbol: 'ltc', name: 'Litecoin' },
    SHIBUSDT: { id: 'shiba-inu', symbol: 'shib', name: 'Shiba Inu' },
    NEARUSDT: { id: 'near', symbol: 'near', name: 'NEAR Protocol' },
};

const toBinancePair = (value = 'BTC') => {
    const normalized = String(value).trim().toUpperCase();
    const aliasMap = {
        BTC: 'BTCUSDT',
        BITCOIN: 'BTCUSDT',
        ETH: 'ETHUSDT',
        ETHEREUM: 'ETHUSDT',
        SOL: 'SOLUSDT',
        SOLANA: 'SOLUSDT',
        XRP: 'XRPUSDT',
        RIPPLE: 'XRPUSDT',
        BNB: 'BNBUSDT',
        BINANCECOIN: 'BNBUSDT',
    };

    if (aliasMap[normalized]) {
        return aliasMap[normalized];
    }

    if (normalized.endsWith('USDT')) {
        return normalized;
    }

    return `${normalized}USDT`;
};

const toBinanceInterval = (interval = '1D') => {
    const key = String(interval).toUpperCase();
    const map = {
        '1M': { interval: '4h', limit: 180 },
        '1W': { interval: '1h', limit: 168 },
        '1D': { interval: '15m', limit: 96 },
        '4H': { interval: '15m', limit: 64 },
        '1H': { interval: '5m', limit: 60 },
    };
    return map[key] || { interval: '1h', limit: 120 };
};

// Lazy-load Symbol model to avoid circular deps
let _Symbol = null;
const getSymbolModel = () => {
    if (!_Symbol) _Symbol = require('../models/Symbol');
    return _Symbol;
};

// In-process cache for resolved pairs (refreshed every 5 min)
let _resolvedPairsCache = null;
let _resolvedPairsExpiry = 0;

/**
 * Returns Binance-style USDT pairs from the DB Symbol collection (assetType=crypto).
 * Falls back to FALLBACK_PAIRS when DB is empty or unavailable.
 */
const getActiveCryptoPairs = async () => {
    const now = Date.now();
    if (_resolvedPairsCache && now < _resolvedPairsExpiry) return _resolvedPairsCache;

    try {
        const Symbol = getSymbolModel();
        const docs = await Symbol.find(
            { active: true, assetType: 'crypto' },
            { symbol: 1, _id: 0 }
        ).lean();

        if (docs.length > 0) {
            // Normalise to BINANCE pair format: BTC → BTCUSDT
            const pairs = docs.map(d => {
                const s = String(d.symbol || '').toUpperCase().replace(/USDT$/, '');
                return `${s}USDT`;
            });
            _resolvedPairsCache = pairs;
            _resolvedPairsExpiry = now + 5 * 60 * 1000;
            return pairs;
        }
    } catch (_) { /* fall through */ }

    return FALLBACK_PAIRS;
};

// Category metadata for known crypto assets
const CRYPTO_CATEGORY = {
    bitcoin: { category: 'Currency', layer: 'Layer 1', consensus: 'Proof of Work' },
    ethereum: { category: 'Smart Contract Platform', layer: 'Layer 1', consensus: 'Proof of Stake' },
    solana: { category: 'Smart Contract Platform', layer: 'Layer 1', consensus: 'Proof of History' },
    ripple: { category: 'Payment Protocol', layer: 'Layer 1', consensus: 'Federated Consensus' },
    binancecoin: { category: 'Exchange Token', layer: 'Layer 1', consensus: 'Proof of Stake Authority' },
    cardano: { category: 'Smart Contract Platform', layer: 'Layer 1', consensus: 'Proof of Stake' },
    'matic-network': { category: 'Scaling Solution', layer: 'Layer 2', consensus: 'Proof of Stake' },
    'avalanche-2': { category: 'Smart Contract Platform', layer: 'Layer 1', consensus: 'Avalanche Consensus' },
    uniswap: { category: 'DeFi / DEX', layer: 'Layer 1', consensus: 'Governance Token' },
    chainlink: { category: 'Oracle Network', layer: 'Layer 1', consensus: 'Decentralized Oracles' },
    dogecoin: { category: 'Meme Currency', layer: 'Layer 1', consensus: 'Proof of Work' },
    litecoin: { category: 'Currency', layer: 'Layer 1', consensus: 'Proof of Work' },
    'shiba-inu': { category: 'Meme Token', layer: 'Layer 2 (ETH)', consensus: 'ERC-20' },
    cosmos: { category: 'Interoperability', layer: 'Layer 0', consensus: 'Tendermint BFT' },
    polkadot: { category: 'Interoperability', layer: 'Layer 0', consensus: 'Nominated Proof of Stake' },
    near: { category: 'Smart Contract Platform', layer: 'Layer 1', consensus: 'Nightshade Sharding' },
};

const fetchCryptoData = async () => {
    const pairs = await getActiveCryptoPairs();
    try {
        const response = await axios.get(`${BINANCE_BASE_URL}/api/v3/ticker/24hr`, {
            params: { symbols: JSON.stringify(pairs) },
            timeout: 5000,
        });

        return response.data.map((ticker) => {
            const meta = PAIR_META[ticker.symbol] || {
                id: ticker.symbol.toLowerCase(),
                symbol: ticker.symbol.replace('USDT', '').toLowerCase(),
                name: ticker.symbol.replace('USDT', ''),
            };

            const currentPrice   = Number(ticker.lastPrice);
            const change24h      = Number(ticker.priceChangePercent);
            const quoteVolume    = Number(ticker.quoteVolume);
            const high24h        = Number(ticker.highPrice);
            const low24h         = Number(ticker.lowPrice);
            const openPrice      = Number(ticker.openPrice);
            const prevClosePrice = Number(ticker.prevClosePrice);
            const tradeCount     = Number(ticker.count);
            const catMeta        = CRYPTO_CATEGORY[meta.id] || { category: 'Cryptocurrency', layer: 'Layer 1', consensus: 'N/A' };

            return {
                id: meta.id,
                symbol: meta.symbol,
                name: meta.name,
                current_price: Number.isFinite(currentPrice) ? currentPrice : 0,
                price_change_percentage_24h: Number.isFinite(change24h) ? change24h : 0,
                price_change_24h: Number(ticker.priceChange) || 0,
                market_cap: null,
                total_volume: Number.isFinite(quoteVolume) ? quoteVolume : 0,
                high_24h: Number.isFinite(high24h) ? high24h : 0,
                low_24h: Number.isFinite(low24h) ? low24h : 0,
                open: Number.isFinite(openPrice) ? openPrice : 0,
                prev_close: Number.isFinite(prevClosePrice) ? prevClosePrice : 0,
                trade_count: Number.isFinite(tradeCount) ? tradeCount : 0,
                image: null,
                category: catMeta.category,
                layer: catMeta.layer,
                consensus: catMeta.consensus,
                details: {
                    sector: catMeta.category,
                    market_cap: 'N/A',
                    about: `${meta.name} market data sourced from Binance.`,
                    volume: Number.isFinite(quoteVolume) ? `$${(quoteVolume / 1e6).toFixed(2)}M` : 'N/A',
                },
            };
        });
    } catch (error) {
        console.error('Binance crypto fetch failed, trying CoinMarketCap:', error.message);
        if (!process.env.COINMARKETCAP_API_KEY) return [];
        try {
            const shortSyms = pairs.map(p => p.replace('USDT', '')).slice(0, 10).join(',');
            const response = await axios.get(`${COINMARKETCAP_BASE_URL}/cryptocurrency/quotes/latest`, {
                params: { symbol: shortSyms, convert: 'USD' },
                timeout: 7000,
                headers: { 'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY },
            });

            const data = response.data?.data || {};
            return Object.values(data).map((row) => {
                const quote = row?.quote?.USD;
                if (!row || !quote) return null;
                const catMeta = CRYPTO_CATEGORY[String(row.slug || row.symbol).toLowerCase()] || { category: 'Cryptocurrency', layer: 'Layer 1', consensus: 'N/A' };
                return {
                    id: String(row.slug || row.symbol).toLowerCase(),
                    symbol: String(row.symbol).toLowerCase(),
                    name: row.name || row.symbol,
                    current_price: Number(quote.price) || 0,
                    price_change_percentage_24h: Number(quote.percent_change_24h) || 0,
                    price_change_24h: Number(quote.volume_change_24h) || 0,
                    market_cap: Number(quote.market_cap) || null,
                    total_volume: Number(quote.volume_24h) || 0,
                    high_24h: 0, low_24h: 0, open: 0, prev_close: 0, trade_count: 0,
                    image: null,
                    category: catMeta.category,
                    layer: catMeta.layer,
                    consensus: catMeta.consensus,
                    details: {
                        sector: catMeta.category,
                        market_cap: Number(quote.market_cap) > 0 ? `$${(Number(quote.market_cap) / 1e9).toFixed(2)}B` : 'N/A',
                        about: `${row.name || row.symbol} market data sourced from CoinMarketCap.`,
                        volume: Number(quote.volume_24h) > 0 ? `$${(Number(quote.volume_24h) / 1e6).toFixed(2)}M` : 'N/A',
                    },
                };
            }).filter(Boolean);
        } catch (cmcError) {
            console.error('CoinMarketCap crypto fetch failed:', cmcError.message);
            return [];
        }
    }
};

const fetchCryptoBySymbol = async (symbol) => {
    try {
        const pair = toBinancePair(symbol);
        const response = await axios.get(`${BINANCE_BASE_URL}/api/v3/ticker/24hr`, {
            params: { symbol: pair },
            timeout: 5000,
        });

        const ticker = response.data;
        const meta = PAIR_META[ticker.symbol] || {
            id: ticker.symbol.toLowerCase(),
            symbol: ticker.symbol.replace('USDT', '').toLowerCase(),
            name: ticker.symbol.replace('USDT', ''),
        };

        const catMeta = CRYPTO_CATEGORY[meta.id] || { category: 'Cryptocurrency', layer: 'Layer 1', consensus: 'N/A' };

        return {
            id: meta.id,
            symbol: meta.symbol,
            name: meta.name,
            current_price: Number(ticker.lastPrice) || 0,
            price_change_percentage_24h: Number(ticker.priceChangePercent) || 0,
            price_change_24h: Number(ticker.priceChange) || 0,
            total_volume: Number(ticker.quoteVolume) || 0,
            high_24h: Number(ticker.highPrice) || 0,
            low_24h: Number(ticker.lowPrice) || 0,
            open: Number(ticker.openPrice) || 0,
            prev_close: Number(ticker.prevClosePrice) || 0,
            trade_count: Number(ticker.count) || 0,
            category: catMeta.category,
            layer: catMeta.layer,
            consensus: catMeta.consensus,
        };
    } catch (error) {
        console.error(`Binance fetch for ${symbol} failed:`, error.message);
        return null;
    }
};

const fetchCryptoHistory = async (symbol, interval) => {
    try {
        const pair = toBinancePair(symbol);
        const timeConfig = toBinanceInterval(interval);
        const response = await axios.get(`${BINANCE_BASE_URL}/api/v3/klines`, {
            params: {
                symbol: pair,
                interval: timeConfig.interval,
                limit: timeConfig.limit,
            },
            timeout: 5000,
        });

        return response.data.map((candle) => ({
            date: new Date(candle[0]).toLocaleString(),
            timestamp: candle[0],
            open: Number(candle[1]),
            high: Number(candle[2]),
            low: Number(candle[3]),
            close: Number(candle[4]),
            volume: Number(candle[5]),
            price: Number(candle[4]), // Alias for backward compatibility
        }));
    } catch (error) {
        console.error('Binance crypto history fetch failed:', error.message);
        return [];
    }
};

const fetchOrderBook = async (symbol) => {
    try {
        const pair = toBinancePair(symbol);
        const response = await axios.get(`${BINANCE_BASE_URL}/api/v3/depth`, {
            params: { symbol: pair, limit: 10 },
            timeout: 5000,
        });

        return {
            bids: response.data.bids || [],
            asks: response.data.asks || [],
        };
    } catch (error) {
        console.error('Binance order book fetch failed:', error.message);
        return null;
    }
};

module.exports = { fetchCryptoData, fetchCryptoBySymbol, fetchCryptoHistory, fetchOrderBook };
