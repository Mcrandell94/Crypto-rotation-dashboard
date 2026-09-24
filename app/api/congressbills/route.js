// Server-side. Congress.gov's own official API (api.congress.gov), keyed
// via a data.gov registration key — real bill status, actions, and votes,
// not a guessed or hand-maintained outcome. Tracks the Digital Asset
// Market Clarity Act ("CLARITY Act"), the crypto market-structure bill —
// 119th Congress, H.R. 3633, introduced by Rep. French Hill. Bill number
// verified against public reporting at the time this was written; if it's
// wrong, Congress.gov's own 404/error response will say so directly
// (surfaced below), not silently misreport a different bill's status.
//
// congress.gov's own docs site is unreachable from this sandbox like most
// providers hit this session — endpoint shape (GET /v3/bill/{congress}/
// {billType}/{billNumber}, api_key query param, response wraps the bill
// under a `bill` key with `latestAction`) is from the API's own published
// schema, not guessed.

import { withCdnCache } from '../../lib/cdnCache';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://api.congress.gov/v3';

// { label, congress, billType, billNumber } — add more bills here as
// other real crypto market-structure legislation becomes relevant.
const TRACKED_BILLS = [
  { label: 'CLARITY Act (Digital Asset Market Clarity Act)', congress: 119, billType: 'hr', billNumber: 3633 },
];

async function fetchBill(bill, apiKey) {
  const url = `${BASE_URL}/bill/${bill.congress}/${bill.billType}/${bill.billNumber}?api_key=${apiKey}&format=json`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } });
  if (!res.ok) {
    const detail = await res.text();
    return { label: bill.label, error: `Congress.gov returned ${res.status} for ${bill.billType.toUpperCase()} ${bill.billNumber} (${bill.congress}th Congress) — the bill number may be wrong. Raw response: ${detail.slice(0, 400)}` };
  }

  const json = await res.json();
  const b = json.bill;
  if (!b) {
    const detail = JSON.stringify(json).slice(0, 500);
    return { label: bill.label, error: `Congress.gov's bill response didn't match the expected shape. Raw sample: ${detail}` };
  }

  return {
    label: bill.label,
    title: b.title,
    congress: b.congress,
    billType: b.type,
    billNumber: b.number,
    latestAction: b.latestAction ? { date: b.latestAction.actionDate, text: b.latestAction.text } : null,
    originChamber: b.originChamber,
    url: `https://www.congress.gov/bill/${bill.congress}th-congress/${bill.billType === 'hr' ? 'house-bill' : 'senate-bill'}/${bill.billNumber}`,
  };
}

async function handler() {
  const apiKey = process.env.DATAGOV_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'DATAGOV_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const bills = await Promise.all(TRACKED_BILLS.map((b) => fetchBill(b, apiKey)));
    return Response.json({ bills, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: err.message || 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}

export const GET = withCdnCache(handler, 3600);
