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

export const dynamic = 'force-dynamic';

const ETHERSCAN_BASE = 'https://api.etherscan.io/api';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO_TOPIC = `0x${'0'.repeat(64)}`;
// ~7 days of Ethereum blocks at a ~12s block time. Bounded so Etherscan's
// getLogs doesn't have to scan since-genesis history on every call, while
// still wide enough that the feed isn't empty between mints (USDT/USDC
// mint irregularly — sometimes daily, sometimes with multi-day gaps).
const BLOCK_WINDOW = 50_400;
const MAX_MINTS = 20;

const TOKENS = [
  { symbol: 'USDT', label: 'Tether', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, color: '#26A17B' },
  { symbol: 'USDC', label: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, color: '#2775CA' },
];

async function fetchLatestBlock(apiKey) {
  const url = `${ETHERSCAN_BASE}?module=proxy&action=eth_blockNumber&apikey=${apiKey}`;
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

async function fetchMints(token, apiKey, fromBlock) {
  const url =
    `${ETHERSCAN_BASE}?module=logs&action=getLogs&fromBlock=${fromBlock}&toBlock=latest` +
    `&address=${token.address}&topic0=${TRANSFER_TOPIC}&topic0_1_opr=and&topic1=${ZERO_TOPIC}` +
    `&page=1&offset=${MAX_MINTS}&sort=desc&apikey=${apiKey}`;

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
    const fromBlock = Math.max(0, latestBlock - BLOCK_WINDOW);

    const results = await Promise.all(TOKENS.map((t) => fetchMints(t, apiKey, fromBlock)));
    const failed = results.filter((r) => r.error);
    const succeeded = results.filter((r) => !r.error);

    if (succeeded.length === 0) {
      return Response.json(
        { error: 'Etherscan mint lookup failed for every tracked token.', detail: JSON.stringify(failed).slice(0, 800) },
        { status: 502 }
      );
    }

    const mints = succeeded
      .flatMap((r) => r.mints)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, MAX_MINTS);

    return Response.json({
      mints,
      tokensFailed: failed.map((f) => ({ symbol: f.symbol, error: f.error })),
      windowBlocks: BLOCK_WINDOW,
      latestBlock,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message || 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
