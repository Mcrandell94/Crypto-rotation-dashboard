'use client';

import { useState, useEffect, useCallback } from 'react';
import RotationChart from './components/RotationChart';

const TRACKED = ['BTC', 'ETH', 'SOL', 'SUI', 'LINK'];

export default function DashboardHome() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/crypto?symbols=${TRACKED.join(',')}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Crypto Rotation Dashboard</h1>
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            background: '#171D21', border: '1px solid #2A3136', color: '#C9A66B',
            borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>

      <p style={{ fontSize: 12, color: '#6E767B', marginTop: 6 }}>
        {data?.fetchedAt
          ? `Live from CoinMarketCap — last fetched ${new Date(data.fetchedAt).toLocaleTimeString()}`
          : 'Fetching live data…'}
      </p>

      {error && (
        <div style={{ marginTop: 20, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
          <strong>Fetch failed:</strong> {error}
          <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
            Most likely cause: CMC_API_KEY isn't set yet in this environment's variables.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginTop: 24 }}>
        {TRACKED.map((sym) => {
          const t = data?.tickers?.[sym];
          return (
            <div key={sym} style={{ background: '#171D21', border: '1px solid #2A3136', borderRadius: 6, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#E7E4DD' }}>{sym}</div>
              {t ? (
                <>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 20, marginTop: 8 }}>
                    ${t.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: '#8B9298', marginTop: 4 }}>
                    Mkt Cap: ${(t.marketCap / 1e9).toFixed(2)}B
                  </div>
                  <div style={{ fontSize: 11, marginTop: 4, color: t.percentChange24h >= 0 ? '#7FA37F' : '#A85D4F' }}>
                    24h: {t.percentChange24h >= 0 ? '+' : ''}{t.percentChange24h.toFixed(2)}%
                  </div>
                  <div style={{ fontSize: 11, color: t.percentChange7d >= 0 ? '#7FA37F' : '#A85D4F' }}>
                    7d: {t.percentChange7d >= 0 ? '+' : ''}{t.percentChange7d.toFixed(2)}%
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#6E767B', marginTop: 8 }}>—</div>
              )}
            </div>
          );
        })}
      </div>

      <RotationChart tickers={data?.tickers} symbols={TRACKED} />

      <p style={{ fontSize: 11, color: '#6E767B', marginTop: 32, lineHeight: 1.6 }}>
        This proves the full pipeline: browser → Next.js API route → CoinMarketCap → back to the
        browser, with the API key never leaving the server. Once this is confirmed working live,
        the plan is to port AI Vibe scoring and the rest of the existing dashboard's panels over
        to read from this same kind of route instead of hardcoded data.
      </p>
    </main>
  );
}
