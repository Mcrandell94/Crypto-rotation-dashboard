// Deterministic composite "read" of the dashboard's own live signals — the
// real equivalent of the reference prototype's "AI Market Vibe" panel. That
// panel's name implied an AI model was involved; it wasn't — it was a plain
// weighted sum over ~20 factors, several of them hand-transcribed for a
// single point in time. This is the same idea done honestly: every factor
// below reads a field this dashboard already fetches live elsewhere (EMA,
// options, COT, ETF flows, macro, funding, seasonality), no LLM call and no
// hardcoded event data. A factor is skipped — not guessed — when its
// backing data hasn't loaded, so the read only ever speaks to what's
// actually in front of it right now.

import { monthStats } from './seasonality.js';
import { FUNDING_HOT } from './rrgOverlays.js';
import { computeSeries, quadrantOf, RRG_PRESETS } from './rrgMath.js';
import { SECTORS } from './sectors.js';

const THRESHOLDS = [
  { max: -2, verdict: 'Bearish', color: '#A85D4F' },
  { max: -0.5, verdict: 'Leaning Bearish', color: '#C9866F' },
  { max: 0.5, verdict: 'Mixed / Neutral', color: '#8B9298' },
  { max: 2, verdict: 'Leaning Bullish', color: '#9BBF8F' },
];
const BULLISH_FALLBACK = { verdict: 'Bullish', color: '#7FA37F' };

function headlineExpiry(expiries) {
  return expiries?.find((e) => e.type === 'quarterly') || expiries?.[0] || null;
}

// Total BTC open interest now vs 24h ago across every exchange in the
// Coinglass breakdown (each venue's 24h ago = now / (1 + change24h%)).
export function openInterestChange24h(openInterestData) {
  const venues = openInterestData?.assets?.BTC?.byExchange;
  if (!Array.isArray(venues) || venues.length === 0) return null;
  let now = 0;
  let before = 0;
  for (const v of venues) {
    if (!(v.openInterestUsd > 0) || !Number.isFinite(v.change24h)) continue;
    now += v.openInterestUsd;
    before += v.openInterestUsd / (1 + v.change24h / 100);
  }
  return before > 0 ? (now / before - 1) * 100 : null;
}

// Where each sector sits on the sectors-vs-BTC RRG today, using the chart's
// default (Balanced, z-score) settings. Not scored: rotation between
// sectors doesn't say which way the market goes.
export function sectorQuadrants(rrgSectorsData) {
  const prices = rrgSectorsData?.prices;
  const bench = prices?.[rrgSectorsData?.benchmark];
  if (!prices || !Array.isArray(bench)) return null;
  const settings = { zscore: true, ...RRG_PRESETS.find((p) => p.key === 'balanced').settings };
  const out = { leading: [], improving: [], weakening: [], lagging: [] };
  for (const sector of SECTORS) {
    const series = prices[sector.label];
    if (!Array.isArray(series) || series.length !== bench.length) continue;
    const last = computeSeries(series, bench, settings).at(-1);
    if (!last || !Number.isFinite(last.x) || !Number.isFinite(last.y)) continue;
    out[quadrantOf(last.x, last.y)].push(sector.short);
  }
  return Object.values(out).some((l) => l.length) ? out : null;
}

export function computeMarketRead({
  btcTicker, macroData, emaData, cotData, optionsData, etfFlowsData, fundingData, seasonalityData,
  openInterestData, liquidationsData, rrgSectorsData,
}) {
  // Options and seasonality responses are per asset ({ assets: { BTC, ETH } })
  // since ETH was added; the read is about BTC. Reading them flat (as this
  // did before) silently skipped both factors.
  const btcOptions = optionsData?.assets?.BTC ?? optionsData;
  const btcSeasonality = seasonalityData?.assets?.BTC ?? seasonalityData;

  const factors = [];
  let score = 0;
  const add = (bull, text, weight = 1) => {
    score += bull ? weight : -weight;
    factors.push({ bull, text });
  };

  if (btcTicker?.percentChange24h != null) {
    const up = btcTicker.percentChange24h > 0;
    add(up, `BTC ${up ? 'up' : 'down'} ${Math.abs(btcTicker.percentChange24h).toFixed(1)}% on the day`, 1);
  }

  if (btcTicker?.percentChange7d != null) {
    const up = btcTicker.percentChange7d > 0;
    add(up, `BTC ${up ? 'up' : 'down'} ${Math.abs(btcTicker.percentChange7d).toFixed(1)}% on the week`, 0.5);
  }

  const fng = macroData?.fng?.value;
  if (fng != null) {
    if (fng >= 75) add(false, `Fear & Greed at ${fng.toFixed(0)} (Extreme Greed) — contrarian caution`, 1);
    else if (fng <= 25) add(true, `Fear & Greed at ${fng.toFixed(0)} (Extreme Fear) — contrarian opportunity`, 1);
  }

  const spread = macroData?.rates?.yieldCurveSpread?.value;
  if (spread != null) {
    add(spread >= 0, `10Y-2Y spread ${spread >= 0 ? 'positive' : 'inverted'} at ${spread.toFixed(2)}pp`, 0.5);
  }

  const dailyCross = emaData?.assets?.BTC?.daily?.goldenCross;
  if (dailyCross != null) {
    add(dailyCross, `Daily ${dailyCross ? 'golden' : 'death'} cross showing (50 EMA ${dailyCross ? 'above' : 'below'} 200)`, 0.5);
  }

  const btcPrice = emaData?.assets?.BTC?.price;
  const weekly50 = emaData?.assets?.BTC?.weekly?.ema50;
  if (btcPrice != null && weekly50 != null) {
    const holding = btcPrice > weekly50;
    add(holding, holding ? 'Holding above the weekly 50 EMA' : 'Sitting on/below the weekly 50 EMA — key support being tested', 0.5);
  }

  if (btcOptions?.callsPct != null) {
    const bullTilt = btcOptions.callsPct > 50;
    if (btcOptions.callsPct !== 50) {
      add(bullTilt, `Options book is ${btcOptions.callsPct}% calls`, 0.5);
    }
  }
  const headline = headlineExpiry(btcOptions?.expiries);
  if (headline?.maxPain != null && btcOptions?.price) {
    const dist = ((headline.maxPain - btcOptions.price) / btcOptions.price) * 100;
    if (Math.abs(dist) >= 1) {
      add(dist >= 0, `Max pain for the ${headline.type === 'quarterly' ? 'nearest quarterly' : headline.date} sits ${Math.abs(dist).toFixed(1)}% ${dist >= 0 ? 'above' : 'below'} spot`, 0.5);
    }
  }

  if (etfFlowsData?.last5Total != null) {
    const inflow = etfFlowsData.last5Total > 0;
    add(inflow, `Spot ETFs ${inflow ? 'net inflow' : 'net outflow'} over the last 5 trading days`, 1);
  }

  if (cotData?.cotIndex != null && cotData?.cotIndexPeak != null) {
    const drop = cotData.cotIndexPeak - cotData.cotIndex;
    if (drop >= 15) add(false, `COT commercials index rolled over from its ${cotData.lookbackWeeks}-week peak of ${cotData.cotIndexPeak} to ${cotData.cotIndex} — re-shorting`, 0.5);
    else if (drop <= 2) add(true, `COT commercials index at/near its ${cotData.lookbackWeeks}-week peak (${cotData.cotIndex})`, 0.5);
  }

  const fundingAnnualized = fundingData?.data?.BTC?.fundingRateAnnualized;
  if (fundingAnnualized != null) {
    if (fundingAnnualized >= FUNDING_HOT) add(false, `BTC funding running hot at ${fundingAnnualized.toFixed(1)}% annualized — crowded long`, 0.5);
    else if (fundingAnnualized <= -10) add(true, `BTC funding negative at ${fundingAnnualized.toFixed(1)}% annualized — crowded short, squeeze risk`, 0.5);
  }

  // Leverage: is open interest building behind the day's move? Rising OI
  // with price up = new positions backing the rally; rising OI with price
  // down = shorts pressing. Falling OI (positions closing) isn't scored.
  const oiChange = openInterestChange24h(openInterestData);
  const dayMove = btcTicker?.percentChange24h;
  if (oiChange != null && dayMove != null && oiChange >= 2 && Math.abs(dayMove) >= 0.5) {
    const up = dayMove > 0;
    add(up, `BTC open interest up ${oiChange.toFixed(1)}% in 24h with price ${up ? 'up — new positions backing the move' : 'down — shorts pressing'}`, 0.5);
  }

  // Liquidations over the last 7 days: a lopsided flush shows which side
  // is being forced out.
  const liq = liquidationsData?.assets?.BTC;
  if (liq?.last7dLong > 0 && liq?.last7dShort > 0) {
    const fmt = (v) => `$${Math.round(v / 1e6)}M`;
    if (liq.last7dShort >= 2 * liq.last7dLong) add(true, `Shorts squeezed: ${fmt(liq.last7dShort)} short vs ${fmt(liq.last7dLong)} long liquidations over 7 days`, 0.25);
    else if (liq.last7dLong >= 2 * liq.last7dShort) add(false, `Longs flushed: ${fmt(liq.last7dLong)} long vs ${fmt(liq.last7dShort)} short liquidations over 7 days`, 0.25);
  }

  // Seasonality uses completed years only: the current month's partial
  // return isn't history yet (see lib/seasonality).
  const season = btcSeasonality?.monthlyReturns && btcSeasonality?.currentMonth != null
    ? monthStats(btcSeasonality, btcSeasonality.currentMonth)
    : null;
  if (season?.avg != null) {
    const { avg, count } = season;
    add(avg >= 0, `Current month historically averages ${avg >= 0 ? '+' : ''}${avg.toFixed(1)}% over ${count} completed years — seasonal ${avg >= 0 ? 'tailwind' : 'headwind'}`, 0.25);
  }

  const bucket = THRESHOLDS.find((t) => score <= t.max) || BULLISH_FALLBACK;

  const sources = [
    { label: 'Price', ok: !!btcTicker },
    { label: 'Macro', ok: !!macroData },
    { label: 'EMA levels', ok: !!emaData },
    { label: 'Options positioning', ok: !!optionsData },
    { label: 'ETF flows', ok: !!etfFlowsData },
    { label: 'COT', ok: !!cotData },
    { label: 'Funding rates', ok: !!fundingData },
    { label: 'Seasonality', ok: !!seasonalityData },
    { label: 'Open interest', ok: !!openInterestData },
    { label: 'Liquidations', ok: !!liquidationsData },
  ];
  const missingSources = sources.filter((s) => !s.ok).map((s) => s.label);

  return {
    score: Math.round(score * 100) / 100,
    verdict: bucket.verdict,
    color: bucket.color,
    factors,
    missingSources,
    sectors: sectorQuadrants(rrgSectorsData),
  };
}
