// Server-side, no key. The NY Fed Desk's own schedule of Treasury purchase
// operations for the current monthly period — the "Current schedule"
// table on its Treasury Securities Operational Details page, read from the
// CSV that table is built from (parsing in lib/fedPurchases). The Desk
// posts each period's schedule around the middle of the month, with a
// one-line plan saying how much is reinvestment and how much is reserve
// management purchases.

import { withCdnCache } from '../../lib/cdnCache';
import { scheduleOf } from '../../lib/fedPurchases';

export const dynamic = 'force-dynamic';

const CSV_URL = 'https://www.newyorkfed.org/medialibrary/media/markets/treasury-securities-schedule/current-schedule.csv';
const PAGE_URL = 'https://www.newyorkfed.org/markets/domestic-market-operations/monetary-policy-implementation/treasury-securities/treasury-securities-operational-details';
const REVALIDATE = 3600;

async function handler() {
  const res = await fetch(CSV_URL, {
    headers: { Accept: 'text/csv', 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: REVALIDATE },
  });
  const text = await res.text();
  if (!res.ok) {
    return Response.json({ error: `NY Fed returned ${res.status} for its operation schedule: ${text.slice(0, 200)}` }, { status: 502 });
  }
  const schedule = scheduleOf(text);
  if (!schedule) {
    return Response.json({ error: `NY Fed's schedule file didn't have the expected columns. Raw sample: ${text.slice(0, 300)}` }, { status: 502 });
  }
  return Response.json({ ...schedule, source: 'Federal Reserve Bank of New York', pageUrl: PAGE_URL, fetchedAt: new Date().toISOString() });
}

export const GET = withCdnCache(handler, REVALIDATE);
