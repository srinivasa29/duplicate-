const mapSymbol = (symbol) => {

    const mappings = {
        NIFTY: '^NSEI',
        BANKNIFTY: '^NSEBANK',
        FINNIFTY: 'NIFTY_FIN_SERVICE.NS',
    };

    // NSE stock support
    if (
        !symbol.startsWith('^') &&
        !symbol.endsWith('.NS') &&
        symbol !== 'NIFTY' &&
        symbol !== 'BANKNIFTY'
    ) {
        return `${symbol}.NS`;
    }

    return mappings[symbol] || symbol;
};

module.exports = mapSymbol;