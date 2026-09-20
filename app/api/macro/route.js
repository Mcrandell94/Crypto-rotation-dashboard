// Server-side only. Combines two free, no-cost sources: alternative.me's
// Fear & Greed Index (fully keyless) and CoinGecko's /global endpoint
// (same Demo key as the RRG route) for BTC/USDT market cap dominance.

export const dynamic = 'force-dynamic';

export async function GET() {
  const cgKey = process.env.COINGECKO_API_KEY;
  if (!cgKey) {
    return Response.json(
      { error: 'COINGECKO_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const [fngRes, globalRes] = await Promise.all([
      fetch('https://api.alternative.me/fng/?limit=1', { next: { revalidate: 3600 } }),
      fetch('https://api.coingecko.com/api/v3/global', {
        headers: { 'x-cg-demo-api-key': cgKey, Accept: 'application/json' },
        next: { revalidate: 900 },
      }),
    ]);

    if (!fngRes.ok) {
      const detail = await fngRes.text();
      return Response.json({ error: `Fear & Greed API returned ${fngRes.status}`, detail }, { status: fngRes.status });
    }
    if (!globalRes.ok) {
      const detail = await globalRes.text();
      return Response.json({ error: `CoinGecko returned ${globalRes.status}`, detail }, { status: globalRes.status });
    }

    const fngJson = await fngRes.json();
    const globalJson = await globalRes.json();

    const point = fngJson.data?.[0];
    const pct = globalJson.data?.market_cap_percentage || {};

    return Response.json({
      fng: point
        ? { value: Number(point.value), classification: point.value_classification, asOf: new Date(Number(point.timestamp) * 1000).toISOString() }
        : null,
      dominance: { btc: pct.btc ?? null, usdt: pct.usdt ?? null },
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
