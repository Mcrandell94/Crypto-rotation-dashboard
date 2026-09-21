'use client';

import { useEffect, useState } from 'react';
import { LEVELS_BY_ASSET } from '../lib/liquidationLevels';

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

function levelId(l) {
  return l.kind === 'zone' ? `zone-${l.zoneLow}-${l.zoneHigh}` : `level-${l.side}-${l.price}`;
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

function isNowHit(l, price, spotAtCapture) {
  if (l.kind === 'zone') return price >= l.zoneLow && price <= l.zoneHigh;
  if (spotAtCapture == null) return false;
  return l.price < spotAtCapture ? price <= l.price : price >= l.price;
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

export default function LiquidationLevelsTracker({ btcPrice, btcPriceError, ethPrice, ethPriceError }) {
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
      for (const h of Object.values(LEVELS_BY_ASSET[asset])) {
        if (h.levels.length === 0) continue;
        const set = new Set(next[asset][h.key]);
        let changed = false;
        for (const l of h.levels) {
          const id = levelId(l);
          if (set.has(id) || readHit(asset, h.key, h.capturedAt, id)) {
            if (!set.has(id)) set.add(id);
            continue;
          }
          if (isNowHit(l, price, h.spotAtCapture)) {
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
  }, [asset, price]);

  const horizonList = Object.values(LEVELS_BY_ASSET[asset]);
  const active = LEVELS_BY_ASSET[asset][horizonKey] || horizonList[0];
  const hitIds = hitByAssetHorizon[asset]?.[active?.key] || new Set();

  if (!active || active.levels.length === 0) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Liquidation Levels Tracker
        </h2>
        <AssetPicker asset={asset} setAsset={setAsset} />
        <HorizonPicker horizonList={horizonList} horizonKey={active?.key} setHorizonKey={setHorizonKey} />
        <p style={{ fontSize: 12, color: TEXT_MUTED, maxWidth: 680, lineHeight: 1.5 }}>
          No {asset} liquidation map loaded yet for this horizon. Send a liquidation heatmap screenshot and
          its squeeze zones and liquidity levels get read off it and tracked here — live price is checked
          against each one, and once it's crossed, that level is marked hit.
        </p>
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
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 12px', maxWidth: 680, lineHeight: 1.5 }}>
        Squeeze zones and liquidity levels read off a screenshot you sent — not modeled, not pulled from an
        API. Live price is checked against each one; once crossed, it's marked hit and stays that way.
        {active.source ? ` Source: ${active.source}.` : ''}
        {active.capturedAt ? ` Captured ${new Date(active.capturedAt).toLocaleString()}.` : ''}
      </p>

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

      {hitCount > 0 && (
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
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, flex: 1 }}>{l.label || ''}</span>
              {hit && <span style={{ fontSize: 10, color: AMBER, fontWeight: 600 }}>HIT</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
