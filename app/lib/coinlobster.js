// Shared helper for CoinLobster's REST API (coinlobster.com) — a real
// crypto whale-tracking service: live large trades merged across 15 CEX,
// Hyperliquid, and on-chain DEX swaps on Ethereum/Base/Arbitrum, plus
// derived signals (unusual-activity radar, hourly buy/sell flow, named
// Hyperliquid wallets, modeled liquidation zones).
//
// REST base verified from CoinLobster's own published extension docs
// (github.com/CoinLobster/coinlobster-gemini-extension — README.md and
// GEMINI.md), since coinlobster.com itself is unreachable from this
// sandbox to confirm directly: "unlocks the metered REST endpoints at
// /api/ai/v1/*". Auth is `Authorization: Bearer <key>` — the extension
// docs said `X-API-Key`, but the live API's own 401 body corrected that
// directly ("API key required. Pass it as an Authorization: Bearer <key>
// header. Never put a key in a URL: it is logged by every proxy in the
// path and leaks through Referer."), so the real error is what's used
// here, not the secondhand docs. Each MCP tool name (whale_trades,
// whale_radar, ...) is
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

// pick/extractArray/normalizeTimeMs used to be defined here and got
// copy-pasted into other routes as they came up against the same
// unverified-response-shape problem — now shared from one place; see
// app/lib/apiParsing.js for what each one does.
export { pick, extractArray, normalizeTimeMs } from './apiParsing';

const BASE_URL = 'https://coinlobster.com/api/ai/v1';

export async function fetchCoinLobster(tool, params, apiKey, { revalidateSeconds = 300 } = {}) {
  // Trimmed defensively — a stray trailing newline/space from copy-paste
  // into Vercel's env var UI would silently break the Authorization header
  // and produce exactly the generic 401 this API returns for any bad key.
  const key = (apiKey || '').trim();
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/${tool}${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    const detail = await res.text();
    // Never the full key — but on a 401 specifically, its length and a few
    // characters from each end are safe to surface and let us compare
    // against what the site shows, to catch a copy-paste mismatch/typo
    // without needing to see the secret itself.
    const keyHint =
      res.status === 401
        ? key
          ? ` [key check: length=${key.length}, starts "${key.slice(0, 6)}", ends "${key.slice(-4)}"]`
          : ' [key check: COINLOBSTER_API_KEY read as EMPTY at request time]'
        : '';
    const err = new Error(`CoinLobster returned ${res.status} for ${tool}.${keyHint} Raw response: ${detail.slice(0, 400)}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  return res.json();
}
