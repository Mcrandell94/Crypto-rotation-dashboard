'use client';

import { useEffect, useState } from 'react';
import { getMoonPhase, getUpcomingPhases } from '../lib/moon';
import { RETROGRADES_2026 } from '../lib/retrogrades';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_SECONDARY = '#8B9298';
const TEXT_MUTED = '#6E767B';
const CARD_BG = '#171D21';
const CARD_BORDER = '#2A3136';
const AMBER = '#C9A66B';
const GAIN = '#7FA37F';
const LOSS = '#A85D4F';

// Both the moon-phase math and the retrograde dates are UTC instants —
// format in UTC too, or viewers west of UTC (most US timezones) see every
// date rolled back by a day.
function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: TEXT_MUTED }}>{label}</div>
      <div style={{ fontSize: 16, color: TEXT_PRIMARY, fontFamily: 'ui-monospace, monospace', marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function Card({ title, right, children }) {
  return (
    <div style={{ marginTop: 20, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 6, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

// The full "Astro-Crypto Trading System, Phase 8" claimed signal table,
// reproduced verbatim for documentation — not as something to trade off.
// See the critique paragraph directly below it for why.
const SIGNAL_TABLE = [
  ['Mars conjunction Sun', 'Bull', 'T1', '+3.6%', '89%', 'Jan 9', '8/9'],
  ['Jupiter sextile Saturn', 'Bull', 'T1', '+6.6%', '94%', 'Rare — not in 2026', '7/9'],
  ['Jupiter square Pluto', 'Bull', 'T1', '+7.3%', '74%', 'Rare — not in 2026', '6/9'],
  ['Saturn conjunction Pluto', 'Bull', 'T1', '+7.8%', '100%', 'Generational (~2053)', '5/5'],
  ['Venus opposition Jupiter', 'Bull', 'T2', '+10.0%', '67%', 'Jan 10', '6/9'],
  ['Mars sextile Neptune', 'Bull', 'T2', '+5.5%', '80%', 'Jan 23, Jul 5', '6/9'],
  ['Mercury sextile Uranus', 'Bull', 'T2', '+4.9%', '77%', 'Apr 15, Aug 13', '8/9'],
  ['Saturn trine Uranus', 'Bull', 'T2', '+4.6%', '79%', 'Long-cycle — not in 2026', '6/9'],
  ['Saturn square Neptune', 'Bull', 'T2', '+4.7%', '65%', 'Long-cycle — not in 2026', '5/9'],
  ['Jupiter opposition Uranus', 'Bull', 'T2', '+5.5%', '86%', 'Long-cycle — not in 2026', '7/9'],
  ['Venus Retrograde', 'Bear', 'T1', '-11.2%', '0%', 'Oct 4 - Nov 16', '9/9'],
  ['Uranus Station Direct', 'Bear', 'T2', '-5.9%', '36%', 'Feb 5', '6/9'],
  ['Mercury sextile Chiron', 'Bear', 'T2', '-5.2%', '31%', 'Feb 4, May 30', '5/9'],
  ['Sun conjunction North Node', 'Bear', 'T2', '-5.9%', '29%', 'Feb 28', '5/9'],
  ['Pluto conjunction Sun', 'Bear', 'T2', '-5.3%', '44%', 'Jan 23', '5/9'],
  ['Mars trine Uranus', 'Bear', 'T2', '-4.0%', '26%', 'Jan 20', '5/9'],
  ['Mercury conjunction Venus', 'Bear', 'T2', '-5.0%', '38%', 'Jan 29, Feb 28, Oct 7', '5/9'],
  ['Mars trine North Node', 'Bear', 'T2', '-8.0%', '8%', 'Aug 12', '6/9'],
];

const DEBUNKED_TABLE = [
  ['Mercury Retrograde = bear', '~150 periods tested', 'p = 0.67 — pure noise'],
  ['Moon phases (new/full)', '~1,200 phases tested', 'p > 0.4 — no effect on crypto'],
  ['Moon-planet aspects', '13,527 events tested', 'Barely anything significant'],
  ['Void of Course Moon', '1,595 periods tested', 'Zero effect'],
  ['Minor aspects (semi-square, quincunx)', '8,000+ events', 'Collective p > 0.5 — no signal as a group'],
];

const SIZING_TABLE = [
  ['0 signals', '0% — flat', 'No valid setup'],
  ['1 Tier 2 signal', '0.5x base', '+3.5% avg excess 7d'],
  ['1 Tier 1 signal', '0.75x base', '+4.8% avg excess 7d'],
  ['2+ signals, same direction', '1.0x base', '+6.7% avg excess 7d'],
  ['3+ signals, same direction', '1.5x base MAX', '+9.2% avg excess 7d'],
];

const CLAIMED_CALENDAR = [
  ['Jan', 2.6, 'Bullish', 'Mars conj Sun Jan 9, Venus opp Jup Jan 10'],
  ['Feb', -9.9, 'Bearish', 'Uranus Stn Direct Feb 5, North Node Feb 28'],
  ['Mar', -0.5, 'Neutral', 'Lunar Eclipse Mar 3'],
  ['Apr', 3.8, 'Bullish', 'Mercury sextile Uranus Apr 15'],
  ['May', 4.1, 'Bullish', 'Hold Apr longs, exit by May 28'],
  ['Jun', 0.3, 'Neutral', 'Uranus ingress Gemini (structural)'],
  ['Jul', 2.8, 'Bullish', 'Mars sextile Neptune Jul 5'],
  ['Aug', -1.2, 'Caution', 'Mars trine North Node Aug 12 (8% win claimed)'],
  ['Sep', -8.4, 'Bearish', '"Triple Bear Cluster" Sep 14-26 per this table (Sep 12-26 per the executive summary — inconsistent)'],
  ['Oct', -12.0, 'Blackout', 'Venus Retrograde Oct 4 - Nov 16'],
  ['Nov', 1.4, 'Recovery', 'Venus direct Nov 16 - claimed re-entry signal'],
  ['Dec', 5.2, 'Bullish', 'Mercury opp Uranus Dec 7 (93% win claimed)'],
];

function AstronomySection() {
  const [now, setNow] = useState(null);

  // Computed on mount rather than during render, so the server-rendered
  // markup can't disagree with the client's clock (hydration mismatch).
  useEffect(() => {
    setNow(new Date());
  }, []);

  if (!now) return <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 16 }}>Loading…</p>;

  const tonight = getMoonPhase(now);
  const upcoming = getUpcomingPhases(now);

  const windowEvents = [
    { date: upcoming.firstQuarter, label: 'First Quarter Moon' },
    { date: upcoming.fullMoon, label: 'Full Moon' },
    { date: upcoming.newMoon, label: 'New Moon' },
    { date: upcoming.lastQuarter, label: 'Last Quarter Moon' },
    ...RETROGRADES_2026.flatMap((r) => {
      const start = new Date(`${r.start}T00:00:00Z`);
      const end = new Date(`${r.end}T00:00:00Z`);
      return [
        { date: start, label: `${r.planet} Retrograde begins`, note: `A long window (through ${formatDate(end)}) — worth pacing yourself through rather than treating as one day` },
        { date: end, label: `${r.planet} stations direct` },
      ];
    }),
  ]
    .filter((e) => e.date >= now)
    .sort((a, b) => a.date - b.date)
    .slice(0, 6);

  return (
    <>
      <Card title="Real astronomy — moon phases" right={<span style={{ fontSize: 11, color: TEXT_MUTED }}>Computed live from orbital mechanics</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginTop: 14 }}>
          <Stat label="Tonight" value={`${tonight.name}, ${tonight.illumination}%`} />
          <Stat label="Next First Quarter" value={formatDate(upcoming.firstQuarter)} />
          <Stat label="Next Full Moon" value={formatDate(upcoming.fullMoon)} />
          <Stat label="Next New Moon" value={formatDate(upcoming.newMoon)} />
        </div>
      </Card>

      <Card title="Transition windows — a cue to check in with yourself, not a trade signal">
        <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8, lineHeight: 1.6 }}>
          Full moons, new moons, and retrograde stations are windows some traders associate with
          heightened impulsivity. Use these as a personal prompt — &ldquo;am I sizing this
          normally, or am I chasing something&rdquo; — the same way you&apos;d use any other
          discipline checkpoint.
        </p>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {windowEvents.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 4px', borderBottom: `1px solid ${CARD_BORDER}`, gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: AMBER, fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>{formatDate(e.date)}</span>
              <span style={{ fontSize: 12, color: TEXT_PRIMARY, textAlign: 'right' }}>
                {e.label}
                {e.note && <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>{e.note}</div>}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

export default function AstroOutlook() {
  return (
    <section style={{ marginTop: 20 }}>
      {/* Top-level framing — purpose stated plainly */}
      <div style={{ background: '#1E1B14', border: `2px solid ${AMBER}`, borderRadius: 6, padding: '18px 20px' }}>
        <div style={{ fontSize: 14, color: TEXT_PRIMARY, fontWeight: 600, marginBottom: 8 }}>🌙 Astro Outlook</div>
        <p style={{ fontSize: 12, color: AMBER, lineHeight: 1.65 }}>
          This tab exists for two real reasons, and neither of them is &ldquo;planets predict Bitcoin&apos;s
          price.&rdquo; First: <strong style={{ color: TEXT_PRIMARY }}>self-awareness</strong> — some traders
          notice their own impulse control, mood, or risk appetite shifts around lunar or astrological
          transitions, and use that awareness as a personal cue to size down or step back during those
          windows, the same way someone might avoid trading right after a big loss or when overtired.
          Second: <strong style={{ color: TEXT_PRIMARY }}>community psychology</strong> — belief in these
          cycles is real and widespread among some traders, and shared belief shapes real behavior and real
          order flow regardless of whether the underlying mechanism is physical. Both are legitimate reasons
          to track this. What this tab does <em>not</em> claim: that planetary positions directly cause
          price moves, or that the specific &ldquo;backtested&rdquo; statistics further down (from a
          document reviewed for this section) are validated — those numbers have real, documented problems,
          covered plainly below. Nothing on this tab feeds into any score elsewhere on this dashboard.
        </p>
      </div>

      <AstronomySection />

      <Card title='The source document — "Astro-Crypto Trading System, Phase 8 Complete"'>
        <p style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.6, marginTop: 12 }}>
          Self-described as a &ldquo;2026 Master Playbook,&rdquo; dated Feb 2026, presenting itself as
          backtested on 11+ years of Bitcoin data (2013-2026) and validated across 9 crypto assets with
          &ldquo;walk-forward out-of-sample confirmation.&rdquo; Its headline claims:
        </p>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 12 }}>
          {[
            ['23,194', 'Astronomical events tested'],
            ['9', 'Crypto assets "validated" across'],
            ['38%', 'Of bull signals peak at 30-day hold'],
            ['89%', 'Claimed cross-asset hit rate'],
          ].map(([n, l]) => (
            <div key={l}>
              <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 20, color: AMBER }}>{n}</div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, maxWidth: 130 }}>{l}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: LOSS, lineHeight: 1.6, marginTop: 16, paddingTop: 14, borderTop: `1px solid #232A2E` }}>
          <strong>Why the headline numbers themselves are the first red flag:</strong> &ldquo;23,194 events
          tested, only 12 survived&rdquo; is a textbook multiple-comparisons setup. With a p&lt;0.05
          threshold, testing that many combinations of planets, aspects, and assets will produce a
          meaningful number of &ldquo;statistically significant&rdquo;-looking results from pure noise
          alone — that&apos;s what the 5% false-positive rate guarantees at scale. The document claims
          Benjamini-Hochberg correction was applied, but that correction controls the false-discovery
          <em>rate</em>, not whether any true signal exists in the first place; if the true effect is zero
          (the reasonable prior here, given no known mechanism), some fraction of tests will still clear
          correction by chance, especially if the correction wasn&apos;t independently audited. Testing
          volume this large is far more consistent with data dredging until something looks good than with
          genuine discovery.
        </p>
      </Card>

      <Card title='Claimed "Validated Signal Database" — full table as presented'>
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${CARD_BORDER}`, color: TEXT_MUTED, textAlign: 'left' }}>
                <th style={{ padding: '4px 8px 4px 0' }}>Signal</th>
                <th style={{ padding: '4px 8px' }}>Bias</th>
                <th style={{ padding: '4px 8px' }}>Tier</th>
                <th style={{ padding: '4px 8px' }}>7d Excess</th>
                <th style={{ padding: '4px 8px' }}>Win%</th>
                <th style={{ padding: '4px 8px' }}>2026 Dates</th>
                <th style={{ padding: '4px 0' }}>Assets</th>
              </tr>
            </thead>
            <tbody>
              {SIGNAL_TABLE.map((row) => (
                <tr key={row[0]} style={{ borderBottom: '1px solid #1A1F22' }}>
                  <td style={{ padding: '4px 8px 4px 0', color: TEXT_PRIMARY }}>{row[0]}</td>
                  <td style={{ padding: '4px 8px', color: row[1] === 'Bull' ? GAIN : LOSS }}>{row[1]}</td>
                  <td style={{ padding: '4px 8px', color: TEXT_SECONDARY }}>{row[2]}</td>
                  <td style={{ padding: '4px 8px', color: TEXT_SECONDARY, fontFamily: 'ui-monospace,monospace' }}>{row[3]}</td>
                  <td style={{
                    padding: '4px 8px', fontFamily: 'ui-monospace,monospace',
                    color: (row[4] === '0%' || row[4] === '100%') ? LOSS : TEXT_SECONDARY,
                    fontWeight: (row[4] === '0%' || row[4] === '100%') ? 700 : 400,
                  }}>{row[4]}</td>
                  <td style={{ padding: '4px 8px', color: TEXT_SECONDARY }}>{row[5]}</td>
                  <td style={{ padding: '4px 0', color: TEXT_SECONDARY }}>{row[6]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: LOSS, lineHeight: 1.6, marginTop: 14, paddingTop: 12, borderTop: '1px solid #232A2E' }}>
          <strong>The highlighted 0% and 100% win rates are the tell.</strong> Venus Retrograde is claimed
          to have a 0% win rate across &ldquo;all 6 periods tested,&rdquo; and Saturn conjunction Pluto a
          100% win rate across 5. With samples that small, a real underlying win rate of, say, 30-40% would
          still have a meaningful chance of producing 0/6 or 5/5 by pure coincidence — a 6-sample binomial
          gives you very little power to distinguish &ldquo;genuinely 0%&rdquo; from &ldquo;actually 35% but
          got unlucky.&rdquo; Real, economically-driven trading edges in liquid markets almost never show
          literal 0% or 100% over multiple independent periods; that pattern is far more consistent with the
          periods being chosen or defined after seeing the outcome than with a stable underlying effect.
        </p>
      </Card>

      <Card title='What the document itself calls "Debunked Signals"'>
        <p style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.5, marginTop: 8, marginBottom: 4 }}>
          Worth including on its own merits — the document claims these popular &ldquo;financial
          astrology&rdquo; ideas produced zero statistical significance:
        </p>
        {DEBUNKED_TABLE.map((row) => (
          <div key={row[0]} style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: '1px solid #1A1F22', fontSize: 12, flexWrap: 'wrap' }}>
            <span style={{ color: TEXT_SECONDARY, flex: '1 1 200px' }}>{row[0]}</span>
            <span style={{ color: TEXT_MUTED, flex: '1 1 150px', fontSize: 11 }}>{row[1]}</span>
            <span style={{ color: GAIN, flex: '1 1 200px', fontSize: 11 }}>{row[2]}</span>
          </div>
        ))}
        <p style={{ fontSize: 11, color: AMBER, lineHeight: 1.6, marginTop: 14, paddingTop: 12, borderTop: '1px solid #232A2E' }}>
          The irony worth sitting with: the document correctly identifies that the most popular,
          widely-shared astrology claims (Mercury Rx, moon phases) are noise when actually tested
          rigorously — using the same p-value logic that should apply just as hard to its own remaining 12
          &ldquo;surviving&rdquo; signals. It applies skepticism to everyone else&apos;s claims but not
          fully to its own, which is a common pattern in this genre.
        </p>
      </Card>

      <Card title='"Cross-asset validation" — claimed strength, actual weakness'>
        <p style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.6, marginTop: 12 }}>
          The document treats a signal appearing on BTC, ETH, SOL, BNB, ADA, and LINK simultaneously as
          independent confirmation — &ldquo;84% of BTC signals showed the same directional effect on
          ETH,&rdquo; presented as proof the signals reflect real market dynamics rather than a
          BTC-specific fluke.
        </p>
        <p style={{ fontSize: 12, color: LOSS, lineHeight: 1.6, marginTop: 10 }}>
          This inverts the actual statistics. Major crypto assets are highly correlated with BTC — often
          70-90%+ over any given week — precisely because one broad market factor (overall risk appetite,
          BTC&apos;s own price action) drives most of the co-movement. If an &ldquo;astrological
          signal&rdquo; coincides with a BTC move, ETH and SOL moving the same direction that week
          isn&apos;t 6 independent confirmations of the signal — it&apos;s largely the same single BTC move
          showing up 6 times through existing correlation. Cross-asset agreement here is close to what
          you&apos;d expect from correlation alone, not evidence the astrology adds anything beyond it.
        </p>
      </Card>

      <Card title='Claimed "Confluence-Based Position Sizing"'>
        <div style={{ marginTop: 4 }}>
          {SIZING_TABLE.map((row) => (
            <div key={row[0]} style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: '1px solid #1A1F22', fontSize: 12, flexWrap: 'wrap' }}>
              <span style={{ color: TEXT_SECONDARY, flex: '1 1 220px' }}>{row[0]}</span>
              <span style={{ color: TEXT_PRIMARY, flex: '1 1 120px', fontFamily: 'ui-monospace,monospace' }}>{row[1]}</span>
              <span style={{ color: TEXT_MUTED, flex: '1 1 160px', fontSize: 11 }}>{row[2]}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: TEXT_SECONDARY, lineHeight: 1.5, marginTop: 10 }}>
          Also specifies hard stops (-5% to -10% depending on confluence) and market-regime multipliers
          (0.5x-1.3x depending on trend/volatility state).
        </p>
        <p style={{ fontSize: 12, color: LOSS, lineHeight: 1.6, marginTop: 12, paddingTop: 12, borderTop: '1px solid #232A2E' }}>
          <strong>This is the most concerning section of the document,</strong> not the least. Position
          sizing, leverage caps, and stop-loss placement are real risk-management tools — wrapping them
          around a signal generator with no demonstrated edge doesn&apos;t make the underlying bet safer, it
          just makes a baseless signal look like a professionally risk-managed one. The specific percentages
          (0.5x, 0.75x, 1.5x max) carry false precision: they&apos;re only meaningful if the underlying win
          rates and excess returns above them are real, which is exactly what the rest of this tab disputes.
        </p>
      </Card>

      <Card title="Claimed 2026 monthly calendar, as presented in the document">
        <div style={{ marginTop: 4 }}>
          {CLAIMED_CALENDAR.map((row) => (
            <div key={row[0]} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #1A1F22', fontSize: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ color: TEXT_PRIMARY, width: 34 }}>{row[0]}</span>
              <span style={{ width: 46, fontFamily: 'ui-monospace,monospace', color: row[1] > 0 ? GAIN : row[1] < 0 ? LOSS : TEXT_SECONDARY }}>
                {row[1] > 0 ? '+' : ''}{row[1]}
              </span>
              <span style={{ width: 70, color: TEXT_SECONDARY, fontSize: 11 }}>{row[2]}</span>
              <span style={{ color: TEXT_MUTED, fontSize: 11, flex: 1 }}>{row[3]}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: TEXT_SECONDARY, lineHeight: 1.5, marginTop: 14, paddingTop: 12, borderTop: '1px solid #232A2E' }}>
          The document instructs, near-verbatim: exit longs by Sep 5 ahead of the &ldquo;bear
          cluster,&rdquo; move fully to stablecoins by Oct 3 with &ldquo;no exceptions,&rdquo; and re-enter
          longs Nov 15-17. Those are specific, actionable trade instructions attached to unverified
          statistics — reproduced here for documentation, not as something to act on.
        </p>
      </Card>

      <Card title="Overall assessment">
        <p style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.65, marginTop: 12 }}>
          The document is polished and uses real statistical vocabulary correctly — p-values,
          Benjamini-Hochberg correction, walk-forward validation, out-of-sample testing are all legitimate
          concepts. That vocabulary is what makes this genre convincing. But the specific numbers it
          reports (literal 0%/100% win rates on tiny samples, cross-asset &ldquo;confirmation&rdquo;
          that&apos;s largely explained by ordinary correlation, an internal date inconsistency in its own
          headline setup, and a testing volume in the tens of thousands that all but guarantees false
          positives) are far more consistent with an overfit or fabricated backtest than a genuine
          discovery. There is also, underlying all of it, no proposed mechanism for why any of this would
          be true — astrology has none linking planetary positions to a decentralized ledger&apos;s market
          price, unlike, say, a real macro transmission channel (a rate hike raising borrowing costs) that
          at least has a causal story behind the correlation.
        </p>
        <p style={{ fontSize: 12, color: AMBER, lineHeight: 1.65, marginTop: 12 }}>
          None of that changes the two legitimate reasons this tab exists: tracking these windows as a
          personal check-in on your own impulse control, and respecting that belief in these cycles is real
          and shapes real behavior within parts of this trading community. Those are about self-awareness
          and psychology, not about whether Mars actually moves Bitcoin&apos;s price — and they don&apos;t
          need the specific backtested numbers above to be true in order to be useful to you.
        </p>
      </Card>
    </section>
  );
}
