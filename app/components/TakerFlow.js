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

const RANGE_LABELS = { '5m': '5 min', '1h': '1 hour', '4h': '4 hours', '24h': '24 hours' };
const RANGE_ORDER = ['5m', '1h', '4h', '24h'];

function formatUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function SplitBar({ buyPct, height = 16 }) {
  return (
    <div style={{ display: 'flex', height, borderRadius: 3, overflow: 'hidden', background: '#141A1D' }}>
      <div style={{ width: `${buyPct}%`, background: GAIN, opacity: 0.75 }} />
      <div style={{ width: `${100 - buyPct}%`, background: LOSS, opacity: 0.75 }} />
    </div>
  );
}

export default function TakerFlow({ data }) {
  const [symbol, setSymbol] = useState('BTC');
  const [range, setRange] = useState('1h');

  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Taker Buy/Sell Volume — Cross-Exchange
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const asset = data.assets[symbol];
  const row = asset?.byRange?.[range];
  const availableRanges = RANGE_ORDER.filter((r) => asset?.byRange?.[r]);

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        Taker Buy/Sell Volume — Cross-Exchange
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px' }}>
        Live taker (market-order) buy vs. sell volume, aggregated across every exchange Coinglass
        tracks — who's actually crossing the spread, not just resting orders or open positions.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {RANGE_ORDER.map((r) => {
          const has = availableRanges.includes(r);
          return (
            <button
              key={r}
              onClick={() => has && setRange(r)}
              disabled={!has}
              style={{
                background: range === r ? '#1E252A' : '#171D21',
                border: `1px solid ${range === r ? AMBER : CARD_BORDER}`,
                color: !has ? TEXT_MUTED : range === r ? AMBER : TEXT_SECONDARY,
                borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: has ? 'pointer' : 'not-allowed',
                opacity: has ? 1 : 0.5,
              }}
            >
              {RANGE_LABELS[r]}
            </button>
          );
        })}
      </div>

      {!row ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>
          No live data for {symbol} at this range this refresh
          {asset?.rangesFailed?.find((f) => f.range === range) && `: ${asset.rangesFailed.find((f) => f.range === range).error}`}
        </p>
      ) : (
        <>
          <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: TEXT_MUTED, marginBottom: 8 }}>
              <span>Aggregate {symbol} taker volume, trailing {RANGE_LABELS[row.range].toLowerCase()}</span>
              <span style={{ color: row.netVolUsd >= 0 ? GAIN : LOSS, fontFamily: 'ui-monospace, monospace' }}>
                Net {row.netVolUsd >= 0 ? '+' : ''}{formatUsd(row.netVolUsd)}
              </span>
            </div>
            <SplitBar buyPct={row.buyRatio} height={22} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: GAIN, fontFamily: 'ui-monospace, monospace' }}>
                  {row.buyRatio?.toFixed(1)}% buy
                </span>
                <span style={{ fontSize: 11, color: TEXT_MUTED, marginLeft: 6 }}>{formatUsd(row.buyVolUsd)}</span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: TEXT_MUTED, marginRight: 6 }}>{formatUsd(row.sellVolUsd)}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: LOSS, fontFamily: 'ui-monospace, monospace' }}>
                  {row.sellRatio?.toFixed(1)}% sell
                </span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 8 }}>By exchange</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {row.byExchange.slice(0, 8).map((e) => (
              <div key={e.exchange} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: TEXT_SECONDARY, width: 70, flexShrink: 0 }}>{e.exchange}</span>
                <div style={{ flex: 1 }}>
                  <SplitBar buyPct={e.buyRatio} />
                </div>
                <span style={{ fontSize: 11, color: GAIN, width: 42, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                  {e.buyRatio?.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {asset?.rangesFailed?.length > 0 && (
        <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 10 }}>
          No live data for: {asset.rangesFailed.map((f) => f.range).join(', ')} — skipped.
        </p>
      )}
    </section>
  );
}
