// Ticker -> CoinGecko coin id. Verified via CoinGecko's search API against
// the project name (many tickers are ambiguous — several coins can share a
// symbol), not guessed. Extend this table as more sectors get wired up;
// never add an entry without verifying it first — a wrong id silently
// plots the wrong coin's price.
//
// Note on TON: CoinGecko's own `name`/`symbol` fields for this id currently
// read "Gram (prev. Toncoin)" / GRAM, reflecting a project rebrand — the id
// itself is still correct/stable. We only ever display our own ticker label
// (TON) in this app, never CoinGecko's live name field, so this doesn't
// surface anywhere in the UI, but worth knowing if that ever changes.
export const COINGECKO_IDS = {
  BTC: 'bitcoin',

  // Layer 1s
  ETH: 'ethereum',
  SOL: 'solana',
  SUI: 'sui',
  AVAX: 'avalanche-2',
  NEAR: 'near',
  APT: 'aptos',
  ADA: 'cardano',
  DOT: 'polkadot',
  TON: 'the-open-network',
  ATOM: 'cosmos',
  TRX: 'tron',
  ICP: 'internet-computer',
  BNB: 'binancecoin',
  ARB: 'arbitrum',

  // Oracles & Middleware
  LINK: 'chainlink',
  PYTH: 'pyth-network',
  API3: 'api3',
  BAND: 'band-protocol',
  TRB: 'tellor',
  UMA: 'uma',
  DIA: 'dia-data',
  AXL: 'axelar',
  ZRO: 'layerzero',
  W: 'wormhole',
  RENDER: 'render-token',

  // Privacy
  ZEC: 'zcash',
  XMR: 'monero',
  DASH: 'dash',
  SCRT: 'secret',
  ROSE: 'oasis-network',
  ZEN: 'zencash',
  BEAM: 'beam', // Mimblewimble privacy coin (beam.mw) — not the Avalonche gaming token ("beam-2")
  FIRO: 'zcoin',
  NYM: 'nym',

  // DeFi
  AAVE: 'aave',
  UNI: 'uniswap',
  MKR: 'maker',
  CRV: 'curve-dao-token',
  LDO: 'lido-dao',
  COMP: 'compound-governance-token',
  SNX: 'havven',
  SUSHI: 'sushi',
  '1INCH': '1inch',
  DYDX: 'dydx-chain', // current dYdX v4 chain token — not the legacy pre-migration ERC-20 ("dydx")
  PENDLE: 'pendle',
  CAKE: 'pancakeswap-token',
  HYPE: 'hyperliquid',

  // Payments & Legacy
  XLM: 'stellar',
  LTC: 'litecoin',
  XRP: 'ripple',
  BCH: 'bitcoin-cash',
  BSV: 'bitcoin-cash-sv',
  XNO: 'nano',
  DGB: 'digibyte',

  // Meme & Culture
  DOGE: 'dogecoin',
  SHIB: 'shiba-inu',
  PEPE: 'pepe',
  WIF: 'dogwifcoin',
  FLOKI: 'floki',
  BONK: 'bonk',
  BRETT: 'based-brett',
  POPCAT: 'popcat',
  MOG: 'mog-coin',
  TURBO: 'turbo',

  // Enterprise / RWA
  HBAR: 'hedera-hashgraph',
  ONDO: 'ondo-finance',
  ALGO: 'algorand',
  XDC: 'xdce-crowd-sale',
  POLYX: 'polymesh',
  VET: 'vechain',
  QNT: 'quant-network',
  CFG: 'centrifuge-2',
  TRU: 'truefi',

  // Gaming — ids checked against CoinGecko's markets data (name + symbol).
  IMX: 'immutable-x',
  GALA: 'gala',
  SAND: 'the-sandbox',
  AXS: 'axie-infinity',
  MANA: 'decentraland',
  RON: 'ronin',
  BEAMX: 'beam-2', // Beam gaming network (Merit Circle) — not Privacy's BEAM ("beam")
  PRIME: 'echelon-prime',
  ILV: 'illuvium',
  APE: 'apecoin',
};
