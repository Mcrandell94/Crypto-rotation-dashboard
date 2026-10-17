// TEMPORARY probe — preview only, removed before merge. Reports this
// key's plan tier and whether the liquidation ladder answers. Never
// returns the key, its prefix, or the account email.

export const dynamic = 'force-dynamic';

const BASE = 'https://cryptodataapi.com/api/v1';

async function hit(path, key) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'X-API-Key': key, Accept: 'application/json' }, cache: 'no-store' });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

export async function GET() {
  const key = (process.env.CRYPTODATAAPI_API_KEY || '').trim();
  if (!key) return Response.json({ error: 'no key' }, { status: 500 });

  const me = await hit('/auth/keys/me', key);
  const plan = me.json
    ? Object.fromEntries(['tier', 'is_active', 'requests_today', 'daily_limit', 'per_minute_limit', 'expires_at', 'upgrade_message'].map((k) => [k, me.json[k] ?? null]))
    : { status: me.status, body: me.text.slice(0, 200) };

  const out = { plan, ladder: {} };
  for (const sym of ['BTC', 'ETH']) {
    const r = await hit(`/quant/positioning/ladder?symbol=${sym}`, key);
    if (r.status === 200 && r.json) {
      const d = r.json.data ?? r.json;
      const coin = d?.[sym] ?? d;
      out.ladder[sym] = { status: 200, keys: Object.keys(coin || {}).slice(0, 30), bins: Array.isArray(coin?.bins) ? coin.bins.length : null, sample: JSON.stringify(coin?.bins?.[0] ?? coin).slice(0, 300) };
    } else {
      out.ladder[sym] = { status: r.status, detail: (r.json?.detail ? JSON.stringify(r.json.detail) : r.text).slice(0, 400) };
    }
  }
  const g = await hit('/quant/gex?symbol=BTC', key);
  const gd = g.json?.data ?? g.json;
  const gc = gd?.BTC ?? gd;
  const prof = gc?.gamma_profile;
  out.gexProfile = { status: g.status, type: Array.isArray(prof) ? `array(${prof.length})` : typeof prof, sample: JSON.stringify(Array.isArray(prof) ? prof.slice(0, 2) : prof).slice(0, 400) };
  return Response.json(out);
}
