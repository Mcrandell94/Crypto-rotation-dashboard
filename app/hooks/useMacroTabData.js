'use client';

import { useState, useCallback, useEffect } from 'react';

// Macro & Seasonality tab's own data — loads once, the first time that
// tab is opened (isActive flips true), not on page mount. cot/etfFlows/
// options/seasonality/macro are fetched eagerly by useHeaderData /
// useRotationData instead, since the always-visible header needs them
// too — this hook only covers what's exclusive to this tab.
export default function useMacroTabData(isActive) {
  const [loaded, setLoaded] = useState(false);
  const [polymarketData, setPolymarketData] = useState(null);
  const [polymarketError, setPolymarketError] = useState(null);
  const [altseasonData, setAltseasonData] = useState(null);
  const [altseasonError, setAltseasonError] = useState(null);
  const [cpiData, setCpiData] = useState(null);
  const [cpiError, setCpiError] = useState(null);
  const [newsData, setNewsData] = useState(null);
  const [newsError, setNewsError] = useState(null);
  const [ethEtfFlowsData, setEthEtfFlowsData] = useState(null);
  const [ethEtfFlowsError, setEthEtfFlowsError] = useState(null);

  const fetchPolymarket = useCallback(async () => {
    setPolymarketError(null);
    try {
      const res = await fetch('/api/polymarket');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setPolymarketData(json);
    } catch (e) {
      setPolymarketError(e.message);
    }
  }, []);

  const fetchAltseason = useCallback(async () => {
    setAltseasonError(null);
    try {
      const res = await fetch('/api/altseason');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setAltseasonData(json);
    } catch (e) {
      setAltseasonError(e.message);
    }
  }, []);

  const fetchCpi = useCallback(async () => {
    setCpiError(null);
    try {
      const res = await fetch('/api/cpi');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setCpiData(json);
    } catch (e) {
      setCpiError(e.message);
    }
  }, []);

  const fetchNews = useCallback(async () => {
    setNewsError(null);
    try {
      const res = await fetch('/api/news');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setNewsData(json);
    } catch (e) {
      setNewsError(e.message);
    }
  }, []);

  const fetchEthEtfFlows = useCallback(async () => {
    setEthEtfFlowsError(null);
    try {
      const res = await fetch('/api/etfflows-eth');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setEthEtfFlowsData(json);
    } catch (e) {
      setEthEtfFlowsError(e.message);
    }
  }, []);

  const refetch = useCallback(() => {
    fetchPolymarket();
    fetchAltseason();
    fetchCpi();
    fetchNews();
    fetchEthEtfFlows();
  }, [fetchPolymarket, fetchAltseason, fetchCpi, fetchNews, fetchEthEtfFlows]);

  useEffect(() => {
    if (isActive && !loaded) {
      setLoaded(true);
      refetch();
    }
  }, [isActive, loaded, refetch]);

  return {
    polymarketData, polymarketError,
    altseasonData, altseasonError,
    cpiData, cpiError,
    newsData, newsError,
    ethEtfFlowsData, ethEtfFlowsError,
    refetch,
  };
}
