// Server-side only — requires a CoinLobster API key (coinlobster.com).
// Real DEX whale swaps on Ethereum, Base, and Arbitrum, with the wallet
// identified. See app/lib/coinlobster.js for sourcing/verification notes.
//
// Response field names below are no longer a guess — confirmed live via
// a CoinLobster MCP connector this session: {swaps: [{chain, dex,
// tokenSymbol, quoteSymbol, isBuy, amountUsd, wallet, txHash,
// timestamp, ...}], ...}. tokenIn/tokenOut aren't sent directly —
// they're derived here from tokenSymbol/quoteSymbol/isBuy.

export const dynamic = 'force-dynamic';

import { fetchCoinLobster, extractArray, pick, normalizeTimeMs } from '../../lib/coinlobster';

const CHAIN_EXPLORERS = {
  ethereum: 'https://etherscan.io',
  eth: 'https://etherscan.io',
  base: 'https://basescan.org',
  arbitrum: 'https://arbiscan.io',
  arb: 'https://arbiscan.io',
};

export async function GET() {
  const apiKey = process.env.COINLOBSTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINLOBSTER_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const json = await fetchCoinLobster('onchain_whales', {}, apiKey, { revalidateSeconds: 120 });
    const rows = extractArray(json, ['swaps', 'trades', 'data', 'results', 'items']);

    if (!rows) {
      return Response.json(
        { error: `CoinLobster's onchain_whales response didn't match the expected shape. Raw sample: ${JSON.stringify(json).slice(0, 500)}` },
        { status: 502 }
      );
    }

    const swaps = rows.map((s) => {
      const chain = pick(s, ['chain', 'network']);
      const chainKey = (chain || '').toLowerCase();
      const txHash = pick(s, ['tx_hash', 'txHash', 'hash', 'txid']);
      const wallet = pick(s, ['wallet', 'address', 'trader']);
      const explorerBase = CHAIN_EXPLORERS[chainKey];
      const isBuy = typeof s.isBuy === 'boolean' ? s.isBuy : null;
      const tokenSymbol = pick(s, ['tokenSymbol', 'token_in', 'sell_token', 'from_token']);
      const quoteSymbol = pick(s, ['quoteSymbol', 'token_out', 'buy_token', 'to_token']);
      const tokenIn = isBuy != null ? (isBuy ? quoteSymbol : tokenSymbol) : pick(s, ['token_in']);
      const tokenOut = isBuy != null ? (isBuy ? tokenSymbol : quoteSymbol) : pick(s, ['token_out']);
      return {
        chain,
        wallet,
        tokenIn,
        tokenOut,
        usd: Number(pick(s, ['amountUsd', 'usd', 'amount_usd', 'value_usd'])) || null,
        txHash,
        txUrl: explorerBase && txHash ? `${explorerBase}/tx/${txHash}` : null,
        walletUrl: explorerBase && wallet ? `${explorerBase}/address/${wallet}` : null,
        timestamp: normalizeTimeMs(pick(s, ['timestamp', 'time', 'ts', 'created_at'])),
      };
    });

    return Response.json({ swaps, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
