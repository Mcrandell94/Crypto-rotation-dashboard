'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// Crypto price/rotation data (Rotation tab) plus macro & funding data —
// the latter two also consumed by the always-visible MarketRead header.
// All four come from one combined fetch (fetchData), so they stay
// bundled in one hook rather than split across a rotation hook and a
// header hook.
//
// activeSector is taken as its own param (not derived from sectorTickers)
// because sectorTickers is a new array reference every render — depending
// on it directly in the mount/refetch effect would refetch on every
// render, not just when the sector or benchmark actually changes.
//
// rrgInterval ('4h' | '1d' | '1w') only affects the two RRG fetches, so
// changing it refetches just those, not prices/macro/funding. It's null
// until the page has read the saved choice; nothing is fetched until then.
export default function useRotationData(sectorTickers, benchmark, activeSector, rrgMode, rrgInterval) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [rrgData, setRrgData] = useState(null);
  const [rrgError, setRrgError] = useState(null);
  const [macroData, setMacroData] = useState(null);
  const [macroError, setMacroError] = useState(null);
  const [fundingData, setFundingData] = useState(null);
  const [fundingError, setFundingError] = useState(null);
  const [rrgSectorsData, setRrgSectorsData] = useState(null);
  const [rrgSectorsError, setRrgSectorsError] = useState(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(rrgInterval);
  intervalRef.current = rrgInterval;
  // Each RRG fetch gets a sequence number so a slow, older response (e.g.
  // after a quick 4H -> 1W switch) can't overwrite a newer one.
  const rrgSeq = useRef(0);
  const sectorsSeq = useRef(0);

  const fetchRrg = useCallback(async (symbols, bench, interval) => {
    const seq = ++rrgSeq.current;
    setRrgError(null);
    try {
      const rrgRes = await fetch(`/api/rrg?benchmark=${bench}&symbols=${symbols.join(',')}&interval=${interval}`);
      const rrgJson = await rrgRes.json();
      if (!rrgRes.ok) throw new Error(rrgJson.error || 'Unknown error');
      if (seq === rrgSeq.current) setRrgData(rrgJson);
    } catch (e) {
      if (seq === rrgSeq.current) setRrgError(e.message);
    }
  }, []);

  const fetchData = useCallback(async (symbols, bench) => {
    setLoading(true);
    setError(null);
    setRrgError(null);
    setMacroError(null);
    setFundingError(null);
    try {
      const res = await fetch(`/api/crypto?symbols=${[bench, ...symbols].join(',')}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }

    await fetchRrg(symbols, bench, intervalRef.current);

    try {
      const macroRes = await fetch('/api/macro');
      const macroJson = await macroRes.json();
      if (!macroRes.ok) throw new Error(macroJson.error || 'Unknown error');
      setMacroData(macroJson);
    } catch (e) {
      setMacroError(e.message);
    }

    try {
      const fundingRes = await fetch(`/api/funding?symbols=${[bench, ...symbols].join(',')}`);
      const fundingJson = await fundingRes.json();
      if (!fundingRes.ok) throw new Error(fundingJson.error || 'Unknown error');
      setFundingData(fundingJson);
    } catch (e) {
      setFundingError(e.message);
    }
  }, [fetchRrg]);

  const fetchRrgSectors = useCallback(async (bench, interval = intervalRef.current) => {
    const seq = ++sectorsSeq.current;
    setRrgSectorsError(null);
    try {
      const res = await fetch(`/api/rrg-sectors?benchmark=${bench}&interval=${interval}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      if (seq === sectorsSeq.current) setRrgSectorsData(json);
    } catch (e) {
      if (seq === sectorsSeq.current) setRrgSectorsError(e.message);
    }
  }, []);

  const ready = rrgInterval != null;
  useEffect(() => {
    if (ready) fetchData(sectorTickers, benchmark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSector, benchmark, ready]);

  // Sector-composite RRG data is heavier to fetch (representative tickers
  // across every sector at once) — only fetch it when that view is
  // actually in use, not alongside the per-sector ticker view.
  useEffect(() => {
    if (ready && rrgMode === 'sectors') fetchRrgSectors(benchmark, rrgInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rrgMode, benchmark, rrgInterval]);

  // Timeframe switch: clear the old bars (their labels and count no longer
  // apply) and refetch only the ticker RRG. Skipped for the first known
  // interval, which fetchData above already fetches.
  const firstInterval = useRef(null);
  useEffect(() => {
    if (!ready) return;
    if (firstInterval.current == null) {
      firstInterval.current = rrgInterval;
      return;
    }
    setRrgData(null);
    setRrgSectorsData(null);
    fetchRrg(sectorTickers, benchmark, rrgInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rrgInterval]);

  return {
    data, error,
    rrgData, rrgError,
    macroData, macroError,
    fundingData, fundingError,
    rrgSectorsData, rrgSectorsError,
    loading,
    fetchData,
    fetchRrgSectors,
  };
}
