// Sector taxonomy, originally ported from the prototype
// (crypto-rotation-dashboard-v2.jsx), refreshed 2026-10-02 from Bitunix's
// listings: every ticker below was on Bitunix's USDT perpetual list
// (fapi.bitunix.com trading_pairs, status OPEN) that day, and every coin
// added in the refresh had its CoinGecko id confirmed by matching
// CoinGecko's price to Bitunix's (all within ~0.5%) plus its CoinGecko
// category where the fit wasn't obvious. Picks favour sector fit, then
// what actually trades on Bitunix (24h volume) and market cap. TON trades
// there under its new ticker, GRAM.
//
// Order matters: the sectors-vs-each-other RRG builds each sector from its
// first few tickers (app/api/rrg-sectors), so the largest names come
// first. 16 tickers is the most one RRG keeps apart (8 hues x 2 marker
// shapes). `short` is the on-chart label in the sectors view.

export const SECTORS = [
  { key: 'l1', label: 'Layer 1s', short: 'L1s',
    tickers: ['ETH', 'BNB', 'SOL', 'TRX', 'ADA', 'TON', 'SUI', 'AVAX', 'NEAR', 'DOT', 'ICP', 'APT', 'KAS', 'INJ', 'SEI', 'MON'] },
  { key: 'l2', label: 'Layer 2s', short: 'L2s',
    tickers: ['ARB', 'MNT', 'POL', 'STX', 'OP', 'STRK', 'ZK', 'LINEA', 'METIS'] },
  { key: 'ai', label: 'AI & DePIN', short: 'AI',
    tickers: ['TAO', 'WLD', 'RENDER', 'FIL', 'FET', 'VIRTUAL', 'GRASS', 'AR', 'THETA', 'KAITO', 'IO', 'AIXBT'] },
  { key: 'oracle', label: 'Oracles & Middleware', short: 'Oracles',
    tickers: ['LINK', 'PYTH', 'ZRO', 'GRT', 'W', 'TRB', 'API3', 'BAND', 'UMA', 'DIA', 'AXL'] },
  { key: 'privacy', label: 'Privacy', short: 'Privacy',
    tickers: ['ZEC', 'XMR', 'NIGHT', 'DASH', 'ZEN', 'MINA', 'ZAMA', 'ROSE', 'DUSK', 'AZTEC'] },
  { key: 'defi', label: 'DeFi', short: 'DeFi',
    tickers: ['AAVE', 'UNI', 'HYPE', 'ENA', 'SKY', 'ASTER', 'MORPHO', 'LDO', 'JUP', 'AERO', 'ETHFI', 'PENDLE', 'RAY', 'CRV', 'CAKE', 'DYDX'] },
  { key: 'payments', label: 'Payments & Legacy', short: 'Payments',
    tickers: ['XRP', 'BCH', 'LTC', 'XLM', 'ETC', 'XPL', 'BSV', 'CELO'] },
  { key: 'meme', label: 'Meme & Culture', short: 'Meme',
    tickers: ['DOGE', 'SHIB', 'PEPE', 'TRUMP', 'BONK', 'PENGU', 'SPX', 'FLOKI', 'WIF', 'USELESS', 'FARTCOIN', 'POPCAT', 'BRETT', 'TURBO', 'MOG', 'PEOPLE'] },
  { key: 'rwa', label: 'Enterprise / RWA', short: 'RWA',
    tickers: ['HBAR', 'ONDO', 'ALGO', 'VET', 'QNT', 'POLYX', 'PLUME', 'SYRUP', 'CFG'] },
  // BEAMX is Beam the gaming network (CoinGecko `beam-2`).
  { key: 'gaming', label: 'Gaming', short: 'Gaming',
    tickers: ['IMX', 'GALA', 'SAND', 'AXS', 'MANA', 'APE', 'ENJ', 'SUPER', 'ALICE', 'MAGIC', 'YGG', 'ILV', 'BIGTIME', 'XAI', 'BEAMX', 'PIXEL'] },
];

// BTC and ETH are the only benchmarks with a wired-up live data source
// (both come from the same CoinGecko pipeline as everything else). Gold/USD
// from the prototype would need a non-crypto data source.
export const BENCHMARKS = [
  { key: 'BTC', label: 'Bitcoin' },
  { key: 'ETH', label: 'Ethereum' },
];

export function sectorTickers(sectorKey) {
  const sec = SECTORS.find((s) => s.key === sectorKey);
  return sec ? sec.tickers : [];
}
