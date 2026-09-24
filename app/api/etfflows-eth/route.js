// Server-side only — requires the paid Coinglass API key (confirmed by
// Coinglass's own docs to be available on every plan tier, Hobbyist
// included). Ethereum spot ETF flows aren't covered anywhere else in this
// dashboard — the existing Spot ETF Flows panel is BTC-only, via SoSoValue.
//
// Coinglass's docs site (docs.coinglass.com) is unreachable from this
// sandbox, same as most providers hit so far. Base URL, auth header, and
// this endpoint's shape were verified against Coinglass's own official
// docs repo (github.com/coinglass-official/coinglass-api-docs) instead of
// guessed.

import { withCdnCache } from '../../lib/cdnCache';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://open-api-v4.coinglass.com/api';

async function handler() {
  const apiKey = process.env.COINGLASS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINGLASS_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${BASE_URL}/etf/ethereum/flow-history`, {
      headers: { 'CG-API-KEY': apiKey, Accept: 'application/json' },
      next: { revalidate: 1800 },
    });
    if (!res.ok) {
      const detail = await res.text();
      return Response.json({ error: `Coinglass returned ${res.status}`, detail }, { status: res.status });
    }

    const json = await res.json();
    if (json.code !== '0' && json.code !== 0) {
      return Response.json(
        { error: `Coinglass API error: ${json.msg || 'unknown error'}`, detail: JSON.stringify(json).slice(0, 500) },
        { status: 502 }
      );
    }

    const rows = Array.isArray(json.data) ? json.data : [];
    if (rows.length === 0) {
      return Response.json({ error: 'Coinglass returned no Ethereum ETF flow data' }, { status: 502 });
    }

    const days = [...rows]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((d) => ({
        date: new Date(Number(d.timestamp)).toISOString().slice(0, 10),
        netInflow: Number(d.flow_usd) || 0,
      }));

    const latest = days[days.length - 1];
    const last5 = days.slice(-5);
    const last5Total = last5.reduce((sum, d) => sum + d.netInflow, 0);

    return Response.json({ days, latest, last5Total, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}

export const GET = withCdnCache(handler, 1800);
