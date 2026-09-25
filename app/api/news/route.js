// Server-side only — requires a free CoinStats API key (openapi.coinstats.app).
//
// CoinStats' own docs (docs.api.coinstats.app, coinstats.app/api-docs) are
// blocked from this sandbox, same as most other providers' docs sites this
// project has hit. The base URL and X-API-KEY header were verified against
// a real published example (CoinStats' own Fear & Greed reference page,
// reachable through search results), but the exact field names on /news
// items weren't independently confirmed the same way — every other doc
// mirror site that might have shown a full example was also unreachable.
// Parsing below tries several plausible field-name variants per field and
// fails loudly with a raw sample of the actual response if none match,
// rather than silently rendering an empty or broken list.

import { withCdnCache } from '../../lib/cdnCache';
import { filterNews } from '../../lib/newsFilter';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://openapiv1.coinstats.app';
const FETCH_LIMIT = 50;
const SHOW = 20;

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k];
  }
  return null;
}

async function handler() {
  const apiKey = process.env.COINSTATS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'COINSTATS_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    // Pull extra: auto-generated and non-English items are filtered out
    // below (see app/lib/newsFilter.js), and 20 are kept.
    const url = `${BASE_URL}/news?page=1&limit=${FETCH_LIMIT}`;
    const res = await fetch(url, {
      headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
      next: { revalidate: 900 },
    });
    if (!res.ok) {
      const detail = await res.text();
      return Response.json({ error: `CoinStats returned ${res.status}`, detail }, { status: res.status });
    }

    const json = await res.json();
    const rows = Array.isArray(json?.result) ? json.result
      : Array.isArray(json?.data) ? json.data
      : Array.isArray(json?.news) ? json.news
      : Array.isArray(json) ? json
      : [];

    if (rows.length === 0) {
      return Response.json(
        { error: 'CoinStats returned no news items', detail: JSON.stringify(json).slice(0, 500) },
        { status: 502 }
      );
    }

    const articles = rows
      .map((r) => {
        const sourceRaw = pick(r, ['source', 'sourceName', 'feedName']);
        return {
          id: pick(r, ['id', '_id']),
          title: pick(r, ['title', 'headline']),
          link: pick(r, ['link', 'url', 'sourceUrl']),
          source: typeof sourceRaw === 'object' && sourceRaw ? (sourceRaw.name || sourceRaw.title || null) : sourceRaw,
          publishedAt: pick(r, ['feedDate', 'publishedAt', 'date', 'createdAt']),
          imageUrl: pick(r, ['imgUrl', 'imageUrl', 'image', 'thumbnail']),
        };
      })
      .filter((a) => a.title && a.link);

    if (articles.length === 0) {
      const detail = JSON.stringify(rows[0]).slice(0, 500);
      return Response.json(
        { error: `CoinStats news response didn't match any known field shape. Raw sample: ${detail}`, detail },
        { status: 502 }
      );
    }

    const kept = filterNews(articles);
    if (kept.length === 0) {
      return Response.json(
        { error: `All ${articles.length} CoinStats news items were auto-generated or non-English, so none are shown.` },
        { status: 502 }
      );
    }

    return Response.json({ articles: kept.slice(0, SHOW), filteredOut: articles.length - kept.length, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}

export const GET = withCdnCache(handler, 900);
