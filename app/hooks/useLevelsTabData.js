'use client';

import { useState, useCallback, useEffect } from 'react';

// Levels & Liquidations tab's own data — loads once, the first time that
// tab is opened. EMA, open interest, liquidations and funding are fetched
// by useHeaderData / useRotationData instead, since the always-visible header needs them
// too — this hook only covers what's exclusive to this tab.
export default function useLevelsTabData(isActive) {
  const [loaded, setLoaded] = useState(false);
  const [timeframesData, setTimeframesData] = useState(null);
  const [timeframesError, setTimeframesError] = useState(null);
  const [takerFlowData, setTakerFlowData] = useState(null);
  const [takerFlowError, setTakerFlowError] = useState(null);
  const [liquidationHeatmapData, setLiquidationHeatmapData] = useState(null);
  const [liquidationHeatmapError, setLiquidationHeatmapError] = useState(null);
  const [liquidationHeatmapCoinalyzeData, setLiquidationHeatmapCoinalyzeData] = useState(null);
  const [liquidationHeatmapCoinalyzeError, setLiquidationHeatmapCoinalyzeError] = useState(null);
  const [liquidationHeatmapBcfData, setLiquidationHeatmapBcfData] = useState(null);
  const [liquidationHeatmapBcfError, setLiquidationHeatmapBcfError] = useState(null);
  const [liquidationFeedData, setLiquidationFeedData] = useState(null);
  const [liquidationFeedError, setLiquidationFeedError] = useState(null);
  const [levelHitsData, setLevelHitsData] = useState(null);
  const [liquidationMapData, setLiquidationMapData] = useState(null);
  const [liquidationMapError, setLiquidationMapError] = useState(null);
  const [liquidationZonesData, setLiquidationZonesData] = useState(null);
  const [liquidationZonesError, setLiquidationZonesError] = useState(null);
  const [btcPriceData, setBtcPriceData] = useState(null);
  const [btcPriceError, setBtcPriceError] = useState(null);
  const [ethPriceData, setEthPriceData] = useState(null);
  const [ethPriceError, setEthPriceError] = useState(null);
  const [derivativesFlowData, setDerivativesFlowData] = useState(null);
  const [derivativesFlowError, setDerivativesFlowError] = useState(null);
  const [positioningData, setPositioningData] = useState(null);
  const [positioningError, setPositioningError] = useState(null);

  const fetchDerivativesFlow = useCallback(async () => {
    setDerivativesFlowError(null);
    try {
      const res = await fetch('/api/derivativesflow');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setDerivativesFlowData(json);
    } catch (e) {
      setDerivativesFlowError(e.message);
    }
  }, []);

  const fetchPositioning = useCallback(async () => {
    setPositioningError(null);
    try {
      const res = await fetch('/api/positioning');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setPositioningData(json);
    } catch (e) {
      setPositioningError(e.message);
    }
  }, []);

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

  // When price first touched each hand-entered tracker level since its
  // capture. A failure here just leaves hits to the live-price check.
  const fetchLevelHits = useCallback(async () => {
    try {
      const res = await fetch('/api/levelhits');
      if (res.ok) setLevelHitsData(await res.json());
    } catch {}
  }, []);

  const fetchLiquidationMap = useCallback(async () => {
    setLiquidationMapError(null);
    try {
      const res = await fetch('/api/liquidationmap');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setLiquidationMapData(json);
    } catch (e) {
      setLiquidationMapError(e.message);
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
  // Taker buy/sell volume (Coinglass) is disabled here for now — the
  // Coinglass key/plan doesn't cover that endpoint. Not removed, just not
  // called: fetchTakerFlow above is untouched and still returned below —
  // re-enable by adding it back into refetch() and its dependency array.
  const refetch = useCallback(() => {
    fetchTimeframes();
    fetchLiquidationHeatmap();
    fetchLiquidationHeatmapCoinalyze();
    fetchLiquidationFeed();
    fetchBtcPrice();
    fetchEthPrice();
    fetchDerivativesFlow();
    fetchPositioning();
    fetchLiquidationZones();
    fetchLiquidationMap();
    fetchLevelHits();
  }, [fetchTimeframes, fetchLiquidationHeatmap, fetchLiquidationHeatmapCoinalyze, fetchLiquidationFeed, fetchBtcPrice, fetchEthPrice, fetchDerivativesFlow, fetchPositioning, fetchLiquidationZones, fetchLiquidationMap, fetchLevelHits]);

  useEffect(() => {
    if (isActive && !loaded) {
      setLoaded(true);
      refetch();
    }
  }, [isActive, loaded, refetch]);

  return {
    timeframesData, timeframesError,
    takerFlowData, takerFlowError,
    liquidationHeatmapData, liquidationHeatmapError,
    liquidationHeatmapCoinalyzeData, liquidationHeatmapCoinalyzeError,
    liquidationHeatmapBcfData, liquidationHeatmapBcfError,
    liquidationFeedData, liquidationFeedError,
    liquidationZonesData, liquidationZonesError,
    liquidationMapData, liquidationMapError,
    levelHitsData,
    derivativesFlowData, derivativesFlowError,
    positioningData, positioningError,
    btcPriceData, btcPriceError,
    ethPriceData, ethPriceError,
    refetch,
  };
}
