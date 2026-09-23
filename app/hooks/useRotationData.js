'use client';

import { useState, useCallback, useEffect } from 'react';

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
export default function useRotationData(sectorTickers, benchmark, activeSector, rrgMode) {
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

    try {
      const rrgRes = await fetch(`/api/rrg?benchmark=${bench}&symbols=${symbols.join(',')}`);
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
      const fundingRes = await fetch(`/api/funding?symbols=${[bench, ...symbols].join(',')}`);
      const fundingJson = await fundingRes.json();
      if (!fundingRes.ok) throw new Error(fundingJson.error || 'Unknown error');
      setFundingData(fundingJson);
    } catch (e) {
      setFundingError(e.message);
    }
  }, []);

  const fetchRrgSectors = useCallback(async (bench) => {
    setRrgSectorsError(null);
    try {
      const res = await fetch(`/api/rrg-sectors?benchmark=${bench}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setRrgSectorsData(json);
    } catch (e) {
      setRrgSectorsError(e.message);
    }
  }, []);

  useEffect(() => {
    fetchData(sectorTickers, benchmark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSector, benchmark]);

  // Sector-composite RRG data is heavier to fetch (representative tickers
  // across every sector at once) — only fetch it when that view is
  // actually in use, not alongside the per-sector ticker view.
  useEffect(() => {
    if (rrgMode === 'sectors') fetchRrgSectors(benchmark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rrgMode, benchmark]);

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
