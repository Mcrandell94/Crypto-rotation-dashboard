// Server-side, keyless. When price first touched each hand-entered
// liquidation level (lib/liquidationLevels) since its screenshot was
// captured, from Kraken's public BTC/USD and ETH/USD candles — so a wick
// through a level counts as a hit even if nobody had the page open, and
// even if price has since bounced back. One candle fetch per asset and
// candle size, at the finest size that reaches back to the capture
// (15-minute candles for maps up to a week old). Matching in
// lib/liquidationLevelsStatus. Kraken is spot; the maps are aggregated
// perpetuals, so a level touched by a few dollars on perps alone can show
// as not yet hit.

import { withCdnCache } from '../../lib/cdnCache';
import { PAIRS, fetchCandles } from '../../lib/kraken';
import { LEVELS_BY_ASSET } from '../../lib/liquidationLevels';
import { touchesSince, intervalFor } from '../../lib/liquidationLevelsStatus';

export const dynamic = 'force-dynamic';

const REVALIDATE = 300;

async function handler() {
  const now = Date.now();
  const hits = {};
  const failed = [];

  await Promise.all(
    Object.entries(LEVELS_BY_ASSET).map(async ([asset, horizons]) => {
      const tracked = Object.values(horizons).filter((h) => !h.live && h.levels.length && Number.isFinite(Date.parse(h.capturedAt)));
      const byInterval = {};
      for (const h of tracked) (byInterval[intervalFor(Date.parse(h.capturedAt), now)] ||= []).push(h);
      hits[asset] = {};
      await Promise.all(
        Object.entries(byInterval).map(async ([minutes, list]) => {
          try {
            const candles = await fetchCandles(PAIRS[asset], Number(minutes));
            for (const h of list) {
              const touched = touchesSince(h.levels, candles, Date.parse(h.capturedAt), h.spotAtCapture);
              hits[asset][h.key] = {
                capturedAt: h.capturedAt,
                candleMinutes: Number(minutes),
                hits: Object.fromEntries(Object.entries(touched).map(([id, t]) => [id, new Date(t).toISOString()])),
              };
            }
          } catch (e) {
            failed.push({ asset, candleMinutes: Number(minutes), error: e.message });
          }
        })
      );
    })
  );

  if (failed.length && !Object.values(hits).some((a) => Object.keys(a).length)) {
    return Response.json({ error: `Kraken candles unavailable: ${failed.map((f) => f.error).join(' | ').slice(0, 400)}` }, { status: 502 });
  }
  return Response.json({ hits, failed, source: 'Kraken', fetchedAt: new Date().toISOString() });
}

export const GET = withCdnCache(handler, REVALIDATE);
