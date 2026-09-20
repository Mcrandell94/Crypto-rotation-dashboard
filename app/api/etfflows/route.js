// Server-side only — requires a free SoSoValue Demo API key (sosovalue.com/developer).
//
// SoSoValue's own docs (sosovalue.gitbook.io) are blocked from this sandbox,
// same as several other providers' docs sites this project has hit. The
// endpoint, query params, and response shape here were verified against a
// real open-source integration instead (github.com/markinho1970/sosomon's
// backend/services/sosovalue.py), not guessed — same standard as reading
// Hyperliquid's own Python SDK source for the Funding/OI route.

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://openapi.sosovalue.com/openapi/v1';

export async function GET() {
  const apiKey = process.env.SOSOVALUE_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'SOSOVALUE_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const url = `${BASE_URL}/etfs/summary-history?symbol=BTC&country_code=US&limit=10`;
    const res = await fetch(url, {
      headers: { 'x-soso-api-key': apiKey, Accept: 'application/json' },
      next: { revalidate: 1800 },
    });
    if (!res.ok) {
      const detail = await res.text();
      return Response.json({ error: `SoSoValue returned ${res.status}`, detail }, { status: res.status });
    }

    const json = await res.json();
    // The API wraps results as { code, message, data }; unwrap defensively
    // in case a future version returns the array directly.
    const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    if (rows.length === 0) {
      return Response.json({ error: 'SoSoValue returned no ETF flow data' }, { status: 502 });
    }

    const days = [...rows]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((d) => ({
        date: d.date,
        netInflow: Number(d.total_net_inflow),
        netAssets: d.total_net_assets != null ? Number(d.total_net_assets) : null,
        cumulativeInflow: d.cum_net_inflow != null ? Number(d.cum_net_inflow) : null,
      }));

    const latest = days[days.length - 1];
    const last5 = days.slice(-5);
    const last5Total = last5.reduce((sum, d) => sum + d.netInflow, 0);

    return Response.json({ days, latest, last5Total, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
