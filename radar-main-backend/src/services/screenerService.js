const { fetchStockData } = require('./stockService');
const { getTechnicalIndicators, getTechnicalIndicatorsFromOHLC } = require('./indicatorService');
const { getInstrumentScore } = require('./scoringService');

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

const PRESETS = {
    momentum: {
        filters: { minChange: 0.8, minRsi: 55, minScore: 55 },
        sortBy: 'change',
        sortOrder: 'desc',
    },
    value: {
        filters: { maxPe: 22, minPrice: 50 },
        sortBy: 'pe',
        sortOrder: 'asc',
    },
    breakout: {
        filters: { minRsi: 60, minScore: 65, minChange: 0.5 },
        sortBy: 'score',
        sortOrder: 'desc',
    },
};

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase();
const stripStockSuffix = (value) => normalizeSymbol(value).replace(/\.(NS|BO)$/i, '');

const toNumber = (value, fallback = NaN) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const isFiniteNumber = (value) => Number.isFinite(Number(value));

// Returns true if the value is within [min, max].
// If NEITHER bound is specified, the check is skipped entirely (pass-through),
// so rows with NaN field values are still included in unfiltered results.
const inRange = (value, min, max) => {
    const hasMin = isFiniteNumber(min);
    const hasMax = isFiniteNumber(max);
    // No constraint at all — always pass
    if (!hasMin && !hasMax) return true;
    // Value must be finite when a bound IS specified
    if (!isFiniteNumber(value)) return false;
    if (hasMin && Number(value) < Number(min)) return false;
    if (hasMax && Number(value) > Number(max)) return false;
    return true;
};

const needsTechnicalData = (filters, sortBy) => {
    const technicalKeys = ['minRsi', 'maxRsi', 'minScore', 'maxScore', 'volumeStatus'];
    if (technicalKeys.some((key) => filters[key] !== undefined && filters[key] !== null && filters[key] !== '')) {
        return true;
    }
    return ['rsi', 'score'].includes(String(sortBy || '').toLowerCase());
};

const applyBaseFilters = (rows, filters) => rows.filter((row) => {
    if (!inRange(row.price, filters.minPrice, filters.maxPrice)) return false;
    if (!inRange(row.change, filters.minChange, filters.maxChange)) return false;
    if (!inRange(row.pe, filters.minPe, filters.maxPe)) return false;
    if (!inRange(row.marketCapNumeric, filters.minMarketCap, filters.maxMarketCap)) return false;

    if (Array.isArray(filters.sectors) && filters.sectors.length > 0) {
        const normalizedSectors = filters.sectors.map((sector) => String(sector || '').toLowerCase());
        if (!normalizedSectors.includes(String(row.sector || '').toLowerCase())) {
            return false;
        }
    }

    if (Array.isArray(filters.symbols) && filters.symbols.length > 0) {
        const normalizedSymbols = filters.symbols.map((symbol) => stripStockSuffix(symbol));
        if (!normalizedSymbols.includes(stripStockSuffix(row.symbol))) {
            return false;
        }
    }

    return true;
});

const applyTechnicalFilters = (rows, filters) => rows.filter((row) => {
    if (filters.minRsi !== undefined || filters.maxRsi !== undefined) {
        if (!inRange(row.rsi, filters.minRsi, filters.maxRsi)) return false;
    }
    if (filters.minScore !== undefined || filters.maxScore !== undefined) {
        if (!inRange(row.score, filters.minScore, filters.maxScore)) return false;
    }
    if (filters.volumeStatus) {
        const status = String(filters.volumeStatus).toLowerCase();
        if (String(row.volumeStatus || '').toLowerCase() !== status) return false;
    }
    return true;
});

const parseMarketCap = (value) => {
    if (!value) return NaN;
    const text = String(value).toUpperCase().replace(/[$,\s]/g, '');
    const multiplier = text.endsWith('T') ? 1_000_000_000_000
        : text.endsWith('B') ? 1_000_000_000
            : text.endsWith('M') ? 1_000_000
                : 1;
    const numeric = Number.parseFloat(text.replace(/[TBM]$/, ''));
    return Number.isFinite(numeric) ? numeric * multiplier : NaN;
};

const sortRows = (rows, sortBy, sortOrder) => {
    const field = String(sortBy || 'change').toLowerCase();
    const direction = String(sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;

    const accessor = (row) => {
        switch (field) {
            case 'price':
                return row.price;
            case 'rsi':
                return row.rsi;
            case 'score':
                return row.score;
            case 'pe':
                return row.pe;
            case 'marketcap':
            case 'market_cap':
                return row.marketCapNumeric;
            case 'symbol':
                return row.displaySymbol;
            case 'change':
            default:
                return row.change;
        }
    };

    return [...rows].sort((a, b) => {
        const left = accessor(a);
        const right = accessor(b);

        if (typeof left === 'string' || typeof right === 'string') {
            return direction * String(left || '').localeCompare(String(right || ''));
        }
        const safeLeft = Number.isFinite(Number(left)) ? Number(left) : -Infinity;
        const safeRight = Number.isFinite(Number(right)) ? Number(right) : -Infinity;
        return direction * (safeLeft - safeRight);
    });
};

const attachTechnicals = async (rows, strictLive) => {
    return Promise.all(rows.map(async (row) => {
        try {
            // Prefer OHLC database for stock screeners (fast, reliable)
            // Only use live API if strictLive flag is set or OHLC has insufficient data
            let indicators;
            let source = 'api';

            if (!strictLive) {
                try {
                    const ohlcIndicators = await getTechnicalIndicatorsFromOHLC(
                        row.symbol,
                        'NSE',
                        '1d',
                        365
                    );
                    if (ohlcIndicators.status === 'success' && ohlcIndicators.dataPoints >= 26) {
                        indicators = ohlcIndicators;
                        source = 'ohlc_db';
                    } else {
                        // Fall back to live API
                        indicators = await getTechnicalIndicators('stock', row.symbol, '1D', { strictLive: false });
                    }
                } catch (_err) {
                    // Fall back to live API on OHLC error
                    indicators = await getTechnicalIndicators('stock', row.symbol, '1D', { strictLive: false });
                }
            } else {
                // Use live API only when explicitly requested
                indicators = await getTechnicalIndicators('stock', row.symbol, '1D', { strictLive: true });
            }

            const score = await getInstrumentScore('stock', row.symbol, { strictLive });

            return {
                ...row,
                rsi: toNumber(indicators?.rsi, NaN),
                volumeStatus: indicators?.volumeStatus || null,
                score: toNumber(score?.score, NaN),
                bias: score?.bias || 'neutral',
                technicalLive: source === 'api',
                technicalSource: source,
            };
        } catch (_error) {
            return {
                ...row,
                rsi: NaN,
                volumeStatus: null,
                score: NaN,
                bias: 'neutral',
                technicalLive: false,
                technicalSource: 'error',
            };
        }
    }));
};

const buildRow = (stock) => ({
    symbol: normalizeSymbol(stock.symbol),
    displaySymbol: stripStockSuffix(stock.symbol),
    name: stock.name || stock.symbol,
    type: stock.type || 'STOCK',
    price: toNumber(stock.price, NaN),
    change: toNumber(stock.change, NaN),
    sector: stock.details?.sector || 'Unknown',
    pe: toNumber(stock.details?.pe_ratio, NaN),
    marketCap: stock.details?.market_cap || null,
    marketCapNumeric: parseMarketCap(stock.details?.market_cap),
    volumeStatus: null,
    rsi: NaN,
    score: NaN,
    bias: 'neutral',
    technicalLive: false,
    technicalSource: 'pending',
});

const runScreener = async (payload = {}) => {
    const presetName = String(payload.preset || '').trim().toLowerCase();
    const preset = PRESETS[presetName] || {};

    const filters = {
        ...(preset.filters || {}),
        ...((payload.filters && typeof payload.filters === 'object') ? payload.filters : {}),
    };

    const sortBy = payload.sortBy || preset.sortBy || 'change';
    const sortOrder = payload.sortOrder || preset.sortOrder || 'desc';
    const limit = Math.max(1, Math.min(MAX_LIMIT, Number(payload.limit || DEFAULT_LIMIT)));
    const strictLive = payload.strictLive === true;

    const stocks = await fetchStockData();
    const baseRows = (Array.isArray(stocks) ? stocks : []).map(buildRow);

    const filteredBase = applyBaseFilters(baseRows, filters);
    const enrichedRows = needsTechnicalData(filters, sortBy)
        ? await attachTechnicals(filteredBase, strictLive)
        : filteredBase;

    const filteredRows = applyTechnicalFilters(enrichedRows, filters);
    const sorted = sortRows(filteredRows, sortBy, sortOrder);
    const results = sorted.slice(0, limit).map((row) => ({
        symbol: row.symbol,
        displaySymbol: row.displaySymbol,
        name: row.name,
        price: Number.isFinite(row.price) ? Number(row.price.toFixed(2)) : 0,
        change: Number.isFinite(row.change) ? Number(row.change.toFixed(2)) : 0,
        sector: row.sector !== 'Unknown' ? row.sector : (row.details?.sector || 'Equity'),
        pe: Number.isFinite(row.pe) ? Number(row.pe.toFixed(2)) : null,
        marketCap: row.marketCap,
        marketCapNumeric: row.marketCapNumeric,
        rsi: Number.isFinite(row.rsi) ? Number(row.rsi.toFixed(2)) : null,
        score: Number.isFinite(row.score) ? Number(row.score.toFixed(0)) : 75,
        bias: row.bias,
        volumeStatus: row.volumeStatus,
        technicalLive: row.technicalLive,
        technicalSource: row.technicalSource,
        // Helpful for frontend display
        signal: row.bias === 'bullish' ? 'BULLISH' : row.bias === 'bearish' ? 'BEARISH' : 'NEUTRAL',
        why: row.bias === 'bullish'
            ? 'Bullish momentum detected based on technical scoring.'
            : row.bias === 'bearish'
                ? 'Bearish pressure detected. Risk elevated above benchmark.'
                : 'Stock matched screener criteria. No directional signal.',
        tags: [row.sector || 'Equity', row.bias || 'neutral'].filter(Boolean),
        confidence: Number.isFinite(row.score) ? Math.min(99, Math.max(50, row.score)) : 75,
    }));

    return {
        preset: presetName || null,
        totalUniverse: baseRows.length,
        matched: filteredRows.length,
        returned: results.length,
        strictLive,
        sortBy,
        sortOrder: String(sortOrder || 'desc').toLowerCase(),
        results,
    };
};

module.exports = { runScreener };
