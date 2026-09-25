// Parsing for Polymarket's Fed-decision events (see app/api/fedodds).
// Tested in fedOdds.test.js.

// Same Gamma API quirk as /api/polymarket: outcomes/outcomePrices arrive
// as JSON-stringified arrays. Returns the market's "Yes" probability (%).
function yesPct(market) {
  try {
    const outcomes = JSON.parse(market.outcomes || '[]');
    const prices = JSON.parse(market.outcomePrices || '[]');
    const idx = outcomes.findIndex((o) => /^yes$/i.test(o));
    if (idx === -1) return null;
    const pct = Math.round(parseFloat(prices[idx]) * 1000) / 10;
    return Number.isFinite(pct) ? pct : null;
  } catch {
    return null;
  }
}

// One outcome per decision market in the event, most likely first.
export function decisionOutcomes(markets) {
  return (markets || [])
    .filter((m) => !m.closed)
    .map((m) => ({ label: m.groupItemTitle || m.question, pct: yesPct(m) }))
    .filter((o) => o.label && o.pct != null)
    .sort((a, b) => b.pct - a.pct);
}
