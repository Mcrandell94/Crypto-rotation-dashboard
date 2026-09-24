// Server-side only — requires the paid Coinglass API key. Provides real
// long-vs-short liquidation volume over time: a genuine market-stress
// signal, on every plan tier including Hobbyist (with the interval
// restriction below). This is deliberately NOT the liquidation heatmap or
// liquidation map (price-level clusters) — Coinglass's own docs mark both
// of those, plus liquidation max-pain, Professional-plan-only ($699+/mo);
// see the panel's own footer note for that distinction.
//
// Coinglass's docs site is unreachable from this sandbox; base URL, auth
// header, and this endpoint's parameters/plan requirements were verified
// against Coinglass's own official docs repo
// (github.com/coinglass-official/coinglass-api-docs) rather than guessed.
// Hobbyist requires interval >= 4h; 1d is used here for a clean 30-day
// daily view, well above that floor.

import { withCdnCache } from '../../lib/cdnCache';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://open-api-v4.coinglass.com/api';
const EXCHANGES = 'Binance,OKX,Bybit,Bitget,Gate';

async function fetchLiquidationsForSymbol(symbol, apiKey) {
  const url = `${BASE_URL}/futures/liquidation/aggregated-history?exchange_list=${EXCHANGES}&symbol=${symbol}&interval=1d&limit=30`;
  const res = await fetch(url, {
    headers: { 'CG-API-KEY': apiKey, Accept: 'application/json' },
    next: { revalidate: 900 },
  });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`Coinglass returned ${res.status} for ${symbol}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  const json = await res.json();
  if (json.code !== '0' && json.code !== 0) {
    const err = new Error(`Coinglass API error for ${symbol}: ${json.msg || 'unknown error'}`);
    err.detail = JSON.stringify(json).slice(0, 500);
    throw err;
  }

  const rows = Array.isArray(json.data) ? json.data : [];
  if (rows.length === 0) {
    const err = new Error(`Coinglass returned no liquidation data for ${symbol}`);
    err.status = 502;
    throw err;
  }

  const days = rows
    .map((r) => ({
      date: new Date(Number(r.time)).toISOString().slice(0, 10),
      longUsd: Number(r.aggregated_long_liquidation_usd) || 0,
      shortUsd: Number(r.aggregated_short_liquidation_usd) || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const last24h = days[days.length - 1];
  const last7d = days.slice(-7);
  const last7dLong = last7d.reduce((s, d) => s + d.longUsd, 0);
  const last7dShort = last7d.reduce((s, d) => s + d.shortUsd, 0);

  return { days, last24h, last7dLong, last7dShort };
}

async function handler() {
  const apiKey = process.env.COINGLASS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINGLASS_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const [btc, eth] = await Promise.allSettled([
      fetchLiquidationsForSymbol('BTC', apiKey),
      fetchLiquidationsForSymbol('ETH', apiKey),
    ]);

    const assets = {};
    const failed = [];
    if (btc.status === 'fulfilled') assets.BTC = btc.value; else failed.push('BTC');
    if (eth.status === 'fulfilled') assets.ETH = eth.value; else failed.push('ETH');

    if (Object.keys(assets).length === 0) {
      const err = btc.status === 'rejected' ? btc.reason : eth.reason;
      return Response.json(
        { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
        { status: err.status || 500 }
      );
    }

    return Response.json({ assets, failed, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}

export const GET = withCdnCache(handler, 900);
