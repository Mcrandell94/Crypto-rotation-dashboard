// Minimal client for a remote MCP server over streamable HTTP: one
// stateless tools/call per request, which both LiqWall's and CoinLobster's
// servers allow (every POST is its own session, no initialize needed).
// Answers come back either as plain JSON or as server-sent events; both
// are read here. The tool's own answer is JSON text in the result's first
// text content block — parsed and returned, or thrown with a raw sample.

// The JSON-RPC response inside a body that is either JSON or SSE.
export function parseRpcBody(text) {
  const t = String(text || '').trim();
  if (t.startsWith('{')) {
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  }
  for (const event of t.split(/\r?\n\r?\n/)) {
    const data = event
      .split(/\r?\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trimStart())
      .join('\n');
    if (!data) continue;
    try {
      const j = JSON.parse(data);
      if (j && (j.result || j.error)) return j;
    } catch {}
  }
  return null;
}

// The tool's parsed JSON answer from a JSON-RPC response, or throws.
export function toolAnswerOf(rpc, label) {
  if (!rpc) throw new Error(`${label}: no JSON-RPC response in the body`);
  if (rpc.error) throw new Error(`${label}: ${rpc.error.message || JSON.stringify(rpc.error).slice(0, 300)}`);
  const text = (rpc.result?.content || []).find((c) => c.type === 'text')?.text;
  if (rpc.result?.isError) throw new Error(`${label}: ${String(text).slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}: answer wasn't JSON. Raw sample: ${String(text).slice(0, 300)}`);
  }
}

export async function callMcpTool(url, name, args, { key, revalidateSeconds = 300 } = {}) {
  const label = `${new URL(url).hostname} ${name}`;
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    next: { revalidate: revalidateSeconds },
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`${label} returned ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return toolAnswerOf(parseRpcBody(text), label);
}
