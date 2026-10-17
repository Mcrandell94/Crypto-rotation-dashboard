// TEMPORARY — one-off check of the CRYPTODATAAPI_API_KEY on the preview
// deployment. Reports only the key's shape (length, the public cdk_live_
// prefix, stray whitespace/quotes) and status codes, never the key or any
// of its characters; strips the account email and key prefix from
// /auth/keys/me. Removed before merge.

export const dynamic = 'force-dynamic';

const BASE = 'https://cryptodataapi.com';

async function call(path, key) {
  const res = await fetch(BASE + path, { headers: { 'X-API-Key': key, Accept: 'application/json' }, cache: 'no-store' });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
    if (body && typeof body === 'object') {
      delete body.email;
      delete body.key_prefix;
    }
  } catch {
    body = text.slice(0, 200);
  }
  return { status: res.status, sample: JSON.stringify(body).slice(0, 1500) };
}

export async function GET() {
  const raw = process.env.CRYPTODATAAPI_API_KEY;
  if (!raw) return Response.json({ error: 'CRYPTODATAAPI_API_KEY is not set in this environment' }, { status: 500 });
  const trimmed = raw.trim();
  const unquoted = trimmed.replace(/^["']|["']$/g, '').trim();
  // a pasted "X-API-Key: cdk_live_..." line
  const afterLabel = unquoted.replace(/^x-api-key\s*[:=]\s*/i, '').trim();
  const shape = {
    length: raw.length,
    trimmedLength: trimmed.length,
    leadingOrTrailingWhitespace: raw !== trimmed,
    wrappedInQuotes: trimmed !== unquoted,
    hasHeaderLabel: unquoted !== afterLabel,
    startsWithCdkLive: afterLabel.startsWith('cdk_live_'),
    innerWhitespace: /\s/.test(afterLabel),
  };
  const results = { asStored: await call('/api/v1/auth/keys/me', raw) };
  if (afterLabel !== raw) {
    await new Promise((r) => setTimeout(r, 700));
    results.cleaned = await call('/api/v1/auth/keys/me', afterLabel);
  }
  return Response.json({ shape, results, at: new Date().toISOString() });
}
