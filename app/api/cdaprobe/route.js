// TEMPORARY — one-off check of the CRYPTODATAAPI_API_KEY on the preview
// deployment. Reports only the key's shape (length, the public cdk_live_
// prefix, stray whitespace/quotes) and status codes plus trimmed samples,
// never the key or any of its characters; strips the account email and key
// prefix from /auth/keys/me. Removed before merge.

export const dynamic = 'force-dynamic';

const BASE = 'https://cryptodataapi.com';
const SAMPLES = [
  '/api/v1/market-intelligence/taker-buy-sell?symbol=BTC',
  '/api/v1/market-intelligence/liquidations?symbol=BTC',
  '/api/v1/market-intelligence/liquidations/by-exchange',
  '/api/v1/liquidity/depth/BTC',
];

async function call(path, key) {
  const res = await fetch(BASE + path, { headers: { 'X-API-Key': key, Accept: 'application/json' }, cache: 'no-store' });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
    if (body && typeof body === 'object') {
      delete body.email;
      delete body.key_prefix;
    }
  } catch {
    body = text.slice(0, 200);
  }
  return { path, status: res.status, sample: JSON.stringify(body).slice(0, 2500) };
}

const pause = () => new Promise((r) => setTimeout(r, 700));

export async function GET() {
  const raw = process.env.CRYPTODATAAPI_API_KEY;
  if (!raw) return Response.json({ error: 'CRYPTODATAAPI_API_KEY is not set in this environment' }, { status: 500 });
  const key = raw.trim();
  const shape = {
    length: raw.length,
    trimmedLength: key.length,
    leadingOrTrailingWhitespace: raw !== key,
    wrappedInQuotes: /^["']|["']$/.test(key),
    startsWithCdkLive: key.startsWith('cdk_live_'),
    innerWhitespace: /\s/.test(key),
  };
  const me = await call('/api/v1/auth/keys/me', key);
  const results = [me];
  if (me.status === 200) {
    for (const p of SAMPLES) {
      await pause();
      results.push(await call(p, key));
    }
  }
  return Response.json({ shape, results, at: new Date().toISOString() });
}
