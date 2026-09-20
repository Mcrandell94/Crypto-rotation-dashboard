// Server-side only — requires a Coinglass API key (coinglass.com). The user
// currently has a free/trial key, not a paid subscription — this route
// deliberately only calls endpoints Coinglass's own docs mark as available
// on every plan tier (Hobbyist through Enterprise), so it's a real test of
// what that free key can actually do before paying for anything.
//
// Coinglass's own docs site (docs.coinglass.com) is unreachable from this
// sandbox, same as most providers hit so far. Base URL, auth header, this
// endpoint's parameters, and its "available on all plans" status were
// verified against Coinglass's own official docs repo
// (github.com/coinglass-official/coinglass-api-docs) rather than guessed —
// same standard as reading Deribit/Hyperliquid's own source for other
// routes. By contrast, the same docs mark the liquidation heatmap, the
// liquidation map, and liquidation max-pain endpoints Professional-plan-only
// ($699+/mo) — deliberately not used here, and not silently pretended to
// exist; see the panel's own footer note.

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://open-api-v4.coinglass.com/api';

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] != null) return obj[k];
  }
  return null;
}

async function fetchOiForSymbol(symbol, apiKey) {
  const res = await fetch(`${BASE_URL}/futures/open-interest/exchange-list?symbol=${symbol}`, {
    headers: { 'CG-API-KEY': apiKey, Accept: 'application/json' },
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`Coinglass returned ${res.status} for ${symbol} open interest`);
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
    const err = new Error(`Coinglass returned no open interest rows for ${symbol}`);
    err.detail = JSON.stringify(json).slice(0, 500);
    throw err;
  }

  const totalRow = rows.find((r) => r.exchange === 'All' || r.exchangeName === 'All');
  const byExchange = rows
    .filter((r) => {
      const name = pick(r, ['exchange', 'exchangeName']);
      return name && name !== 'All';
    })
    .map((r) => ({
      exchange: pick(r, ['exchange', 'exchangeName']),
      openInterestUsd: Number(pick(r, ['open_interest_usd', 'openInterestUsd'])) || 0,
      change24h: (() => {
        const v = pick(r, ['open_interest_change_percent_24h', 'oi_change_percent_24h', 'change_percent_24h', 'h24_change']);
        return v != null ? Number(v) : null;
      })(),
    }))
    .filter((e) => e.openInterestUsd > 0)
    .sort((a, b) => b.openInterestUsd - a.openInterestUsd);

  if (byExchange.length === 0) {
    const detail = JSON.stringify(rows[0]).slice(0, 500);
    const err = new Error(`Coinglass open interest response for ${symbol} didn't match the expected field shape. Raw sample: ${detail}`);
    err.detail = detail;
    throw err;
  }

  const totalUsd = totalRow
    ? Number(pick(totalRow, ['open_interest_usd', 'openInterestUsd'])) || null
    : byExchange.reduce((s, e) => s + e.openInterestUsd, 0);

  return { symbol, totalUsd, byExchange };
}

export async function GET() {
  const apiKey = process.env.COINGLASS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINGLASS_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const [btc, eth] = await Promise.all([
      fetchOiForSymbol('BTC', apiKey),
      fetchOiForSymbol('ETH', apiKey),
    ]);
    return Response.json({ assets: { BTC: btc, ETH: eth }, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
