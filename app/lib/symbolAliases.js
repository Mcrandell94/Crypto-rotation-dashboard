// Tickers this app shows vs the ticker a data provider lists them under.
// Toncoin rebranded to GRAM in September 2026 (CoinGecko now names it
// "Gram (prev. Toncoin)" / GRAM, and news feeds use GRAM). Looking up "TON"
// by symbol on CoinMarketCap started matching an unrelated token (~$14.8K
// market cap), so it's looked up as GRAM and shown as TON.
// Tested in symbolAliases.test.js.

export const PROVIDER_SYMBOLS = { TON: 'GRAM' };

export function toProviderSymbol(sym) {
  return PROVIDER_SYMBOLS[sym] || sym;
}

// Map a provider's result keys back to the app's tickers. Only exact matches
// for what was requested are kept: a key in different case (e.g. "Ton") is
// a different token sharing the ticker, not the one asked for.
export function fromProviderResults(requested, results) {
  const out = {};
  for (const sym of requested) {
    const key = toProviderSymbol(sym);
    if (Object.prototype.hasOwnProperty.call(results, key)) out[sym] = results[key];
  }
  return out;
}
