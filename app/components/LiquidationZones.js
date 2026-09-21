'use client';

import { useState } from 'react';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const AMBER = '#C9A66B';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';

function formatUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

function formatPrice(v) {
  return v == null ? '—' : `$${Math.round(v).toLocaleString()}`;
}

export default function LiquidationZones({ data }) {
  const [asset, setAsset] = useState('BTC');

  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Liquidation Zones (Modeled) — CoinLobster
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const assetData = data.assets?.[asset];
  const levels = [...(assetData?.levels || [])].sort((a, b) => b.price - a.price);

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        Liquidation Zones (Modeled) — CoinLobster
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px', maxWidth: 680, lineHeight: 1.5 }}>
        CoinLobster's own projected liquidation levels — explicitly a model, not executed trades or raw
        exchange liquidation-order data. Shown as a live cross-check alongside the Liquidation Levels
        Tracker above, which is read by eye from real exchange heatmap screenshots — the two use
        fundamentally different methods, so agreement between them is more meaningful than either alone.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {['BTC', 'ETH'].map((a) => (
          <button
            key={a}
            onClick={() => setAsset(a)}
            style={{
              background: asset === a ? '#1E252A' : '#171D21',
              border: `1px solid ${asset === a ? AMBER : CARD_BORDER}`,
              color: asset === a ? AMBER : TEXT_SECONDARY,
              borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
            }}
          >
            {a}
          </button>
        ))}
      </div>

      {assetData?.error ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>{assetData.error}</p>
      ) : levels.length === 0 ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>No modeled liquidation zones for {asset} right now.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {levels.slice(0, 12).map((l, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '8px 10px',
              }}
            >
              <span
                style={{
                  fontSize: 10, fontWeight: 700, color: l.side === 'short' ? LOSS : GAIN,
                  border: `1px solid ${l.side === 'short' ? LOSS : GAIN}`, borderRadius: 3, padding: '1px 6px', flexShrink: 0,
                }}
              >
                {l.side ? l.side.toUpperCase() : '—'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: 'ui-monospace, monospace' }}>
                {formatPrice(l.price)}
              </span>
              {l.usd != null && (
                <span style={{ fontSize: 11, color: TEXT_MUTED, marginLeft: 'auto' }}>{formatUsd(l.usd)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
