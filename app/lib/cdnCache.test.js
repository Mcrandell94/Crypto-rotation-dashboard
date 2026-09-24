// Locks down which responses get cached on Vercel's CDN: only a real 200
// with no top-level `error`. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withCdnCache } = require('./cdnCache');

const HEADER = 'Vercel-CDN-Cache-Control';

test('caches a successful response for half the window, stale for the full window', async () => {
  const GET = withCdnCache(async () => Response.json({ value: 1 }), 300);
  const res = await GET();
  assert.equal(res.headers.get(HEADER), 'public, s-maxage=150, stale-while-revalidate=300');
  assert.deepEqual(await res.json(), { value: 1 }); // body still readable
});

test('does not cache a 200 carrying an error field', async () => {
  const GET = withCdnCache(async () => Response.json({ error: 'API key is not set' }), 300);
  assert.equal((await GET()).headers.get(HEADER), null);
});

test('does not cache a 200 reporting partial failures', async () => {
  for (const body of [
    { assets: {}, failed: ['BTC daily'] },
    { rates: {}, ratesFailed: ['DGS10'] },
    { buckets: {}, missing: ['march'] },
    { walletsFailed: [{ name: 'x' }] },
  ]) {
    const GET = withCdnCache(async () => Response.json(body), 300);
    assert.equal((await GET()).headers.get(HEADER), null, JSON.stringify(body));
  }
});

test('still caches when failure lists are present but empty', async () => {
  const GET = withCdnCache(async () => Response.json({ rates: { x: 1 }, ratesFailed: [], missing: [] }), 300);
  assert.notEqual((await GET()).headers.get(HEADER), null);
});

test('does not cache error statuses', async () => {
  const GET = withCdnCache(async () => Response.json({ error: 'BLS returned 503' }, { status: 503 }), 300);
  const res = await GET();
  assert.equal(res.status, 503);
  assert.equal(res.headers.get(HEADER), null);
});

test('does not cache a non-JSON body', async () => {
  const GET = withCdnCache(async () => new Response('oops', { status: 200 }), 300);
  assert.equal((await GET()).headers.get(HEADER), null);
});

test('passes the request through to the handler', async () => {
  const GET = withCdnCache(async (req) => Response.json({ url: req.url }), 60);
  const res = await GET(new Request('https://example.com/api/funding?symbols=BTC'));
  assert.equal((await res.json()).url, 'https://example.com/api/funding?symbols=BTC');
});
