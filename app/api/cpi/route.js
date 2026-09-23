// Server-side. The Bureau of Labor Statistics' own public Timeseries API
// (api.bls.gov) — real, historical CPI print data, not a guessed number.
// Series CUUR0000SA0 is CPI-U, all items, U.S. city average, not
// seasonally adjusted — the headline year-over-year inflation number most
// commonly quoted.
//
// Uses v1 (unregistered, no key) rather than v2 (which needs a BLS-issued
// registration key from data.bls.gov/registrationEngine/, separate from a
// generic data.gov key — a source of real confusion this session, twice).
// v1's unregistered limits (25 queries/day, 25 series/query, up to 20
// years of data per BLS's own published limits) comfortably cover this
// route's actual usage: one series, a ~2-year window, cached an hour at a
// time — nowhere near 25 requests/day even under load. No key to
// provision, expire, or mismatch means one less thing that can silently
// break this panel.
//
// Deliberately does NOT attempt to show a future release date — BLS
// publishes its release calendar a year in advance, but this session has
// already gotten one hand-maintained date wrong once (Venus retrograde)
// from unverified recall; showing the real, live, already-published
// numbers is honest, a schedule guessed from memory isn't. If a real
// source for the release calendar turns up, that's separate follow-up
// work, not something to fabricate here.
//
// Endpoint shape (POST with a JSON body carrying seriesid/startyear/
// endyear, response wraps series under Results.series[].data[], each item
// carrying year/period/periodName/value/footnotes) is from BLS's own
// published API schema and sample code; bls.gov itself is unreachable
// from this sandbox like most providers hit this session.

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://api.bls.gov/publicAPI/v1/timeseries/data/';
const SERIES_ID = 'CUUR0000SA0';

export async function GET() {
  try {
    const now = new Date();
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: [SERIES_ID],
        startyear: String(now.getUTCFullYear() - 1),
        endyear: String(now.getUTCFullYear()),
      }),
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      const detail = await res.text();
      return Response.json({ error: `BLS returned ${res.status}`, detail: detail.slice(0, 500) }, { status: res.status });
    }

    const json = await res.json();
    if (json.status !== 'REQUEST_SUCCEEDED') {
      const detail = JSON.stringify(json).slice(0, 500);
      return Response.json(
        { error: `BLS API error: ${(json.message || []).join(', ') || 'unknown error'}. Raw sample: ${detail}`, detail },
        { status: 502 }
      );
    }

    const series = json.Results?.series?.[0];
    const points = (series?.data || [])
      .filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period)) // exclude annual-average M13
      .map((d) => ({
        year: Number(d.year),
        month: Number(d.period.slice(1)),
        periodName: d.periodName,
        value: Number(d.value),
      }))
      .sort((a, b) => (a.year - b.year) || (a.month - b.month));

    if (points.length === 0) {
      const detail = JSON.stringify(json).slice(0, 500);
      return Response.json(
        { error: `BLS's CPI response didn't match the expected shape. Raw sample: ${detail}`, detail },
        { status: 502 }
      );
    }

    const latest = points[points.length - 1];
    const yearAgo = points.find((p) => p.year === latest.year - 1 && p.month === latest.month);
    const priorMonth = points[points.length - 2];
    const yoyPct = yearAgo ? Math.round(((latest.value / yearAgo.value) - 1) * 1000) / 10 : null;
    const momPct = priorMonth ? Math.round(((latest.value / priorMonth.value) - 1) * 1000) / 10 : null;

    return Response.json({
      latest: { ...latest, yoyPct, momPct },
      history: points.slice(-13),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message || 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
