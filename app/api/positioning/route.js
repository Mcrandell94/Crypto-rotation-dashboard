// Server-side only — requires a CryptoDataAPI Pro key (CRYPTODATAAPI_API_KEY;
// cryptodataapi.com). Who holds what on Hyperliquid, from every account
// >= $100k (~5-minute fresh):
// - /quant/positioning: long/short/net per coin by trader type (whales,
//   market makers, everyone else) and tag (smart money, high leverage);
// - /quant/whales: the whole book's long share and net bias;
// - /quant/gex: dealer-gamma analog from market-maker accounts only — a
//   regime read (amplify = forced flow follows through, dampen = moves
//   fade), the "gamma flip" price, and the nearest market-maker
//   liquidation clusters either side of the mark.
// Shapes confirmed against live Pro responses on 2026-10-17; parsing in
// lib/cryptoDataApi. The all-account liquidation ladder
// (/quant/positioning/ladder) is Pro Plus and not used.
//
// Pro allows 10,000 requests/day and 30/minute. Five URLs, each fetched
// at most once per REVALIDATE seconds (shared Data Cache): under 1,500/day.

import { withCdnCache } from '../../lib/cdnCache';
import { positioningOf, whaleSummaryOf, gexOf } from '../../lib/cryptoDataApi';

export const dynamic = 'force-dynamic';

const BASE = 'https://cryptodataapi.com/api/v1/quant';
const ASSETS = ['BTC', 'ETH'];
const REVALIDATE = 300;

async function getJson(path, key) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-API-Key': key, Accept: 'application/json' },
    next: { revalidate: REVALIDATE },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  if (res.ok && json) return { json };
  const detail = json?.detail?.message || json?.detail?.error || json?.message || text.slice(0, 200);
  // 402/403 = not on this key's plan: reported as unavailable, not failed,
  // so lib/cdnCache still caches the rest at the edge.
  return { status: res.status, gated: res.status === 402 || res.status === 403, detail };
}

async function handler() {
  const key = (process.env.CRYPTODATAAPI_API_KEY || '').trim();
  if (!key) {
    return Response.json(
      { error: 'CRYPTODATAAPI_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  const positioning = {};
  const gex = {};
  let whales = null;
  const unavailable = [];
  const failed = [];

  const jobs = [
    ...ASSETS.map((sym) => ['positioning', sym, `/positioning?symbol=${sym}`, (j) => positioningOf(j, sym), (v) => { positioning[sym] = v; }]),
    ...ASSETS.map((sym) => ['gex', sym, `/gex?symbol=${sym}`, (j) => gexOf(j, sym), (v) => { gex[sym] = v; }]),
    ['whales', null, '/whales', whaleSummaryOf, (v) => { whales = v; }],
  ];
  await Promise.all(
    jobs.map(async ([kind, sym, path, parse, keep]) => {
      const r = await getJson(path, key);
      if (r.json) {
        const parsed = parse(r.json);
        if (parsed) keep(parsed);
        else failed.push({ kind, symbol: sym, error: `CryptoDataAPI's ${kind} response didn't have the expected ${sym || 'summary'} data. Raw sample: ${JSON.stringify(r.json).slice(0, 300)}` });
      } else if (r.gated) {
        unavailable.push({ kind, symbol: sym, reason: `Not on this CryptoDataAPI plan (${r.status}; needs Pro)` });
      } else {
        failed.push({ kind, symbol: sym, error: `CryptoDataAPI returned ${r.status} for ${kind}${sym ? ` ${sym}` : ''}: ${r.detail}` });
      }
    })
  );

  if (!Object.keys(positioning).length && !Object.keys(gex).length && !whales) {
    const reasons = [...failed.map((f) => f.error), ...unavailable.map((u) => `${u.kind}${u.symbol ? ` ${u.symbol}` : ''}: ${u.reason}`)];
    return Response.json({ error: `CryptoDataAPI returned nothing usable: ${reasons.join(' | ').slice(0, 600)}` }, { status: 502 });
  }
  return Response.json({ positioning, gex, whales, unavailable, failed, source: 'CryptoDataAPI', fetchedAt: new Date().toISOString() });
}

export const GET = withCdnCache(handler, REVALIDATE);
