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
  // Added 2026-10-02 (Bitunix-listed; CoinGecko category "Privacy Blockchain",
  // price matched to Bitunix's)
  MINA: 'mina-protocol',
  DUSK: 'dusk-network',

  // DeFi
  AAVE: 'aave',
  UNI: 'uniswap',
  MKR: 'maker',
  SKY: 'sky', // Sky Protocol, Maker's successor token (price matched to Bitunix's SKY)
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
  CFG: 'centrifuge-2', // current Centrifuge — not "centrifuge" (marked [OLD] on CoinGecko)
  // Added 2026-10-02 (Bitunix-listed; CoinGecko category "Real World Assets
  // (RWA)", price matched to Bitunix's)
  PLUME: 'plume',
  SYRUP: 'syrup', // Maple Finance
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
  // Added 2026-10-02 (Bitunix-listed; CoinGecko category "Gaming (GameFi)"
  // or Metaverse, price matched to Bitunix's)
  ENJ: 'enjincoin',
  SUPER: 'superfarm', // SuperVerse
  ALICE: 'my-neighbor-alice',
  MAGIC: 'magic', // Treasure
  YGG: 'yield-guild-games',
  BIGTIME: 'big-time',
  XAI: 'xai-blockchain',
  PIXEL: 'pixels',

  // Added in the 2026-10-02 Bitunix refresh (app/lib/sectors.js). Each id was
  // confirmed by matching CoinGecko's price to Bitunix's for that ticker.
  // Layer 1s
  KAS: 'kaspa',
  INJ: 'injective-protocol',
  SEI: 'sei-network',
  MON: 'monad',
  // Layer 2s
  MNT: 'mantle',
  POL: 'polygon-ecosystem-token', // ex-MATIC
  STX: 'blockstack', // Stacks
  OP: 'optimism',
  STRK: 'starknet',
  ZK: 'zksync',
  LINEA: 'linea',
  METIS: 'metis-token',
  // AI & DePIN
  TAO: 'bittensor',
  WLD: 'worldcoin-wld',
  FIL: 'filecoin',
  FET: 'fetch-ai', // Artificial Superintelligence Alliance
  VIRTUAL: 'virtual-protocol',
  GRASS: 'grass',
  AR: 'arweave',
  THETA: 'theta-token',
  KAITO: 'kaito',
  IO: 'io', // io.net
  AIXBT: 'aixbt',
  // Oracles & Middleware
  GRT: 'the-graph',
  // Privacy (CoinGecko: Privacy Blockchain / Privacy Infrastructure)
  NIGHT: 'midnight-3', // Midnight (Cardano privacy chain) — not "midnight"
  ZAMA: 'zama',
  AZTEC: 'aztec',
  // DeFi
  ENA: 'ethena',
  ASTER: 'aster-2',
  MORPHO: 'morpho',
  JUP: 'jupiter-exchange-solana',
  AERO: 'aerodrome-finance',
  ETHFI: 'ether-fi',
  RAY: 'raydium',
  // Payments & Legacy
  ETC: 'ethereum-classic',
  XPL: 'plasma', // stablecoin-payments chain
  CELO: 'celo',
  // Meme & Culture
  TRUMP: 'official-trump',
  PENGU: 'pudgy-penguins',
  SPX: 'spx6900',
  USELESS: 'useless-3',
  FARTCOIN: 'fartcoin',
  PEOPLE: 'constitutiondao',
};
