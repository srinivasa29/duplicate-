const yahooFinanceService = require('./yahooFinanceService');
const ohlcService = require('./ohlcService');
const logger = require('../config/logger');



// ── Nifty 50 (all current constituents) ──────────────────────────────────
const NIFTY_50_SYMBOLS = [
    'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
    'HINDUNILVR.NS', 'ITC.NS', 'SBIN.NS', 'BHARTIARTL.NS', 'KOTAKBANK.NS',
    'LT.NS', 'AXISBANK.NS', 'ASIANPAINT.NS', 'MARUTI.NS', 'HCLTECH.NS',
    'BAJFINANCE.NS', 'WIPRO.NS', 'ULTRACEMCO.NS', 'TITAN.NS', 'NESTLEIND.NS',
    'SUNPHARMA.NS', 'TECHM.NS', 'ONGC.NS', 'NTPC.NS', 'POWERGRID.NS',
    'M&M.NS', 'TATASTEEL.NS', 'ADANIPORTS.NS', 'BAJAJFINSV.NS', 'JSWSTEEL.NS',
    'INDUSINDBK.NS', 'TATAMOTORS.NS', 'HINDALCO.NS', 'DIVISLAB.NS', 'COALINDIA.NS',
    'DRREDDY.NS', 'EICHERMOT.NS', 'CIPLA.NS', 'GRASIM.NS', 'BRITANNIA.NS',
    'HEROMOTOCO.NS', 'SHREECEM.NS', 'APOLLOHOSP.NS', 'UPL.NS', 'BPCL.NS',
    'TATACONSUM.NS', 'SBILIFE.NS', 'ADANIENT.NS', 'HDFCLIFE.NS', 'BAJAJ-AUTO.NS',
];

// ── Nifty Next 50 ────────────────────────────────────────────────────────
const NIFTY_NEXT_50_SYMBOLS = [
    'ABB.NS', 'ADANIGREEN.NS', 'ADANITRANS.NS', 'AMBUJACEM.NS', 'AUROPHARMA.NS',
    'BAJAJHLDNG.NS', 'BANKBARODA.NS', 'BEL.NS', 'BERGEPAINT.NS', 'BOSCHLTD.NS',
    'CANBK.NS', 'CHOLAFIN.NS', 'COLPAL.NS', 'DABUR.NS', 'DMART.NS',
    'DLF.NS', 'GAIL.NS', 'GODREJCP.NS', 'GODREJPROP.NS', 'HAVELLS.NS',
    'ICICIGI.NS', 'ICICIPRULI.NS', 'INDHOTEL.NS', 'IOC.NS', 'IRCTC.NS',
    'JINDALSTEL.NS', 'LICI.NS', 'LUPIN.NS', 'MANKIND.NS', 'MARICO.NS',
    'MOTHERSON.NS', 'MUTHOOTFIN.NS', 'NAUKRI.NS', 'OBEROIRLTY.NS', 'OFSS.NS',
    'PAGEIND.NS', 'PATANJALI.NS', 'PEL.NS', 'PERSISTENT.NS', 'PETRONET.NS',
    'PFC.NS', 'PIDILITIND.NS', 'PIIND.NS', 'PNB.NS', 'RECLTD.NS',
    'SAIL.NS', 'SIEMENS.NS', 'TORNTPHARM.NS', 'TRENT.NS', 'VEDL.NS',
];

// ── Nifty Midcap 100 — top picks ────────────────────────────────────────
const NIFTY_MIDCAP_SYMBOLS = [
    'ABCAPITAL.NS', 'ABFRL.NS', 'ALKEM.NS', 'APLLTD.NS', 'ASTRAL.NS',
    'ATUL.NS', 'AUBANK.NS', 'AWHCL.NS', 'BANDHANBNK.NS', 'BSOFT.NS',
    'CAMS.NS', 'CANFINHOME.NS', 'CASTROLIND.NS', 'CEATLTD.NS', 'CESC.NS',
    'COFORGE.NS', 'CONCOR.NS', 'CROMPTON.NS', 'CUB.NS', 'DEEPAKFERT.NS',
    'DIXON.NS', 'EMAMILTD.NS', 'ESCORTS.NS', 'FEDERALBNK.NS', 'FINOLEXIND.NS',
    'GLENMARK.NS', 'GMRINFRA.NS', 'GRINDWELL.NS', 'HAL.NS', 'HONAUT.NS',
    'IDBI.NS', 'IDFC.NS', 'IDFCFIRSTB.NS', 'IGL.NS', 'INDIANB.NS',
    'INDIGO.NS', 'IPCA.NS', 'JKCEMENT.NS', 'JUBLPHARMA.NS', 'KAJARIACER.NS',
    'KANSAINER.NS', 'KEI.NS', 'KPITTECH.NS', 'LALPATHLAB.NS', 'LAURUSLABS.NS',
    'LTTS.NS', 'MFSL.NS', 'MINDTREE.NS', 'MRF.NS', 'MUTHOOTFIN.NS',
];

// ── Extra Sectoral / Thematic picks ────────────────────────────────────
const SECTORAL_SYMBOLS = [
    // IT & Tech
    'COFORGE.NS', 'MPHASIS.NS', 'HEXAWARE.NS', 'NIITTECH.NS', 'ZENSARTECH.NS',
    'RATEGAIN.NS', 'MASTEK.NS', 'TATAELXSI.NS', 'KFINTECH.NS', 'ANGELONE.NS',
    // Banking & Finance
    'RBLBANK.NS', 'KARURVYSYA.NS', 'SOUTHBANK.NS', 'DCBBANK.NS', 'LAKSHVILAS.NS',
    'CHOLAFIN.NS', 'BAJAJHFL.NS', 'AAVAS.NS', 'HOMEFIRST.NS', 'CREDITACC.NS',
    // Pharma & Healthcare
    'ALEMBICLTD.NS', 'NATCOPHARM.NS', 'GRANULES.NS', 'AJANTPHARM.NS', 'JBCHEPHARM.NS',
    'FORTIS.NS', 'NARAYANHRUL.NS', 'MAXHEALTH.NS', 'METROPOLIS.NS', 'THYROCARE.NS',
    // Auto & EV
    'TVSMOTOR.NS', 'BAJAJHIND.NS', 'ASHOKLEY.NS', 'ESCORTS.NS', 'BHEL.NS',
    'OLECTRA.NS', 'GREENPANEL.NS', 'CRAFTSMAN.NS', 'TIINDIA.NS', 'SWARAJENG.NS',
    // Consumer & FMCG
    'VBL.NS', 'RADICO.NS', 'UNITDSPR.NS', 'TASTY.NS', 'HONASA.NS',
    'SAPPHIRE.NS', 'MANYAVAR.NS', 'ZOMATO.NS', 'NYKAA.NS', 'CAMPUS.NS',
    // Infra & Real Estate
    'PRESTIGE.NS', 'SOBHA.NS', 'BRIGADE.NS', 'MAHLIFE.NS', 'LODHA.NS',
    'NBCC.NS', 'IRCON.NS', 'RITES.NS', 'KEC.NS', 'KALPATPOWR.NS',
    // Energy & Power
    'TORNTPOWER.NS', 'TATAPOWER.NS', 'CESC.NS', 'JSWENERGY.NS', 'ADANIPOWER.NS',
    'NHPC.NS', 'SJVN.NS', 'IREDA.NS', 'RPOWER.NS', 'INDIAGRID.NS',
    // PSUs
    'RVNL.NS', 'IRFC.NS', 'HUDCO.NS', 'RAILTEL.NS', 'MAZAGON.NS',
    'COCHINSHIP.NS', 'GRSE.NS', 'BDL.NS', 'BEML.NS', 'MIDHANI.NS',
];

const SENSEX_30_SYMBOLS = [
    'RELIANCE.BO', 'TCS.BO', 'HDFCBANK.BO', 'INFY.BO', 'ICICIBANK.BO',
    'HINDUNILVR.BO', 'ITC.BO', 'SBIN.BO', 'BHARTIARTL.BO', 'KOTAKBANK.BO',
    'LT.BO', 'AXISBANK.BO', 'ASIANPAINT.BO', 'MARUTI.BO', 'HCLTECH.BO',
    'BAJFINANCE.BO', 'WIPRO.BO', 'ULTRACEMCO.BO', 'TITAN.BO', 'NESTLEIND.BO',
    'SUNPHARMA.BO', 'TECHM.BO', 'M&M.BO', 'TATASTEEL.BO', 'NTPC.BO',
    'POWERGRID.BO', 'INDUSINDBK.BO', 'TATAMOTORS.BO', 'DRREDDY.BO', 'BAJAJFINSV.BO',
];

// ── NSE Indices ───────────────────────────────────────────────────────────
// Note: Yahoo Finance uses different symbols than the NSE display names
const NSE_INDEX_SYMBOLS = [
    '^NSEI',                  // NIFTY 50
    '^NSEBANK',               // BANKNIFTY
    'NIFTY_FIN_SERVICE.NS',   // FINNIFTY (Yahoo Finance format)
    '^NSEMDCP50',             // MIDCPNIFTY
    '^BSESN',                 // SENSEX
    '^INDIAVIX',              // India VIX
];

// ── Top Crypto — must use Yahoo Finance -USD format ────────────────────
const CRYPTO_SYMBOLS = [
    'BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD', 'XRP-USD',
];

// All NSE equity symbols combined (deduped)
const ALL_NSE_SYMBOLS = [
    ...new Set([
        ...NIFTY_50_SYMBOLS,
        ...NIFTY_NEXT_50_SYMBOLS,
        ...NIFTY_MIDCAP_SYMBOLS,
        ...SECTORAL_SYMBOLS,
    ])
];

class HistoricalDataBackfillService {
    
    async backfillSymbol(symbol, exchange = 'NSE', timeframe = '1d', range = '1y') {
        try {
            logger.info(`ðŸ”„ Starting backfill for ${symbol} (${timeframe}, ${range})`);

            const hasExisting = await this.checkExistingData(symbol, exchange, timeframe);
            if (hasExisting) {
                logger.info(`â­ï¸ Skipping ${symbol} - data already exists`);
                return {
                    success: true,
                    skipped: true,
                    message: 'Data already exists',
                };
            }

            const result = await yahooFinanceService.fetchHistoricalData(
                symbol,
                timeframe,
                range
            );

            if (!result.success || result.data.length === 0) {
                logger.warn(`âŒ No data fetched for ${symbol}`);
                return {
                    success: false,
                    message: result.message || 'No data available',
                };
            }

            const enrichedData = result.data.map(candle => ({
                ...candle,
                symbol: symbol.replace('.NS', '').replace('.BO', ''), // Remove suffix
                exchange,
                timeframe,
                source: 'yahoo',
            }));

            const insertResult = await ohlcService.bulkInsertOHLC(enrichedData);

            if (insertResult.success) {
                logger.info(`âœ… Backfilled ${insertResult.count} records for ${symbol}`);
                return {
                    success: true,
                    count: insertResult.count,
                    symbol,
                };
            } else {
                logger.error(`âŒ Failed to store data for ${symbol}`);
                return {
                    success: false,
                    message: insertResult.message,
                };
            }
        } catch (error) {
            logger.error(`Error backfilling ${symbol}: ${error.message}`);
            return {
                success: false,
                message: error.message,
            };
        }
    }

    
    async checkExistingData(symbol, exchange, timeframe) {
        try {
            const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '');
            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1); // Check last month

            return await ohlcService.hasData(
                cleanSymbol,
                exchange,
                timeframe,
                startDate,
                endDate
            );
        } catch (error) {
            return false;
        }
    }

    
    async backfillNifty50(timeframe = '1d', range = '1y') {
        logger.info(`ðŸš€ Starting Nifty 50 backfill (${timeframe}, ${range})`);

        const results = {
            success: [],
            failed: [],
            skipped: [],
            total: NIFTY_50_SYMBOLS.length,
        };

        for (let i = 0; i < NIFTY_50_SYMBOLS.length; i++) {
            const symbol = NIFTY_50_SYMBOLS[i];
            logger.info(`[${i + 1}/${NIFTY_50_SYMBOLS.length}] Processing ${symbol}`);

            const result = await this.backfillSymbol(symbol, 'NSE', timeframe, range);

            if (result.skipped) {
                results.skipped.push(symbol);
            } else if (result.success) {
                results.success.push({
                    symbol,
                    count: result.count,
                });
            } else {
                results.failed.push({
                    symbol,
                    reason: result.message,
                });
            }

            await new Promise(resolve => setTimeout(resolve, 300));
        }

        logger.info(`âœ… Nifty 50 backfill complete: ${results.success.length} success, ${results.failed.length} failed, ${results.skipped.length} skipped`);

        return results;
    }

    
    async backfillSensex30(timeframe = '1d', range = '1y') {
        logger.info(`ðŸš€ Starting Sensex 30 backfill (${timeframe}, ${range})`);

        const results = {
            success: [],
            failed: [],
            skipped: [],
            total: SENSEX_30_SYMBOLS.length,
        };

        for (let i = 0; i < SENSEX_30_SYMBOLS.length; i++) {
            const symbol = SENSEX_30_SYMBOLS[i];
            logger.info(`[${i + 1}/${SENSEX_30_SYMBOLS.length}] Processing ${symbol}`);

            const result = await this.backfillSymbol(symbol, 'BSE', timeframe, range);

            if (result.skipped) {
                results.skipped.push(symbol);
            } else if (result.success) {
                results.success.push({
                    symbol,
                    count: result.count,
                });
            } else {
                results.failed.push({
                    symbol,
                    reason: result.message,
                });
            }

            await new Promise(resolve => setTimeout(resolve, 300));
        }

        logger.info(`âœ… Sensex 30 backfill complete: ${results.success.length} success, ${results.failed.length} failed, ${results.skipped.length} skipped`);

        return results;
    }

    
    async backfillNiftyNext50(timeframe = '1d', range = '1y') {
        logger.info('🚀 Starting Nifty Next 50 backfill');
        return this._backfillList(NIFTY_NEXT_50_SYMBOLS, 'NSE', timeframe, range, 'Nifty Next 50');
    }

    async backfillMidcap(timeframe = '1d', range = '1y') {
        logger.info('🚀 Starting Nifty Midcap backfill');
        return this._backfillList(NIFTY_MIDCAP_SYMBOLS, 'NSE', timeframe, range, 'Midcap 100');
    }

    async backfillSectoral(timeframe = '1d', range = '1y') {
        logger.info('🚀 Starting Sectoral stocks backfill');
        return this._backfillList(SECTORAL_SYMBOLS, 'NSE', timeframe, range, 'Sectoral');
    }

    /**
     * Backfill the full NSE universe (~200 symbols).
     * Runs batches of 10 concurrently with 500ms between batches to respect rate limits.
     */
    async backfillFullUniverse(timeframe = '1d', range = '1y') {
        logger.info(`🚀 Starting FULL NSE universe backfill — ${ALL_NSE_SYMBOLS.length} symbols`);
        const BATCH_SIZE = 10;
        const results = { success: [], failed: [], skipped: [], total: ALL_NSE_SYMBOLS.length };

        for (let i = 0; i < ALL_NSE_SYMBOLS.length; i += BATCH_SIZE) {
            const batch = ALL_NSE_SYMBOLS.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.allSettled(
                batch.map(sym => this.backfillSymbol(sym, 'NSE', timeframe, range))
            );
            batchResults.forEach((r, idx) => {
                const sym = batch[idx];
                if (r.status === 'rejected') { results.failed.push({ symbol: sym, reason: r.reason?.message }); }
                else if (r.value?.skipped) { results.skipped.push(sym); }
                else if (r.value?.success) { results.success.push({ symbol: sym, count: r.value.count }); }
                else { results.failed.push({ symbol: sym, reason: r.value?.message }); }
            });
            logger.info(`  Batch ${Math.floor(i/BATCH_SIZE)+1}: ${results.success.length} ok, ${results.failed.length} fail, ${results.skipped.length} skip`);
            if (i + BATCH_SIZE < ALL_NSE_SYMBOLS.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        logger.info(`✅ Full universe backfill done — success:${results.success.length} fail:${results.failed.length} skip:${results.skipped.length}`);
        return results;
    }

    /** Internal helper used by all index-specific backfill methods */
    async _backfillList(symbolList, exchange, timeframe, range, label) {
        const results = { success: [], failed: [], skipped: [], total: symbolList.length };
        for (let i = 0; i < symbolList.length; i++) {
            const symbol = symbolList[i];
            logger.info(`[${label}] [${i + 1}/${symbolList.length}] Processing ${symbol}`);
            const result = await this.backfillSymbol(symbol, exchange, timeframe, range);
            if (result.skipped) results.skipped.push(symbol);
            else if (result.success) results.success.push({ symbol, count: result.count });
            else results.failed.push({ symbol, reason: result.message });
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        logger.info(`✅ ${label} backfill: ${results.success.length} ok, ${results.failed.length} fail, ${results.skipped.length} skip`);
        return results;
    }

    async backfillIndices(timeframe = '1d', range = '2y') {
        logger.info('🚀 Starting NSE Index backfill');
        return this._backfillList(NSE_INDEX_SYMBOLS, 'NSE', timeframe, range, 'NSE Indices');
    }

    async backfillCrypto(timeframe = '1d', range = '1y') {
        logger.info('🚀 Starting Crypto backfill');
        return this._backfillList(CRYPTO_SYMBOLS, 'CRYPTO', timeframe, range, 'Crypto');
    }

    getNifty50Symbols() { return NIFTY_50_SYMBOLS; }
    getNiftyNext50Symbols() { return NIFTY_NEXT_50_SYMBOLS; }
    getMidcapSymbols() { return NIFTY_MIDCAP_SYMBOLS; }
    getSectoralSymbols() { return SECTORAL_SYMBOLS; }
    getAllNseSymbols() { return ALL_NSE_SYMBOLS; }
    getSensex30Symbols() { return SENSEX_30_SYMBOLS; }
    getIndexSymbols() { return NSE_INDEX_SYMBOLS; }
    getCryptoSymbols() { return CRYPTO_SYMBOLS; }

    /** Master runner — seeds ALL data types into MongoDB */
    async backfillTopIndianStocks(timeframe = '1d', range = '1y') {
        const nifty50   = await this.backfillNifty50(timeframe, range);
        const indices   = await this.backfillIndices(timeframe, '2y');
        const crypto    = await this.backfillCrypto(timeframe, range);

        const totalSuccess = nifty50.success.length + indices.success.length + crypto.success.length;
        const totalFailed  = nifty50.failed.length  + indices.failed.length  + crypto.failed.length;
        const totalSkipped = nifty50.skipped.length + indices.skipped.length + crypto.skipped.length;

        return { nifty50, indices, crypto, totalSuccess, totalFailed, totalSkipped };
    }
}

module.exports = new HistoricalDataBackfillService();
