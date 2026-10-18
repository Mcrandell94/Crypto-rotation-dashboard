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
  for (const [label, withKey] of [['mcp+key', true], ['mcp keyless', false]]) {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
    if (withKey) headers.Authorization = `Bearer ${key}`;
    const res = await fetch('https://coinlobster.com/mcp', {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'liquidations', arguments: { coin: 'BTC', scope: 'projected', detail: 'full' } } }),
    });
    const text = await res.text();
    const data = text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5)).join('') || text;
    let j = null;
    try { j = JSON.parse(JSON.parse(data).result.content[0].text); } catch {}
    out[label] = j
      ? { status: res.status, as_of: j.as_of, delayed: j.delayed ?? null, bands: j.projection?.bands?.length ?? null, sides: [...new Set((j.projection?.bands || []).map((b) => b.side))], access_note: String(j.access_note || '').slice(0, 160) }
      : { status: res.status, body: data.slice(0, 300).replace(/cl_\S+/g, '[removed]') };
  }
  return Response.json(out);
}
