const mongoose = require("mongoose");

const QuoteSchema = new mongoose.Schema({
  symbol: String,
  shortName: String,
  longName: String,

  price: Number,
  changePercent: Number,

  marketCap: Number,
  pe: Number,
  forwardPE: Number,
  priceToBook: Number,

  volume: Number,

  fiftyTwoWeekHigh: Number,
  fiftyTwoWeekLow: Number,

  exchange: String,
  currency: String,

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Quote", QuoteSchema);