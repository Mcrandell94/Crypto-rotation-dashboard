// Server-side. MarginPad's public liquidation feed — genuinely free and
// keyless (no account or API key needed for market-data endpoints).
// Verified against MarginPad's own official Python SDK source
// (github.com/cocchako-ops/marginpad, sdk/python/marginpad/__init__.py),
// since marginpad.io's own docs site is unreachable from this sandbox
// like most providers hit so far. That SDK source is also what corrected
// an earlier wrong guess (general web search had suggested separate
// `/recent`, `/live`, `/clusters` endpoints with pre-bucketed price
// levels) — the real, current API is a single `/api/v1/liquidations`
// endpoint normalizing events across 9 exchanges (Binance, Bybit, OKX,
// Hyperliquid, Gate, HTX, dYdX, BitMEX, Bitfinex).
//
// Response envelope per the SDK: {"ok": true, "data": ...} on success,
// {"ok": false, "error": {code, message}} on failure. The exact shape of
// `data` for this endpoint specifically (flat array vs. grouped by
// symbol) wasn't directly confirmed, so parsing handles both and fails
// loudly with a raw sample if neither matches.

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://marginpad.io';

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] != null) return obj[k];
  }
  return null;
}

function normalizeEvent(e) {
  return {
    symbol: pick(e, ['symbol', 'coin', 'asset']),
    side: pick(e, ['side', 'direction']),
    price: Number(pick(e, ['price'])),
    notionalUsd: Number(pick(e, ['notional', 'notional_usd', 'value', 'amount']) ?? 0),
    timestamp: pick(e, ['timestamp', 'time', 't']),
  };
}

export async function GET() {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/liquidations`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      const detail = await res.text();
      return Response.json({ error: `MarginPad returned ${res.status}`, detail: detail.slice(0, 500) }, { status: res.status });
    }

    const json = await res.json();
    if (json?.ok === false) {
      return Response.json(
        { error: `MarginPad API error: ${json.error?.message || json.error?.code || 'unknown error'}` },
        { status: 502 }
      );
    }

    const payload = json?.data ?? json;
    let rows = null;
    if (Array.isArray(payload)) {
      rows = payload;
    } else if (payload && typeof payload === 'object') {
      // Possible grouped-by-symbol shape: flatten { BTC: [...], ETH: [...] } into one list.
      const flattened = Object.values(payload).flat();
      if (Array.isArray(flattened) && flattened.length > 0 && typeof flattened[0] === 'object') rows = flattened;
    }

    if (!rows || rows.length === 0) {
      const detail = JSON.stringify(json).slice(0, 800);
      return Response.json(
        { error: `MarginPad's liquidations response didn't match a known shape. Raw sample: ${detail}`, detail },
        { status: 502 }
      );
    }

    const events = rows
      .map(normalizeEvent)
      .filter((e) => e.symbol && e.side && Number.isFinite(e.price))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50);

    if (events.length === 0) {
      const detail = JSON.stringify(rows[0]).slice(0, 500);
      return Response.json(
        { error: `MarginPad's liquidation events didn't match the expected field shape. Raw sample: ${detail}`, detail },
        { status: 502 }
      );
    }

    return Response.json({ events, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: err.message || 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
