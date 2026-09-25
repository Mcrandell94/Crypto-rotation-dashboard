'use client';

import { useState } from 'react';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const AMBER = '#C9A66B';

const MIN_SIZE_OPTIONS = [
  { key: 0, label: 'All' },
  { key: 250_000, label: '$250K+' },
  { key: 500_000, label: '$500K+' },
  { key: 1_000_000, label: '$1M+' },
  { key: 10_000_000, label: '$10M+' },
  { key: 50_000_000, label: '$50M+' },
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

function explorerLinks(chain) {
  switch (chain) {
    case 'Tron':
      return { addr: (a) => `https://tronscan.org/#/address/${a}`, tx: (h) => `https://tronscan.org/#/transaction/${h}` };
    case 'Solana':
      return { addr: (a) => `https://solscan.io/account/${a}`, tx: (h) => `https://solscan.io/tx/${h}` };
    default:
      return { addr: (a) => `https://etherscan.io/address/${a}`, tx: (h) => `https://etherscan.io/tx/${h}` };
  }
}

function formatRelative(ts) {
  if (!ts) return null;
  const sec = (Date.now() - ts) / 1000;
  if (sec < 60) return `${Math.max(1, Math.round(sec))}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

export default function StablecoinMintFeed({ data }) {
  // Defaults to $1M+: most USDC "mints" are small CCTP bridge deliveries
  // (often under $1), which buried the treasury-sized ones under "All".
  const [minSize, setMinSize] = useState(1_000_000);

  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Stablecoin Mint Feed — Ethereum · Tron
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const allMints = data.mints || [];
  const mints = allMints.filter((m) => m.amount == null || m.amount >= minSize);
  const hiddenCount = allMints.length - mints.length;

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        Stablecoin Mint Feed — Ethereum · Tron
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px', maxWidth: 680, lineHeight: 1.5 }}>
        Real on-chain stablecoin mints, read live from Etherscan and TronGrid. USDT: Tether&apos;s own
        Issue events (new supply to the Tether treasury) on Ethereum and Tron, last ~30 days. USDC: a
        Transfer from Ethereum&apos;s null address, last ~3 hours only, because most USDC &quot;mints&quot;
        are Circle&apos;s CCTP bridge delivering to an end user on arrival, not a treasury re-supply:
        frequent and usually small. Showing $1M+ by default; pick &quot;All&quot; to see everything.
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

      {mints.length === 0 ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>
          {allMints.length === 0
            ? 'No USDT/USDC mints in the current lookback window.'
            : `No mints at or above ${MIN_SIZE_OPTIONS.find((o) => o.key === minSize)?.label} in this window.`}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mints.map((m, i) => {
            const links = explorerLinks(m.chain);
            return (
              <div
                key={m.txHash || i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, background: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '8px 10px',
                }}
              >
                <span
                  style={{
                    fontSize: 10, fontWeight: 700, color: m.color || AMBER, border: `1px solid ${m.color || AMBER}`,
                    borderRadius: 3, padding: '1px 6px', flexShrink: 0,
                  }}
                >
                  {m.symbol}
                </span>
                <span style={{ fontSize: 9, color: TEXT_MUTED, width: 52, flexShrink: 0 }}>{m.chain}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>
                  {formatUsd(m.amount)}
                </span>
                <span style={{ fontSize: 11, color: TEXT_SECONDARY, flex: 1 }}>
                  to{' '}
                  {m.toLabel ? (
                    m.toLabel
                  ) : m.to ? (
                    <a href={links.addr(m.to)} target="_blank" rel="noopener noreferrer" style={{ color: TEXT_SECONDARY }}>
                      {shortAddr(m.to)}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
                {m.txHash && (
                  <a
                    href={links.tx(m.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 10, color: TEXT_MUTED, flexShrink: 0 }}
                  >
                    tx
                  </a>
                )}
                <span style={{ fontSize: 10, color: TEXT_MUTED, width: 56, textAlign: 'right', flexShrink: 0 }}>
                  {formatRelative(m.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {hiddenCount > 0 && (
        <p style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 8 }}>
          {hiddenCount} smaller mint{hiddenCount === 1 ? '' : 's'} hidden by the size filter above.
        </p>
      )}

      {data.tokensFailed?.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.tokensFailed.map((f, i) => (
            <p key={i} style={{ fontSize: 11, color: TEXT_MUTED, margin: 0 }}>
              <strong style={{ color: TEXT_SECONDARY }}>{f.symbol} ({f.chain})</strong> — skipped: {f.error || 'unknown error'}
            </p>
          ))}
        </div>
      )}

      {data.chainsSkipped?.length > 0 && (
        <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>
          {data.chainsSkipped.map((s) => `${s.chain} (${s.symbol})`).join(', ')} not configured — add its API key to enable.
        </p>
      )}
    </section>
  );
}
