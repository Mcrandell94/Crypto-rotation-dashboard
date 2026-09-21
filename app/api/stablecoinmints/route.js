// Server-side only — requires an Etherscan API key (etherscan.io). A
// stablecoin "mint" is, on Ethereum, an ERC-20 Transfer event from the
// null address (0x000...000) to the issuer's treasury/minter wallet —
// this route watches USDT's and USDC's contracts via Etherscan's getLogs
// for exactly that event, a real on-chain fact, not a guessed or derived
// signal.
//
// Ethereum only. Both stablecoins mint on multiple chains — most notably,
// the majority of USDT's supply is actually minted on Tron, not Ethereum
// — so this feed shows real, verified Ethereum mints, not the complete
// cross-chain picture. Tron coverage (via TronScan's API) would be
// separate follow-up work, not something to fabricate here.
//
// Contract addresses were verified against two independent public
// sources (Uniswap's default-token-list and Trust Wallet's assets repo,
// both on GitHub) rather than recalled from memory, since etherscan.io
// itself is unreachable from this dev sandbox to cross-check directly
// (same as most providers hit this session) — both external sources
// agree and link back to the same Etherscan token pages.
//
// Uses Etherscan's V2 API (api.etherscan.io/v2/api, chainid=1 for
// Ethereum mainnet) rather than the legacy per-chain V1 host
// (api.etherscan.io/api) — Etherscan unified all their per-chain
// explorers behind one multichain key on V2, and newer API keys are
// increasingly V2-only, so V1 is the wrong endpoint to build against now.

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
// shows, after the panel's own size filter narrows things further.
const DISPLAY_LIMIT = 30;

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

  return { symbol: token.symbol, mints };
}

export async function GET() {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'ETHERSCAN_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const latestBlock = await fetchLatestBlock(apiKey);

    const results = await Promise.all(TOKENS.map((t) => fetchMints(t, apiKey, latestBlock)));
    const failed = results.filter((r) => r.error);
    const succeeded = results.filter((r) => !r.error);

    if (succeeded.length === 0) {
      // The reason each token failed goes directly in `error`, not just a
      // separate `detail` field — the client only ever surfaces `error`.
      const reasons = failed.map((f) => f.error).join(' | ').slice(0, 700);
      return Response.json(
        { error: `Etherscan mint lookup failed for every tracked token: ${reasons}`, detail: JSON.stringify(failed).slice(0, 800) },
        { status: 502 }
      );
    }

    const mints = succeeded
      .flatMap((r) => r.mints)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, DISPLAY_LIMIT);

    return Response.json({
      mints,
      tokensFailed: failed.map((f) => ({ symbol: f.symbol, error: f.error })),
      windowBlocksBySymbol: Object.fromEntries(TOKENS.map((t) => [t.symbol, t.blockWindow])),
      latestBlock,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message || 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
