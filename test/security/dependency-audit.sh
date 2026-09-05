#!/usr/bin/env bash
# 1.11 Dependency vulnerability audit.
set -uo pipefail
cd "$(dirname "$0")/../.."   # backend/

echo "=== pnpm audit (backend/) ==="
pnpm audit 2>&1 || true
echo ""
echo "=== pnpm audit --json (for report parsing) ==="
pnpm audit --json > test/security/results/pnpm-audit.json 2>&1 || true
echo "Saved to backend/test/security/results/pnpm-audit.json"
