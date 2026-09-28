// US spot ETF flows are reported after the US close, so a row dated today
// (US Eastern) isn't a real number yet. Coinglass lists it early as 0,
// which read as a genuine $0 "latest day" and dragged the 5-day total.
// Tested in etfFlows.test.js.

export function usEasternDate(now = new Date()) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);
}

// `days`: [{ date: 'YYYY-MM-DD', netInflow }], oldest first.
export function dropUnreported(days, now = new Date()) {
  const today = usEasternDate(now);
  return days.filter((d) => d.date < today && Number.isFinite(d.netInflow));
}
