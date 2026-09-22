'use client';

import { useState, useCallback, useEffect } from 'react';

// Whale Movement tab's data (CoinLobster, credit-metered) — loads once,
// the first time that tab is opened, not on page mount or the global
// refresh button. This is the pattern every other *TabData hook in this
// directory copies, since it was proven here first.
export default function useWhaleTabData(isActive) {
  const [loaded, setLoaded] = useState(false);
  const [whaleTradesData, setWhaleTradesData] = useState(null);
  const [whaleTradesError, setWhaleTradesError] = useState(null);
  const [whaleRadarData, setWhaleRadarData] = useState(null);
  const [whaleRadarError, setWhaleRadarError] = useState(null);
  const [whaleFlowData, setWhaleFlowData] = useState(null);
  const [whaleFlowError, setWhaleFlowError] = useState(null);
  const [hyperliquidWhalesData, setHyperliquidWhalesData] = useState(null);
  const [hyperliquidWhalesError, setHyperliquidWhalesError] = useState(null);
  const [onchainWhalesData, setOnchainWhalesData] = useState(null);
  const [onchainWhalesError, setOnchainWhalesError] = useState(null);

  const fetchWhaleTrades = useCallback(async () => {
    setWhaleTradesError(null);
    try {
      const res = await fetch('/api/whaletrades');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setWhaleTradesData(json);
    } catch (e) {
      setWhaleTradesError(e.message);
    }
  }, []);

  const fetchWhaleRadar = useCallback(async () => {
    setWhaleRadarError(null);
    try {
      const res = await fetch('/api/whaleradar');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setWhaleRadarData(json);
    } catch (e) {
      setWhaleRadarError(e.message);
    }
  }, []);

  const fetchWhaleFlow = useCallback(async () => {
    setWhaleFlowError(null);
    try {
      const res = await fetch('/api/whaleflow');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setWhaleFlowData(json);
    } catch (e) {
      setWhaleFlowError(e.message);
    }
  }, []);

  const fetchHyperliquidWhales = useCallback(async () => {
    setHyperliquidWhalesError(null);
    try {
      const res = await fetch('/api/hyperliquidwhales');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setHyperliquidWhalesData(json);
    } catch (e) {
      setHyperliquidWhalesError(e.message);
    }
  }, []);

  const fetchOnchainWhales = useCallback(async () => {
    setOnchainWhalesError(null);
    try {
      const res = await fetch('/api/onchainwhales');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setOnchainWhalesData(json);
    } catch (e) {
      setOnchainWhalesError(e.message);
    }
  }, []);

  const refetch = useCallback(() => {
    fetchWhaleTrades();
    fetchWhaleRadar();
    fetchWhaleFlow();
    fetchHyperliquidWhales();
    fetchOnchainWhales();
  }, [fetchWhaleTrades, fetchWhaleRadar, fetchWhaleFlow, fetchHyperliquidWhales, fetchOnchainWhales]);

  useEffect(() => {
    if (isActive && !loaded) {
      setLoaded(true);
      refetch();
    }
  }, [isActive, loaded, refetch]);

  return {
    loaded,
    whaleTradesData, whaleTradesError,
    whaleRadarData, whaleRadarError,
    whaleFlowData, whaleFlowError,
    hyperliquidWhalesData, hyperliquidWhalesError,
    onchainWhalesData, onchainWhalesError,
    refetch,
  };
}
