// Server-side, but no secret involved — reuses the same keyless Kraken OHLC
// endpoint as the EMA/Timeframes routes. Computes real BTC monthly returns
// from actual weekly closes, going back as many years as Kraken's weekly
// history allows (720 weeks ≈ 13.8 years, comfortably more than needed).
//
// This replaces what the reference prototype this was modeled on explicitly
// labeled "an approximate reconstruction from known price history — pattern
// is real, exact percent isn't guaranteed." Real weekly closes make this
// genuinely computed rather than reconstructed — the only approximation
// left is attributing each week to whichever calendar month its Kraken
// timestamp falls in, so a month's return can be off by up to a few days
// at its boundary rather than landing on the exact calendar close.

import { PAIRS, fetchCandles } from '../../lib/kraken';

export const dynamic = 'force-dynamic';

const YEARS_SHOWN = 5;

export async function GET() {
  try {
    const candles = await fetchCandles(PAIRS.BTC, 10080); // weekly
    const sorted = [...candles].sort((a, b) => a[0] - b[0]);

    // Last weekly close seen for each (year, month), walking chronologically
    // — a stand-in for "the month's closing price."
    const lastCloseByMonth = new Map();
    for (const c of sorted) {
      const d = new Date(c[0] * 1000);
      lastCloseByMonth.set(`${d.getUTCFullYear()}-${d.getUTCMonth()}`, parseFloat(c[4]));
    }

    const now = new Date();
    const curYear = now.getUTCFullYear();
    const curMonth = now.getUTCMonth();

    const years = [];
    for (let i = YEARS_SHOWN - 1; i >= 0; i--) years.push(curYear - i);

    const monthlyReturns = {};
    for (const year of years) {
      const row = [];
      for (let m = 0; m < 12; m++) {
        if (year === curYear && m > curMonth) {
          row.push(null);
          continue;
        }
        const thisClose = lastCloseByMonth.get(`${year}-${m}`);
        const prevYear = m === 0 ? year - 1 : year;
        const prevMonth = m === 0 ? 11 : m - 1;
        const prevClose = lastCloseByMonth.get(`${prevYear}-${prevMonth}`);
        row.push(thisClose != null && prevClose != null ? Math.round((thisClose / prevClose - 1) * 1000) / 10 : null);
      }
      monthlyReturns[year] = row;
    }

    return Response.json({
      years,
      monthlyReturns,
      currentYear: curYear,
      currentMonth: curMonth,
      historyPoints: sorted.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
