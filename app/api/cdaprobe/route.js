// TEMPORARY — one-off check of the CRYPTODATAAPI_API_KEY on the preview
// deployment: status and a trimmed sample per endpoint. Never returns the
// key; strips the account email and key prefix. Removed before merge.

export const dynamic = 'force-dynamic';

const BASE = 'https://cryptodataapi.com';
const PATHS = [
  '/api/v1/auth/keys/me',
  '/api/v1/market-intelligence/taker-buy-sell?symbol=BTC',
  '/api/v1/market-intelligence/taker-buy-sell?symbol=ETH',
  '/api/v1/market-intelligence/liquidations?symbol=BTC',
  '/api/v1/market-intelligence/liquidations/by-exchange',
  '/api/v1/liquidity/depth/BTC',
  '/api/v1/liquidity/oi-divergence',
  '/api/v1/quant/whales',
];

export async function GET() {
  const key = process.env.CRYPTODATAAPI_API_KEY;
  if (!key) return Response.json({ error: 'CRYPTODATAAPI_API_KEY is not set in this environment' }, { status: 500 });
  const results = [];
  for (const p of PATHS) {
    const t0 = Date.now();
    try {
      const res = await fetch(BASE + p, { headers: { 'X-API-Key': key, Accept: 'application/json' }, cache: 'no-store' });
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
        if (p.includes('/auth/keys/me') && body && typeof body === 'object') {
          delete body.email;
          delete body.key_prefix;
        }
      } catch {
        body = text.slice(0, 300);
      }
      const rl = Object.fromEntries([...res.headers.entries()].filter(([k]) => /ratelimit|rate-limit|retry-after/i.test(k)));
      results.push({ path: p, status: res.status, ms: Date.now() - t0, rateLimitHeaders: rl, sample: JSON.stringify(body).slice(0, 2500) });
    } catch (err) {
      results.push({ path: p, error: String(err).slice(0, 200) });
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return Response.json({ results, at: new Date().toISOString() });
}
