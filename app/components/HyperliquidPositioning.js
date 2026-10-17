'use client';

import { useState } from 'react';

// Who holds what on Hyperliquid (accounts >= $100k) and the market-maker
// "dealer gamma" read, from CryptoDataAPI Pro via /api/positioning.

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const AMBER = '#C9A66B';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';
const TEAL = '#5E9C98';
const ASSETS = ['BTC', 'ETH'];

const REGIMES = {
  amplify: { label: 'Amplify', color: AMBER, read: 'Crowded positioning with liquidation clusters near price — moves tend to feed on forced flows.' },
  dampen: { label: 'Dampen', color: TEAL, read: 'Balanced positioning, funding near normal, no clusters close to price — moves tend to fade.' },
  transitional: { label: 'Transitional', color: TEXT_SECONDARY, read: 'Price near the flip line, or mixed signals — the jumpiest state.' },
};

function usd(v, signed = false) {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = signed ? (v > 0 ? '+' : v < 0 ? '−' : '') : v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(a).toLocaleString()}`;
}

const price = (p) => (p == null ? '—' : `$${p.toLocaleString('en-US', { maximumFractionDigits: p >= 1000 ? 0 : 2 })}`);
const pct = (p) => (p == null ? '—' : `${p > 0 ? '+' : ''}${p.toFixed(2)}%`);

function Picker({ asset, setAsset }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      {ASSETS.map((a) => (
        <button
          key={a}
          onClick={() => setAsset(a)}
          style={{
            background: asset === a ? '#1E252A' : '#171D21',
            border: `1px solid ${asset === a ? AMBER : CARD_BORDER}`,
            color: asset === a ? AMBER : TEXT_SECONDARY,
            borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
          }}
        >
          {a}
        </button>
      ))}
    </div>
  );
}

function PositionRow({ row }) {
  const gross = row.longUsd + row.shortUsd;
  const longPct = gross > 0 ? (row.longUsd / gross) * 100 : 50;
  const total = row.key === 'all';
  return (
    <div style={{ padding: '7px 0', borderTop: total ? `1px solid ${CARD_BORDER}` : 'none', marginTop: total ? 4 : 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
        <span style={{ color: total ? TEXT_PRIMARY : TEXT_SECONDARY, fontWeight: total ? 600 : 400 }}>
          {row.label}
          {row.nAccounts != null && <span style={{ color: TEXT_MUTED, fontSize: 10 }}> · {row.nAccounts.toLocaleString()} accts</span>}
        </span>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
          <span style={{ color: GAIN }}>{usd(row.longUsd)} L</span>
          <span style={{ color: TEXT_MUTED }}> / </span>
          <span style={{ color: LOSS }}>{usd(row.shortUsd)} S</span>
          <span style={{ color: TEXT_MUTED }}> · net </span>
          <span style={{ color: row.netUsd >= 0 ? GAIN : LOSS }}>{usd(row.netUsd, true)}</span>
        </span>
      </div>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#141A1D', marginTop: 4 }}>
        <div style={{ width: `${longPct}%`, background: GAIN, opacity: 0.75 }} />
        <div style={{ width: `${100 - longPct}%`, background: LOSS, opacity: 0.75 }} />
      </div>
    </div>
  );
}

function Cluster({ l }) {
  // side = which positions liquidate there: longs below the mark are
  // forced selling, shorts above are forced buying.
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, padding: '3px 0' }}>
      <span style={{ color: TEXT_SECONDARY, fontFamily: 'ui-monospace, monospace' }}>{price(l.price)} <span style={{ color: TEXT_MUTED }}>({pct(l.distPct)})</span></span>
      <span style={{ fontFamily: 'ui-monospace, monospace', color: l.side === 'long' ? LOSS : GAIN }}>
        {usd(l.totalUsd)} {l.side === 'long' ? 'longs' : 'shorts'}
        {l.nAccounts != null && <span style={{ color: TEXT_MUTED }}> · {l.nAccounts} acct{l.nAccounts === 1 ? '' : 's'}</span>}
      </span>
    </div>
  );
}

function DealerGamma({ g }) {
  const r = REGIMES[g.state] || { label: g.state, color: TEXT_SECONDARY, read: '' };
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '10px 12px', marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY }}>Dealer gamma</span>
        <span style={{ fontSize: 10, color: r.color, border: `1px solid ${r.color}`, borderRadius: 3, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{r.label}</span>
        {g.confidence != null && <span style={{ fontSize: 10, color: TEXT_MUTED }}>confidence {Math.round(g.confidence * 100)}%</span>}
      </div>
      <p style={{ fontSize: 11, color: TEXT_SECONDARY, margin: '6px 0 0', lineHeight: 1.5 }}>
        {r.read}
        {g.rationale && <span style={{ color: TEXT_MUTED }}> Now: {g.rationale}.</span>}
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: TEXT_SECONDARY, marginTop: 8 }}>
        <span>Flip line <strong style={{ color: TEXT_PRIMARY, fontFamily: 'ui-monospace, monospace' }}>{price(g.flipPrice)}</strong> <span style={{ color: TEXT_MUTED }}>({pct(g.distToFlipPct)} from price)</span></span>
        <span>Market makers net <strong style={{ color: g.mmNetDeltaUsd >= 0 ? GAIN : LOSS, fontFamily: 'ui-monospace, monospace' }}>{usd(g.mmNetDeltaUsd, true)}</strong></span>
      </div>
      {(g.above.length > 0 || g.below.length > 0) && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 2 }}>Nearest market-maker liquidation clusters</div>
          {[...g.above].reverse().map((l) => <Cluster key={`a${l.price}`} l={l} />)}
          <div style={{ fontSize: 10, color: AMBER, padding: '2px 0', fontFamily: 'ui-monospace, monospace' }}>— price {price(g.mark)} —</div>
          {g.below.map((l) => <Cluster key={`b${l.price}`} l={l} />)}
        </div>
      )}
      <p style={{ fontSize: 10, color: TEXT_MUTED, margin: '8px 0 0', lineHeight: 1.5 }}>
        From {g.mmAccounts ?? 'Hyperliquid'} market-maker accounts only — a perp analog of options GEX, not the whole market&apos;s liquidation map.
      </p>
    </div>
  );
}

export default function HyperliquidPositioning({ data, error }) {
  const [asset, setAsset] = useState('BTC');
  const p = data?.positioning?.[asset];
  const g = data?.gex?.[asset];
  const w = data?.whales;
  const gated = (kind) => (data?.unavailable || []).some((u) => u.kind === kind && (u.symbol == null || u.symbol === asset));

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: TEXT_PRIMARY }}>Hyperliquid Positioning — accounts ≥ $100K</h2>
      <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 14px', maxWidth: 680, lineHeight: 1.5 }}>
        Open perp positions held by every Hyperliquid account of $100K or more, by trader type, via CryptoDataAPI (about 5 minutes fresh).
        Smart money and high leverage are tags that overlap the other groups.
      </p>
      {error && <p style={{ fontSize: 12, color: TEXT_MUTED }}>Positioning unavailable this refresh: {error}</p>}
      {!error && !data && <p style={{ fontSize: 12, color: TEXT_MUTED }}>Waiting for data…</p>}
      {!error && data && (
        <>
          {w && (
            <p style={{ fontSize: 11, color: TEXT_SECONDARY, margin: '0 0 12px' }}>
              Whole book, all coins: <strong style={{ color: TEXT_PRIMARY }}>{w.longPct}% long</strong> (long/short {w.longShortRatio}) across{' '}
              {w.accounts?.toLocaleString()} accounts — leaning <strong style={{ color: w.netBias === 'long' ? GAIN : w.netBias === 'short' ? LOSS : TEXT_PRIMARY }}>{w.netBias}</strong>.
            </p>
          )}
          <Picker asset={asset} setAsset={setAsset} />
          <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '6px 12px' }}>
            {p ? (
              p.rows.map((row) => <PositionRow key={row.key} row={row} />)
            ) : (
              <p style={{ fontSize: 11, color: TEXT_MUTED }}>{gated('positioning') ? 'Needs a CryptoDataAPI Pro key.' : `No ${asset} positioning this refresh.`}</p>
            )}
          </div>
          {g ? (
            <DealerGamma g={g} />
          ) : (
            <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 10 }}>{gated('gex') ? 'Dealer gamma needs a CryptoDataAPI Pro key.' : `No ${asset} dealer-gamma read this refresh.`}</p>
          )}
        </>
      )}
    </section>
  );
}
