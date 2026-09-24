// Server-side. Kraken's public Ticker endpoint — fully keyless, no account
// needed. Same as /api/btcprice, just the ETH pair — used to drive the ETH
// side of the liquidation-levels tracker's "has price crossed this level"
// check, so it needs the actual last-traded price rather than a candle close.

import { withCdnCache } from '../../lib/cdnCache';

export const dynamic = 'force-dynamic';

const KRAKEN_TICKER_URL = 'https://api.kraken.com/0/public/Ticker?pair=ETHUSD';

async function handler() {
  try {
    const res = await fetch(KRAKEN_TICKER_URL, { next: { revalidate: 30 } });
    if (!res.ok) {
      const detail = await res.text();
      return Response.json({ error: `Kraken returned ${res.status}`, detail: detail.slice(0, 500) }, { status: res.status });
    }

    const json = await res.json();
    if (json.error?.length) {
      return Response.json({ error: `Kraken error: ${json.error.join(', ')}` }, { status: 502 });
    }

    const result = json.result || {};
    const key = Object.keys(result)[0];
    const ticker = key ? result[key] : null;
    const price = ticker ? Number(ticker.c?.[0]) : null;

    if (!Number.isFinite(price)) {
      const detail = JSON.stringify(json).slice(0, 500);
      return Response.json(
        { error: `Kraken's ticker response didn't match the expected shape. Raw sample: ${detail}`, detail },
        { status: 502 }
      );
    }

    return Response.json({ price, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: err.message || 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}

export const GET = withCdnCache(handler, 30);
