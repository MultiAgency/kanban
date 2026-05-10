#!/usr/bin/env bash
# Verifies every "Deferred to v0.1 #N" cross-reference in PLAN.md and TASKS.md
# resolves to a literal anchor in SPEC.md. Exits non-zero on any dangling ref.
#
# Note: this validates callers → anchors only. Dead anchors in SPEC.md (no
# callers in PLAN/TASKS) are not detected. Add reverse-check when justified.

set -euo pipefail
cd "$(dirname "$0")/.."

dangling=0
for ref in $(grep -hoE 'Deferred to v0\.1 #[0-9]+' PLAN.md TASKS.md | sort -u); do
  if ! grep -qF "$ref" SPEC.md; then
    echo "DANGLING: \"$ref\" referenced in PLAN.md/TASKS.md but missing from SPEC.md"
    dangling=$((dangling + 1))
  fi
done

if [ "$dangling" -gt 0 ]; then
  echo "FAIL: $dangling dangling cross-reference(s)"
  exit 1
fi

echo "OK: all Deferred to v0.1 #N refs resolve in SPEC.md"
