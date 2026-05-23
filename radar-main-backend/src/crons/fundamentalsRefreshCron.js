/**
 * fundamentalsRefreshCron.js
 *
 * Nightly cron that refreshes fundamental data for all equity symbols
 * into MongoDB so the frontend can serve them from the DB without
 * hitting Yahoo Finance per-request.
 *
 * Schedule: 10:00 PM IST every weekday (after NSE close + 30 min buffer)
 *           which is 16:30 UTC.
 *
 * Fallback run: also runs once on server startup if DB has < 50 symbols.
 */

const cron   = require('node-cron');
const logger = require('../config/logger');
const { getFundamentals } = require('../services/fundamentalsEnrichmentService');
const FundamentalsSnapshot = require('../models/FundamentalsSnapshot');

// All equity symbols that we backfilled OHLC for (Nifty 50 + Next 50 + Midcap)
const EQUITY_UNIVERSE = [
    // Nifty 50
    'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','HINDUNILVR','ITC','SBIN','BHARTIARTL','KOTAKBANK',
    'LT','AXISBANK','ASIANPAINT','MARUTI','HCLTECH','BAJFINANCE','WIPRO','ULTRACEMCO','TITAN','NESTLEIND',
    'SUNPHARMA','TECHM','ONGC','NTPC','POWERGRID','M&M','TATASTEEL','ADANIPORTS','BAJAJFINSV','JSWSTEEL',
    'INDUSINDBK','TATAMOTORS','HINDALCO','DIVISLAB','COALINDIA','DRREDDY','EICHERMOT','CIPLA','GRASIM','BRITANNIA',
    'HEROMOTOCO','SHREECEM','APOLLOHOSP','UPL','BPCL','TATACONSUM','SBILIFE','ADANIENT','HDFCLIFE','BAJAJ-AUTO',
    // Nifty Next 50
    'ABB','ADANIGREEN','AMBUJACEM','AUROPHARMA','BANKBARODA','BEL','BERGEPAINT','BOSCHLTD',
    'CANBK','CHOLAFIN','COLPAL','DABUR','DMART','DLF','GAIL','GODREJCP','GODREJPROP','HAVELLS',
    'ICICIGI','ICICIPRULI','INDHOTEL','IOC','IRCTC','JINDALSTEL','LICI','LUPIN','MANKIND','MARICO',
    'MOTHERSON','MUTHOOTFIN','NAUKRI','OBEROIRLTY','OFSS','PAGEIND','PERSISTENT','PETRONET',
    'PFC','PIDILITIND','PNB','RECLTD','SAIL','SIEMENS','TORNTPHARM','TRENT','VEDL',
    // Nifty Midcap highlights
    'AUBANK','BANDHANBNK','COFORGE','DIXON','ESCORTS','FEDERALBNK','HAL','IDFCFIRSTB',
    'INDIGO','KPITTECH','LAURUSLABS','MRF','TATAELXSI','TVSMOTOR','ZOMATO','NYKAA',
    'ZENSARTECH','ANGELONE','TATAPOWER','ADANIPOWER','RVNL','IRFC','RAILTEL',
];

const BATCH_SIZE = 5;
const DELAY_MS   = 800; // Respect Yahoo rate limits

async function refreshAll(label = 'cron') {
    logger.info(`[FundCron][${label}] Starting fundamentals refresh for ${EQUITY_UNIVERSE.length} symbols`);
    let success = 0, failed = 0;
    const startMs = Date.now();

    for (let i = 0; i < EQUITY_UNIVERSE.length; i += BATCH_SIZE) {
        const batch = EQUITY_UNIVERSE.slice(i, i + BATCH_SIZE);

        await Promise.allSettled(
            batch.map(async (sym) => {
                try {
                    await getFundamentals(sym, 0, { forceRefresh: true });
                    success++;
                } catch (err) {
                    logger.warn(`[FundCron] Failed ${sym}: ${err.message}`);
                    failed++;
                }
            })
        );

        const pct = Math.round(((i + batch.length) / EQUITY_UNIVERSE.length) * 100);
        logger.info(`[FundCron] Progress: ${pct}% (${i + batch.length}/${EQUITY_UNIVERSE.length}) — ✅ ${success} ❌ ${failed}`);

        if (i + BATCH_SIZE < EQUITY_UNIVERSE.length) {
            await new Promise((r) => setTimeout(r, DELAY_MS));
        }
    }

    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    logger.info(`[FundCron][${label}] Done in ${elapsed}s — ✅ ${success} succeeded, ❌ ${failed} failed`);
    return { success, failed };
}

async function startFundamentalsRefreshCron() {
    // ── Startup warm-up: if DB has < 50 snapshots, seed immediately ───────
    try {
        const count = await FundamentalsSnapshot.countDocuments();
        if (count < 50) {
            logger.info(`[FundCron] DB has only ${count} snapshots — running warm-up seed now`);
            refreshAll('startup').catch((e) => logger.error('[FundCron] Startup seed failed:', e.message));
        } else {
            logger.info(`[FundCron] DB already has ${count} fundamentals snapshots — skipping startup seed`);
        }
    } catch (err) {
        logger.warn(`[FundCron] Startup check failed: ${err.message}`);
    }

    // ── Nightly at 22:00 IST (16:30 UTC) every weekday ───────────────────
    // Cron format: minute hour day month weekday
    cron.schedule('30 16 * * 1-5', () => {
        logger.info('[FundCron] Nightly refresh triggered (22:00 IST)');
        refreshAll('nightly').catch((e) => logger.error('[FundCron] Nightly refresh failed:', e.message));
    }, { timezone: 'UTC' });

    // ── Mid-day refresh at 12:00 IST (06:30 UTC) for intraday updates ─────
    cron.schedule('30 6 * * 1-5', () => {
        logger.info('[FundCron] Mid-day refresh triggered (12:00 IST)');
        refreshAll('midday').catch((e) => logger.error('[FundCron] Mid-day refresh failed:', e.message));
    }, { timezone: 'UTC' });

    logger.info('[FundCron] Scheduled: nightly 22:00 IST + mid-day 12:00 IST (weekdays only)');
}

module.exports = { startFundamentalsRefreshCron, refreshAll };
