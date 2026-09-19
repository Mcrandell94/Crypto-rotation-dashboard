// Sector taxonomy ported verbatim from the original prototype
// (crypto-rotation-dashboard-v2.jsx). BTC is the fixed benchmark and isn't
// listed in any sector — it's always shown/plotted alongside whichever
// sector is active.

export const SECTORS = [
  { key: 'l1', label: 'Layer 1s',
    tickers: ['ETH', 'SOL', 'SUI', 'AVAX', 'NEAR', 'APT', 'ADA', 'DOT', 'TON', 'ATOM', 'TRX', 'ICP', 'BNB', 'ARB'] },
  { key: 'oracle', label: 'Oracles & Middleware',
    tickers: ['LINK', 'PYTH', 'API3', 'BAND', 'TRB', 'UMA', 'DIA', 'AXL', 'ZRO', 'W', 'RENDER'] },
  { key: 'privacy', label: 'Privacy',
    tickers: ['ZEC', 'XMR', 'DASH', 'SCRT', 'ROSE', 'ZEN', 'BEAM', 'FIRO', 'NYM'] },
  { key: 'defi', label: 'DeFi',
    tickers: ['AAVE', 'UNI', 'MKR', 'CRV', 'LDO', 'COMP', 'SNX', 'SUSHI', '1INCH', 'DYDX', 'PENDLE', 'CAKE', 'HYPE'] },
  { key: 'payments', label: 'Payments & Legacy',
    tickers: ['XLM', 'LTC', 'XRP', 'BCH', 'BSV', 'XNO', 'DGB'] },
  { key: 'meme', label: 'Meme & Culture',
    tickers: ['DOGE', 'SHIB', 'PEPE', 'WIF', 'FLOKI', 'BONK', 'BRETT', 'POPCAT', 'MOG', 'TURBO'] },
  { key: 'rwa', label: 'Enterprise / RWA',
    tickers: ['HBAR', 'ONDO', 'ALGO', 'XDC', 'POLYX', 'VET', 'QNT', 'CFG', 'TRU'] },
];

export const BENCHMARK = 'BTC';

export function sectorTickers(sectorKey) {
  const sec = SECTORS.find((s) => s.key === sectorKey);
  return sec ? sec.tickers : [];
}
