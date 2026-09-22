// Server-side only — requires ETHERSCAN_API_KEY; SOLSCAN_API_KEY optional
// (Solana wallets are skipped, not failed, without it). Watches a small,
// curated list of publicly-labeled exchange and market-maker wallets for
// real USDT/USDC transfers in and out — a companion to the Stablecoin
// Mint Feed, same "Printer Watch" data (real on-chain stablecoin
// movement), just wallet-centric instead of contract-wide.
//
// Scoped to USDT/USDC only, not general token activity — keeps this
// consistent with Printer Watch's theme and lets it reuse the same
// contract/mint addresses already verified for the mint feed, instead of
// needing a live price feed to size arbitrary token transfers.
//
// Every wallet address below was cross-checked against its block
// explorer's own public entity label (Etherscan's / Solscan's own
// tagging, via each explorer's indexed page title — same verification
// standard used for the stablecoin contract addresses) rather than
// recalled from memory; etherscan.io and solscan.io are both unreachable
// directly from this dev sandbox. Only entities/chains with a clearly
// labeled address were included — no Tron wallet for any of these four
// entities, and no Solana wallet for Wintermute/Jump Trading/GSR, was
// well-enough documented to include, so those combinations are simply
// absent rather than guessed.
//
// Uses Etherscan's account/tokentx endpoint (not getLogs, which the mint
// feed uses) since this is address-centric: tokentx returns every
// transfer of a given token in or out of one address directly, both
// directions, in one call — the documented, intended tool for exactly
// this, with well-documented response fields (docs.etherscan.io), unlike
// the getLogs topic-decoding the mint feed needs.
//
// Solscan's account/transfer endpoint is the Solana equivalent, and its
// exact request/response shape is now confirmed from Solscan's own full
// reference page (pasted in by the user), not guessed:
//   - wallet param is `address` (required) — NOT `account`. An earlier fix
//     here changed it to `account` based on a curl example for a
//     different endpoint, /v2.0/account/transactions (plural) — that
//     endpoint does use `account`, but /account/transfer (singular, what
//     this route calls) uses `address`. Solscan is just inconsistent
//     between the two; this is back to `address`, confirmed correct for
//     THIS endpoint by its own reference doc.
//   - page_size only accepts 10/20/30/40/60/100 (default 10) — the 25
//     this route used before was never a valid value.
//   - response is {success, data: [{block_id, trans_id, block_time, time,
//     activity_type, from_address, from_token_account, to_address,
//     to_token_account, token_address, token_decimals, amount, flow}]}.
//     `flow` ("in"/"out") is reported directly by the API — used below
//     instead of deriving direction by comparing addresses ourselves.
//   - an error response is {success: false, errors: {code, message}} —
//     surfaced directly when present, for a much clearer message than a
//     truncated raw body.

export const dynamic = 'force-dynamic';

const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api';
const ETHEREUM_CHAIN_ID = 1;
const ETH_TOKENS = [
  { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, color: '#26A17B' },
  { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, color: '#2775CA' },
];

const SOLANA_BASE = 'https://pro-api.solscan.io/v2.0';
const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOLANA_DECIMALS = 6;

// entity/address pairs verified against each explorer's own public label
// (see header comment) — expand only with the same standard, never a guess.
const WATCHED_WALLETS = [
  { entity: 'Binance', chain: 'Ethereum', address: '0x28c6c06298d514db089934071355e5743bf21d60', sourceLabel: 'Binance 14' },
  { entity: 'Binance', chain: 'Solana', address: '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', sourceLabel: 'Binance 2' },
  { entity: 'Wintermute', chain: 'Ethereum', address: '0xdbf5e9c5206d0db70a90108bf936da60221dc080', sourceLabel: 'Wintermute' },
  { entity: 'Jump Trading', chain: 'Ethereum', address: '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621', sourceLabel: 'Jump Trading' },
  { entity: 'GSR', chain: 'Ethereum', address: '0xd8d6ffe342210057bf4dcc31da28d006f253cef0', sourceLabel: 'GSR' },
];

const ETH_PER_WALLET_FETCH = 25;
// Solscan's page_size only accepts 10/20/30/40/60/100 — 25 isn't valid.
const SOLANA_PAGE_SIZE = 20;
const DISPLAY_LIMIT = 40;

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
  return n < 1e12 ? n * 1000 : n;
}

async function fetchEthWalletActivity(wallet, apiKey) {
  const perToken = await Promise.all(ETH_TOKENS.map(async (token) => {
    const url =
      `${ETHERSCAN_BASE}?chainid=${ETHEREUM_CHAIN_ID}&module=account&action=tokentx` +
      `&address=${wallet.address}&contractaddress=${token.address}&page=1&offset=${ETH_PER_WALLET_FETCH}&sort=desc&apikey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) {
      const detail = await res.text();
      return { error: `Etherscan returned ${res.status} for ${wallet.entity} ${token.symbol} activity. Raw response: ${detail.slice(0, 300)}` };
    }
    const json = await res.json();
    if (json.status !== '1') {
      if (json.message === 'No transactions found') return { rows: [] };
      return { error: `Etherscan API error for ${wallet.entity} ${token.symbol}: ${json.message || 'unknown error'}. Raw sample: ${JSON.stringify(json).slice(0, 300)}` };
    }

    const rows = (Array.isArray(json.result) ? json.result : []).map((tx) => {
      const isOut = tx.from?.toLowerCase() === wallet.address.toLowerCase();
      let amount = null;
      try {
        amount = Number(BigInt(tx.value)) / 10 ** Number(tx.tokenDecimal || token.decimals);
      } catch {
        amount = null;
      }
      return {
        entity: wallet.entity,
        chain: 'Ethereum',
        symbol: token.symbol,
        color: token.color,
        direction: isOut ? 'out' : 'in',
        amount,
        counterparty: isOut ? tx.to : tx.from,
        txHash: tx.hash,
        timestamp: tx.timeStamp ? Number(tx.timeStamp) * 1000 : null,
      };
    });
    return { rows };
  }));

  const errors = perToken.filter((r) => r.error);
  if (errors.length === ETH_TOKENS.length) {
    return { entity: wallet.entity, chain: wallet.chain, error: errors.map((e) => e.error).join(' | ') };
  }
  return { entity: wallet.entity, chain: wallet.chain, rows: perToken.flatMap((r) => r.rows || []) };
}

async function fetchSolanaWalletActivity(wallet, apiKey) {
  if (!apiKey) return { entity: wallet.entity, chain: wallet.chain, rows: [], skipped: true };

  const url =
    `${SOLANA_BASE}/account/transfer?address=${wallet.address}&activity_type=ACTIVITY_SPL_TRANSFER` +
    `&token=${SOLANA_USDC_MINT}&page=1&page_size=${SOLANA_PAGE_SIZE}&sort_by=block_time&sort_order=desc`;
  const res = await fetch(url, { headers: { token: apiKey, accept: 'application/json' }, next: { revalidate: 60 } });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    const apiMessage = json?.errors?.message;
    const detail = apiMessage || JSON.stringify(json)?.slice(0, 300) || (await res.text().catch(() => '')).slice(0, 300);
    return { entity: wallet.entity, chain: wallet.chain, error: `Solscan returned ${res.status} for ${wallet.entity} activity: ${detail}` };
  }

  const rawRows = extractRows(json, ['data', 'result', 'transfers', 'items']);
  if (!rawRows) {
    return { entity: wallet.entity, chain: wallet.chain, error: `Solscan's account/transfer response didn't match the expected shape. Raw sample: ${JSON.stringify(json).slice(0, 500)}` };
  }

  // The `token` query param scopes results server-side, but also filter
  // client-side against the known USDC mint as a belt-and-suspenders
  // check wherever a token field is present.
  const rows = rawRows
    .filter((r) => {
      const mint = pickField(r, ['token_address', 'tokenAddress', 'mint']);
      return mint == null || mint === SOLANA_USDC_MINT;
    })
    .map((r) => {
      const from = pickField(r, ['from_address', 'from']);
      const to = pickField(r, ['to_address', 'to']);
      // The API reports direction directly via `flow` ("in"/"out") —
      // trust that over deriving it ourselves by comparing addresses.
      const flow = pickField(r, ['flow']);
      const isOut = flow ? flow === 'out' : from === wallet.address;
      const rawAmount = pickField(r, ['amount', 'value']);
      const decimals = Number(pickField(r, ['token_decimals', 'decimals']) ?? SOLANA_DECIMALS);
      const n = rawAmount != null ? Number(rawAmount) : null;
      const amount = Number.isFinite(n) ? n / 10 ** decimals : null;
      return {
        entity: wallet.entity,
        chain: 'Solana',
        symbol: 'USDC',
        color: '#2775CA',
        direction: isOut ? 'out' : 'in',
        amount,
        counterparty: isOut ? to : from,
        txHash: pickField(r, ['trans_id', 'signature', 'tx_hash']),
        timestamp: normalizeMs(pickField(r, ['block_time', 'time', 'timestamp'])),
      };
    });

  return { entity: wallet.entity, chain: wallet.chain, rows };
}

export async function GET() {
  const etherscanKey = process.env.ETHERSCAN_API_KEY;
  const solscanKey = process.env.SOLSCAN_API_KEY;

  if (!etherscanKey) {
    return Response.json(
      { error: 'ETHERSCAN_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const results = await Promise.all(
      WATCHED_WALLETS.map((w) =>
        w.chain === 'Ethereum' ? fetchEthWalletActivity(w, etherscanKey) : fetchSolanaWalletActivity(w, solscanKey)
      )
    );

    const failed = results.filter((r) => r.error);
    const skipped = results.filter((r) => r.skipped);
    const succeeded = results.filter((r) => !r.error && !r.skipped);

    if (succeeded.length === 0) {
      const reasons = failed.map((f) => f.error).join(' | ').slice(0, 700);
      return Response.json(
        { error: `Notable wallet activity lookup failed for every tracked wallet: ${reasons}`, detail: JSON.stringify(failed).slice(0, 800) },
        { status: 502 }
      );
    }

    const activity = succeeded
      .flatMap((r) => r.rows)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, DISPLAY_LIMIT);

    return Response.json({
      activity,
      walletsFailed: failed.map((f) => ({ entity: f.entity, chain: f.chain, error: f.error })),
      walletsSkipped: skipped.map((s) => ({ entity: s.entity, chain: s.chain, reason: 'API key not configured' })),
      watchedWallets: WATCHED_WALLETS.map((w) => ({ entity: w.entity, chain: w.chain, sourceLabel: w.sourceLabel })),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message || 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
