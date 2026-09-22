// Server-side only — requires an Etherscan API key (etherscan.io) for the
// Ethereum leg; TronScan and Solscan keys (optional) add Tron and Solana
// coverage. A stablecoin "mint" is, on Ethereum and Tron, an ERC-20/TRC20
// Transfer from the chain's null/black-hole address to the issuer's
// treasury or an end wallet — a real on-chain fact read live from each
// chain's own explorer API, not a guessed or derived signal. On Solana,
// Solscan's activity_type filter names "mint" directly (ACTIVITY_SPL_MINT)
// rather than needing that null-address inference.
//
// Multi-chain: both USDT and USDC mint on several chains, and most of
// USDT's supply is actually minted on Tron, not Ethereum — so Ethereum
// alone (this route's original scope) was real but partial. This now
// covers the three primary mint venues: Ethereum (USDT+USDC), Tron
// (USDT), Solana (USDC).
//
// Contract/mint addresses were verified against independent public
// sources (Etherscan/Uniswap's token list, TronScan's own contract page,
// Solana's official explorer + Solscan, Circle's published USDC mint —
// cross-checked via web search since etherscan.io/tronscan.org/solscan.io
// are all unreachable from this dev sandbox to hit directly) rather than
// recalled from memory:
//   - ETH USDT/USDC: see addresses below (unchanged from original).
//   - Tron USDT contract: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
//   - Tron black-hole/null address: T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb
//     (TRON's address(0) equivalent — no private key exists for it; real
//     new-supply events are TRC20 Transfers FROM this address)
//   - Solana USDC mint: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
//
// Uses Etherscan's V2 API (api.etherscan.io/v2/api, chainid=1 for
// Ethereum mainnet) rather than the legacy per-chain V1 host
// (api.etherscan.io/api) — Etherscan unified all their per-chain
// explorers behind one multichain key on V2, and newer API keys are
// increasingly V2-only, so V1 is the wrong endpoint to build against now.
//
// TronScan's and Solscan's exact response field names are NOT confirmed
// against a live response — both APIs' docs (docs.tronscan.org,
// pro-api.solscan.io) and both live hosts are unreachable from this
// sandbox, so unlike the Ethereum leg (which decodes raw getLogs topics,
// no field-name guessing involved), the Tron and Solana parsers below try
// several plausible field names defensively (same pattern used for
// CoinLobster elsewhere in this codebase) and fail loudly with the raw
// response embedded in the error if the expected array shape isn't found.
// A field-level miss (unknown key) degrades a single value to null rather
// than failing the whole chain, since the meaningful gate is finding the
// transfer list at all, not any one field. If this throws a raw-response
// error in production, that response is the fastest way to correct the
// mapping — same as how CoinLobster's routes were corrected this session.

export const dynamic = 'force-dynamic';

const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api';
const ETHEREUM_CHAIN_ID = 1;
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO_TOPIC = `0x${'0'.repeat(64)}`;
// How many rows to actually pull from Etherscan per token in one call —
// generous, but recency is guaranteed by keeping each token's block
// window (below) short enough that its real event count comfortably fits
// under this, not by this number alone. getLogs' own sort/pagination
// isn't trustworthy the way it is on Etherscan's account-module endpoints
// (tokentx, txlist): `sort=desc&offset=N` can hand back the OLDEST N
// events in the range instead of the newest. Recency is enforced below by
// sorting everything actually returned ourselves, never by trusting the
// API to have handed us the right end of the list.
const FETCH_LIMIT = 1000;
// How many of the most-recent, freshly-sorted rows the feed actually
// shows, after the panel's own size filter narrows things further. Raised
// from 30 now that three chains contribute instead of one.
const DISPLAY_LIMIT = 45;

// USDT and USDC's null-address Transfer events happen at wildly different
// real rates, so a one-size block window doesn't work: a window wide
// enough to catch USDT's rare, large treasury mints (real ones can be
// days apart) is so oversaturated with USDC's — mostly small, frequent
// mints from Circle's CCTP cross-chain bridge minting directly to
// end-user addresses on receipt, not classic treasury re-supply — that
// FETCH_LIMIT rows never reach anywhere near "now": the feed looked stuck
// showing only ~7-day-old data because that 7-day window's USDC event
// count vastly exceeded FETCH_LIMIT even after sorting, so nothing recent
// was ever actually fetched in the first place. Each token's window here
// is sized to its own real frequency instead of a shared guess.
const TOKENS = [
  { symbol: 'USDT', label: 'Tether', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, color: '#26A17B', blockWindow: 50_400 }, // ~7 days
  { symbol: 'USDC', label: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, color: '#2775CA', blockWindow: 900 }, // ~3 hours
];

// Generic helpers for the Tron/Solana parsers below — same "try several
// plausible field names, never assume" approach as coinlobster.js, kept
// local here since these two chains are the only unconfirmed-shape callers
// in this file.
function pickField(obj, keys) {
  for (const k of keys) {
    if (obj?.[k] != null) return obj[k];
  }
  return null;
}
function extractRows(json, wrapperKeys) {
  if (Array.isArray(json)) return json;
  for (const k of wrapperKeys) {
    if (Array.isArray(json?.[k])) return json[k];
  }
  return null;
}
function normalizeMs(v) {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n < 1e12 ? n * 1000 : n; // seconds vs ms
}

const TRON_BASE = 'https://apilist.tronscanapi.com/api';
const TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRON_BLACK_HOLE = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
const TRON_DECIMALS = 6;
// The /token_trc20/transfers endpoint has a documented quirk (confirmed
// via a GitHub issue against the tronscan-api repo) of always capping at
// 20 rows per page regardless of the requested `limit` — so recent-window
// coverage comes from paginating with `start`, not from one large `limit`.
const TRON_PAGE_SIZE = 20;
const TRON_PAGES = 15; // ~300 most-recent contract-wide transfers scanned

async function fetchTronMints(apiKey) {
  if (!apiKey) return { chain: 'Tron', symbol: 'USDT', mints: [], skipped: true };

  const allRows = [];
  for (let page = 0; page < TRON_PAGES; page++) {
    const start = page * TRON_PAGE_SIZE;
    const url = `${TRON_BASE}/token_trc20/transfers?limit=${TRON_PAGE_SIZE}&start=${start}&contract_address=${TRON_USDT_CONTRACT}`;
    const res = await fetch(url, { headers: { 'TRON-PRO-API-KEY': apiKey }, next: { revalidate: 60 } });

    if (!res.ok) {
      const detail = await res.text();
      return { chain: 'Tron', symbol: 'USDT', error: `TronScan returned ${res.status} for USDT transfers. Raw response: ${detail.slice(0, 300)}` };
    }

    const json = await res.json();
    const rows = extractRows(json, ['token_transfers', 'data', 'transfers', 'results']);
    if (!rows) {
      return { chain: 'Tron', symbol: 'USDT', error: `TronScan's token_trc20/transfers response didn't match the expected shape. Raw sample: ${JSON.stringify(json).slice(0, 500)}` };
    }
    if (rows.length === 0) break;
    allRows.push(...rows);
    if (rows.length < TRON_PAGE_SIZE) break; // short page = no more data
  }

  const mints = allRows
    .map((r) => {
      const from = pickField(r, ['from_address', 'from', 'fromAddress']);
      const to = pickField(r, ['to_address', 'to', 'toAddress']);
      const rawAmount = pickField(r, ['quant', 'amount', 'value']);
      const n = rawAmount != null ? Number(rawAmount) : null;
      const amount = Number.isFinite(n) ? n / 10 ** TRON_DECIMALS : null;
      const timestamp = normalizeMs(pickField(r, ['block_ts', 'timestamp', 'block_timestamp']));
      const txHash = pickField(r, ['transaction_id', 'hash', 'tx_hash', 'transactionHash']);
      return { from, to, amount, timestamp, txHash };
    })
    // Real new-supply events are TRC20 Transfers FROM the black-hole
    // address — the same "from the null address" pattern as Ethereum's
    // mint detection, just under Tron's own zero-address equivalent.
    .filter((r) => r.from === TRON_BLACK_HOLE)
    .map((r) => ({
      chain: 'Tron',
      symbol: 'USDT',
      label: 'Tether (Tron)',
      color: '#26A17B',
      to: r.to,
      amount: r.amount,
      txHash: r.txHash,
      timestamp: r.timestamp,
    }));

  return { chain: 'Tron', symbol: 'USDT', mints };
}

const SOLANA_BASE = 'https://pro-api.solscan.io/v2.0';
const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOLANA_DECIMALS = 6;
const SOLANA_PAGE_SIZE = 40;

async function fetchSolanaMints(apiKey) {
  if (!apiKey) return { chain: 'Solana', symbol: 'USDC', mints: [], skipped: true };

  // activity_type[]=ACTIVITY_SPL_MINT is a direct, documented semantic
  // filter (per Solscan's published activity-type values) — no need to
  // reconstruct "mint" from a null-address transfer pattern here.
  const url = `${SOLANA_BASE}/token/transfer?address=${SOLANA_USDC_MINT}&activity_type[]=ACTIVITY_SPL_MINT&page=1&page_size=${SOLANA_PAGE_SIZE}&sort_by=block_time&sort_order=desc`;
  const res = await fetch(url, { headers: { token: apiKey }, next: { revalidate: 60 } });

  if (!res.ok) {
    const detail = await res.text();
    return { chain: 'Solana', symbol: 'USDC', error: `Solscan returned ${res.status} for USDC mint activity. Raw response: ${detail.slice(0, 300)}` };
  }

  const json = await res.json();
  const rows = extractRows(json, ['data', 'result', 'transfers', 'items']);
  if (!rows) {
    return { chain: 'Solana', symbol: 'USDC', error: `Solscan's token/transfer response didn't match the expected shape. Raw sample: ${JSON.stringify(json).slice(0, 500)}` };
  }

  const mints = rows.map((r) => {
    const to = pickField(r, ['to_address', 'to', 'destination', 'address']);
    const rawAmount = pickField(r, ['amount', 'value', 'token_amount']);
    const rawDecimals = pickField(r, ['token_decimals', 'decimals']);
    const decimals = rawDecimals != null ? Number(rawDecimals) : SOLANA_DECIMALS;
    const n = rawAmount != null ? Number(rawAmount) : null;
    const amount = Number.isFinite(n) ? n / 10 ** decimals : null;
    const timestamp = normalizeMs(pickField(r, ['block_time', 'time', 'timestamp']));
    const txHash = pickField(r, ['trans_id', 'signature', 'tx_hash', 'txHash']);
    return {
      chain: 'Solana',
      symbol: 'USDC',
      label: 'USD Coin (Solana)',
      color: '#2775CA',
      to,
      amount,
      txHash,
      timestamp,
    };
  });

  return { chain: 'Solana', symbol: 'USDC', mints };
}

async function fetchLatestBlock(apiKey) {
  const url = `${ETHERSCAN_BASE}?chainid=${ETHEREUM_CHAIN_ID}&module=proxy&action=eth_blockNumber&apikey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Etherscan returned ${res.status} fetching the latest block. Raw response: ${detail.slice(0, 300)}`);
  }
  const json = await res.json();
  if (!json.result) {
    throw new Error(`Etherscan's eth_blockNumber response was missing a result. Raw sample: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return parseInt(json.result, 16);
}

async function fetchMints(token, apiKey, latestBlock) {
  const fromBlock = Math.max(0, latestBlock - token.blockWindow);
  const url =
    `${ETHERSCAN_BASE}?chainid=${ETHEREUM_CHAIN_ID}&module=logs&action=getLogs&fromBlock=${fromBlock}&toBlock=latest` +
    `&address=${token.address}&topic0=${TRANSFER_TOPIC}&topic0_1_opr=and&topic1=${ZERO_TOPIC}` +
    `&page=1&offset=${FETCH_LIMIT}&sort=desc&apikey=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) {
    const detail = await res.text();
    return { symbol: token.symbol, error: `Etherscan returned ${res.status} for ${token.symbol} mint logs. Raw response: ${detail.slice(0, 300)}` };
  }

  const json = await res.json();
  if (json.status !== '1') {
    // Etherscan reports an empty result set as status "0" with this exact
    // message — a real "no mints in this window," not a failure.
    if (json.message === 'No records found') return { symbol: token.symbol, mints: [] };
    return { symbol: token.symbol, error: `Etherscan API error for ${token.symbol}: ${json.message || 'unknown error'}. Raw sample: ${JSON.stringify(json).slice(0, 300)}` };
  }

  const rows = Array.isArray(json.result) ? json.result : [];
  const mints = rows.map((log) => {
    const toTopic = log.topics?.[2];
    const to = toTopic ? `0x${toTopic.slice(-40)}` : null;
    let amount = null;
    try {
      amount = Number(BigInt(log.data)) / 10 ** token.decimals;
    } catch {
      amount = null;
    }
    return {
      chain: 'Ethereum',
      symbol: token.symbol,
      label: token.label,
      color: token.color,
      to,
      amount,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber ? parseInt(log.blockNumber, 16) : null,
      timestamp: log.timeStamp ? parseInt(log.timeStamp, 16) * 1000 : null,
    };
  });

  // Don't trust getLogs' own ordering — sort what actually came back
  // ourselves so "most recent" is a fact, not an assumption about the API.
  mints.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return { chain: 'Ethereum', symbol: token.symbol, mints };
}

export async function GET() {
  const etherscanKey = process.env.ETHERSCAN_API_KEY;
  const tronscanKey = process.env.TRONSCAN_API_KEY;
  const solscanKey = process.env.SOLSCAN_API_KEY;

  if (!etherscanKey) {
    return Response.json(
      { error: 'ETHERSCAN_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const latestBlock = await fetchLatestBlock(etherscanKey);

    const [ethResults, tronResult, solanaResult] = await Promise.all([
      Promise.all(TOKENS.map((t) => fetchMints(t, etherscanKey, latestBlock))),
      fetchTronMints(tronscanKey),
      fetchSolanaMints(solscanKey),
    ]);

    const allResults = [...ethResults, tronResult, solanaResult];
    const failed = allResults.filter((r) => r.error);
    const skipped = allResults.filter((r) => r.skipped);
    const succeeded = allResults.filter((r) => !r.error && !r.skipped);

    if (succeeded.length === 0) {
      // The reason each chain/token failed goes directly in `error`, not
      // just a separate `detail` field — the client only ever surfaces
      // `error`.
      const reasons = failed.map((f) => f.error).join(' | ').slice(0, 700);
      return Response.json(
        { error: `Stablecoin mint lookup failed for every tracked chain: ${reasons}`, detail: JSON.stringify(failed).slice(0, 800) },
        { status: 502 }
      );
    }

    const mints = succeeded
      .flatMap((r) => r.mints)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, DISPLAY_LIMIT);

    return Response.json({
      mints,
      tokensFailed: failed.map((f) => ({ chain: f.chain, symbol: f.symbol, error: f.error })),
      chainsSkipped: skipped.map((s) => ({ chain: s.chain, symbol: s.symbol, reason: 'API key not configured' })),
      windowBlocksBySymbol: Object.fromEntries(TOKENS.map((t) => [t.symbol, t.blockWindow])),
      latestBlock,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message || 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
