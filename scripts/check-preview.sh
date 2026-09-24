#!/usr/bin/env bash
# Verify a Vercel preview deployment is actually serving data, not just a
# Vercel Authentication login redirect.
#
# Usage:
#   VERCEL_AUTOMATION_BYPASS_SECRET=... ./scripts/check-preview.sh <preview-url> [path]
#
# <preview-url>  e.g. crypto-rotation-dashboard-abc123-onchain4.vercel.app
#                (with or without https://)
# [path]         defaults to /api/cpi
#
# Vercel's bypass flow needs two hits: the first request (with the bypass
# header) sets a _vercel_jwt cookie and 307s back to the same URL; the
# second request (sending that cookie) gets the real response. -L -c/-b
# handles both hops in one curl call.

set -euo pipefail

if [ -z "${VERCEL_AUTOMATION_BYPASS_SECRET:-}" ]; then
  echo "ERROR: VERCEL_AUTOMATION_BYPASS_SECRET is not set" >&2
  exit 1
fi

if [ -z "${1:-}" ]; then
  echo "Usage: VERCEL_AUTOMATION_BYPASS_SECRET=... $0 <preview-url> [path]" >&2
  exit 1
fi

HOST="${1#https://}"
HOST="${HOST#http://}"
PATH_TO_CHECK="${2:-/api/cpi}"
URL="https://${HOST}${PATH_TO_CHECK}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

STATUS=$(curl -s -L -o /tmp/check-preview-body.json -w '%{http_code}' \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H "x-vercel-protection-bypass: ${VERCEL_AUTOMATION_BYPASS_SECRET}" \
  -H "x-vercel-set-bypass-cookie: true" \
  "$URL")

if [ "$STATUS" != "200" ]; then
  echo "FAIL: ${URL} returned HTTP ${STATUS} (expected 200)" >&2
  cat /tmp/check-preview-body.json >&2
  exit 1
fi

echo "OK: ${URL} returned HTTP 200"
head -c 300 /tmp/check-preview-body.json
echo
