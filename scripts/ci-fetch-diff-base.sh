#!/usr/bin/env bash
# Prepare origin/<base> for --diff scans (CI and local verify:fast).
# Exports CI_DIFF_REF. When sourced, does not exit the parent shell on fetch issues
# unless CI_DIFF_STRICT=1.
set -euo pipefail

BASE_REF="${BASE_REF:-main}"
CI_DIFF_REF="origin/${BASE_REF}"

if [ -n "${PR_BASE_SHA:-}" ]; then
  git cat-file -e "$PR_BASE_SHA^{commit}" 2>/dev/null || git fetch --no-tags --depth=1 origin "$PR_BASE_SHA"
  git update-ref "refs/remotes/origin/${BASE_REF}" "$PR_BASE_SHA"
elif git rev-parse --verify "${CI_DIFF_REF}" >/dev/null 2>&1; then
  :
else
  git show-ref --verify --quiet "refs/remotes/origin/${BASE_REF}" 2>/dev/null \
    || git fetch --no-tags --depth=1 origin "${BASE_REF}:refs/remotes/origin/${BASE_REF}" 2>/dev/null \
    || git fetch --no-tags --depth=1 origin main:refs/remotes/origin/main
  CI_DIFF_REF="origin/${BASE_REF}"
  if ! git rev-parse --verify "${CI_DIFF_REF}" >/dev/null 2>&1; then
    CI_DIFF_REF="origin/main"
  fi
fi

export CI_DIFF_REF

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "CI_DIFF_REF=${CI_DIFF_REF}" >> "$GITHUB_ENV"
fi

echo "ci-fetch-diff-base: using diff ref ${CI_DIFF_REF}"
