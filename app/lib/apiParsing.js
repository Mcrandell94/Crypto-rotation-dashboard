// Generic response-parsing helpers shared by every route that talks to a
// third-party API whose exact response shape is unconfirmed or was only
// defensively guessed (CoinLobster, TronScan, Solscan's less-verified
// endpoints) — try several plausible field names / wrapper keys rather
// than assuming one, so a provider using a name we didn't expect degrades
// a single value to null instead of throwing, while a genuinely missing
// array shape is still something the caller can catch and fail loudly on.
//
// Previously duplicated near-identically in coinlobster.js,
// stablecoinmints/route.js, and notablewallets/route.js — consolidated
// here so a fix (like normalizeTimeMs's numeric-string handling below)
// lands everywhere at once instead of drifting between copies.

export function pick(obj, keys) {
  for (const k of keys) {
    if (obj?.[k] != null) return obj[k];
  }
  return null;
}

// CoinLobster/TronScan/Solscan don't document a single response envelope,
// so this tries the plausible shapes (a bare array, or an array under a
// handful of likely wrapper keys) rather than assuming one. Returns null
// if nothing array-shaped is found, so the caller can fail loudly with
// the raw JSON.
export function extractArray(json, wrapperKeys) {
  if (Array.isArray(json)) return json;
  for (const k of wrapperKeys) {
    if (Array.isArray(json?.[k])) return json[k];
  }
  return null;
}

// Timestamps of unknown shape — a real number, a numeric string, unix
// seconds vs unix ms, or an ISO date string — normalized to epoch ms, or
// null if nothing parses. A real number or numeric string is treated as
// an epoch value (seconds if it's short enough to not already be ms);
// anything else falls back to Date.parse for a genuine date string.
export function normalizeTimeMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    const n = Number(v);
    return n < 1e12 ? n * 1000 : n;
  }
  const parsed = Date.parse(v);
  return Number.isNaN(parsed) ? null : parsed;
}
