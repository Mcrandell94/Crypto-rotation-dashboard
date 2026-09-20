// Server-side, but no secret involved — Deribit's public REST API is fully
// keyless for market data. Computes real BTC options positioning (open
// interest split, per-expiry put/call ratio, max pain) directly from
// Deribit's own order book summary — not Coinglass, which is paywalled.
//
// Endpoint, base URL, and field names (open_interest, instrument_name,
// volume, underlying_price; instrument_name format like
// "BTC-27FEB26-100000-C") were verified against ccxt's actively-maintained
// Deribit integration (github.com/ccxt/ccxt), since Deribit's own docs
// site (docs.deribit.com) is blocked from this sandbox.
//
// Max pain — the strike where option *sellers* owe the least at
// settlement — is computed here directly from real open-interest-by-strike
// data rather than pulled from a third party: for each candidate strike,
// sum what every call/put would pay out if the price settled there, and
// take the strike that minimizes that total.

import { FOMC_MEETINGS, decisionDateTime } from '../../lib/fomc-calendar';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://www.deribit.com/api/v2';
const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
const QUARTER_MONTHS = new Set([2, 5, 8, 11]); // Mar, Jun, Sep, Dec

function parseInstrument(name) {
  const parts = name.split('-');
  if (parts.length !== 4) return null;
  const [, expiryStr, strikeStr, typeChar] = parts;
  const m = expiryStr.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!m) return null;
  const month = MONTHS[m[2]];
  if (month == null) return null;
  // Deribit options settle 08:00 UTC on expiry day.
  const expiry = new Date(Date.UTC(2000 + Number(m[3]), month, Number(m[1]), 8, 0, 0));
  return {
    expiry,
    expiryLabel: expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    strike: Number(strikeStr),
    type: typeChar === 'C' ? 'call' : 'put',
  };
}

function maxPainFor(instruments) {
  const strikes = [...new Set(instruments.map((i) => i.strike))];
  let best = null;
  for (const candidate of strikes) {
    let payout = 0;
    for (const inst of instruments) {
      payout += inst.type === 'call'
        ? Math.max(0, candidate - inst.strike) * inst.openInterest
        : Math.max(0, inst.strike - candidate) * inst.openInterest;
    }
    if (best === null || payout < best.payout) best = { strike: candidate, payout };
  }
  return best ? best.strike : null;
}

// Deribit lists weekly expiries every Friday, with the last Friday of each
// month promoted to "monthly", and the last Friday of Mar/Jun/Sep/Dec
// further promoted to "quarterly" — the highest-open-interest, most-watched
// dates. Real, structural classification, not a hand-picked label.
function isLastFridayOfMonth(date) {
  const next = new Date(date);
  next.setUTCDate(date.getUTCDate() + 7);
  return next.getUTCMonth() !== date.getUTCMonth();
}
function classifyExpiry(date) {
  if (date.getUTCDay() !== 5 || !isLastFridayOfMonth(date)) return 'weekly';
  return QUARTER_MONTHS.has(date.getUTCMonth()) ? 'quarterly' : 'monthly';
}

// If this expiry falls within 4 days after a real FOMC decision (see
// app/lib/fomc-calendar.js), traders hedging the announcement itself show
// up as a distinctly elevated put/call ratio on that one date — a real,
// checkable pattern, not asserted without the data to back it.
function fomcNote(expiry) {
  for (const meeting of FOMC_MEETINGS) {
    const decision = decisionDateTime(meeting);
    const daysAfter = Math.round((expiry - decision) / 86400000);
    if (daysAfter >= 0 && daysAfter <= 4) {
      return { daysAfter, label: `${daysAfter === 0 ? 'Same day as' : `${daysAfter} day${daysAfter === 1 ? '' : 's'} after`} the Fed decision` };
    }
  }
  return null;
}

function expiryNote(type, expiry) {
  const fomc = fomcNote(expiry);
  if (fomc) return fomc.label;
  if (type === 'quarterly') return 'Quarterly expiry — the big one';
  if (type === 'monthly') return 'Monthly expiry';
  return null;
}

export async function GET() {
  try {
    const url = `${BASE_URL}/public/get_book_summary_by_currency?currency=BTC&kind=option`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) {
      const detail = await res.text();
      return Response.json({ error: `Deribit returned ${res.status}`, detail }, { status: res.status });
    }
    const json = await res.json();
    const rows = json.result || [];
    if (rows.length === 0) {
      return Response.json({ error: 'Deribit returned no BTC option instruments' }, { status: 502 });
    }

    const instruments = rows
      .map((r) => {
        const parsed = parseInstrument(r.instrument_name);
        if (!parsed) return null;
        return { ...parsed, openInterest: r.open_interest || 0, volume: r.volume || 0, underlyingPrice: r.underlying_price };
      })
      .filter(Boolean);

    const price = instruments.find((i) => i.underlyingPrice)?.underlyingPrice || null;

    const totalCallOI = instruments.filter((i) => i.type === 'call').reduce((s, i) => s + i.openInterest, 0);
    const totalPutOI = instruments.filter((i) => i.type === 'put').reduce((s, i) => s + i.openInterest, 0);
    const totalOI = totalCallOI + totalPutOI;
    const callsPct = totalOI ? Math.round((totalCallOI / totalOI) * 1000) / 10 : null;
    const putsPct = totalOI ? Math.round((totalPutOI / totalOI) * 1000) / 10 : null;

    const vol24hCalls = instruments.filter((i) => i.type === 'call').reduce((s, i) => s + i.volume, 0);
    const vol24hPuts = instruments.filter((i) => i.type === 'put').reduce((s, i) => s + i.volume, 0);

    const expiryMap = new Map();
    for (const inst of instruments) {
      const key = inst.expiry.toISOString();
      if (!expiryMap.has(key)) expiryMap.set(key, []);
      expiryMap.get(key).push(inst);
    }

    const now = new Date();
    const futureExpiries = [...expiryMap.entries()].filter(([key]) => new Date(key) >= now);

    const expiries = futureExpiries
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .slice(0, 6)
      .map(([key, group]) => {
        const callOI = group.filter((i) => i.type === 'call').reduce((s, i) => s + i.openInterest, 0);
        const putOI = group.filter((i) => i.type === 'put').reduce((s, i) => s + i.openInterest, 0);
        const expiry = group[0].expiry;
        const type = classifyExpiry(expiry);
        return {
          date: group[0].expiryLabel,
          expiry: key,
          type,
          note: expiryNote(type, expiry),
          putCallRatio: callOI ? Math.round((putOI / callOI) * 100) / 100 : null,
          maxPain: maxPainFor(group),
          callOI: Math.round(callOI * 10) / 10,
          putOI: Math.round(putOI * 10) / 10,
        };
      });

    const topPositions = [...instruments]
      .sort((a, b) => b.openInterest - a.openInterest)
      .slice(0, 5)
      .map((i) => ({
        label: `$${i.strike.toLocaleString()} ${i.type}`,
        expiry: i.expiryLabel,
        side: i.type,
        openInterest: Math.round(i.openInterest * 10) / 10,
      }));

    // Call walls: the strikes with the heaviest call open interest — a
    // cluster of written calls tends to act as resistance/a price magnet.
    const callWalls = [...new Set(
      [...instruments].filter((i) => i.type === 'call').sort((a, b) => b.openInterest - a.openInterest).slice(0, 6).map((i) => i.strike)
    )].sort((a, b) => a - b).slice(0, 2);

    // Downside insurance: the heaviest put open interest below current spot.
    const downsideInsuranceStrike = [...instruments]
      .filter((i) => i.type === 'put' && (!price || i.strike < price))
      .sort((a, b) => b.openInterest - a.openInterest)[0]?.strike ?? null;

    return Response.json({
      price,
      totalCallOI: Math.round(totalCallOI * 10) / 10,
      totalPutOI: Math.round(totalPutOI * 10) / 10,
      callsPct,
      putsPct,
      vol24hCalls: Math.round(vol24hCalls * 10) / 10,
      vol24hPuts: Math.round(vol24hPuts * 10) / 10,
      totalBookOI: Math.round(totalOI * 10) / 10,
      totalExpiryCount: futureExpiries.length,
      expiries,
      topPositions,
      callWalls,
      downsideInsuranceStrike,
      instrumentCount: instruments.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Fetch failed', detail: err.detail || String(err) },
      { status: err.status || 500 }
    );
  }
}
