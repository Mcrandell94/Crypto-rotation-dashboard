// Seasonality averages. The current calendar month is still in progress,
// so its partial return is shown in the table but left out of every
// average and "closed green" count. Tested in seasonality.test.js.

export function isInProgress(year, month, currentYear, currentMonth) {
  return year === currentYear && month === currentMonth;
}

// Average return for one calendar month across completed years.
export function monthStats({ years, monthlyReturns, currentYear, currentMonth }, month) {
  const vals = years
    .filter((y) => !isInProgress(y, month, currentYear, currentMonth))
    .map((y) => monthlyReturns[y]?.[month])
    .filter((v) => v != null);
  if (vals.length === 0) return { avg: null, count: 0, green: 0 };
  return {
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    count: vals.length,
    green: vals.filter((v) => v > 0).length,
  };
}
