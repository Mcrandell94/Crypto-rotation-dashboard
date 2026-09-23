'use client';

import { useState } from 'react';
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
import NotableWalletActivity from './components/NotableWalletActivity';
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
import useHeaderData from './hooks/useHeaderData';
import useRotationData from './hooks/useRotationData';
import useMacroTabData from './hooks/useMacroTabData';
import useLevelsTabData from './hooks/useLevelsTabData';
import useMintsTabData from './hooks/useMintsTabData';
import useCalendarTabData from './hooks/useCalendarTabData';
import useWhaleTabData from './hooks/useWhaleTabData';

const EMA_SYMBOLS = ['BTC', 'ETH'];

const TABS = [
  { key: 'rotation', label: 'Rotation' },
  { key: 'macro', label: 'Macro & Seasonality' },
  { key: 'levels', label: 'Levels & Liquidations' },
  { key: 'mints', label: 'Printer Watch', icon: '₮' },
  { key: 'calendar', label: 'CB Calendar' },
  { key: 'astro', label: 'Astro Outlook' },
];
// 'whale' (Whale Movement, CoinLobster) is temporarily off the tab bar —
// its hook, useWhaleTabData, and the render block below are left intact,
// just unreachable, so it's a one-line restore (re-add its TABS entry)
// rather than a rebuild.

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

  // Each hook owns one data domain's state + fetchers. header fetches
  // eagerly (MarketRead is always visible above the tab bar); rotation
  // is driven by activeSector/benchmark/rrgMode; every *TabData hook
  // loads lazily, the first time its own tab is opened — see each
  // hook's file for why. This is what keeps API bursts (Etherscan,
  // TronScan, Solscan, Coinglass...) from all firing on every page load
  // regardless of what's actually on screen, and is also why "Refresh
  // now" below only needs to call header + rotation + whichever tab is
  // currently active, not thirty separate fetchers.
  const header = useHeaderData();
  const rotation = useRotationData(sectorTickers, benchmark, activeSector, rrgMode);
  const macro = useMacroTabData(activeTab === 'macro');
  const levels = useLevelsTabData(activeTab === 'levels');
  const mints = useMintsTabData(activeTab === 'mints');
  const calendar = useCalendarTabData(activeTab === 'calendar');
  const whale = useWhaleTabData(activeTab === 'whale');

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Crypto Rotation Dashboard</h1>
        <button
          onClick={() => {
            // Always refresh: Rotation's own data, plus everything the
            // always-visible MarketRead header needs.
            rotation.fetchData(sectorTickers, benchmark);
            header.refetch();
            if (rrgMode === 'sectors') rotation.fetchRrgSectors(benchmark);

            // Plus whichever tab is actually on screen right now — not
            // every other tab's data too.
            if (activeTab === 'macro') macro.refetch();
            else if (activeTab === 'levels') levels.refetch();
            else if (activeTab === 'mints') mints.refetch();
            else if (activeTab === 'calendar') calendar.refetch();
            else if (activeTab === 'whale') whale.refetch();
          }}
          disabled={rotation.loading}
          style={{
            background: '#171D21', border: '1px solid #2A3136', color: '#C9A66B',
            borderRadius: 4, padding: '6px 14px', fontSize: 12, cursor: rotation.loading ? 'default' : 'pointer',
          }}
        >
          {rotation.loading ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>

      <MarketRead
        btcTicker={rotation.data?.tickers?.BTC}
        macroData={rotation.macroData}
        emaData={header.emaData}
        cotData={header.cotData}
        optionsData={header.optionsData}
        etfFlowsData={header.etfFlowsData}
        fundingData={rotation.fundingData}
        seasonalityData={header.seasonalityData}
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
            {t.icon && <span style={{ color: '#26A17B', marginRight: 5 }}>{t.icon}</span>}
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
            {rotation.data?.fetchedAt
              ? `Live from CoinMarketCap — last fetched ${new Date(rotation.data.fetchedAt).toLocaleTimeString()}`
              : 'Fetching live data…'}
          </p>

          {rotation.error && (
            <div style={{ marginTop: 20, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Fetch failed:</strong> {rotation.error}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: CMC_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          )}

          {rrgMode === 'tickers' ? (
            rotation.rrgError ? (
              <div style={{ marginTop: 24, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
                <strong>RRG fetch failed:</strong> {rotation.rrgError}
                <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                  Most likely cause: COINGECKO_API_KEY isn't set yet in this environment's variables.
                </div>
              </div>
            ) : (
              <>
                <RelativeRotationGraph data={rotation.rrgData} symbols={sectorTickers} benchmark={benchmark} />
                {rotation.rrgData?.failed?.length > 0 && (
                  <p style={{ fontSize: 11, color: '#6E767B', marginTop: 8 }}>
                    No live data for: {rotation.rrgData.failed.join(', ')} — skipped.
                  </p>
                )}
              </>
            )
          ) : rotation.rrgSectorsError ? (
            <div style={{ marginTop: 24, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Sector RRG fetch failed:</strong> {rotation.rrgSectorsError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: COINGECKO_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, color: '#6E767B', marginTop: 8, maxWidth: 620 }}>
                Each sector is an equal-weighted composite of its {' '}
                {rotation.rrgSectorsData?.sectorMembers ? Object.values(rotation.rrgSectorsData.sectorMembers)[0]?.length : 4}{' '}
                most prominent tickers, normalized to a common starting index rather than raw price — so a
                sector&apos;s RS-Ratio/Momentum reflects its overall trend, not any single token&apos;s price level.
              </p>
              <RelativeRotationGraph
                data={rotation.rrgSectorsData}
                symbols={SECTORS.map((s) => s.label)}
                benchmark={benchmark}
                assetLabel="index"
                assetFormat={(v) => v?.toFixed(3)}
              />
              {rotation.rrgSectorsData?.failed?.length > 0 && (
                <p style={{ fontSize: 11, color: '#6E767B', marginTop: 8 }}>
                  No live data for: {rotation.rrgSectorsData.failed.join(', ')} — skipped.
                </p>
              )}
            </>
          )}

          <RotationChart tickers={rotation.data?.tickers} symbols={tracked} />
        </TabErrorBoundary>
      )}

      {activeTab === 'calendar' && (
        <TabErrorBoundary tabName="CB Calendar">
          <CbCalendar
            optionsData={header.optionsData}
            fedOddsData={calendar.fedOddsData}
            fedOddsError={calendar.fedOddsError}
            congressData={calendar.congressData}
            congressError={calendar.congressError}
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
          {rotation.macroError ? (
            <div style={{ marginTop: 20, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Macro fetch failed:</strong> {rotation.macroError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: COINGECKO_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <MacroSentiment data={rotation.macroData} cpiData={macro.cpiData} cpiError={macro.cpiError} />
          )}

          {macro.newsError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Market news fetch failed:</strong> {macro.newsError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: COINSTATS_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <MarketNews data={macro.newsData} />
          )}

          {macro.altseasonError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Altcoin Season Index fetch failed:</strong> {macro.altseasonError}
            </div>
          ) : (
            <AltseasonIndex data={macro.altseasonData} />
          )}

          {header.etfFlowsError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>ETF flows fetch failed:</strong> {header.etfFlowsError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: SOSOVALUE_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <EtfFlows data={header.etfFlowsData} />
          )}

          {macro.ethEtfFlowsError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>ETH ETF flows fetch failed:</strong> {macro.ethEtfFlowsError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: COINGLASS_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <EtfFlows
              data={macro.ethEtfFlowsData}
              title="Spot ETH ETF Flows"
              subtitle="Live daily net flow across US spot Ethereum ETFs, via Coinglass — weekly/monthly views sum the same daily numbers, not a separately reported figure"
            />
          )}

          {header.optionsError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Options positioning fetch failed:</strong> {header.optionsError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Deribit's public API may be temporarily unavailable — try refreshing.
              </div>
            </div>
          ) : (
            <OptionsPositioning data={header.optionsData} />
          )}

          {macro.polymarketError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Polymarket fetch failed:</strong> {macro.polymarketError}
            </div>
          ) : (
            <PolymarketPredictions data={macro.polymarketData} />
          )}

          {header.cotError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>COT fetch failed:</strong> {header.cotError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                The CFTC's public reporting site may be temporarily unavailable — try refreshing.
              </div>
            </div>
          ) : (
            <CotPanel data={header.cotData} />
          )}

          {header.seasonalityError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Seasonality fetch failed:</strong> {header.seasonalityError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Kraken's public OHLC endpoint may be temporarily unavailable — try refreshing.
              </div>
            </div>
          ) : (
            <SeasonalityTable data={header.seasonalityData} />
          )}
        </TabErrorBoundary>
      )}

      {activeTab === 'levels' && (
        <TabErrorBoundary tabName="Levels & Liquidations">
          {/* Liquidation Zones (CoinLobster) and Taker Flow (Coinglass) are
              temporarily off this tab — both fail every call right now
              (CoinLobster's unresolved REST 401, Coinglass's key/plan not
              covering this endpoint). Not removed: their fetchers stay
              intact in useLevelsTabData, just uncalled — see that hook's
              refetch() comment for how to bring them back. */}
          {header.emaError ? (
            <div style={{ marginTop: 20, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>EMA fetch failed:</strong> {header.emaError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Kraken's public OHLC endpoint may be temporarily unavailable — try refreshing.
              </div>
            </div>
          ) : (
            <EmaLevels data={header.emaData} symbols={EMA_SYMBOLS} />
          )}

          {levels.timeframesError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Timeframes fetch failed:</strong> {levels.timeframesError}
            </div>
          ) : (
            <TimeframesPanel data={levels.timeframesData} />
          )}

          <LiquidationHeatmap
            data={levels.liquidationHeatmapData}
            dataError={levels.liquidationHeatmapError}
            coinalyzeData={levels.liquidationHeatmapCoinalyzeData}
            coinalyzeError={levels.liquidationHeatmapCoinalyzeError}
            bcfData={levels.liquidationHeatmapBcfData}
            bcfError={levels.liquidationHeatmapBcfError}
          />

          <LiquidationLevelsTracker
            btcPrice={levels.btcPriceData?.price ?? null}
            btcPriceError={levels.btcPriceError}
            ethPrice={levels.ethPriceData?.price ?? null}
            ethPriceError={levels.ethPriceError}
          />

          {levels.openInterestError ? (
            <div style={{ marginTop: 20, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Cross-exchange open interest fetch failed:</strong> {levels.openInterestError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: COINGLASS_API_KEY isn't set yet, or the key's plan doesn't include this endpoint.
              </div>
            </div>
          ) : (
            <OpenInterestPanel data={levels.openInterestData} />
          )}

          {levels.liquidationsError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Liquidations fetch failed:</strong> {levels.liquidationsError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: COINGLASS_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <LiquidationsPanel data={levels.liquidationsData} />
          )}

          {levels.liquidationFeedError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Live liquidation feed fetch failed:</strong> {levels.liquidationFeedError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                MarginPad's public API may be temporarily unavailable — try refreshing.
              </div>
            </div>
          ) : (
            <LiveLiquidationFeed data={levels.liquidationFeedData} />
          )}

          {rotation.fundingError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Funding/OI fetch failed:</strong> {rotation.fundingError}
            </div>
          ) : (
            <FundingOI data={rotation.fundingData} symbols={tracked} />
          )}
        </TabErrorBoundary>
      )}

      {activeTab === 'mints' && (
        <TabErrorBoundary tabName="Printer Watch">
          {mints.stablecoinMintsError ? (
            <div style={{ marginTop: 20, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Stablecoin mint feed fetch failed:</strong> {mints.stablecoinMintsError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: ETHERSCAN_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <StablecoinMintFeed data={mints.stablecoinMintsData} />
          )}

          {mints.notableWalletActivityError ? (
            <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
              <strong>Notable wallet activity fetch failed:</strong> {mints.notableWalletActivityError}
              <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                Most likely cause: ETHERSCAN_API_KEY isn't set yet in this environment's variables.
              </div>
            </div>
          ) : (
            <NotableWalletActivity data={mints.notableWalletActivityData} />
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
              onClick={whale.refetch}
              style={{
                background: '#171D21', border: '1px solid #2A3136', color: '#C9A66B',
                borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', flexShrink: 0,
              }}
            >
              Refresh whale data
            </button>
          </div>

          {!whale.loaded ? (
            <p style={{ fontSize: 12, color: '#6E767B', marginTop: 16 }}>Loading…</p>
          ) : (
            <>
              {whale.whaleTradesError ? (
                <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
                  <strong>Whale trade feed fetch failed:</strong> {whale.whaleTradesError}
                  <div style={{ fontSize: 12, color: '#8B9298', marginTop: 8 }}>
                    Most likely cause: COINLOBSTER_API_KEY isn't set yet, or this key's plan doesn't include this endpoint.
                  </div>
                </div>
              ) : (
                <WhaleTradeFeed data={whale.whaleTradesData} />
              )}

              {whale.whaleRadarError ? (
                <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
                  <strong>Whale radar fetch failed:</strong> {whale.whaleRadarError}
                </div>
              ) : (
                <WhaleRadar data={whale.whaleRadarData} />
              )}

              {whale.whaleFlowError ? (
                <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
                  <strong>Whale flow fetch failed:</strong> {whale.whaleFlowError}
                </div>
              ) : (
                <WhaleFlow data={whale.whaleFlowData} />
              )}

              {whale.hyperliquidWhalesError ? (
                <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
                  <strong>Hyperliquid whale board fetch failed:</strong> {whale.hyperliquidWhalesError}
                </div>
              ) : (
                <HyperliquidWhaleBoard data={whale.hyperliquidWhalesData} />
              )}

              {whale.onchainWhalesError ? (
                <div style={{ marginTop: 32, background: '#1E1B14', border: '1px solid #A85D4F', borderRadius: 6, padding: 16, color: '#C9A66B' }}>
                  <strong>On-chain whale swaps fetch failed:</strong> {whale.onchainWhalesError}
                </div>
              ) : (
                <OnchainWhaleSwaps data={whale.onchainWhalesData} />
              )}
            </>
          )}
        </TabErrorBoundary>
      )}
    </main>
  );
}
