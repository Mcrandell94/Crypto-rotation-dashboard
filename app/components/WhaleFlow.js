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

const PRIMARY_COINS = ['BTC', 'ETH'];

function formatUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

function SplitBar({ buyPct, height = 14 }) {
  return (
    <div style={{ display: 'flex', height, borderRadius: 3, overflow: 'hidden', background: '#141A1D' }}>
      <div style={{ width: `${buyPct}%`, background: GAIN, opacity: 0.75 }} />
      <div style={{ width: `${100 - buyPct}%`, background: LOSS, opacity: 0.75 }} />
    </div>
  );
}

function formatHour(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function WhaleFlow({ data }) {
  const [coin, setCoin] = useState('BTC');
  const [otherFlows, setOtherFlows] = useState({}); // coin -> { loading } | { error } | { coin, hours }

  const loadCoin = useCallback(async (c) => {
    setOtherFlows((prev) => ({ ...prev, [c]: { loading: true } }));
    try {
      const res = await fetch(`/api/whaleflow?coin=${encodeURIComponent(c)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setOtherFlows((prev) => ({ ...prev, [c]: json }));
    } catch (e) {
      setOtherFlows((prev) => ({ ...prev, [c]: { error: e.message } }));
    }
  }, []);

  const handlePick = (c) => {
    setCoin(c);
    if (c !== data?.coin && !otherFlows[c]) loadCoin(c);
  };

  if (!data) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Whale Flow</h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Waiting for data…</p>
      </section>
    );
  }

  const active = coin === data.coin ? data : otherFlows[coin];
  const hours = (active?.hours || []).slice(0, 12);
  const otherOptions = ['SOL', 'XRP', 'DOGE'];

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Whale Flow</h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 16px', maxWidth: 680, lineHeight: 1.5 }}>
        Hourly whale buy vs. sell volume for one coin, CEX and DEX combined, via CoinLobster.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {PRIMARY_COINS.map((c) => (
          <button
            key={c}
            onClick={() => handlePick(c)}
            style={{
              background: coin === c ? '#1E252A' : '#171D21',
              border: `1px solid ${coin === c ? AMBER : CARD_BORDER}`,
              color: coin === c ? AMBER : TEXT_SECONDARY,
              borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
            }}
          >
            {c}
          </button>
        ))}
        {otherOptions.map((c) => (
          <button
            key={c}
            onClick={() => handlePick(c)}
            style={{
              background: coin === c ? '#1E252A' : '#171D21',
              border: `1px solid ${coin === c ? AMBER : CARD_BORDER}`,
              color: coin === c ? AMBER : TEXT_SECONDARY,
              borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {active?.loading ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>Loading {coin}…</p>
      ) : active?.error ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>{active.error}</p>
      ) : hours.length === 0 ? (
        <p style={{ fontSize: 12, color: TEXT_MUTED }}>No whale flow data for {coin} right now.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {hours.map((h, i) => {
            const total = h.buyUsd + h.sellUsd;
            const buyPct = total > 0 ? (h.buyUsd / total) * 100 : 50;
            return (
              <div key={h.timestamp || i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 10, color: TEXT_MUTED, width: 60, flexShrink: 0 }}>{formatHour(h.timestamp)}</span>
                <div style={{ flex: 1 }}>
                  <SplitBar buyPct={buyPct} />
                </div>
                <span style={{ fontSize: 10, color: GAIN, width: 56, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                  {formatUsd(h.buyUsd)}
                </span>
                <span style={{ fontSize: 10, color: LOSS, width: 56, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                  {formatUsd(h.sellUsd)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
