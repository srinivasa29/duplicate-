require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const FundSnap = require('../models/FundamentalsSnapshot');
  const OHLC     = require('../models/OHLC');

  const fundCount = await FundSnap.countDocuments();
  const ohlcCount = await OHLC.countDocuments();
  const ohlcSyms  = (await OHLC.distinct('symbol'));
  const fundSyms  = (await FundSnap.distinct('symbol'));

  const sample = await FundSnap.findOne({ pe: { $ne: null } }).sort({ updatedAt: -1 }).lean();

  const fundSet = new Set(fundSyms);
  const ohlcOnly = ohlcSyms.filter(s => !fundSet.has(s) && !s.startsWith('^') && !s.includes('-USD') && !s.includes('NIFTY_FIN'));

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║         RADAR MongoDB — Full Platform Audit          ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  OHLC (price candles)                                ║');
  console.log('║    Records : ' + String(ohlcCount).padEnd(39) + '║');
  console.log('║    Symbols : ' + String(ohlcSyms.length).padEnd(39) + '║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  FundamentalsSnapshot (P/E, ROE, MktCap, etc.)       ║');
  console.log('║    Symbols : ' + String(fundCount).padEnd(39) + '║');
  console.log('╠══════════════════════════════════════════════════════╣');
  if (sample) {
    const mktCap = sample.marketCap ? (sample.marketCap / 1e9).toFixed(0) + 'B INR' : 'n/a';
    console.log('║  Latest sample — ' + (sample.symbol + ' (' + (sample.sector || '?') + ')').padEnd(35) + '║');
    console.log('║    PE       : ' + String(sample.pe ?? 'n/a').padEnd(38) + '║');
    console.log('║    ROE      : ' + String(sample.roe != null ? sample.roe + '%' : 'n/a').padEnd(38) + '║');
    console.log('║    D/E      : ' + String(sample.debtToEquity ?? 'n/a').padEnd(38) + '║');
    console.log('║    Div Yld  : ' + String(sample.dividendYield != null ? sample.dividendYield + '%' : 'n/a').padEnd(38) + '║');
    console.log('║    Market Cap: ' + String(mktCap).padEnd(37) + '║');
    console.log('║    Beta     : ' + String(sample.beta ?? 'n/a').padEnd(38) + '║');
    console.log('║    Sector   : ' + String(sample.sector ?? 'n/a').padEnd(38) + '║');
    console.log('║    Val Status: ' + String(sample.valStatus ?? 'n/a').padEnd(37) + '║');
  }
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Coverage gap (equities with OHLC but no fund.)      ║');
  console.log('║    Count : ' + String(ohlcOnly.length).padEnd(41) + '║');
  if (ohlcOnly.length > 0) {
    console.log('║    Syms  : ' + ohlcOnly.slice(0, 5).join(', ').padEnd(41) + '║');
  }
  console.log('╚══════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
}).catch(e => { console.error(e.message); process.exit(1); });
