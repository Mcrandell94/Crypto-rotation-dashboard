'use client';

import { useState, useEffect, useCallback } from 'react';

// Data for MarketRead — the header shown above the tab bar regardless of
// which tab is active — so it fetches eagerly on mount, unlike every
// tab-scoped hook in this directory. refetch() is what "Refresh now"
// calls unconditionally, alongside whichever tab is currently open.
export default function useHeaderData() {
  const [emaData, setEmaData] = useState(null);
  const [emaError, setEmaError] = useState(null);
  const [cotData, setCotData] = useState(null);
  const [cotError, setCotError] = useState(null);
  const [etfFlowsData, setEtfFlowsData] = useState(null);
  const [etfFlowsError, setEtfFlowsError] = useState(null);
  const [optionsData, setOptionsData] = useState(null);
  const [optionsError, setOptionsError] = useState(null);
  const [seasonalityData, setSeasonalityData] = useState(null);
  const [seasonalityError, setSeasonalityError] = useState(null);

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

  const fetchEtfFlows = useCallback(async () => {
    setEtfFlowsError(null);
    try {
      const res = await fetch('/api/etfflows');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setEtfFlowsData(json);
    } catch (e) {
      setEtfFlowsError(e.message);
    }
  }, []);

  const fetchOptions = useCallback(async () => {
    setOptionsError(null);
    try {
      const res = await fetch('/api/options');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setOptionsData(json);
    } catch (e) {
      setOptionsError(e.message);
    }
  }, []);

  const fetchSeasonality = useCallback(async () => {
    setSeasonalityError(null);
    try {
      const res = await fetch('/api/seasonality');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setSeasonalityData(json);
    } catch (e) {
      setSeasonalityError(e.message);
    }
  }, []);

  const refetch = useCallback(() => {
    fetchEma();
    fetchCot();
    fetchEtfFlows();
    fetchOptions();
    fetchSeasonality();
  }, [fetchEma, fetchCot, fetchEtfFlows, fetchOptions, fetchSeasonality]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    emaData, emaError,
    cotData, cotError,
    etfFlowsData, etfFlowsError,
    optionsData, optionsError,
    seasonalityData, seasonalityError,
    refetch,
  };
}
