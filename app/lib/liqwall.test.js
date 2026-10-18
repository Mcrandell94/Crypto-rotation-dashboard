// Tests for LiqWall liquidation_map parsing. Run with: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const { liquidationMapOf } = require('./liqwall');
const { parseRpcBody, toolAnswerOf } = require('./mcpClient');

// Trimmed from the live BTC answer on 2026-10-18.
const BTC = {
  coin: 'BTC',
  hyperliquid: {
    time_utc: '2026-10-18T14:52:18Z',
    price: 81103.23,
    largest_levels: { columns: ['side', 'price', 'usd', 'distance_pct'], rows: [['long liquidations below', 80000, 112000000, -1.3]] },
  },
  by_exchange: {
    time_utc: '2026-10-18T14:52:18Z',
    price: 81103.23,
    level_step: 100,
    exchanges: ['Binance', 'OKX', 'Bybit', 'Hyperliquid', 'Gate', 'other exchanges'],
    long_liquidations_below_usd: { within_5pct: 416000000, within_10pct: 668000000 },
    short_liquidations_above_usd: { within_5pct: 290000000, within_10pct: 474000000 },
    largest_levels_within_pct: 10,
    largest_levels: {
      columns: ['side', 'price', 'usd', 'distance_pct', 'largest_exchange'],
      rows: [
        ['short liquidations above', 84500, 25700000, 4.2, 'Hyperliquid'],
        ['short liquidations above', 83900, 18000000, 3.5, 'Binance'],
        ['long liquidations below', 80000, 121000000, -1.3, 'Hyperliquid'],
      ],
    },
  },
  page_url: 'https://liqwall.com/liquidation-map/btc?src=mcp',
};

test('cross-exchange levels are preferred over Hyperliquid alone', () => {
  const m = liquidationMapOf(BTC);
  assert.equal(m.price, 81103.23);
  assert.equal(m.asOf, '2026-10-18T14:52:18Z');
  assert.equal(m.venues.length, 6);
  assert.deepEqual(m.levels.map((l) => [l.side, l.price, l.exchange]), [
    ['short', 84500, 'Hyperliquid'],
    ['short', 83900, 'Binance'],
    ['long', 80000, 'Hyperliquid'],
  ]);
  assert.equal(m.longBelow.within_10pct, 668000000);
});

test('falls back to Hyperliquid, and rejects answers without levels', () => {
  const { by_exchange, ...hlOnly } = BTC;
  const m = liquidationMapOf(hlOnly);
  assert.deepEqual(m.venues, ['Hyperliquid']);
  assert.equal(m.levels[0].usd, 112000000);
  assert.equal(liquidationMapOf({ coin: 'BTC' }), null);
  assert.equal(liquidationMapOf(null), null);
});

test('MCP answers are read from JSON and from server-sent events', () => {
  const answer = { pair: 'BTC/USD', projection: { bands: [] } };
  const rpc = { jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: JSON.stringify(answer) }] } };
  assert.deepEqual(toolAnswerOf(parseRpcBody(JSON.stringify(rpc)), 'x'), answer);
  const sse = `event: message\ndata: ${JSON.stringify(rpc)}\n\n`;
  assert.deepEqual(toolAnswerOf(parseRpcBody(sse), 'x'), answer);
  assert.throws(() => toolAnswerOf({ error: { message: 'Unknown tool' } }, 'x'), /Unknown tool/);
  assert.throws(() => toolAnswerOf(parseRpcBody('not json'), 'x'), /no JSON-RPC/);
});
