// Wraps a route's GET handler so successful responses are cached on
// Vercel's CDN, not just upstream fetches in the Data Cache. Without this,
// every visitor invokes the function for every panel even when the data
// underneath is cached (production returned `x-vercel-cache: MISS` on each
// request).
//
// Only a complete success is cached: status 200 and no failure marker at
// the top level. Several routes return 200 while reporting trouble — an
// `error` for a missing key, or partial-failure lists like `failed`,
// `ratesFailed`, `rangesFailed`, `missing` (e.g. /api/ema returns 200 with
// every candle fetch in `failed` when Kraken is down). Those must not stick
// at the edge; they keep the default no-cache behavior, so a transient
// outage clears on the next load.
//
// `revalidateSeconds` is the route's own upstream revalidate window. The
// CDN keeps a response fresh for half of it, then serves it stale for up
// to the full window while refetching in the background — worst-case age
// stays close to what the Data Cache alone already allowed.
const FAILURE_KEY = /(^error$|^errors$|^missing$|failed$)/i;

function hasFailure(body) {
  return Object.entries(body).some(([key, value]) => {
    if (!FAILURE_KEY.test(key)) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return Boolean(value);
  });
}

export function withCdnCache(handler, revalidateSeconds) {
  const fresh = Math.max(1, Math.floor(revalidateSeconds / 2));
  return async function GET(...args) {
    const res = await handler(...args);
    if (res.status !== 200) return res;
    const body = await res.clone().json().catch(() => null);
    if (!body || hasFailure(body)) return res;
    res.headers.set(
      'Vercel-CDN-Cache-Control',
      `public, s-maxage=${fresh}, stale-while-revalidate=${revalidateSeconds}`
    );
    return res;
  };
}
