'use client';

import { useState, useCallback, useEffect } from 'react';

// CB Calendar tab's own data — loads once, the first time that tab is
// opened. Options data is fetched by useHeaderData instead, since the
// always-visible header needs it too — this hook only covers what's
// exclusive to this tab.
export default function useCalendarTabData(isActive) {
  const [loaded, setLoaded] = useState(false);
  const [fedOddsData, setFedOddsData] = useState(null);
  const [fedOddsError, setFedOddsError] = useState(null);
  const [congressData, setCongressData] = useState(null);
  const [congressError, setCongressError] = useState(null);
  const [inflationOddsData, setInflationOddsData] = useState(null);
  const [inflationOddsError, setInflationOddsError] = useState(null);
  const [fedPurchasesData, setFedPurchasesData] = useState(null);
  const [fedPurchasesError, setFedPurchasesError] = useState(null);

  const fetchFedOdds = useCallback(async () => {
    setFedOddsError(null);
    try {
      const res = await fetch('/api/fedodds');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setFedOddsData(json);
    } catch (e) {
      setFedOddsError(e.message);
    }
  }, []);

  const fetchCongressBills = useCallback(async () => {
    setCongressError(null);
    try {
      const res = await fetch('/api/congressbills');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setCongressData(json);
    } catch (e) {
      setCongressError(e.message);
    }
  }, []);

  const fetchInflationOdds = useCallback(async () => {
    setInflationOddsError(null);
    try {
      const res = await fetch('/api/inflationodds');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setInflationOddsData(json);
    } catch (e) {
      setInflationOddsError(e.message);
    }
  }, []);

  const fetchFedPurchases = useCallback(async () => {
    setFedPurchasesError(null);
    try {
      const res = await fetch('/api/fedpurchases');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setFedPurchasesData(json);
    } catch (e) {
      setFedPurchasesError(e.message);
    }
  }, []);

  const refetch = useCallback(() => {
    fetchFedOdds();
    fetchCongressBills();
    fetchInflationOdds();
    fetchFedPurchases();
  }, [fetchFedOdds, fetchCongressBills, fetchInflationOdds, fetchFedPurchases]);

  useEffect(() => {
    if (isActive && !loaded) {
      setLoaded(true);
      refetch();
    }
  }, [isActive, loaded, refetch]);

  return {
    fedOddsData, fedOddsError,
    congressData, congressError,
    inflationOddsData, inflationOddsError,
    fedPurchasesData, fedPurchasesError,
    refetch,
  };
}
