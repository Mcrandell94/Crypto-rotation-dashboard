'use client';

import { useState } from 'react';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';

function formatRelative(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  const hrs = diffMs / 3_600_000;
  if (hrs < 1) return `${Math.max(1, Math.round(hrs * 60))}m ago`;
  if (hrs < 24) return `${Math.round(hrs)}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function MarketNews({ data }) {
  const [expanded, setExpanded] = useState(false);

  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Market News</h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const { articles } = data;
  const latest = articles[0];

  return (
    <section style={{ marginTop: 32 }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
          padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 11, color: TEXT_SECONDARY, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          ▸
        </span>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Market News</h2>
        <span style={{ fontSize: 11, color: TEXT_MUTED }}>({articles.length})</span>
      </button>

      {!expanded && latest && (
        <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: '6px 0 0 20px', lineHeight: 1.4 }}>
          {latest.title}
        </p>
      )}

      {expanded && (
        <>
          <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px 20px' }}>
            Live crypto headlines via CoinStats
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {articles.map((a, i) => (
              <a
                key={a.id || a.link || i}
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block', textDecoration: 'none', background: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '10px 14px',
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.4 }}>{a.title}</div>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: TEXT_SECONDARY, marginTop: 5 }}>
                  {a.source && <span>{a.source}</span>}
                  {a.source && formatRelative(a.publishedAt) && <span>·</span>}
                  {formatRelative(a.publishedAt) && <span>{formatRelative(a.publishedAt)}</span>}
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
