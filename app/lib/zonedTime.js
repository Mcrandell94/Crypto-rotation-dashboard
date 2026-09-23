// Converts a wall-clock date and time in a named time zone (e.g. 2:00pm in
// America/New_York) to the exact instant, using the runtime's own tz
// database so daylight saving is applied for that specific date. Used by
// the central bank calendars, whose decision times are published as local
// wall-clock times, not fixed UTC offsets.
export function zonedTime(date, time, timeZone) {
  const asIfUtc = new Date(`${date}T${time}Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(asIfUtc);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const zoneWallClockMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  const offsetMs = zoneWallClockMs - asIfUtc.getTime();
  return new Date(asIfUtc.getTime() - offsetMs);
}
