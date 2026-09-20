// This file runs ONLY on the server (Vercel's serverless functions), never in the browser.
// The API key is read from an environment variable — it's never sent to, or visible from,
// the client. This is the whole reason a backend route exists instead of calling CoinMarketCap
// directly from the React page.

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const apiKey = process.env.CMC_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: 'CMC_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  // Default tickers — extend this list as you migrate more of the dashboard's panels over.
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get('symbols') || 'BTC,ETH,SOL,SUI,LINK';

  try {
    // skip_invalid=true so one unrecognized/delisted symbol in a larger sector batch
    // doesn't fail the whole request — CMC just omits it from the response.
    const cmcUrl = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbols}&convert=USD&skip_invalid=true`;

    const res = await fetch(cmcUrl, {
      headers: {
        'X-CMC_PRO_API_KEY': apiKey,
        Accept: 'application/json',
      },
      // Vercel caches this route's response for 60 seconds by default via this option —
      // adjust as needed. This also protects your free-tier call quota from being burned
      // by every page load.
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const errBody = await res.text();
      return Response.json(
        { error: `CoinMarketCap returned ${res.status}`, detail: errBody },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Reshape into exactly the flat structure the dashboard expects, so the frontend
    // component doesn't need to know anything about CoinMarketCap's response format.
    const tickers = {};
    for (const symbol of Object.keys(data.data || {})) {
      // CoinMarketCap's shape here is inconsistent: usually a single object per symbol,
      // but an array when there are multiple listings sharing that ticker. Handle both
      // rather than assume one — this is exactly the kind of thing to verify once you
      // have real output in front of you, since it can't be tested from this environment.
      const raw = data.data[symbol];
      const entry = Array.isArray(raw) ? raw[0] : raw;
      const quote = entry.quote.USD;
      tickers[symbol] = {
        price: quote.price,
        marketCap: quote.market_cap,
        percentChange24h: quote.percent_change_24h,
        percentChange7d: quote.percent_change_7d,
        lastUpdated: quote.last_updated,
      };
    }

    return Response.json({
      tickers,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
