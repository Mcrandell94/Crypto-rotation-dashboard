// Title classification for Polymarket's Bitcoin price-target events (see
// app/api/polymarket). Tested in polymarketBuckets.test.js.

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

export function isBitcoinOnly(title) {
  const t = title.toLowerCase();
  if (!t.includes('bitcoin') && !/\bbtc\b/.test(t)) return false;
  // The broad Crypto tag also carries other coins' versions of the same
  // question format — exclude anything that names another asset too.
  return !/ethereum|\beth\b|solana|\bsol\b|xrp|dogecoin|\bdoge\b/.test(t);
}

export function classify(rawTitle) {
  const t = rawTitle.toLowerCase().trim();
  if (/hit (before|in) \d{4}\??$/.test(t)) return 'yearly';
  if (MONTH_NAMES.some((m) => t.includes(`hit in ${m}`))) return 'monthly';
  // e.g. "hit September 14-20", or a week that crosses months:
  // "hit September 28-October 4"
  if (/hit .*\d{1,2}\s*[-–]\s*(?:[a-z]+\s+)?\d{1,2}/.test(t)) return 'weekly';
  if (/bitcoin above \$?[\d,]+ on /.test(t)) return 'daily';
  if (/up or down/.test(t) && !/\d{1,2}(:\d{2})?\s*(am|pm)\s*-/.test(t)) return 'daily'; // exclude the 5m/15m variants, which carry a time range
  return null;
}
