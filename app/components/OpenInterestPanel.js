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
  return `$${v.toLocaleString()}`;
}

export default function OpenInterestPanel({ data }) {
  const [symbol, setSymbol] = useState('BTC');

  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Open Interest — Cross-Exchange
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const asset = data.assets[symbol];
  const maxOi = Math.max(1, ...asset.byExchange.map((e) => e.openInterestUsd));

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        Open Interest — Cross-Exchange
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        Live open interest aggregated across all exchanges Coinglass tracks — unlike Funding &amp; OI
        below, which is Hyperliquid only
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {Object.keys(data.assets).map((s) => (
          <button
            key={s}
            onClick={() => setSymbol(s)}
            style={{
              background: symbol === s ? '#1E252A' : '#171D21',
              border: `1px solid ${symbol === s ? AMBER : CARD_BORDER}`,
              color: symbol === s ? AMBER : TEXT_SECONDARY,
              borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: TEXT_MUTED }}>Total {symbol} open interest</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: TEXT_PRIMARY, marginTop: 6, fontFamily: 'ui-monospace, monospace' }}>
          {formatUsd(asset.totalUsd)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {asset.byExchange.slice(0, 8).map((e) => {
          const pct = (e.openInterestUsd / maxOi) * 100;
          return (
            <div key={e.exchange} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, width: 70, flexShrink: 0 }}>{e.exchange}</span>
              <div style={{ flex: 1, height: 16, background: '#141A1D', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: AMBER, opacity: 0.7 }} />
              </div>
              <span style={{ fontSize: 11, color: TEXT_PRIMARY, width: 70, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                {formatUsd(e.openInterestUsd)}
              </span>
              {e.change24h != null && (
                <span style={{ fontSize: 10, width: 46, textAlign: 'right', color: e.change24h >= 0 ? GAIN : LOSS, fontFamily: 'ui-monospace, monospace' }}>
                  {e.change24h >= 0 ? '+' : ''}{e.change24h.toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 12, lineHeight: 1.5, maxWidth: 620 }}>
        Coinglass's liquidation heatmap, liquidation map, and liquidation max-pain data all require
        its Professional plan ($699+/mo) — not included on the current key, and not shown here.
      </p>
    </section>
  );
}
