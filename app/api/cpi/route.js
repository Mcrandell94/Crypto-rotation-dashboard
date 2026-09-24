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
// route's actual usage: one series, cached an hour at a
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
// Uses BLS's single-series GET endpoint (…/timeseries/data/<series_id>)
// rather than the multi-series POST. Next.js's fetch cache (the
// `next: { revalidate }` below) only caches GET requests — with POST, every
// page load went straight to BLS and could burn through the unregistered
// 25-queries/day limit, which then broke this panel for the rest of the
// day. As a GET, BLS is hit at most about once an hour per server region.
// The GET form takes no year range; BLS returns roughly the past 3 years,
// which covers the 13 months shown plus the year-ago comparison.
//
// Response shape (status/message/Results.series[].data[], each item
// carrying year/period/periodName/value/footnotes) is from BLS's own
// published API docs; those docs show `Results` both as an object and as a
// one-element array, so both are handled. bls.gov itself is unreachable
// from this sandbox like most providers hit this session.

import { withCdnCache } from '../../lib/cdnCache';

export const dynamic = 'force-dynamic';

const SERIES_ID = 'CUUR0000SA0';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SERIES_URL = `https://api.bls.gov/publicAPI/v1/timeseries/data/${SERIES_ID}`;

async function handler() {
  try {
    const res = await fetch(SERIES_URL, {
      headers: { Accept: 'application/json' },
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

    const results = Array.isArray(json.Results) ? json.Results[0] : json.Results;
    const series = results?.series?.[0];
    const points = (series?.data || [])
      .filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period)) // exclude annual-average M13
      .map((d) => ({
        year: Number(d.year),
        month: Number(d.period.slice(1)),
        periodName: d.periodName,
        value: Number(d.value),
      }))
      // BLS marks months it never collected with "-" (e.g. October 2025,
      // lost to the federal shutdown; BLS won't publish it). Drop them
      // rather than letting NaN through — nothing is filled in.
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => (a.year - b.year) || (a.month - b.month));

    if (points.length === 0) {
      const detail = JSON.stringify(json).slice(0, 500);
      return Response.json(
        { error: `BLS's CPI response didn't match the expected shape. Raw sample: ${detail}`, detail },
        { status: 502 }
      );
    }

    // Comparisons look up the exact calendar month, so a gap BLS left blank
    // yields null plus the missing month's label — never a comparison
    // against the wrong month.
    const monthIndex = (p) => p.year * 12 + (p.month - 1);
    const latest = points[points.length - 1];
    const findMonth = (idx) => points.find((p) => monthIndex(p) === idx);
    const labelFor = (idx) => `${MONTH_NAMES[idx % 12]} ${Math.floor(idx / 12)}`;
    const yearAgoIdx = monthIndex(latest) - 12;
    const priorIdx = monthIndex(latest) - 1;
    const yearAgo = findMonth(yearAgoIdx);
    const priorMonth = findMonth(priorIdx);
    const yoyPct = yearAgo ? Math.round(((latest.value / yearAgo.value) - 1) * 1000) / 10 : null;
    const momPct = priorMonth ? Math.round(((latest.value / priorMonth.value) - 1) * 1000) / 10 : null;

    return Response.json({
      latest: {
        ...latest,
        yoyPct,
        momPct,
        yoyMissingMonth: yearAgo ? null : labelFor(yearAgoIdx),
        momMissingMonth: priorMonth ? null : labelFor(priorIdx),
      },
      history: points.filter((p) => monthIndex(p) > monthIndex(latest) - 13),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message || 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}

export const GET = withCdnCache(handler, 3600);
