#!/usr/bin/env bash
# Restore dist/ and packages/*/dist from CI artifact tarball.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ARCHIVE="${1:-ci-build-artifacts.tar.gz}"

if [ ! -f "$ARCHIVE" ]; then
  echo "::error::${ARCHIVE} not found"
  exit 1
fi

tar xzf "$ARCHIVE"
echo "ci-unpack-build-artifacts: restored from ${ARCHIVE}"

if [ ! -f dist/loader.js ]; then
  echo "::error::dist/loader.js missing after unpack"
  exit 1
fi
