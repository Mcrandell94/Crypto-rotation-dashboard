// Server-side only — requires a CoinLobster API key (coinlobster.com).
// Real DEX whale swaps on Ethereum, Base, and Arbitrum, with the wallet
// identified. See app/lib/coinlobster.js for sourcing/verification notes
// and why fields are read defensively.

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
      const txHash = pick(s, ['tx_hash', 'hash', 'txid']);
      const explorerBase = CHAIN_EXPLORERS[chainKey];
      return {
        chain,
        wallet: pick(s, ['wallet', 'address', 'trader']),
        tokenIn: pick(s, ['token_in', 'sell_token', 'from_token']),
        tokenOut: pick(s, ['token_out', 'buy_token', 'to_token']),
        usd: Number(pick(s, ['usd', 'amount_usd', 'value_usd'])) || null,
        txHash,
        txUrl: explorerBase && txHash ? `${explorerBase}/tx/${txHash}` : null,
        walletUrl: explorerBase && pick(s, ['wallet', 'address', 'trader'])
          ? `${explorerBase}/address/${pick(s, ['wallet', 'address', 'trader'])}`
          : null,
        timestamp: normalizeTimeMs(pick(s, ['time', 'timestamp', 'ts', 'created_at'])),
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
