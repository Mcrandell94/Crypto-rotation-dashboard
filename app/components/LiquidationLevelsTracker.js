'use client';

import { useEffect, useState } from 'react';
import { CAPTURED_AT, SPOT_AT_CAPTURE, SOURCE, LEVELS } from '../lib/liquidationLevels';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const AMBER = '#C9A66B';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';

function formatPrice(v) {
  return v == null ? '—' : `$${Math.round(v).toLocaleString()}`;
}

function levelId(l) {
  return l.kind === 'zone' ? `zone-${l.zoneLow}-${l.zoneHigh}` : `level-${l.side}-${l.price}`;
}

// Once a level is hit it stays hit, even if price later moves back — a
// liquidation cluster that's been wicked through is spent, and a squeeze
// zone that's been traded through is no longer "thin." Persisted per
// browser in localStorage, namespaced by CAPTURED_AT so a fresh screenshot
// (a new CAPTURED_AT) starts every level unhit again.
function readHit(id) {
  try {
    return localStorage.getItem(`liqLevelHit:${CAPTURED_AT}:${id}`) === '1';
  } catch {
    return false;
  }
}

function writeHit(id) {
  try {
    localStorage.setItem(`liqLevelHit:${CAPTURED_AT}:${id}`, '1');
  } catch {
    // localStorage unavailable (private mode, blocked) — hit state just
    // won't persist across reloads; not worth failing the panel over.
  }
}

function isNowHit(l, price) {
  if (l.kind === 'zone') return price >= l.zoneLow && price <= l.zoneHigh;
  if (SPOT_AT_CAPTURE == null) return false;
  return l.price < SPOT_AT_CAPTURE ? price <= l.price : price >= l.price;
}

export default function LiquidationLevelsTracker({ btcPrice, btcPriceError }) {
  const [hitIds, setHitIds] = useState(() => new Set());
  const [justHit, setJustHit] = useState(false);

  useEffect(() => {
    if (btcPrice == null || LEVELS.length === 0) return;
    setHitIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const l of LEVELS) {
        const id = levelId(l);
        if (next.has(id) || readHit(id)) {
          if (!next.has(id)) next.add(id);
          continue;
        }
        if (isNowHit(l, btcPrice)) {
          next.add(id);
          writeHit(id);
          changed = true;
        }
      }
      if (changed) setJustHit(true);
      return changed ? next : prev;
    });
  }, [btcPrice]);

  if (LEVELS.length === 0) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Liquidation Levels Tracker
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16, maxWidth: 680, lineHeight: 1.5 }}>
          No liquidation map loaded yet. Send a liquidation heatmap screenshot and its squeeze zones and
          liquidity levels get read off it and tracked here — live price is checked against each one, and
          once it's crossed, that level is marked hit.
        </p>
      </section>
    );
  }

  const sorted = [...LEVELS].sort((a, b) => {
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
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 12px', maxWidth: 680, lineHeight: 1.5 }}>
        Squeeze zones and liquidity levels read off a screenshot you sent — not modeled, not pulled from an
        API. Live price is checked against each one; once crossed, it's marked hit and stays that way.
        {SOURCE ? ` Source: ${SOURCE}.` : ''}
        {CAPTURED_AT ? ` Captured ${new Date(CAPTURED_AT).toLocaleString()}.` : ''}
      </p>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, flex: '1 1 160px' }}>
          <div style={{ fontSize: 11, color: TEXT_MUTED }}>Live price</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: TEXT_PRIMARY, marginTop: 6, fontFamily: 'ui-monospace, monospace' }}>
            {btcPriceError ? '—' : formatPrice(btcPrice)}
          </div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, flex: '1 1 160px' }}>
          <div style={{ fontSize: 11, color: TEXT_MUTED }}>Levels hit</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: hitCount > 0 ? AMBER : TEXT_PRIMARY, marginTop: 6, fontFamily: 'ui-monospace, monospace' }}>
            {hitCount} / {sorted.length}
          </div>
        </div>
      </div>

      {btcPriceError && (
        <div style={{ background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 12, color: '#C9A66B', fontSize: 12, marginBottom: 14 }}>
          Live price failed to load: {btcPriceError}
        </div>
      )}

      {(hitCount > 0 || justHit) && (
        <div style={{ background: '#1E1B14', border: `1px solid ${AMBER}`, borderRadius: 6, padding: 12, color: AMBER, fontSize: 12, marginBottom: 14 }}>
          <strong>Liquidation map update required</strong> — {hitCount} level{hitCount === 1 ? '' : 's'} hit
          since this map was captured. Send a fresh screenshot to refresh it.
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
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, flex: 1 }}>{l.label || ''}</span>
              {hit && <span style={{ fontSize: 10, color: AMBER, fontWeight: 600 }}>HIT</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
