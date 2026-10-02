// Sector taxonomy, originally ported from the prototype
// (crypto-rotation-dashboard-v2.jsx), now curated to favour coins that
// trade as USDT perpetuals on Bitunix: every ticker below was on Bitunix's
// futures pair list (fapi.bitunix.com trading_pairs, status OPEN) on
// 2026-10-02, and each new one's CoinGecko id was matched to Bitunix's live
// price. TON trades there under its new ticker, GRAM. Dropped as not
// listed: SCRT, BEAM, FIRO, NYM, MKR (Bitunix lists its successor SKY), XNO,
// XDC, TRU, RON, PRIME.
//
// Order matters: the sectors-vs-each-other RRG builds each sector from its
// first few tickers (app/api/rrg-sectors), so the largest, most liquid
// names come first. `short` is the on-chart label in that view.

export const SECTORS = [
  { key: 'l1', label: 'Layer 1s', short: 'L1s',
    tickers: ['ETH', 'SOL', 'SUI', 'AVAX', 'NEAR', 'APT', 'ADA', 'DOT', 'TON', 'ATOM', 'TRX', 'ICP', 'BNB', 'ARB'] },
  { key: 'oracle', label: 'Oracles & Middleware', short: 'Oracles',
    tickers: ['LINK', 'PYTH', 'API3', 'BAND', 'TRB', 'UMA', 'DIA', 'AXL', 'ZRO', 'RENDER'] },
  { key: 'privacy', label: 'Privacy', short: 'Privacy',
    tickers: ['ZEC', 'XMR', 'DASH', 'ZEN', 'ROSE', 'MINA', 'DUSK'] },
  { key: 'defi', label: 'DeFi', short: 'DeFi',
    tickers: ['AAVE', 'UNI', 'SKY', 'CRV', 'LDO', 'COMP', 'SNX', 'SUSHI', '1INCH', 'DYDX', 'PENDLE', 'CAKE', 'HYPE'] },
  { key: 'payments', label: 'Payments & Legacy', short: 'Payments',
    tickers: ['XLM', 'LTC', 'XRP', 'BCH', 'BSV'] },
  { key: 'meme', label: 'Meme & Culture', short: 'Meme',
    tickers: ['DOGE', 'SHIB', 'PEPE', 'WIF', 'FLOKI', 'BONK', 'BRETT', 'POPCAT', 'MOG', 'TURBO'] },
  { key: 'rwa', label: 'Enterprise / RWA', short: 'RWA',
    tickers: ['HBAR', 'ONDO', 'ALGO', 'VET', 'QNT', 'POLYX', 'PLUME', 'SYRUP', 'CFG'] },
  // BEAMX is Beam the gaming network (CoinGecko `beam-2`). 16 tickers is
  // the most the RRG can keep apart (8 hues x 2 marker shapes).
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
