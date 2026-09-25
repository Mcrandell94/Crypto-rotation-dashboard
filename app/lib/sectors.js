// Sector taxonomy ported verbatim from the original prototype
// (crypto-rotation-dashboard-v2.jsx). `short` is the on-chart label in the
// sectors-vs-each-other RRG, where full names collide.

export const SECTORS = [
  { key: 'l1', label: 'Layer 1s', short: 'L1s',
    tickers: ['ETH', 'SOL', 'SUI', 'AVAX', 'NEAR', 'APT', 'ADA', 'DOT', 'TON', 'ATOM', 'TRX', 'ICP', 'BNB', 'ARB'] },
  { key: 'oracle', label: 'Oracles & Middleware', short: 'Oracles',
    tickers: ['LINK', 'PYTH', 'API3', 'BAND', 'TRB', 'UMA', 'DIA', 'AXL', 'ZRO', 'RENDER'] },
  { key: 'privacy', label: 'Privacy', short: 'Privacy',
    tickers: ['ZEC', 'XMR', 'DASH', 'SCRT', 'ROSE', 'ZEN', 'BEAM', 'FIRO', 'NYM'] },
  { key: 'defi', label: 'DeFi', short: 'DeFi',
    tickers: ['AAVE', 'UNI', 'MKR', 'CRV', 'LDO', 'COMP', 'SNX', 'SUSHI', '1INCH', 'DYDX', 'PENDLE', 'CAKE', 'HYPE'] },
  { key: 'payments', label: 'Payments & Legacy', short: 'Payments',
    tickers: ['XLM', 'LTC', 'XRP', 'BCH', 'BSV', 'XNO'] },
  { key: 'meme', label: 'Meme & Culture', short: 'Meme',
    tickers: ['DOGE', 'SHIB', 'PEPE', 'WIF', 'FLOKI', 'BONK', 'BRETT', 'POPCAT', 'MOG', 'TURBO'] },
  { key: 'rwa', label: 'Enterprise / RWA', short: 'RWA',
    tickers: ['HBAR', 'ONDO', 'ALGO', 'XDC', 'POLYX', 'VET', 'QNT', 'TRU'] },
  // BEAMX is Beam the gaming network (CoinGecko `beam-2`), kept distinct
  // from Privacy's BEAM (the Mimblewimble coin, `beam`).
  { key: 'gaming', label: 'Gaming', short: 'Gaming',
    tickers: ['IMX', 'GALA', 'SAND', 'AXS', 'MANA', 'RON', 'BEAMX', 'PRIME', 'ILV', 'APE'] },
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
