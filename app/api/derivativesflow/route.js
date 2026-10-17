// Server-side only — requires a CryptoDataAPI key (cryptodataapi.com, keys
// start with cdk_live_), sent as the X-API-Key header. Two short-window
// reads the other liquidation sources here don't give:
// - realized liquidations, long vs short, over the trailing 1h/4h/12h/24h
//   (OKX + Bybit + Hyperliquid; Binance geo-blocks CryptoDataAPI's
//   collector, so totals run below an all-exchange figure — the panel says
//   so), next to Coinglass's daily bars;
// - taker buy share over the trailing 4h, per exchange (Binance for BTC,
//   plus Hyperliquid's own trade tape).
// Endpoints and response shapes verified against CryptoDataAPI's OpenAPI
// spec (cryptodataapi.com/api/openapi.json) and live responses on
// 2026-10-17; parsing in lib/cryptoDataApi.
//
// The free tier covers BTC (1,000 requests/day); Pro adds ETH's rolling
// liquidations (10,000/day, 30/minute). Each URL below is fetched at most
// once per REVALIDATE seconds (shared Data Cache), so four URLs stay under
// ~1,200 calls/day however many people load the page.

import { withCdnCache } from '../../lib/cdnCache';
import { liquidationWindows, takerLegs } from '../../lib/cryptoDataApi';

export const dynamic = 'force-dynamic';

const BASE = 'https://cryptodataapi.com/api/v1/market-intelligence';
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
  // 402/403 = the endpoint or coin isn't on this key's plan: expected on
  // the free tier, so it's reported as unavailable, not as a failure.
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

  const liquidations = {};
  const taker = {};
  const unavailable = [];
  const failed = [];

  const jobs = ASSETS.flatMap((sym) => [
    ['liquidations', sym, `/liquidations?symbol=${sym}`, liquidationWindows, liquidations],
    ['taker', sym, `/taker-buy-sell?symbol=${sym}`, takerLegs, taker],
  ]);
  await Promise.all(
    jobs.map(async ([kind, sym, path, parse, into]) => {
      const r = await getJson(path, key);
      if (r.json) {
        const parsed = parse(r.json, sym);
        if (parsed) into[sym] = parsed;
        else failed.push({ kind, symbol: sym, error: `No ${sym} row in CryptoDataAPI's ${kind} response. Raw sample: ${JSON.stringify(r.json).slice(0, 300)}` });
      } else if (r.gated) {
        unavailable.push({ kind, symbol: sym, reason: `Not on this CryptoDataAPI plan (${r.status})` });
      } else {
        failed.push({ kind, symbol: sym, error: `CryptoDataAPI returned ${r.status} for ${kind} ${sym}: ${r.detail}` });
      }
    })
  );

  if (!Object.keys(liquidations).length && !Object.keys(taker).length) {
    const reasons = [...failed.map((f) => f.error), ...unavailable.map((u) => `${u.kind} ${u.symbol}: ${u.reason}`)];
    return Response.json({ error: `CryptoDataAPI returned nothing usable: ${reasons.join(' | ').slice(0, 600)}` }, { status: 502 });
  }
  return Response.json({ liquidations, taker, unavailable, failed, source: 'CryptoDataAPI', fetchedAt: new Date().toISOString() });
}

export const GET = withCdnCache(handler, REVALIDATE);
