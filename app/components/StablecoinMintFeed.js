'use client';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const AMBER = '#C9A66B';

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

export default function StablecoinMintFeed({ data }) {
  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
          Stablecoin Mint Feed — Ethereum
        </h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const mints = data.mints || [];

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>
        Stablecoin Mint Feed — Ethereum
      </h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px', maxWidth: 680, lineHeight: 1.5 }}>
        Real on-chain USDT/USDC mints — an ERC-20 Transfer from the null address to the issuer's
        treasury, read live from Etherscan. Ethereum only: most USDT actually mints on Tron, so this
        is real but partial — not the full cross-chain picture. A mint isn't itself a buy signal, just
        new supply entering the issuer's treasury; it typically moves to exchanges later, if at all.
      </p>

      {mints.length === 0 ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>No USDT/USDC mints in the last ~7 days of Ethereum blocks.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mints.map((m) => (
            <div
              key={m.txHash}
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
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>
                {formatUsd(m.amount)}
              </span>
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, flex: 1 }}>
                to{' '}
                <a
                  href={`https://etherscan.io/address/${m.to}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: TEXT_SECONDARY }}
                >
                  {shortAddr(m.to)}
                </a>
              </span>
              <a
                href={`https://etherscan.io/tx/${m.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 10, color: TEXT_MUTED, flexShrink: 0 }}
              >
                tx
              </a>
              <span style={{ fontSize: 10, color: TEXT_MUTED, width: 56, textAlign: 'right', flexShrink: 0 }}>
                {formatRelative(m.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}

      {data.tokensFailed?.length > 0 && (
        <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 10 }}>
          No live data for: {data.tokensFailed.map((f) => f.symbol).join(', ')} — skipped.
        </p>
      )}
    </section>
  );
}
