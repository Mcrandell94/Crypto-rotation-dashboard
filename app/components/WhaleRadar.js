'use client';

import { useCallback, useState } from 'react';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const AMBER = '#C9A66B';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';

const WINDOWS = ['1h', '4h', '24h'];

function formatUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString()}`;
}

export default function WhaleRadar({ data }) {
  const [window_, setWindow] = useState('4h');
  const [byWindow, setByWindow] = useState({}); // window -> { loading } | { error } | { window, coins }

  const loadWindow = useCallback(async (w) => {
    setByWindow((prev) => ({ ...prev, [w]: { loading: true } }));
    try {
      const res = await fetch(`/api/whaleradar?window=${w}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setByWindow((prev) => ({ ...prev, [w]: json }));
    } catch (e) {
      setByWindow((prev) => ({ ...prev, [w]: { error: e.message } }));
    }
  }, []);

  const handlePickWindow = (w) => {
    setWindow(w);
    if (w !== data?.window && !byWindow[w]) loadWindow(w);
  };

  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Whale Radar</h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const active = window_ === data.window ? data : byWindow[window_];
  const coins = [...(active?.coins || [])].sort((a, b) => (b.netFlowUsd ?? -Infinity) - (a.netFlowUsd ?? -Infinity));

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Whale Radar</h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px', maxWidth: 680, lineHeight: 1.5 }}>
        Coins showing unusual whale activity right now, via CoinLobster — ranked by net whale flow
        (buy volume minus sell volume) over the selected window.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {WINDOWS.map((w) => (
          <button
            key={w}
            onClick={() => handlePickWindow(w)}
            style={{
              background: window_ === w ? '#1E252A' : '#171D21',
              border: `1px solid ${window_ === w ? AMBER : CARD_BORDER}`,
              color: window_ === w ? AMBER : TEXT_SECONDARY,
              borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
            }}
          >
            {w}
          </button>
        ))}
      </div>

      {active?.loading ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>Loading {window_} window…</p>
      ) : active?.error ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>{active.error}</p>
      ) : coins.length === 0 ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>No unusual whale activity flagged right now.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {coins.slice(0, 15).map((c) => (
            <div
              key={c.coin}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '8px 10px',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, width: 60, flexShrink: 0 }}>
                {c.coin || '—'}
              </span>
              <span
                style={{
                  fontSize: 12, fontWeight: 600, fontFamily: 'ui-monospace, monospace',
                  color: (c.netFlowUsd ?? 0) >= 0 ? GAIN : LOSS, flex: 1,
                }}
              >
                Net {(c.netFlowUsd ?? 0) >= 0 ? '+' : ''}{formatUsd(c.netFlowUsd)}
              </span>
              {c.score != null && (
                <span style={{ fontSize: 10, color: TEXT_MUTED }}>score {c.score}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
