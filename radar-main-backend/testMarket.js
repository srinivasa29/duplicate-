const mongoose = require("mongoose");
const YahooFinance = require("yahoo-finance2").default;
const Quote = require("./src/models/Quote");

const yahooFinance = new YahooFinance();

mongoose.connect("mongodb://localhost:27017/radar")
    .then(() => console.log("MongoDB Connected"));

async function testMarketData() {
    try {
        const result = await yahooFinance.quote("RELIANCE.NS");

        console.log("LIVE MARKET DATA:");
        console.log(result);

        await Quote.findOneAndUpdate(
            { symbol: result.symbol },
            {
                symbol: result.symbol,
                shortName: result.shortName,
                longName: result.longName,

                price: result.regularMarketPrice,
                changePercent: result.regularMarketChangePercent,

                marketCap: result.marketCap,
                pe: result.trailingPE,
                forwardPE: result.forwardPE,
                priceToBook: result.priceToBook,

                volume: result.regularMarketVolume,

                fiftyTwoWeekHigh: result.fiftyTwoWeekHigh,
                fiftyTwoWeekLow: result.fiftyTwoWeekLow,

                exchange: result.fullExchangeName,
                currency: result.currency,

                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );

        console.log("Data Stored Successfully");
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

testMarketData();