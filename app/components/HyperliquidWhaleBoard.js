'use client';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';

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

export default function HyperliquidWhaleBoard({ data }) {
  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Hyperliquid Whale Board</h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const accounts = [...(data.accounts || [])].sort((a, b) => (b.equityUsd ?? 0) - (a.equityUsd ?? 0));

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Hyperliquid Whale Board</h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px', maxWidth: 680, lineHeight: 1.5 }}>
        CoinLobster's tracked Hyperliquid accounts — equity, open position size, leverage, and bias per
        named wallet. Hyperliquid's own public feed names the wallet on both sides of every fill, which
        is what makes tracking specific accounts possible there.
      </p>

      {accounts.length === 0 ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>No tracked accounts returned right now.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {accounts.slice(0, 20).map((a, i) => (
            <div
              key={a.wallet || i}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '8px 10px',
              }}
            >
              <a
                href={a.wallet ? `https://app.hyperliquid.xyz/explorer/address/${a.wallet}` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, color: TEXT_SECONDARY, width: 130, flexShrink: 0, fontFamily: 'ui-monospace, monospace' }}
              >
                {a.label || shortAddr(a.wallet)}
              </a>
              <span style={{ fontSize: 12, color: TEXT_PRIMARY, fontFamily: 'ui-monospace, monospace', width: 80, flexShrink: 0 }}>
                {formatUsd(a.equityUsd)}
              </span>
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, flex: 1 }}>
                {formatUsd(a.positionUsd)} position{a.leverage != null ? ` @ ${a.leverage}x` : ''}
              </span>
              {a.bias && (
                <span
                  style={{
                    fontSize: 10, fontWeight: 700, color: /short/i.test(a.bias) ? LOSS : GAIN,
                    border: `1px solid ${/short/i.test(a.bias) ? LOSS : GAIN}`, borderRadius: 3, padding: '1px 6px',
                  }}
                >
                  {a.bias.toUpperCase()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
