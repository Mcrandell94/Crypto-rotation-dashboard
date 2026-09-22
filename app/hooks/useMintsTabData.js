'use client';

import { useState, useCallback, useEffect } from 'react';

// Printer Watch tab's data — loads once, the first time that tab is
// opened.
export default function useMintsTabData(isActive) {
  const [loaded, setLoaded] = useState(false);
  const [stablecoinMintsData, setStablecoinMintsData] = useState(null);
  const [stablecoinMintsError, setStablecoinMintsError] = useState(null);
  const [notableWalletActivityData, setNotableWalletActivityData] = useState(null);
  const [notableWalletActivityError, setNotableWalletActivityError] = useState(null);

  const fetchStablecoinMints = useCallback(async () => {
    setStablecoinMintsError(null);
    try {
      const res = await fetch('/api/stablecoinmints');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setStablecoinMintsData(json);
    } catch (e) {
      setStablecoinMintsError(e.message);
    }
  }, []);

  const fetchNotableWalletActivity = useCallback(async () => {
    setNotableWalletActivityError(null);
    try {
      const res = await fetch('/api/notablewallets');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setNotableWalletActivityData(json);
    } catch (e) {
      setNotableWalletActivityError(e.message);
    }
  }, []);

  const refetch = useCallback(() => {
    fetchStablecoinMints();
    // Staggered behind the mint feed — both hit Etherscan with the same
    // key, and starting at the same instant is what triggered its "3
    // calls/sec" rate limit in production.
    setTimeout(fetchNotableWalletActivity, 1500);
  }, [fetchStablecoinMints, fetchNotableWalletActivity]);

  useEffect(() => {
    if (isActive && !loaded) {
      setLoaded(true);
      refetch();
    }
  }, [isActive, loaded, refetch]);

  return {
    stablecoinMintsData, stablecoinMintsError,
    notableWalletActivityData, notableWalletActivityError,
    refetch,
  };
}
