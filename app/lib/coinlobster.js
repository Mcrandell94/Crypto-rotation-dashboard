// Shared helper for CoinLobster's REST API (coinlobster.com) — a real
// crypto whale-tracking service: live large trades merged across 15 CEX,
// Hyperliquid, and on-chain DEX swaps on Ethereum/Base/Arbitrum, plus
// derived signals (unusual-activity radar, hourly buy/sell flow, named
// Hyperliquid wallets, modeled liquidation zones).
//
// REST base and auth verified from CoinLobster's own published extension
// docs (github.com/CoinLobster/coinlobster-gemini-extension — README.md
// and GEMINI.md), since coinlobster.com itself is unreachable from this
// sandbox to confirm directly, same as most providers hit this session:
// "unlocks the metered REST endpoints at /api/ai/v1/*" and "sent as
// X-API-Key". Each MCP tool name (whale_trades, whale_radar, ...) is
// documented as mirroring a REST endpoint 1:1 — this assumes
// /api/ai/v1/<tool_name>, which is the direct, documented reading of
// that relationship, not a guess pulled from nowhere. Exact query
// parameter names and response field shapes are NOT documented anywhere
// reachable, so every caller here parses defensively (tries several
// plausible field names) and fails loudly with the raw response embedded
// in the error if nothing matches, rather than silently misreporting.
//
// Credit-metered: each successful call on a developer plan spends 40-100
// credits from the plan's shared monthly balance (2x the REST cost).
// Keyless calls get a reduced free data shape (BTC/USD full, $1M+ trades
// on any coin, others 15min delayed) — same key works either way, depth
// just depends on whether it's on an active paid plan. Because of this
// cost, callers of this helper should NOT be wired into this dashboard's
// normal eager on-page-load refresh cycle the way free/cheap APIs are —
// see the whale-tab routes' own comments for how each one is gated.

const BASE_URL = 'https://coinlobster.com/api/ai/v1';

export function pick(obj, keys) {
  for (const k of keys) {
    if (obj?.[k] != null) return obj[k];
  }
  return null;
}

export async function fetchCoinLobster(tool, params, apiKey, { revalidateSeconds = 300 } = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/${tool}${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`CoinLobster returned ${res.status} for ${tool}. Raw response: ${detail.slice(0, 400)}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  return res.json();
}

// CoinLobster's own docs don't show a response envelope example, so this
// tries the plausible shapes (a bare array, or an array under a handful of
// likely wrapper keys) rather than assuming one. Returns null if nothing
// array-shaped is found, so the caller can fail loudly with the raw JSON.
export function extractArray(json, wrapperKeys) {
  if (Array.isArray(json)) return json;
  for (const k of wrapperKeys) {
    if (Array.isArray(json?.[k])) return json[k];
  }
  return null;
}

// Timestamps of unknown shape (unix seconds, unix ms, or an ISO string) —
// normalizes to epoch ms, or null if nothing parses.
export function normalizeTimeMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  const parsed = Date.parse(v);
  return Number.isNaN(parsed) ? null : parsed;
}
