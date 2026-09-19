// Server-side, but no secret involved — the CFTC's Commitments of Traders
// data (Socrata dataset 6dca-aqww, "Legacy - Futures Only") is fully public
// and keyless. Routed through our own server anyway to keep the fetch
// pattern consistent with the rest of the app and to control caching.
//
// Contract: CME Bitcoin futures, CFTC contract market code 133741
// ("BITCOIN - CHICAGO MERCANTILE EXCHANGE").

const CFTC_BASE = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';
const BITCOIN_CONTRACT_CODE = '133741';
const LOOKBACK_WEEKS = 156; // ~3 years — the standard COT Index reference window
const PEAK_WINDOW_WEEKS = 52; // how far back to look for "the recent peak" to compare against

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  try {
    const fields = [
      'report_date_as_yyyy_mm_dd',
      'open_interest_all',
      'noncomm_positions_long_all',
      'noncomm_positions_short_all',
      'comm_positions_long_all',
      'comm_positions_short_all',
      'nonrept_positions_long_all',
      'nonrept_positions_short_all',
    ].join(',');

    // Built with URLSearchParams rather than manual string concatenation so
    // every value (including the space in "$order=... DESC") gets properly
    // URL-encoded — a raw space in the query string is invalid and was
    // silently producing a malformed request before this fix.
    const params = new URLSearchParams({
      cftc_contract_market_code: BITCOIN_CONTRACT_CODE,
      $select: fields,
      $order: 'report_date_as_yyyy_mm_dd DESC',
      $limit: String(LOOKBACK_WEEKS),
    });
    const url = `${CFTC_BASE}?${params.toString()}`;

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        // Some government endpoints reject requests with no/blank User-Agent.
        'User-Agent': 'crypto-rotation-dashboard (contact: via GitHub repo)',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      const detail = await res.text();
      return Response.json({ error: `CFTC returned ${res.status}`, detail }, { status: res.status });
    }

    const rows = await res.json();
    if (!rows.length) {
      return Response.json({ error: 'CFTC returned no rows for the Bitcoin contract' }, { status: 502 });
    }

    // rows are DESC by date — rows[0] is the most recent published week.
    const commercialNet = (r) => num(r.comm_positions_long_all) - num(r.comm_positions_short_all);
    const nonCommercialNet = (r) => num(r.noncomm_positions_long_all) - num(r.noncomm_positions_short_all);
    const smallSpecNet = (r) => num(r.nonrept_positions_long_all) - num(r.nonrept_positions_short_all);

    const nets = rows.map(commercialNet);
    const minNet = Math.min(...nets);
    const maxNet = Math.max(...nets);
    const cotIndexOf = (net) => (maxNet === minNet ? 50 : Math.round((100 * (net - minNet)) / (maxNet - minNet)));

    const latest = rows[0];
    const cotIndex = cotIndexOf(commercialNet(latest));
    const peakWindow = rows.slice(0, Math.min(PEAK_WINDOW_WEEKS, rows.length));
    const cotIndexPeak = Math.max(...peakWindow.map((r) => cotIndexOf(commercialNet(r))));

    return Response.json({
      asOf: latest.report_date_as_yyyy_mm_dd,
      totalOI: num(latest.open_interest_all),
      cotIndex,
      cotIndexPeak,
      lookbackWeeks: rows.length,
      groups: [
        { name: 'Commercials', sub: 'Hedgers, dealers — the "smart money" bucket', net: Math.round(commercialNet(latest)) },
        { name: 'Non-Commercials', sub: 'Large speculators — funds and CTAs', net: Math.round(nonCommercialNet(latest)) },
        { name: 'Small speculators', sub: 'Below the reporting threshold', net: Math.round(smallSpecNet(latest)) },
      ],
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
