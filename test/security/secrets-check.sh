#!/usr/bin/env bash
# 1.12 Secrets — no git initialized yet, so this is preventive/documentary,
# not an actual leak check.
set -uo pipefail
cd "$(dirname "$0")/../../.."   # repo root (backend/test/security -> up 3)
FAIL=0
pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; FAIL=1; }

echo "=== .gitignore coverage ==="
if grep -qx "\.env" .gitignore 2>/dev/null; then
  pass "Root .gitignore excludes .env"
else
  fail "Root .gitignore does NOT list .env"
fi

if grep -qx "\.env" backend/.gitignore 2>/dev/null; then
  pass "backend/.gitignore excludes .env"
else
  fail "backend/.gitignore does NOT list .env"
fi

echo ""
echo "=== Hardcoded secret patterns in backend/src ==="
matches=$(grep -rnE "(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][A-Za-z0-9+/=]{16,}['\"]" backend/src 2>/dev/null || true)
if [ -z "$matches" ]; then
  pass "No hardcoded secret-like literals found in backend/src"
else
  fail "Potential hardcoded secret(s) found:"
  echo "$matches"
fi

echo ""
echo "NOTE: no git repository is initialized yet in this project — this check is"
echo "preventive documentation for when git is initialized, not proof of an actual leak."

exit $FAIL
