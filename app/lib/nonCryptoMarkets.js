// Stock, ETF, commodity and FX perpetuals that show up in crypto
// liquidation feeds (MarginPad's feed includes venues that list them, e.g.
// Hyperliquid's builder-deployed markets). The feed doesn't say which
// markets are crypto, so these are matched by ticker. Only unambiguous
// tickers are listed: SPX, for example, is left out because it's also the
// SPX6900 memecoin. Tested in nonCryptoMarkets.test.js.

const NON_CRYPTO = new Set([
  // commodities
  'XAU', 'XAG', 'XPT', 'XPD', 'CL', 'BZ', 'WTI', 'BRENT', 'NG', 'HG', 'COPPER',
  // stocks and ETFs (incl. those seen in the live feed: SNDK, SOXL, SKHYNIX)
  'SNDK', 'SOXL', 'SKHYNIX', 'SMSN', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'GOOG', 'META',
  'NFLX', 'AMD', 'INTC', 'TSM', 'ORCL', 'PLTR', 'MSTR', 'COIN', 'HOOD', 'CRCL', 'BABA', 'MU',
  'SPY', 'QQQ', 'TQQQ', 'SQQQ', 'IWM',
  // FX
  'EUR', 'JPY', 'GBP', 'CHF', 'DXY',
]);

// Accepts a bare ticker or a venue-prefixed one ("xyz:SNDK").
export function isNonCryptoMarket(symbol) {
  const bare = String(symbol || '').toUpperCase().split(':').pop();
  return NON_CRYPTO.has(bare);
}
