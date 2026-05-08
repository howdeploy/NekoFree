#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Building Node CLI ==="
npm run build:node:experimental

echo "=== Checking real feature() calls ==="
REAL_FEATURES=$(node -e '
const fs = require("fs");
let s = fs.readFileSync("dist-node/cli.js", "utf8");
s = s
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "")
  .replace(/`(?:\\[\s\S]|[^`\\])*`/g, "\"\"")
  .replace(/"(?:\\.|[^"\\])*"/g, "\"\"")
  .replace(/'"'"'(?:\\.|[^'"'"'\\\\])*'"'"'/g, "'\''"+"''");
console.log([...s.matchAll(/\bfeature\s*\(/g)].length);
')
if [ "$REAL_FEATURES" -ne 0 ]; then
  echo "FAIL: Expected 0 real feature() calls, got $REAL_FEATURES"
  exit 1
fi
echo "OK: 0 real feature() calls"

echo "=== Checking bun:bundle ==="
if grep -q "bun:bundle" dist-node/cli.js; then
  echo "FAIL: bun:bundle found in bundle"
  exit 1
fi
echo "OK: no bun:bundle in bundle"

echo "=== Running --help ==="
timeout 20s node dist-node/cli.js --help >/tmp/nekofree-node-help.out 2>&1

if ! grep -q "Usage: nekofree" /tmp/nekofree-node-help.out; then
  echo "FAIL: --help did not show Usage"
  exit 1
fi

# Check for startup warnings
if grep -q "Dynamic require.*is not supported\|skill deploy failed" /tmp/nekofree-node-help.out; then
  echo "FAIL: startup warnings detected"
  cat /tmp/nekofree-node-help.out
  exit 1
fi

echo "OK: --help clean, no warnings"
echo "=== All smoke tests passed ==="
