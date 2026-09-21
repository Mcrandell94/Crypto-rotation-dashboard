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
import PolymarketPredictions from './components/PolymarketPredictions';
import SeasonalityTable from './components/SeasonalityTable';
import AltseasonIndex from './components/AltseasonIndex';
import EtfFlows from './components/EtfFlows';
import OptionsPositioning from './components/OptionsPositioning';
import MarketNews from './components/MarketNews';
import OpenInterestPanel from './components/OpenInterestPanel';
import TakerFlow from './components/TakerFlow';
import LiquidationsPanel from './components/LiquidationsPanel';
import LiquidationHeatmap from './components/LiquidationHeatmap';
import LiveLiquidationFeed from './components/LiveLiquidationFeed';
import StablecoinMintFeed from './components/StablecoinMintFeed';
import LiquidationLevelsTracker from './components/LiquidationLevelsTracker';
import LiquidationZones from './components/LiquidationZones';
import WhaleTradeFeed from './components/WhaleTradeFeed';
import WhaleRadar from './components/WhaleRadar';
import WhaleFlow from './components/WhaleFlow';
import HyperliquidWhaleBoard from './components/HyperliquidWhaleBoard';
import OnchainWhaleSwaps from './components/OnchainWhaleSwaps';
import MarketRead from './components/MarketRead';
import TabErrorBoundary from './components/TabErrorBoundary';
import { SECTORS, BENCHMARKS } from './lib/sectors';

const EMA_SYMBOLS = ['BTC', 'ETH'];

const TABS = [
  { key: 'rotation', label: 'Rotation' },
  { key: 'macro', label: 'Macro & Seasonality' },
  { key: 'levels', label: 'Levels & Liquidations' },
  { key: 'whale', label: 'Whale Movement' },
  { key: 'calendar', label: 'CB Calendar' },
  { key: 'astro', label: 'Astro Outlook' },
];

export default function DashboardHome() {
  const [activeTab, setActiveTab] = useState('rotation');
  const [activeSector, setActiveSector] = useState(SECTORS[0].key);
  const [benchmark, setBenchmark] = useState(BENCHMARKS[0].key);
  const [rrgMode, setRrgMode] = useState('tickers'); // 'tickers' | 'sectors'

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
  const [polymarketData, setPolymarketData] = useState(null);
  const [polymarketError, setPolymarketError] = useState(null);
  const [seasonalityData, setSeasonalityData] = useState(null);
  const [seasonalityError, setSeasonalityError] = useState(null);
  const [altseasonData, setAltseasonData] = useState(null);
  const [altseasonError, setAltseasonError] = useState(null);
  const [etfFlowsData, setEtfFlowsData] = useState(null);
  const [etfFlowsError, setEtfFlowsError] = useState(null);
  const [rrgSectorsData, setRrgSectorsData] = useState(null);
  const [rrgSectorsError, setRrgSectorsError] = useState(null);
  const [optionsData, setOptionsData] = useState(null);
  const [optionsError, setOptionsError] = useState(null);
  const [fedOddsData, setFedOddsData] = useState(null);
  const [fedOddsError, setFedOddsError] = useState(null);
  const [congressData, setCongressData] = useState(null);
  const [congressError, setCongressError] = useState(null);
  const [cpiData, setCpiData] = useState(null);
  const [cpiError, setCpiError] = useState(null);
  const [newsData, setNewsData] = useState(null);
  const [newsError, setNewsError] = useState(null);
  const [openInterestData, setOpenInterestData] = useState(null);
  const [openInterestError, setOpenInterestError] = useState(null);
  const [takerFlowData, setTakerFlowData] = useState(null);
  const [takerFlowError, setTakerFlowError] = useState(null);
  const [liquidationsData, setLiquidationsData] = useState(null);
  const [liquidationsError, setLiquidationsError] = useState(null);
  const [ethEtfFlowsData, setEthEtfFlowsData] = useState(null);
  const [ethEtfFlowsError, setEthEtfFlowsError] = useState(null);
  const [liquidationHeatmapData, setLiquidationHeatmapData] = useState(null);
  const [liquidationHeatmapError, setLiquidationHeatmapError] = useState(null);
  const [liquidationHeatmapCoinalyzeData, setLiquidationHeatmapCoinalyzeData] = useState(null);
  const [liquidationHeatmapCoinalyzeError, setLiquidationHeatmapCoinalyzeError] = useState(null);
  const [liquidationHeatmapBcfData, setLiquidationHeatmapBcfData] = useState(null);
  const [liquidationHeatmapBcfError, setLiquidationHeatmapBcfError] = useState(null);
  const [liquidationFeedData, setLiquidationFeedData] = useState(null);
  const [liquidationFeedError, setLiquidationFeedError] = useState(null);
  const [stablecoinMintsData, setStablecoinMintsData] = useState(null);
  const [stablecoinMintsError, setStablecoinMintsError] = useState(null);
  const [liquidationZonesData, setLiquidationZonesData] = useState(null);
  const [liquidationZonesError, setLiquidationZonesError] = useState(null);
  // CoinLobster (whale data) is credit-metered, unlike every other source
  // this dashboard uses — see app/lib/coinlobster.js. These deliberately do
  // NOT fetch on page mount or on the global "Refresh now" button; they
  // only load once the Whale Movement tab is actually opened (see the
  // whaleTabLoaded effect below), plus their own tab-scoped refresh button.
  const [whaleTabLoaded, setWhaleTabLoaded] = useState(false);
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
  const [btcPriceData, setBtcPriceData] = useState(null);
  const [btcPriceError, setBtcPriceError] = useState(null);
  const [ethPriceData, setEthPriceData] = useState(null);
  const [ethPriceError, setEthPriceError] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const fetchAllWhaleData = useCallback(() => {
    fetchWhaleTrades();
    fetchWhaleRadar();
    fetchWhaleFlow();
    fetchHyperliquidWhales();
    fetchOnchainWhales();
  }, [fetchWhaleTrades, fetchWhaleRadar, fetchWhaleFlow, fetchHyperliquidWhales, fetchOnchainWhales]);

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

  // Sector-composite RRG data is heavier to fetch (representative tickers
  // across every sector at once) — only fetch it when that view is actually
  // in use, not alongside the per-sector ticker view.
  useEffect(() => {
    if (rrgMode === 'sectors') fetchRrgSectors(benchmark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rrgMode, benchmark]);

  // EMA, COT, Timeframes, and Polymarket all track fixed BTC data, not the
  // active sector — fetch once on mount, then refresh alongside everything
  // else on manual refresh.
  useEffect(() => {
    fetchEma();
    fetchCot();
    fetchTimeframes();
    fetchPolymarket();
    fetchSeasonality();
    fetchAltseason();
    fetchEtfFlows();
    fetchOptions();
    fetchFedOdds();
    fetchCongressBills();
    fetchCpi();
    fetchNews();
    fetchOpenInterest();
    fetchTakerFlow();
    fetchLiquidations();
    fetchEthEtfFlows();
    fetchLiquidationHeatmap();
    fetchLiquidationHeatmapCoinalyze();
    fetchLiquidationHeatmapBcf();
    fetchLiquidationFeed();
    fetchStablecoinMints();
    fetchLiquidationZones();
    fetchBtcPrice();
    fetchEthPrice();
  }, [fetchEma, fetchCot, fetchTimeframes, fetchPolymarket, fetchSeasonality, fetchAltseason, fetchEtfFlows, fetchOptions, fetchFedOdds, fetchCongressBills, fetchCpi, fetchNews, fetchOpenInterest, fetchTakerFlow, fetchLiquidations, fetchEthEtfFlows, fetchLiquidationHeatmap, fetchLiquidationHeatmapCoinalyze, fetchLiquidationHeatmapBcf, fetchLiquidationFeed, fetchStablecoinMints, fetchLiquidationZones, fetchBtcPrice, fetchEthPrice]);

  // CoinLobster (whale data) is credit-metered — fetch it only the first
  // time the viewer actually opens the Whale Movement tab, not on page
  // mount like everything else above.
  useEffect(() => {
    if (activeTab === 'whale' && !whaleTabLoaded) {
      setWhaleTabLoaded(true);
      fetchAllWhaleData();
    }
  }, [activeTab, whaleTabLoaded, fetchAllWhaleData]);

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
            fetchPolymarket();
            fetchSeasonality();
            fetchAltseason();
            fetchEtfFlows();
            fetchOptions();
            fetchFedOdds();
            fetchCongressBills();
            fetchCpi();
            fetchNews();
            fetchOpenInterest();
            fetchTakerFlow();
            fetchLiquidations();
            fetchEthEtfFlows();
            fetchLiquidationHeatmap();
            fetchLiquidationHeatmapCoinalyze();
            fetchLiquidationHeatmapBcf();
            fetchLiquidationFeed();
            fetchStablecoinMints();
            fetchLiquidationZones();
            fetchBtcPrice();
            fetchEthPrice();
            if (rrgMode === 'sectors') fetchRrgSectors(benchmark);
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

      <MarketRead
        btcTicker={data?.tickers?.BTC}
        macroData={macroData}
        emaData={emaData}
        cotData={cotData}
        optionsData={optionsData}
        etfFlowsData={etfFlowsData}
        fundingData={fundingData}
        seasonalityData={seasonalityData}
      />

      <div style={{
        display: 'flex', gap: 4, marginTop: 20, borderBottom: '1px solid #2A3136',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              background: 'none', border: 'none',
              borderBottom: activeTab === t.key ? '2px solid #4C7EB8' : '2px solid transparent',
              color: activeTab === t.key ? '#E7E4DD' : '#8B9298', fontSize: 13, padding: '9px 14px',
              cursor: 'pointer', marginBottom: -1, fontWeight: activeTab === t.key ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'rotation' && (
        <TabErrorBoundary tabName="Rotation">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20 }}>
            <span style={{ fontSize: 12, color: '#8B9298' }}>RRG shows</span>
            {[
              { key: 'tickers', label: 'Sector tickers' },
              { key: 'sectors', label: 'Sectors vs each other' },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => setRrgMode(m.key)}
                style={{
                  background: rrgMode === m.key ? '#1E252A' : '#171D21',
                  border: `1px solid ${rrgMode === m.key ? '#C9A66B' : '#2A3136'}`,
                  color: rrgMode === m.key ? '#C9A66B' : '#8B9298',
                  borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {rrgMode === 'tickers' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
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
          )}

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

          {rrgMode === 'tickers' ? (
            rrgError ? (
              <div style={{ marginTop: 24, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
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
            )
          ) : rrgSectorsError ? (
            <div style={{ marginTop: 24, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Sector RRG fetch failed:</strong> {rrgSectorsError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: COINGECKO_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, color: '#6E767B', marginTop: 8, maxWidth: 620 }}>
                Each sector is an equal-weighted composite of its {' '}
                {rrgSectorsData?.sectorMembers ? Object.values(rrgSectorsData.sectorMembers)[0]?.length : 4}{' '}
                most prominent tickers, normalized to a common starting index rather than raw price — so a
                sector&apos;s RS-Ratio/Momentum reflects its overall trend, not any single token&apos;s price level.
              </p>
              <RelativeRotationGraph
                data={rrgSectorsData}
                symbols={SECTORS.map((s) => s.label)}
                benchmark={benchmark}
                assetLabel="index"
                assetFormat={(v) => v?.toFixed(3)}
              />
              {rrgSectorsData?.failed?.length > 0 && (
                <p style={{ fontSize: 11, color: '#6E767B', marginTop: 8 }}>
                  No live data for: {rrgSectorsData.failed.join(', ')} — skipped.
                </p>
              )}
            </>
          )}

          <RotationChart tickers={data?.tickers} symbols={tracked} />
        </TabErrorBoundary>
      )}

      {activeTab === 'calendar' && (
        <TabErrorBoundary tabName="CB Calendar">
          <CbCalendar
            optionsData={optionsData}
            fedOddsData={fedOddsData}
            fedOddsError={fedOddsError}
            congressData={congressData}
            congressError={congressError}
          />
        </TabErrorBoundary>
      )}

      {activeTab === 'astro' && (
        <TabErrorBoundary tabName="Astro Outlook">
          <AstroOutlook />
        </TabErrorBoundary>
      )}

      {activeTab === 'macro' && (
        <TabErrorBoundary tabName="Macro & Seasonality">
          {macroError ? (
            <div style={{ marginTop: 20, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Macro fetch failed:</strong> {macroError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: COINGECKO_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <MacroSentiment data={macroData} cpiData={cpiData} cpiError={cpiError} />
          )}

          {newsError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Market news fetch failed:</strong> {newsError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: COINSTATS_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <MarketNews data={newsData} />
          )}

          {altseasonError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Altcoin Season Index fetch failed:</strong> {altseasonError}
            </div>
          ) : (
            <AltseasonIndex data={altseasonData} />
          )}

          {etfFlowsError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>ETF flows fetch failed:</strong> {etfFlowsError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: SOSOVALUE_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <EtfFlows data={etfFlowsData} />
          )}

          {ethEtfFlowsError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>ETH ETF flows fetch failed:</strong> {ethEtfFlowsError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: COINGLASS_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <EtfFlows
              data={ethEtfFlowsData}
              title="Spot ETH ETF Flows"
              subtitle="Live daily net flow across US spot Ethereum ETFs, via Coinglass — weekly/monthly views sum the same daily numbers, not a separately reported figure"
            />
          )}

          {optionsError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Options positioning fetch failed:</strong> {optionsError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Deribit's public API may be temporarily unavailable — try refreshing.
              </div>
            </div>
          ) : (
            <OptionsPositioning data={optionsData} />
          )}

          {polymarketError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Polymarket fetch failed:</strong> {polymarketError}
            </div>
          ) : (
            <PolymarketPredictions data={polymarketData} />
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

          {seasonalityError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Seasonality fetch failed:</strong> {seasonalityError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Kraken's public OHLC endpoint may be temporarily unavailable — try refreshing.
              </div>
            </div>
          ) : (
            <SeasonalityTable data={seasonalityData} />
          )}
        </TabErrorBoundary>
      )}

      {activeTab === 'levels' && (
        <TabErrorBoundary tabName="Levels & Liquidations">
          {emaError ? (
            <div style={{ marginTop: 20, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>EMA fetch failed:</strong> {emaError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Kraken's public OHLC endpoint may be temporarily unavailable — try refreshing.
              </div>
            </div>
          ) : (
            <EmaLevels data={emaData} symbols={EMA_SYMBOLS} />
          )}

          {timeframesError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Timeframes fetch failed:</strong> {timeframesError}
            </div>
          ) : (
            <TimeframesPanel data={timeframesData} />
          )}

          <LiquidationHeatmap
            data={liquidationHeatmapData}
            dataError={liquidationHeatmapError}
            coinalyzeData={liquidationHeatmapCoinalyzeData}
            coinalyzeError={liquidationHeatmapCoinalyzeError}
            bcfData={liquidationHeatmapBcfData}
            bcfError={liquidationHeatmapBcfError}
          />

          <LiquidationLevelsTracker
            btcPrice={btcPriceData?.price ?? null}
            btcPriceError={btcPriceError}
            ethPrice={ethPriceData?.price ?? null}
            ethPriceError={ethPriceError}
          />

          {liquidationZonesError ? (
            <div style={{ marginTop: 20, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Liquidation zones fetch failed:</strong> {liquidationZonesError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: COINLOBSTER_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <LiquidationZones data={liquidationZonesData} />
          )}

          {openInterestError ? (
            <div style={{ marginTop: 20, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Cross-exchange open interest fetch failed:</strong> {openInterestError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: COINGLASS_API_KEY isn't set yet, or the key's plan doesn't include this endpoint.
              </div>
            </div>
          ) : (
            <OpenInterestPanel data={openInterestData} />
          )}

          {takerFlowError ? (
            <div style={{ marginTop: 20, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Taker buy/sell volume fetch failed:</strong> {takerFlowError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: COINGLASS_API_KEY isn't set yet, or the key's plan doesn't include this endpoint.
              </div>
            </div>
          ) : (
            <TakerFlow data={takerFlowData} />
          )}

          {liquidationsError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Liquidations fetch failed:</strong> {liquidationsError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: COINGLASS_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <LiquidationsPanel data={liquidationsData} />
          )}

          {liquidationFeedError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Live liquidation feed fetch failed:</strong> {liquidationFeedError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                MarginPad's public API may be temporarily unavailable — try refreshing.
              </div>
            </div>
          ) : (
            <LiveLiquidationFeed data={liquidationFeedData} />
          )}

          {stablecoinMintsError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Stablecoin mint feed fetch failed:</strong> {stablecoinMintsError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: ETHERSCAN_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <StablecoinMintFeed data={stablecoinMintsData} />
          )}

          {fundingError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Funding/OI fetch failed:</strong> {fundingError}
            </div>
          ) : (
            <FundingOI data={fundingData} symbols={tracked} />
          )}
        </TabErrorBoundary>
      )}

      {activeTab === 'whale' && (
        <TabErrorBoundary tabName="Whale Movement">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
            <p style={{ fontSize: 11, color: '#6E767B', margin: 0, maxWidth: 600, lineHeight: 1.5 }}>
              Live whale-tracking data from CoinLobster — individual large trades, unusual-activity
              screening, hourly buy/sell flow, named Hyperliquid accounts, and on-chain DEX swaps.
              Unlike every other panel here, this data is credit-metered, so it only loads when this
              tab is opened, not on every page refresh — use the button below to pull fresh data.
            </p>
            <button
              onClick={fetchAllWhaleData}
              style={{
                background: '#171D21', border: '1px solid #2A3136', color: '#C9A66B',
                borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', flexShrink: 0,
              }}
            >
              Refresh whale data
            </button>
          </div>

          {!whaleTabLoaded ? (
            <p style={{ fontSize: 12, color: '#6E767B', marginTop: 16 }}>Loading…</p>
          ) : (
            <>
              {whaleTradesError ? (
                <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
                  <strong>Whale trade feed fetch failed:</strong> {whaleTradesError}
                  <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                    Most likely cause: COINLOBSTER_API_KEY isn't set yet, or this key's plan doesn't include this endpoint.
                  </div>
                </div>
              ) : (
                <WhaleTradeFeed data={whaleTradesData} />
              )}

              {whaleRadarError ? (
                <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
                  <strong>Whale radar fetch failed:</strong> {whaleRadarError}
                </div>
              ) : (
                <WhaleRadar data={whaleRadarData} />
              )}

              {whaleFlowError ? (
                <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
                  <strong>Whale flow fetch failed:</strong> {whaleFlowError}
                </div>
              ) : (
                <WhaleFlow data={whaleFlowData} />
              )}

              {hyperliquidWhalesError ? (
                <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
                  <strong>Hyperliquid whale board fetch failed:</strong> {hyperliquidWhalesError}
                </div>
              ) : (
                <HyperliquidWhaleBoard data={hyperliquidWhalesData} />
              )}

              {onchainWhalesError ? (
                <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
                  <strong>On-chain whale swaps fetch failed:</strong> {onchainWhalesError}
                </div>
              ) : (
                <OnchainWhaleSwaps data={onchainWhalesData} />
              )}
            </>
          )}
        </TabErrorBoundary>
      )}
    </main>
  );
}
