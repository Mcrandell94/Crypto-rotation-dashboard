'use client';

import { useState, useEffect, useCallback } from 'react';
import RotationChart from './components/RotationChart';
import RelativeRotationGraph from './components/RelativeRotationGraph';
import MacroSentiment from './components/MacroSentiment';
import EmaLevels from './components/EmaLevels';
import CotPanel from './components/CotPanel';
import FundingOI from './components/FundingOI';
import TimeframesPanel from './components/TimeframesPanel';
import CbCalendar from './components/CbCalendar';
import AstroOutlook from './components/AstroOutlook';
import { SECTORS, BENCHMARKS } from './lib/sectors';

const EMA_SYMBOLS = ['BTC', 'ETH'];

export default function DashboardHome() {
  const [activeSector, setActiveSector] = useState(SECTORS[0].key);
  const [benchmark, setBenchmark] = useState(BENCHMARKS[0].key);

  // A benchmark can't be plotted against itself, so drop it from the sector's
  // own ticker list; when the benchmark isn't BTC, BTC becomes a plottable
  // ticker instead (so you can see BTC's own rotation vs the new benchmark).
  const rawSectorTickers = SECTORS.find((s) => s.key === activeSector)?.tickers || [];
  const sectorTickers = rawSectorTickers.filter((t) => t !== benchmark);
  if (benchmark !== 'BTC' && !sectorTickers.includes('BTC')) sectorTickers.unshift('BTC');
  const tracked = [benchmark, ...sectorTickers];

  const [data, setData] = useState(null);
  const [rrgData, setRrgData] = useState(null);
  const [macroData, setMacroData] = useState(null);
  const [emaData, setEmaData] = useState(null);
  const [cotData, setCotData] = useState(null);
  const [fundingData, setFundingData] = useState(null);
  const [error, setError] = useState(null);
  const [rrgError, setRrgError] = useState(null);
  const [macroError, setMacroError] = useState(null);
  const [emaError, setEmaError] = useState(null);
  const [cotError, setCotError] = useState(null);
  const [fundingError, setFundingError] = useState(null);
  const [timeframesData, setTimeframesData] = useState(null);
  const [timeframesError, setTimeframesError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTimeframes = useCallback(async () => {
    setTimeframesError(null);
    try {
      const res = await fetch('/api/timeframes');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setTimeframesData(json);
    } catch (e) {
      setTimeframesError(e.message);
    }
  }, []);

  const fetchEma = useCallback(async () => {
    setEmaError(null);
    try {
      const res = await fetch('/api/ema');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setEmaData(json);
    } catch (e) {
      setEmaError(e.message);
    }
  }, []);

  const fetchCot = useCallback(async () => {
    setCotError(null);
    try {
      const res = await fetch('/api/cot');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setCotData(json);
    } catch (e) {
      setCotError(e.message);
    }
  }, []);

  const fetchData = useCallback(async (symbols, benchmark) => {
    setLoading(true);
    setError(null);
    setRrgError(null);
    setMacroError(null);
    setFundingError(null);
    try {
      const res = await fetch(`/api/crypto?symbols=${[benchmark, ...symbols].join(',')}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }

    try {
      const rrgRes = await fetch(`/api/rrg?benchmark=${benchmark}&symbols=${symbols.join(',')}`);
      const rrgJson = await rrgRes.json();
      if (!rrgRes.ok) throw new Error(rrgJson.error || 'Unknown error');
      setRrgData(rrgJson);
    } catch (e) {
      setRrgError(e.message);
    }

    try {
      const macroRes = await fetch('/api/macro');
      const macroJson = await macroRes.json();
      if (!macroRes.ok) throw new Error(macroJson.error || 'Unknown error');
      setMacroData(macroJson);
    } catch (e) {
      setMacroError(e.message);
    }

    try {
      const fundingRes = await fetch(`/api/funding?symbols=${[benchmark, ...symbols].join(',')}`);
      const fundingJson = await fundingRes.json();
      if (!fundingRes.ok) throw new Error(fundingJson.error || 'Unknown error');
      setFundingData(fundingJson);
    } catch (e) {
      setFundingError(e.message);
    }
  }, []);

  useEffect(() => {
    fetchData(sectorTickers, benchmark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSector, benchmark]);

  // EMA, COT, and Timeframes all track fixed BTC/ETH data, not the active
  // sector — fetch once on mount, then refresh alongside everything else
  // on manual refresh.
  useEffect(() => {
    fetchEma();
    fetchCot();
    fetchTimeframes();
  }, [fetchEma, fetchCot, fetchTimeframes]);

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Crypto Rotation Dashboard</h1>
        <button
          onClick={() => {
            fetchData(sectorTickers, benchmark);
            fetchEma();
            fetchCot();
            fetchTimeframes();
          }}
          disabled={loading}
          style={{
            background: '#171D21', border: '1px solid #2A3136', color: '#C9A66B',
            borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
        {SECTORS.map((sec) => (
          <button
            key={sec.key}
            onClick={() => setActiveSector(sec.key)}
            style={{
              background: activeSector === sec.key ? '#1E252A' : '#171D21',
              border: `1px solid ${activeSector === sec.key ? '#C9A66B' : '#2A3136'}`,
              color: activeSector === sec.key ? '#C9A66B' : '#8B9298',
              borderRadius: 4, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
            }}
          >
            {sec.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: 12, color: '#8B9298' }}>Measured against</span>
        {BENCHMARKS.map((b) => (
          <button
            key={b.key}
            onClick={() => setBenchmark(b.key)}
            style={{
              background: benchmark === b.key ? '#1E252A' : '#171D21',
              border: `1px solid ${benchmark === b.key ? '#C9A66B' : '#2A3136'}`,
              color: benchmark === b.key ? '#C9A66B' : '#8B9298',
              borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
            }}
          >
            {b.label}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 12, color: '#6E767B', marginTop: 10 }}>
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
        {tracked.map((sym) => {
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

      <RotationChart tickers={data?.tickers} symbols={tracked} />

      {rrgError ? (
        <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
          <strong>RRG fetch failed:</strong> {rrgError}
          <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
            Most likely cause: COINGECKO_API_KEY isn't set yet in this environment's variables.
          </div>
        </div>
      ) : (
        <>
          <RelativeRotationGraph data={rrgData} symbols={sectorTickers} benchmark={benchmark} />
          {rrgData?.failed?.length > 0 && (
            <p style={{ fontSize: 11, color: '#6E767B', marginTop: 8 }}>
              No live data for: {rrgData.failed.join(', ')} — skipped.
            </p>
          )}
        </>
      )}

      {macroError ? (
        <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
          <strong>Macro fetch failed:</strong> {macroError}
          <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
            Most likely cause: COINGECKO_API_KEY isn't set yet in this environment's variables.
          </div>
        </div>
      ) : (
        <MacroSentiment data={macroData} />
      )}

      {emaError ? (
        <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
          <strong>EMA fetch failed:</strong> {emaError}
          <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
            Most likely cause: COINGECKO_API_KEY isn't set yet in this environment's variables.
          </div>
        </div>
      ) : (
        <EmaLevels data={emaData} symbols={EMA_SYMBOLS} />
      )}

      {cotError ? (
        <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
          <strong>COT fetch failed:</strong> {cotError}
          <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
            The CFTC's public reporting site may be temporarily unavailable — try refreshing.
          </div>
        </div>
      ) : (
        <CotPanel data={cotData} />
      )}

      {fundingError ? (
        <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
          <strong>Funding/OI fetch failed:</strong> {fundingError}
        </div>
      ) : (
        <FundingOI data={fundingData} symbols={tracked} />
      )}

      {timeframesError ? (
        <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
          <strong>Timeframes fetch failed:</strong> {timeframesError}
        </div>
      ) : (
        <TimeframesPanel data={timeframesData} />
      )}

      <CbCalendar />

      <AstroOutlook />

      <p style={{ fontSize: 11, color: '#6E767B', marginTop: 32, lineHeight: 1.6 }}>
        This proves the full pipeline: browser → Next.js API route → CoinMarketCap → back to the
        browser, with the API key never leaving the server. Once this is confirmed working live,
        the plan is to port AI Vibe scoring and the rest of the existing dashboard's panels over
        to read from this same kind of route instead of hardcoded data.
      </p>
    </main>
  );
}
