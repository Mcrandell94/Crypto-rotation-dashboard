'use client';

import { useEffect, useState } from 'react';
import { LEVELS_BY_ASSET } from '../lib/liquidationLevels';
import { crossedNow, horizonAge, levelId } from '../lib/liquidationLevelsStatus';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const AMBER = '#C9A66B';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';

const ASSET_LIST = Object.keys(LEVELS_BY_ASSET);

function formatPrice(v) {
  return v == null ? '—' : `$${Math.round(v).toLocaleString()}`;
}

function usdShort(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${Math.round(v / 1e6)}M`;
  return `$${Math.round(v / 1e3)}K`;
}

function listOf(names) {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join('');
}

// The Live horizon's levels come from LiqWall (/api/liquidationmap) at
// runtime, with that snapshot's own price as spotAtCapture; every other
// horizon is hand-entered in lib/liquidationLevels, and carries `touched`
// — when price first reached each level since capture, from
// /api/levelhits (only while that answer is for this same capture).
function horizonsFor(asset, liveMap, levelHits) {
  return Object.values(LEVELS_BY_ASSET[asset]).map((h) => {
    if (!h.live) {
      const t = levelHits?.hits?.[asset]?.[h.key];
      return t && t.capturedAt === h.capturedAt ? { ...h, touched: t.hits || {} } : h;
    }
    const m = liveMap?.assets?.[asset];
    if (!m) return h;
    return {
      ...h,
      capturedAt: m.asOf,
      spotAtCapture: m.price,
      venues: m.venues,
      withinPct: m.withinPct,
      longBelow: m.longBelow,
      shortAbove: m.shortAbove,
      levels: m.levels.map((l) => ({
        kind: 'level',
        price: l.price,
        side: l.side,
        label: `${usdShort(l.usd)} of ${l.side}s${l.exchange ? `, most on ${l.exchange}` : ''}`,
      })),
    };
  });
}

// Once a level is hit it stays hit, even if price later moves back — a
// liquidation cluster that's been wicked through is spent, and a squeeze
// zone that's been traded through is no longer "thin." Persisted per
// browser in localStorage, namespaced by asset + horizon + capturedAt so a
// fresh screenshot for that asset/horizon (a new capturedAt) starts it
// unhit again, without touching any other asset's or horizon's tracking.
function readHit(asset, horizonKey, capturedAt, id) {
  try {
    return localStorage.getItem(`liqLevelHit:${asset}:${horizonKey}:${capturedAt}:${id}`) === '1';
  } catch {
    return false;
  }
}

function writeHit(asset, horizonKey, capturedAt, id) {
  try {
    localStorage.setItem(`liqLevelHit:${asset}:${horizonKey}:${capturedAt}:${id}`, '1');
  } catch {
    // localStorage unavailable (private mode, blocked) — hit state just
    // won't persist across reloads; not worth failing the panel over.
  }
}

function AssetPicker({ asset, setAsset }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      {ASSET_LIST.map((a) => (
        <button
          key={a}
          onClick={() => setAsset(a)}
          style={{
            background: asset === a ? '#1E252A' : '#171D21',
            border: `1px solid ${asset === a ? AMBER : CARD_BORDER}`,
            color: asset === a ? AMBER : TEXT_SECONDARY,
            borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
          }}
        >
          {a}
        </button>
      ))}
    </div>
  );
}

function HorizonPicker({ horizonList, horizonKey, setHorizonKey }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      {horizonList.map((h) => (
        <button
          key={h.key}
          onClick={() => setHorizonKey(h.key)}
          style={{
            background: horizonKey === h.key ? '#1E252A' : '#171D21',
            border: `1px solid ${horizonKey === h.key ? AMBER : CARD_BORDER}`,
            color: horizonKey === h.key ? AMBER : TEXT_SECONDARY,
            borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
          }}
        >
          {h.label}
        </button>
      ))}
    </div>
  );
}

function fmtHitTime(iso) {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return d.toLocaleString('en-US', sameDay ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function LiquidationLevelsTracker({ btcPrice, btcPriceError, ethPrice, ethPriceError, liveMap, liveMapError, levelHits }) {
  const [asset, setAsset] = useState('BTC');
  const [horizonKey, setHorizonKey] = useState(Object.values(LEVELS_BY_ASSET.BTC)[0]?.key);
  const [hitByAssetHorizon, setHitByAssetHorizon] = useState(() =>
    Object.fromEntries(ASSET_LIST.map((a) => [a, Object.fromEntries(Object.keys(LEVELS_BY_ASSET[a]).map((k) => [k, new Set()]))]))
  );

  const price = asset === 'BTC' ? btcPrice : ethPrice;
  const priceError = asset === 'BTC' ? btcPriceError : ethPriceError;

  useEffect(() => {
    if (price == null) return;
    setHitByAssetHorizon((prev) => {
      let changedAny = false;
      const next = { ...prev, [asset]: { ...prev[asset] } };
      for (const h of horizonsFor(asset, liveMap, levelHits)) {
        if (h.levels.length === 0) continue;
        const set = new Set(next[asset][h.key]);
        let changed = false;
        for (const l of h.levels) {
          const id = levelId(l);
          if (set.has(id) || readHit(asset, h.key, h.capturedAt, id)) {
            if (!set.has(id)) set.add(id);
            continue;
          }
          if (crossedNow(l, price, h.spotAtCapture) || h.touched?.[id]) {
            set.add(id);
            writeHit(asset, h.key, h.capturedAt, id);
            changed = true;
          }
        }
        if (changed) {
          next[asset][h.key] = set;
          changedAny = true;
        }
      }
      return changedAny ? next : prev;
    });
  }, [asset, price, liveMap, levelHits]);

  const horizonList = horizonsFor(asset, liveMap, levelHits);
  const active = horizonList.find((h) => h.key === horizonKey) || horizonList[0];
  // Hits remembered in this browser, every level live price is past right
  // now, and every level a candle has touched since capture (a wick that
  // bounced back included) — worked out on each render, so a crossed level
  // shows as hit even if nobody had the page open when it happened.
  const hitIds = new Set([
    ...(hitByAssetHorizon[asset]?.[active?.key] || []),
    ...(active?.levels || []).filter((l) => crossedNow(l, price, active.spotAtCapture)).map(levelId),
    ...Object.keys(active?.touched || {}),
  ]);
  const age = horizonAge(active, price);

  if (!active || active.levels.length === 0) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Liquidation Levels Tracker
        </h2>
        <AssetPicker asset={asset} setAsset={setAsset} />
        <HorizonPicker horizonList={horizonList} horizonKey={active?.key} setHorizonKey={setHorizonKey} />
        {active?.live ? (
          <p style={{ fontSize: 12, color: TEXT_MUTED, maxWidth: 680, lineHeight: 1.5 }}>
            {liveMapError ? `Live liquidation map unavailable this refresh: ${liveMapError}` : 'Loading the live liquidation map…'}
          </p>
        ) : (
          <p style={{ fontSize: 12, color: TEXT_MUTED, maxWidth: 680, lineHeight: 1.5 }}>
            No {asset} liquidation map loaded yet for this horizon. Send a liquidation heatmap screenshot and
            its squeeze zones and liquidity levels get read off it and tracked here — live price is checked
            against each one, and once it's crossed, that level is marked hit.
          </p>
        )}
      </section>
    );
  }

  const sorted = [...active.levels].sort((a, b) => {
    const pa = a.kind === 'zone' ? (a.zoneLow + a.zoneHigh) / 2 : a.price;
    const pb = b.kind === 'zone' ? (b.zoneLow + b.zoneHigh) / 2 : b.price;
    return pb - pa;
  });
  const hitCount = sorted.filter((l) => hitIds.has(levelId(l))).length;

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        Liquidation Levels Tracker
      </h2>
      {active.live ? (
        <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 12px', maxWidth: 680, lineHeight: 1.5 }}>
          Live from LiqWall: the largest liquidation levels within {active.withinPct ?? 10}% of price, across{' '}
          {listOf(active.venues || [])}, refreshed every few minutes. Live price is checked against each one; once
          crossed, it&apos;s marked hit.
          {active.longBelow?.within_5pct != null && active.shortAbove?.within_5pct != null
            ? ` Within 5% of price: ${usdShort(active.longBelow.within_5pct)} of longs below, ${usdShort(active.shortAbove.within_5pct)} of shorts above.`
            : ''}
          {active.capturedAt ? ` As of ${new Date(active.capturedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC.` : ''}
        </p>
      ) : (
        <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 12px', maxWidth: 680, lineHeight: 1.5 }}>
          Liquidation levels read off a heatmap screenshot you sent. Live price, and every price candle since the
          screenshot (Kraken), is checked against each one; once price touches a level it&apos;s crossed off and stays
          that way, even if price has bounced back since.
          {active.source ? ` Source: ${active.source}.` : ''}
          {active.capturedAt ? ` Captured ${new Date(active.capturedAt).toLocaleString()}` : ''}
          {age ? ` — ${age.ageDays === 0 ? 'today' : `${age.ageDays} day${age.ageDays === 1 ? '' : 's'} ago`}` : ''}
          {age && active.spotAtCapture ? `, with ${asset} at ${formatPrice(active.spotAtCapture)}` : ''}
          {age?.movePct != null ? ` (now ${age.movePct > 0 ? '+' : ''}${age.movePct.toFixed(1)}%)` : ''}
          {active.capturedAt ? '.' : ''}
        </p>
      )}

      <AssetPicker asset={asset} setAsset={setAsset} />
      <HorizonPicker horizonList={horizonList} horizonKey={active.key} setHorizonKey={setHorizonKey} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-start' }}>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '10px 12px', flex: '1 1 130px' }}>
          <div style={{ fontSize: 10, color: TEXT_MUTED }}>Live price</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: TEXT_PRIMARY, marginTop: 3, fontFamily: 'ui-monospace, monospace' }}>
            {priceError ? '—' : formatPrice(price)}
          </div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '10px 12px', flex: '1 1 130px' }}>
          <div style={{ fontSize: 10, color: TEXT_MUTED }}>Levels hit ({active.label})</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: hitCount > 0 ? AMBER : TEXT_PRIMARY, marginTop: 3, fontFamily: 'ui-monospace, monospace' }}>
            {hitCount} / {sorted.length}
          </div>
        </div>
      </div>

      {priceError && (
        <div style={{ background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 12, color: '#C9A66B', fontSize: 12, marginBottom: 14 }}>
          Live price failed to load: {priceError}
        </div>
      )}

      {hitCount > 0 && !active.live && (
        <div style={{ background: '#1E1B14', border: `1px solid ${AMBER}`, borderRadius: 6, padding: 12, color: AMBER, fontSize: 12, marginBottom: 14 }}>
          <strong>Liquidation map update required</strong> — {hitCount} level{hitCount === 1 ? '' : 's'} hit
          on this horizon since it was captured. Send a fresh screenshot to refresh it.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sorted.map((l) => {
          const id = levelId(l);
          const hit = hitIds.has(id);
          const isZone = l.kind === 'zone';
          const color = isZone ? AMBER : l.side === 'short' ? GAIN : LOSS;
          const priceLabel = isZone ? `${formatPrice(l.zoneLow)} – ${formatPrice(l.zoneHigh)}` : formatPrice(l.price);
          return (
            <div
              key={id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                background: CARD_BG, border: `1px solid ${hit ? CARD_BORDER : color}`, borderRadius: 4,
                opacity: hit ? 0.5 : 1,
              }}
            >
              <span style={{ fontSize: 10, color, textTransform: 'uppercase', width: 46, flexShrink: 0 }}>
                {isZone ? 'Zone' : l.side}
              </span>
              <span style={{ fontSize: 12, color: TEXT_PRIMARY, fontFamily: 'ui-monospace, monospace', flex: '0 0 150px', textDecoration: hit ? 'line-through' : 'none' }}>
                {priceLabel}
              </span>
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, flex: 1, textDecoration: hit ? 'line-through' : 'none' }}>{l.label || ''}</span>
              {hit && (
                <span style={{ fontSize: 10, color: AMBER, fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
                  HIT
                  {active.touched?.[id] && <span style={{ display: 'block', fontWeight: 400, color: TEXT_MUTED }}>{fmtHitTime(active.touched[id])}</span>}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
