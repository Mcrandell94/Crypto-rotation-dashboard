// TEMPORARY — checks what the CryptoDataAPI key's plan can reach, on the
// preview deployment only. Returns status codes and trimmed samples, never
// the key; strips the account email and key prefix. Removed before merge.

export const dynamic = 'force-dynamic';

const BASE = 'https://cryptodataapi.com';
const PATHS = ['/api/v1/quant/gex?symbol=BTC', '/api/v1/quant/gex?symbol=ETH'];

export async function GET() {
  const key = (process.env.CRYPTODATAAPI_API_KEY || '').trim();
  if (!key) return Response.json({ error: 'CRYPTODATAAPI_API_KEY is not set in this environment' }, { status: 500 });
  const results = [];
  for (const p of PATHS) {
    const res = await fetch(BASE + p, { headers: { 'X-API-Key': key, Accept: 'application/json' }, cache: 'no-store' });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
      if (body && typeof body === 'object') {
        delete body.email;
        delete body.key_prefix;
        delete body.upgrade;
        delete body.meta;
        delete body.regime_legend;
        // keep the shape readable: first and last few bins of any long array
        const trim = (v) => {
          if (Array.isArray(v)) return v.length > 8 ? [...v.slice(0, 4).map(trim), `…${v.length - 8} more…`, ...v.slice(-4).map(trim)] : v.map(trim);
          if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x)]));
          return v;
        };
        body = trim(body);
      }
    } catch {
      body = text.slice(0, 200);
    }
    results.push({ path: p, status: res.status, sample: JSON.stringify(body).slice(0, 6000) });
    await new Promise((r) => setTimeout(r, 400));
  }
  return Response.json({ results, at: new Date().toISOString() });
}
