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

const MIN_SIZE_OPTIONS = [
  { key: 0, label: 'All' },
  { key: 500_000, label: '$500K+' },
  { key: 1_000_000, label: '$1M+' },
  { key: 5_000_000, label: '$5M+' },
];

function formatUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

function shortAddr(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : null;
}

function formatRelative(ts) {
  if (!ts) return null;
  const sec = (Date.now() - ts) / 1000;
  if (sec < 60) return `${Math.max(1, Math.round(sec))}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

export default function WhaleTradeFeed({ data }) {
  const [minSize, setMinSize] = useState(0);

  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Whale Trade Feed</h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const allTrades = data.trades || [];
  const trades = allTrades.filter((t) => t.usd == null || t.usd >= minSize);
  const hiddenCount = allTrades.length - trades.length;

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Whale Trade Feed</h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px', maxWidth: 680, lineHeight: 1.5 }}>
        Live individual whale-sized trades, merged across 15 exchanges, Hyperliquid, and on-chain DEX
        swaps (Ethereum/Base/Arbitrum), via CoinLobster — actual single trades, not an aggregate ratio.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {MIN_SIZE_OPTIONS.map((o) => (
          <button
            key={o.key}
            onClick={() => setMinSize(o.key)}
            style={{
              background: minSize === o.key ? '#1E252A' : '#171D21',
              border: `1px solid ${minSize === o.key ? AMBER : CARD_BORDER}`,
              color: minSize === o.key ? AMBER : TEXT_SECONDARY,
              borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {trades.length === 0 ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>No whale trades at this size in the current feed.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {trades.slice(0, 30).map((t, i) => (
            <div
              key={t.txHash || i}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '8px 10px',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: TEXT_PRIMARY, width: 52, flexShrink: 0 }}>
                {t.coin || '—'}
              </span>
              <span
                style={{
                  fontSize: 10, fontWeight: 700, color: t.side === 'sell' ? LOSS : GAIN,
                  border: `1px solid ${t.side === 'sell' ? LOSS : GAIN}`, borderRadius: 3, padding: '1px 6px', flexShrink: 0,
                }}
              >
                {t.side ? t.side.toUpperCase() : '—'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>
                {formatUsd(t.usd)}
              </span>
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, flex: 1 }}>
                {t.exchange || t.chain || '—'}
                {t.wallet && ` · ${shortAddr(t.wallet)}`}
              </span>
              <span style={{ fontSize: 10, color: TEXT_MUTED, width: 56, textAlign: 'right', flexShrink: 0 }}>
                {formatRelative(t.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}

      {hiddenCount > 0 && (
        <p style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 8 }}>
          {hiddenCount} smaller trade{hiddenCount === 1 ? '' : 's'} hidden by the size filter above.
        </p>
      )}
    </section>
  );
}
