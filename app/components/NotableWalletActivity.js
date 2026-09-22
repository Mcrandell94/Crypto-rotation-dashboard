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
  { key: 100_000, label: '$100K+' },
  { key: 500_000, label: '$500K+' },
  { key: 1_000_000, label: '$1M+' },
  { key: 10_000_000, label: '$10M+' },
];

function formatUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

function shortAddr(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—';
}

function formatRelative(ts) {
  if (!ts) return null;
  const sec = (Date.now() - ts) / 1000;
  if (sec < 60) return `${Math.max(1, Math.round(sec))}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

function explorerLinks(chain) {
  return chain === 'Solana'
    ? { addr: (a) => `https://solscan.io/account/${a}`, tx: (h) => `https://solscan.io/tx/${h}` }
    : { addr: (a) => `https://etherscan.io/address/${a}`, tx: (h) => `https://etherscan.io/tx/${h}` };
}

export default function NotableWalletActivity({ data }) {
  const [minSize, setMinSize] = useState(0);

  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Notable Wallet Activity — Exchanges &amp; Market Makers
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const allActivity = data.activity || [];
  const activity = allActivity.filter((a) => a.amount == null || a.amount >= minSize);
  const hiddenCount = allActivity.length - activity.length;
  const trackedList = (data.watchedWallets || []).map((w) => `${w.entity} (${w.chain})`).join(', ');

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        Notable Wallet Activity — Exchanges &amp; Market Makers
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px', maxWidth: 680, lineHeight: 1.5 }}>
        Real USDT/USDC transfers into and out of a curated set of publicly-labeled exchange and
        market-maker wallets, read live from Etherscan. Each address was verified against its block
        explorer's own public entity label, not guessed — currently tracking:{' '}
        {trackedList || '—'}. Stablecoin flows only, not general token activity.
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

      {activity.length === 0 ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>
          {allActivity.length === 0
            ? 'No tracked wallet activity in the current window.'
            : `No activity at or above ${MIN_SIZE_OPTIONS.find((o) => o.key === minSize)?.label} in this window.`}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {activity.map((a, i) => {
            const links = explorerLinks(a.chain);
            return (
              <div
                key={a.txHash || i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, background: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '8px 10px',
                }}
              >
                <span
                  style={{
                    fontSize: 10, fontWeight: 700, color: a.direction === 'out' ? LOSS : GAIN,
                    border: `1px solid ${a.direction === 'out' ? LOSS : GAIN}`, borderRadius: 3,
                    padding: '1px 6px', flexShrink: 0, width: 28, textAlign: 'center',
                  }}
                >
                  {a.direction === 'out' ? 'OUT' : 'IN'}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY, width: 92, flexShrink: 0 }}>
                  {a.entity}
                </span>
                <span style={{ fontSize: 9, color: TEXT_MUTED, width: 52, flexShrink: 0 }}>{a.chain}</span>
                <span
                  style={{
                    fontSize: 10, fontWeight: 700, color: a.color || AMBER, border: `1px solid ${a.color || AMBER}`,
                    borderRadius: 3, padding: '1px 6px', flexShrink: 0,
                  }}
                >
                  {a.symbol}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>
                  {formatUsd(a.amount)}
                </span>
                <span style={{ fontSize: 11, color: TEXT_SECONDARY, flex: 1 }}>
                  {a.direction === 'out' ? 'to' : 'from'}{' '}
                  {a.counterparty ? (
                    <a href={links.addr(a.counterparty)} target="_blank" rel="noopener noreferrer" style={{ color: TEXT_SECONDARY }}>
                      {shortAddr(a.counterparty)}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
                {a.txHash && (
                  <a
                    href={links.tx(a.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 10, color: TEXT_MUTED, flexShrink: 0 }}
                  >
                    tx
                  </a>
                )}
                <span style={{ fontSize: 10, color: TEXT_MUTED, width: 56, textAlign: 'right', flexShrink: 0 }}>
                  {formatRelative(a.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {hiddenCount > 0 && (
        <p style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 8 }}>
          {hiddenCount} smaller transfer{hiddenCount === 1 ? '' : 's'} hidden by the size filter above.
        </p>
      )}

      {data.walletsFailed?.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.walletsFailed.map((f, i) => (
            <p key={i} style={{ fontSize: 11, color: TEXT_MUTED, margin: 0 }}>
              <strong style={{ color: TEXT_SECONDARY }}>{f.entity} ({f.chain})</strong> — skipped: {f.error || 'unknown error'}
            </p>
          ))}
        </div>
      )}

      {data.walletsSkipped?.length > 0 && (
        <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>
          {data.walletsSkipped.map((s) => `${s.entity} (${s.chain})`).join(', ')} not configured — add its API key to enable.
        </p>
      )}
    </section>
  );
}
