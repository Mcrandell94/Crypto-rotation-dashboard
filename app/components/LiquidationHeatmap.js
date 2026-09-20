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
const MAX_ROWS = 24;

const SOURCES = [
  { key: 'default', label: 'Kraken + Coinglass (modeled, 4h bars)' },
  { key: 'coinalyze', label: 'Coinalyze (modeled, hourly bars)' },
  { key: 'bcf', label: "BitcoinCounterFlow (vendor's own heatmap)" },
];

function formatUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function formatWeight(v, weightUnit) {
  if (weightUnit === 'intensity') return v == null ? '—' : v.toFixed(2);
  return formatUsd(v);
}

function formatPrice(v) {
  return v == null ? '—' : `$${Math.round(v).toLocaleString()}`;
}

function SourcePicker({ source, setSource }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      {SOURCES.map((s) => (
        <button
          key={s.key}
          onClick={() => setSource(s.key)}
          style={{
            background: source === s.key ? '#1E252A' : '#171D21',
            border: `1px solid ${source === s.key ? AMBER : CARD_BORDER}`,
            color: source === s.key ? AMBER : TEXT_SECONDARY,
            borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export default function LiquidationHeatmap({ data, dataError, coinalyzeData, coinalyzeError, bcfData, bcfError }) {
  const [source, setSource] = useState('default');

  const bySource = { default: data, coinalyze: coinalyzeData, bcf: bcfData };
  const errorsBySource = { default: dataError, coinalyze: coinalyzeError, bcf: bcfError };
  const active = bySource[source];
  const activeError = errorsBySource[source];

  if (activeError) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          BTC Liquidation Clusters
        </h2>
        <div style={{ marginTop: 12 }}>
          <SourcePicker source={source} setSource={setSource} />
        </div>
        <div style={{ background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
          <strong>This source failed to load:</strong> {activeError}
        </div>
      </section>
    );
  }

  if (!active) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          BTC Liquidation Clusters
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const { price, bins, nearestLongCluster, nearestShortCluster, lookbackDays, source: sourceLabel, weightUnit } = active;
  const isModeled = source !== 'bcf';

  const activeBins = bins.filter((b) => b.longWeight > 0 || b.shortWeight > 0);
  const nearest = [...activeBins]
    .sort((a, b) => Math.abs((a.priceLow + a.priceHigh) / 2 - price) - Math.abs((b.priceLow + b.priceHigh) / 2 - price))
    .slice(0, MAX_ROWS)
    .sort((a, b) => b.priceLow - a.priceLow);
  const maxWeight = Math.max(1, ...nearest.map((b) => Math.max(b.longWeight, b.shortWeight)));

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        BTC Liquidation Clusters
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 12px', maxWidth: 680, lineHeight: 1.5 }}>
        {isModeled
          ? "Modeled from real BTC price and open-interest data — not an exchange-reported figure. Detects open-interest surges, projects where leveraged longs/shorts at that moment would get liquidated, and clears a level once price actually trades through it."
          : "BitcoinCounterFlow's own vendor-computed liquidation heatmap — not modeled here, pulled directly from their API."}
        {sourceLabel ? ` Source: ${sourceLabel}.` : ''}
        {lookbackDays ? ` ~${lookbackDays} days of lookback.` : ''}
      </p>

      <SourcePicker source={source} setSource={setSource} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-start' }}>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '10px 12px', flex: '1 1 130px' }}>
          <div style={{ fontSize: 10, color: TEXT_MUTED }}>{isModeled ? 'Spot' : 'Center of range'}</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: TEXT_PRIMARY, marginTop: 3, fontFamily: 'ui-monospace, monospace' }}>
            {formatPrice(price)}
          </div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '10px 12px', flex: '1 1 130px' }}>
          <div style={{ fontSize: 10, color: TEXT_MUTED }}>Nearest long cluster (below)</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: LOSS, marginTop: 3, fontFamily: 'ui-monospace, monospace' }}>
            {nearestLongCluster ? formatPrice((nearestLongCluster.priceLow + nearestLongCluster.priceHigh) / 2) : '—'}
          </div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '10px 12px', flex: '1 1 130px' }}>
          <div style={{ fontSize: 10, color: TEXT_MUTED }}>Nearest short cluster (above)</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: GAIN, marginTop: 3, fontFamily: 'ui-monospace, monospace' }}>
            {nearestShortCluster ? formatPrice((nearestShortCluster.priceLow + nearestShortCluster.priceHigh) / 2) : '—'}
          </div>
        </div>
      </div>

      {nearest.length === 0 ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>No liquidation clusters found in the current data.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nearest.map((b, i) => {
            const mid = (b.priceLow + b.priceHigh) / 2;
            const isAbove = mid >= price;
            const weight = isAbove ? b.shortWeight : b.longWeight;
            const pct = Math.min(100, (weight / maxWeight) * 100);
            const color = isAbove ? GAIN : LOSS;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: TEXT_SECONDARY, width: 76, flexShrink: 0, fontFamily: 'ui-monospace, monospace' }}>
                  {formatPrice(mid)}
                </span>
                <div style={{ flex: 1, height: 14, background: '#141A1D', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, opacity: 0.75 }} />
                </div>
                <span style={{ fontSize: 10, color: TEXT_MUTED, width: 54, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                  {formatWeight(weight, weightUnit)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 12, lineHeight: 1.5, maxWidth: 680 }}>
        Bars below spot (<span style={{ color: LOSS }}>red</span>) mark where leveraged longs would be
        forced to sell; bars above spot (<span style={{ color: GAIN }}>green</span>) mark where
        leveraged shorts would be forced to buy.
        {isModeled
          ? ' This is a model, not a forecast — real liquidation cascades have repeatedly missed levels like these.'
          : ''}
      </p>
    </section>
  );
}
