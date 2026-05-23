import api, { isUnauthorizedError } from './api';

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Fetch full fundamentals snapshot for a single symbol.
 * Backend serves from MongoDB (< 24h TTL) before hitting Yahoo Finance.
 * Returns the `data` field of the API response.
 */
export const fetchStockFundamentals = async (symbol) => {
    try {
        const clean = String(symbol || '').toUpperCase().replace(/\.(NS|BO)$/i, '');
        const response = await api.get(`/stocks/${encodeURIComponent(clean)}/fundamentals`);
        const payload = response.data?.data ?? response.data ?? {};
        return payload;
    } catch (error) {
        if (isUnauthorizedError(error)) return null;
        console.warn(`[fundamentalApi] Failed for ${symbol}:`, error.message);
        return null;
    }
};

export const fetchDiscoveryShelves = async () => {
    try {
        const response = await api.get('/fundamental/ideas');
        const payload = response.data?.data ?? response.data;

        if (!payload || typeof payload !== 'object') {
            return {
                stockOfTheWeek: null,
                topDividends: [],
                undervaluedGems: [],
            };
        }

        return {
            stockOfTheWeek: payload.stockOfTheWeek ?? null,
            topDividends: Array.isArray(payload.topDividends) ? payload.topDividends : [],
            undervaluedGems: Array.isArray(payload.undervaluedGems) ? payload.undervaluedGems : [],
            momentumLeaders: Array.isArray(payload.momentumLeaders) ? payload.momentumLeaders : [],
        };
    } catch (error) {
        console.error("Error fetching discovery shelves:", error);
        throw error;
    }
};

export const fetchMarketMood = async () => {
    try {
        const response = await api.get('/fundamental/mood');
        const payload = response.data?.data ?? response.data ?? {};
        return {
            score: toNumber(payload.score ?? payload.value, 50),
            status: payload.status || 'Neutral',
            previousClose: toNumber(payload.previousClose, 0),
            oneWeekAgo: toNumber(payload.oneWeekAgo, 0),
        };
    } catch (error) {
        console.error("Error fetching market mood:", error);
        throw error;
    }
};

export const fetchValuation = async () => {
    try {
        const response = await api.get('/fundamental/valuation');
        const payload = response.data?.data ?? response.data;

        if (Array.isArray(payload) && payload.length > 0) {
            const peValues = payload
                .map((item) => toNumber(item.currentPE ?? item.peRatio ?? item.pe_ratio, NaN))
                .filter((value) => Number.isFinite(value));
            const pbValues = payload
                .map((item) => toNumber(item.currentPB ?? item.pbRatio ?? item.pb_ratio, NaN))
                .filter((value) => Number.isFinite(value));

            const avgPe = peValues.length
                ? peValues.reduce((sum, value) => sum + value, 0) / peValues.length
                : 0;
            const avgPb = pbValues.length
                ? pbValues.reduce((sum, value) => sum + value, 0) / pbValues.length
                : 0;

            return {
                peRatio: toNumber(peValues[0], avgPe),
                pbRatio: toNumber(pbValues[0], avgPb),
                avgPe: toNumber(avgPe, 0),
                avgPb: toNumber(avgPb, 0),
            };
        }

        return {
            peRatio: toNumber(payload?.peRatio ?? payload?.pe_ratio, 0),
            pbRatio: toNumber(payload?.pbRatio ?? payload?.pb_ratio, 0),
            avgPe: toNumber(payload?.avgPe, 0),
            avgPb: toNumber(payload?.avgPb, 0),
        };
    } catch (error) {
        if (isUnauthorizedError(error)) {
            return { peRatio: 20.1, pbRatio: 3.5, avgPe: 20.1, avgPb: 3.5 };
        }

        console.error("Error fetching valuation:", error);
        throw error;
    }
};
