// TEMPORARY probe — preview only, removed before merge. Asks CoinLobster
// what it makes of COINLOBSTER_API_KEY. Never returns the key, any part of
// it, or the account email: only status codes, non-secret shape facts and
// response bodies with key/email/token fields and cl_ strings removed.

export const dynamic = 'force-dynamic';

const BASE = 'https://coinlobster.com/api/ai/v1';

function scrub(v) {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v)
        .filter(([k]) => !/key|email|token|secret|wallet|address/i.test(k))
        .map(([k, x]) => [k, scrub(x)])
    );
  }
  if (typeof v === 'string' && /cl_|@/.test(v)) return '[removed]';
  return v;
}

export async function GET() {
  const raw = process.env.COINLOBSTER_API_KEY || '';
  const key = raw.trim();
  const shape = {
    length: key.length,
    trimmedSomething: raw.length !== key.length,
    startsWithClUnderscore: key.startsWith('cl_'),
    hasInnerWhitespace: /\s/.test(key),
    hasQuotes: /["']/.test(key),
    startsWithBearer: /^bearer\s/i.test(key),
  };
  const out = { shape };
  for (const path of ['/status', '/credits/balance']) {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, cache: 'no-store' });
    const text = await res.text();
    let body;
    try { body = scrub(JSON.parse(text)); } catch { body = text.slice(0, 200).replace(/cl_\S+/g, '[removed]'); }
    out[path] = { status: res.status, body: JSON.stringify(body).slice(0, 600) };
  }
  return Response.json(out);
}
