// Server-side only — requires an Etherscan API key (etherscan.io) for the
// Ethereum leg; the Tron leg uses TronGrid's keyless public API. A USDC
// "mint" is an ERC-20 Transfer from the null address; a USDT mint is
// Tether's own Issue event (see ISSUE_TOPIC below). Both are real on-chain
// facts read live, not a guessed or derived signal.
//
// Multi-chain: both USDT and USDC mint on several chains, and most of
// USDT's supply is actually minted on Tron, not Ethereum — so Ethereum
// alone (this route's original scope) was real but partial. This now
// covers Ethereum (USDT+USDC) and Tron (USDT).
//
// Solana (USDC via Solscan) is DISABLED for now, not removed — Solscan's
// endpoints turned out to be PRO-tier-gated ("Please upgrade your api key
// level" from a live 401), which is an account/billing question, not a
// code bug. fetchSolanaMints, SOLANA_BASE, SOLANA_USDC_MINT, and its
// confirmed response-shape parsing below are all left fully intact and
// working — GET() below just doesn't call it. To re-enable once the
// Solscan plan covers it: add `fetchSolanaMints(process.env.SOLSCAN_API_KEY)`
// back into GET()'s Promise.all and its result back into allResults.
//
// Contract/mint addresses were verified against independent public
// sources (Etherscan/Uniswap's token list, TronScan's own contract page,
// Solana's official explorer + Solscan, Circle's published USDC mint —
// cross-checked via web search since etherscan.io/tronscan.org/solscan.io
// are all unreachable from this dev sandbox to hit directly) rather than
// recalled from memory:
//   - ETH USDT/USDC: see addresses below (unchanged from original).
//   - Tron USDT contract: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
//   - Solana USDC mint: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
//
// Uses Etherscan's V2 API (api.etherscan.io/v2/api, chainid=1 for
// Ethereum mainnet) rather than the legacy per-chain V1 host
// (api.etherscan.io/api) — Etherscan unified all their per-chain
// explorers behind one multichain key on V2, and newer API keys are
// increasingly V2-only, so V1 is the wrong endpoint to build against now.
//
// Solscan's response shape IS now confirmed, via its full reference page
// for the sibling /v2.0/account/transfer endpoint (pasted in by the
// user): {success, data: [{trans_id, block_time, from_address,
// to_address, token_address, token_decimals, amount, flow}]}, with
// errors as {success: false, errors: {code, message}}. This route calls
// /v2.0/token/transfer (a different endpoint in the same API family, not
// byte-for-byte confirmed itself), so field names below still list a
// couple of defensive fallbacks, but the primary candidates and the
// error-envelope handling now come from Solscan's own docs, not a guess.
// A field-level miss (unknown key) degrades a single value to null rather
// than failing the whole chain, since the meaningful gate is finding the
// transfer list at all, not any one field.

// "try several plausible field names, never assume" helpers shared with
// CoinLobster and Notable Wallet Activity's Solana leg (see
// app/lib/apiParsing.js) — used by the Tron/Solana parsers below.
import { pick as pickField, extractArray as extractRows, normalizeTimeMs as normalizeMs, scaleAmount } from '../../lib/apiParsing';
import { withCdnCache } from '../../lib/cdnCache';

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
// How many of the most-recent, freshly-sorted rows each chain/token
// contributes, before the panel's own size filter narrows things further.
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
//
// USDT is different: Tether's contract (TetherToken) never emits a
// Transfer from the zero address. Its issue() adds to the owner's balance
// and emits only `Issue(uint amount)`, so a null-address Transfer filter
// can't see a single USDT mint. USDT is read from its Issue events
// instead: rare (days apart), always to Tether's own treasury (the
// contract owner), so a ~30-day window stays small.
const ISSUE_TOPIC = '0xcb8241adb0c3fdb35b70c24ce35c5eb0c17af7431c99f827d44a445ca624176a'; // keccak256("Issue(uint256)")
const TOKENS = [
  { symbol: 'USDT', label: 'Tether', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, color: '#26A17B', blockWindow: 216_000, mintEvent: 'issue' }, // ~30 days
  { symbol: 'USDC', label: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, color: '#2775CA', blockWindow: 900, mintEvent: 'transfer' }, // ~3 hours
];

// Tron USDT (TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t) is the same TetherToken
// contract, so its mints are Issue events too. They're read from TronGrid's
// public contract-events API (no key needed), last ~30 days.
//
// This replaced a scan of TronScan's ~300 most recent USDT transfers for
// ones from the black-hole address: Tron USDT moves dozens of transfers a
// second, so that window covered a few seconds and never caught a mint.
//
// TronGrid's event shape ({ data: [{ event_name, block_timestamp,
// transaction_id, result: { amount } }] }) isn't confirmed against a live
// response from this sandbox (TronGrid is unreachable here), so the
// parser tries a couple of field names and fails loudly with the raw
// response if the list isn't found.
const TRONGRID_BASE = 'https://api.trongrid.io';
const TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRON_DECIMALS = 6;
const TRON_WINDOW_MS = 30 * 86400000;

async function fetchTronMints() {
  const since = Date.now() - TRON_WINDOW_MS;
  const url = `${TRONGRID_BASE}/v1/contracts/${TRON_USDT_CONTRACT}/events?event_name=Issue&only_confirmed=true&order_by=block_timestamp,desc&limit=50&min_block_timestamp=${since}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 300 } });
  if (!res.ok) {
    const detail = await res.text();
    return { chain: 'Tron', symbol: 'USDT', error: `TronGrid returned ${res.status} for USDT Issue events. Raw response: ${detail.slice(0, 300)}` };
  }
  const json = await res.json();
  const rows = extractRows(json, ['data', 'events', 'result']);
  if (!rows) {
    return { chain: 'Tron', symbol: 'USDT', error: `TronGrid's events response didn't match the expected shape. Raw sample: ${JSON.stringify(json).slice(0, 500)}` };
  }

  const mints = rows
    .filter((r) => (pickField(r, ['event_name', 'eventName']) || 'Issue') === 'Issue')
    .map((r) => {
      const result = r.result || {};
      const rawAmount = pickField(result, ['amount', '0', 'value']);
      return {
        chain: 'Tron',
        symbol: 'USDT',
        label: 'Tether (Tron)',
        color: '#26A17B',
        to: null,
        toLabel: 'Tether treasury',
        amount: scaleAmount(rawAmount, TRON_DECIMALS),
        txHash: pickField(r, ['transaction_id', 'transactionId', 'txID']),
        timestamp: normalizeMs(pickField(r, ['block_timestamp', 'timestamp'])),
      };
    });

  return { chain: 'Tron', symbol: 'USDT', mints };
}

const SOLANA_BASE = 'https://pro-api.solscan.io/v2.0';
const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOLANA_DECIMALS = 6;
const SOLANA_PAGE_SIZE = 40;

async function fetchSolanaMints(apiKey) {
  if (!apiKey) return { chain: 'Solana', symbol: 'USDC', mints: [], skipped: true };

  // activity_type=ACTIVITY_SPL_MINT is a direct, documented semantic
  // filter (per Solscan's published activity-type values) — no need to
  // reconstruct "mint" from a null-address transfer pattern here. No `[]`
  // on the param — Solscan's own documented request example for the
  // sibling account/transfer endpoint uses the bare name despite the
  // param being typed as an array.
  const url = `${SOLANA_BASE}/token/transfer?address=${SOLANA_USDC_MINT}&activity_type=ACTIVITY_SPL_MINT&page=1&page_size=${SOLANA_PAGE_SIZE}&sort_by=block_time&sort_order=desc`;
  const res = await fetch(url, { headers: { token: apiKey, accept: 'application/json' }, next: { revalidate: 60 } });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    const apiMessage = json?.errors?.message;
    const detail = apiMessage || JSON.stringify(json)?.slice(0, 300) || (await res.text().catch(() => '')).slice(0, 300);
    return { chain: 'Solana', symbol: 'USDC', error: `Solscan returned ${res.status} for USDC mint activity: ${detail}` };
  }

  const rows = extractRows(json, ['data', 'result', 'transfers', 'items']);
  if (!rows) {
    return { chain: 'Solana', symbol: 'USDC', error: `Solscan's token/transfer response didn't match the expected shape. Raw sample: ${JSON.stringify(json).slice(0, 500)}` };
  }

  const mints = rows.map((r) => {
    const to = pickField(r, ['to_address', 'to', 'destination']);
    const rawAmount = pickField(r, ['amount', 'value', 'token_amount']);
    const decimals = pickField(r, ['token_decimals', 'decimals']) ?? SOLANA_DECIMALS;
    const amount = scaleAmount(rawAmount, decimals);
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
    `&address=${token.address}` +
    (token.mintEvent === 'issue' ? `&topic0=${ISSUE_TOPIC}` : `&topic0=${TRANSFER_TOPIC}&topic0_1_opr=and&topic1=${ZERO_TOPIC}`) +
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
    // Issue events carry only the amount; the tokens go to the treasury.
    const toTopic = token.mintEvent === 'transfer' ? log.topics?.[2] : null;
    const to = toTopic ? `0x${toTopic.slice(-40)}` : null;
    const amount = scaleAmount(log.data, token.decimals);
    return {
      chain: 'Ethereum',
      symbol: token.symbol,
      label: token.label,
      color: token.color,
      to,
      toLabel: token.mintEvent === 'issue' ? 'Tether treasury' : null,
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

async function handler() {
  const etherscanKey = process.env.ETHERSCAN_API_KEY;

  if (!etherscanKey) {
    return Response.json(
      { error: 'ETHERSCAN_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const latestBlock = await fetchLatestBlock(etherscanKey);

    // Etherscan's rate limit is per key and shared with the Notable
    // Wallet Activity route's own calls, which can fire around the same
    // moment on page load — sequencing these two getLogs calls (rather
    // than Promise.all) keeps this route's own burst smaller.
    const fetchEthSequential = async () => {
      const results = [];
      for (const token of TOKENS) {
        results.push(await fetchMints(token, etherscanKey, latestBlock));
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      return results;
    };

    const [ethResults, tronResult] = await Promise.all([
      fetchEthSequential(),
      fetchTronMints(),
      // Solana (Solscan) is disabled here for now — see header comment.
      // fetchSolanaMints below is untouched; re-enable by adding
      // `fetchSolanaMints(process.env.SOLSCAN_API_KEY)` back into this
      // Promise.all and its result back into allResults below.
    ]);

    const allResults = [...ethResults, tronResult];
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

    // Capped per token before merging: USDC's frequent small bridge mints
    // would otherwise push every (rarer, older) USDT issuance off the list.
    const newestFirst = (a, b) => (b.timestamp || 0) - (a.timestamp || 0);
    const mints = succeeded
      .flatMap((r) => [...r.mints].sort(newestFirst).slice(0, DISPLAY_LIMIT))
      .sort(newestFirst);

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

export const GET = withCdnCache(handler, 60);
