'use client';

import { useState, useCallback, useEffect } from 'react';

// Levels & Liquidations tab's own data — loads once, the first time that
// tab is opened. EMA and funding are fetched by useHeaderData /
// useRotationData instead, since the always-visible header needs them
// too — this hook only covers what's exclusive to this tab.
export default function useLevelsTabData(isActive) {
  const [loaded, setLoaded] = useState(false);
  const [timeframesData, setTimeframesData] = useState(null);
  const [timeframesError, setTimeframesError] = useState(null);
  const [openInterestData, setOpenInterestData] = useState(null);
  const [openInterestError, setOpenInterestError] = useState(null);
  const [takerFlowData, setTakerFlowData] = useState(null);
  const [takerFlowError, setTakerFlowError] = useState(null);
  const [liquidationsData, setLiquidationsData] = useState(null);
  const [liquidationsError, setLiquidationsError] = useState(null);
  const [liquidationHeatmapData, setLiquidationHeatmapData] = useState(null);
  const [liquidationHeatmapError, setLiquidationHeatmapError] = useState(null);
  const [liquidationHeatmapCoinalyzeData, setLiquidationHeatmapCoinalyzeData] = useState(null);
  const [liquidationHeatmapCoinalyzeError, setLiquidationHeatmapCoinalyzeError] = useState(null);
  const [liquidationHeatmapBcfData, setLiquidationHeatmapBcfData] = useState(null);
  const [liquidationHeatmapBcfError, setLiquidationHeatmapBcfError] = useState(null);
  const [liquidationFeedData, setLiquidationFeedData] = useState(null);
  const [liquidationFeedError, setLiquidationFeedError] = useState(null);
  const [liquidationZonesData, setLiquidationZonesData] = useState(null);
  const [liquidationZonesError, setLiquidationZonesError] = useState(null);
  const [btcPriceData, setBtcPriceData] = useState(null);
  const [btcPriceError, setBtcPriceError] = useState(null);
  const [ethPriceData, setEthPriceData] = useState(null);
  const [ethPriceError, setEthPriceError] = useState(null);

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

  const fetchOpenInterest = useCallback(async () => {
    setOpenInterestError(null);
    try {
      const res = await fetch('/api/openinterest');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setOpenInterestData(json);
    } catch (e) {
      setOpenInterestError(e.message);
    }
  }, []);

  const fetchTakerFlow = useCallback(async () => {
    setTakerFlowError(null);
    try {
      const res = await fetch('/api/takerflow');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setTakerFlowData(json);
    } catch (e) {
      setTakerFlowError(e.message);
    }
  }, []);

  const fetchLiquidations = useCallback(async () => {
    setLiquidationsError(null);
    try {
      const res = await fetch('/api/liquidations');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setLiquidationsData(json);
    } catch (e) {
      setLiquidationsError(e.message);
    }
  }, []);

  const fetchLiquidationHeatmap = useCallback(async () => {
    setLiquidationHeatmapError(null);
    try {
      const res = await fetch('/api/liquidationheatmap');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setLiquidationHeatmapData(json);
    } catch (e) {
      setLiquidationHeatmapError(e.message);
    }
  }, []);

  const fetchLiquidationHeatmapCoinalyze = useCallback(async () => {
    setLiquidationHeatmapCoinalyzeError(null);
    try {
      const res = await fetch('/api/liquidationheatmap-coinalyze');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setLiquidationHeatmapCoinalyzeData(json);
    } catch (e) {
      setLiquidationHeatmapCoinalyzeError(e.message);
    }
  }, []);

  const fetchLiquidationHeatmapBcf = useCallback(async () => {
    setLiquidationHeatmapBcfError(null);
    try {
      const res = await fetch('/api/liquidationheatmap-bcf');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setLiquidationHeatmapBcfData(json);
    } catch (e) {
      setLiquidationHeatmapBcfError(e.message);
    }
  }, []);

  const fetchLiquidationFeed = useCallback(async () => {
    setLiquidationFeedError(null);
    try {
      const res = await fetch('/api/liquidationfeed');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setLiquidationFeedData(json);
    } catch (e) {
      setLiquidationFeedError(e.message);
    }
  }, []);

  const fetchLiquidationZones = useCallback(async () => {
    setLiquidationZonesError(null);
    try {
      const res = await fetch('/api/liquidationzones');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setLiquidationZonesData(json);
    } catch (e) {
      setLiquidationZonesError(e.message);
    }
  }, []);

  const fetchBtcPrice = useCallback(async () => {
    setBtcPriceError(null);
    try {
      const res = await fetch('/api/btcprice');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setBtcPriceData(json);
    } catch (e) {
      setBtcPriceError(e.message);
    }
  }, []);

  const fetchEthPrice = useCallback(async () => {
    setEthPriceError(null);
    try {
      const res = await fetch('/api/ethprice');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setEthPriceData(json);
    } catch (e) {
      setEthPriceError(e.message);
    }
  }, []);

  // BitcoinCounterFlow's liquidation heatmap is disabled too —
  // BITCOINCOUNTERFLOW_API_KEY isn't set in Vercel, so it failed on every
  // load. fetchLiquidationHeatmapBcf is untouched; re-enable by adding it
  // back below and removing `disabled` from its entry in
  // LiquidationHeatmap.js's SOURCES.
  //
  // Taker buy/sell volume (Coinglass) and Liquidation Zones (CoinLobster)
  // are disabled here for now — both fail every call in production
  // (Coinglass: key/plan doesn't cover this endpoint; CoinLobster: the
  // unresolved REST 401 auth issue from earlier this session). Not
  // removed, just not called: fetchTakerFlow and fetchLiquidationZones
  // above are untouched and still returned below — re-enable by adding
  // both calls back into refetch() and its dependency array.
  const refetch = useCallback(() => {
    fetchTimeframes();
    fetchOpenInterest();
    fetchLiquidations();
    fetchLiquidationHeatmap();
    fetchLiquidationHeatmapCoinalyze();
    fetchLiquidationFeed();
    fetchBtcPrice();
    fetchEthPrice();
  }, [fetchTimeframes, fetchOpenInterest, fetchLiquidations, fetchLiquidationHeatmap, fetchLiquidationHeatmapCoinalyze, fetchLiquidationFeed, fetchBtcPrice, fetchEthPrice]);

  useEffect(() => {
    if (isActive && !loaded) {
      setLoaded(true);
      refetch();
    }
  }, [isActive, loaded, refetch]);

  return {
    timeframesData, timeframesError,
    openInterestData, openInterestError,
    takerFlowData, takerFlowError,
    liquidationsData, liquidationsError,
    liquidationHeatmapData, liquidationHeatmapError,
    liquidationHeatmapCoinalyzeData, liquidationHeatmapCoinalyzeError,
    liquidationHeatmapBcfData, liquidationHeatmapBcfError,
    liquidationFeedData, liquidationFeedError,
    liquidationZonesData, liquidationZonesError,
    btcPriceData, btcPriceError,
    ethPriceData, ethPriceError,
    refetch,
  };
}
