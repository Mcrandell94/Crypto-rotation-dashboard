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

function formatUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function formatPrice(v) {
  return v == null ? '—' : `$${Math.round(v).toLocaleString()}`;
}

function SourceToggle({ useCoinalyze, setUseCoinalyze }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: TEXT_SECONDARY, cursor: 'pointer', marginBottom: 14 }}>
      <input type="checkbox" checked={useCoinalyze} onChange={(e) => setUseCoinalyze(e.target.checked)} />
      Use Coinalyze (hourly bars, 12 aggregated venues) instead of the Kraken + Coinglass model (4-hour bars)
    </label>
  );
}

export default function LiquidationHeatmap({ data, dataError, coinalyzeData, coinalyzeError }) {
  const [useCoinalyze, setUseCoinalyze] = useState(false);

  const active = useCoinalyze ? coinalyzeData : data;
  const activeError = useCoinalyze ? coinalyzeError : dataError;

  if (activeError) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          BTC Liquidation Clusters (Modeled)
        </h2>
        <div style={{ marginTop: 12 }}>
          <SourceToggle useCoinalyze={useCoinalyze} setUseCoinalyze={setUseCoinalyze} />
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
          BTC Liquidation Clusters (Modeled)
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const { price, bins, nearestLongCluster, nearestShortCluster, lookbackDays, source } = active;

  const activeBins = bins.filter((b) => b.longWeight > 0 || b.shortWeight > 0);
  const nearest = [...activeBins]
    .sort((a, b) => Math.abs((a.priceLow + a.priceHigh) / 2 - price) - Math.abs((b.priceLow + b.priceHigh) / 2 - price))
    .slice(0, MAX_ROWS)
    .sort((a, b) => b.priceLow - a.priceLow);
  const maxWeight = Math.max(1, ...nearest.map((b) => Math.max(b.longWeight, b.shortWeight)));

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        BTC Liquidation Clusters (Modeled)
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 12px', maxWidth: 680, lineHeight: 1.5 }}>
        Modeled from real BTC price and open-interest data — not an exchange-reported figure the way
        the panels above are. Detects open-interest surges, projects where leveraged longs/shorts at
        that moment would get liquidated, and clears a level once price actually trades through it.
        {source ? ` Source: ${source}.` : ''}
        {lookbackDays ? ` ~${lookbackDays} days of lookback.` : ''}
      </p>

      <SourceToggle useCoinalyze={useCoinalyze} setUseCoinalyze={setUseCoinalyze} />

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, flex: '1 1 160px' }}>
          <div style={{ fontSize: 11, color: TEXT_MUTED }}>Spot</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: TEXT_PRIMARY, marginTop: 6, fontFamily: 'ui-monospace, monospace' }}>
            {formatPrice(price)}
          </div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, flex: '1 1 160px' }}>
          <div style={{ fontSize: 11, color: TEXT_MUTED }}>Nearest long cluster (below)</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: LOSS, marginTop: 6, fontFamily: 'ui-monospace, monospace' }}>
            {nearestLongCluster ? formatPrice((nearestLongCluster.priceLow + nearestLongCluster.priceHigh) / 2) : '—'}
          </div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, flex: '1 1 160px' }}>
          <div style={{ fontSize: 11, color: TEXT_MUTED }}>Nearest short cluster (above)</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: GAIN, marginTop: 6, fontFamily: 'ui-monospace, monospace' }}>
            {nearestShortCluster ? formatPrice((nearestShortCluster.priceLow + nearestShortCluster.priceHigh) / 2) : '—'}
          </div>
        </div>
      </div>

      {nearest.length === 0 ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>No open-interest anomalies detected in the current lookback window.</p>
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
                  {formatUsd(weight)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 12, lineHeight: 1.5, maxWidth: 680 }}>
        Bars below spot (<span style={{ color: LOSS }}>red</span>) mark where leveraged longs would be
        forced to sell; bars above spot (<span style={{ color: GAIN }}>green</span>) mark where
        leveraged shorts would be forced to buy. This is a model, not a forecast — real liquidation
        cascades have repeatedly missed levels like these.
      </p>
    </section>
  );
}
