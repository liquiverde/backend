#!/usr/bin/env bash
# 1.7-1.8 CORS and security headers — plain curl, no auth involved.
set -uo pipefail
BASE_URL="${BASE_URL:-http://localhost:3000}"
FAIL=0

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; FAIL=1; }

echo "=== CORS ==="

allowed_origin_header=$(curl -sI -H "Origin: http://localhost:4200" "$BASE_URL/categories" | grep -i "access-control-allow-origin" || true)
if echo "$allowed_origin_header" | grep -q "http://localhost:4200"; then
  pass "Allowed origin (http://localhost:4200) is reflected in Access-Control-Allow-Origin"
else
  fail "Allowed origin was NOT reflected — got: '$allowed_origin_header'"
fi

evil_origin_header=$(curl -sI -H "Origin: http://evil-attacker.com" "$BASE_URL/categories" | grep -i "access-control-allow-origin" || true)
# With a single static configured origin, the `cors` package always returns
# that FIXED value on Access-Control-Allow-Origin — it never echoes back the
# request's actual Origin header. So the header may legitimately be present;
# what matters is that it never equals the untrusted origin (which would let
# the browser accept the response) and is never a wildcard "*".
if echo "$evil_origin_header" | grep -qi "evil-attacker.com"; then
  fail "Disallowed origin WAS reflected back — got: '$evil_origin_header'"
elif echo "$evil_origin_header" | grep -q '\*'; then
  fail "Access-Control-Allow-Origin is a wildcard (*) — got: '$evil_origin_header'"
else
  pass "Disallowed origin is not reflected/wildcarded (got: '$evil_origin_header' — browser will reject this for an evil-attacker.com page since it doesn't match the page's real origin)"
fi

preflight=$(curl -sI -X OPTIONS -H "Origin: http://evil-attacker.com" -H "Access-Control-Request-Method: GET" "$BASE_URL/categories")
echo "--- preflight response headers for disallowed origin ---"
echo "$preflight"

echo ""
echo "=== Security headers (GET /health) ==="
headers=$(curl -sI "$BASE_URL/health")
echo "$headers"
echo ""

check_header() {
  local name="$1"
  if echo "$headers" | grep -qi "^$name:"; then
    pass "Header present: $name"
  else
    fail "Header MISSING: $name"
  fi
}

check_header "Content-Security-Policy"
check_header "Strict-Transport-Security"
check_header "X-Content-Type-Options"
check_header "X-Frame-Options"

if echo "$headers" | grep -qi "^X-Powered-By:"; then
  fail "X-Powered-By header is present (reveals Express) — helmet should remove it"
else
  pass "X-Powered-By header is absent (helmet removed it)"
fi

exit $FAIL
