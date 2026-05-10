#!/usr/bin/env bash
# Validates roadmap/v1-issues.yaml: entry count, declared tracks,
# blocked-iff-depends_on invariant, depends_on ref resolution,
# skill-label presence, eligibility-label presence.
# Exits non-zero on any failure.
#
# Note: validates schema invariants only. Semantic correctness (entry
# bodies match titles, depends_on reflect real prerequisites) requires
# human review.

set -euo pipefail
cd "$(dirname "$0")/.."

YAML=roadmap/v1-issues.yaml
EXPECTED_COUNT=45
EXPECTED_TRACKS="api architecture data-model integration research-docs ui"

failures=0

# 1. Entry count
declared_count=$(grep -cE '^- id: ' "$YAML")
if [ "$declared_count" -ne "$EXPECTED_COUNT" ]; then
  echo "FAIL: expected $EXPECTED_COUNT entries, found $declared_count"
  failures=$((failures + 1))
fi

# 2. Tracks match the canonical set
actual_tracks=$(grep -E '^  track: ' "$YAML" | awk '{print $2}' | sort -u | tr '\n' ' ' | sed 's/ $//')
expected_tracks_normalized=$(echo "$EXPECTED_TRACKS" | tr ' ' '\n' | sort -u | tr '\n' ' ' | sed 's/ $//')
if [ "$actual_tracks" != "$expected_tracks_normalized" ]; then
  echo "FAIL: tracks mismatch"
  echo "  expected: $expected_tracks_normalized"
  echo "  actual:   $actual_tracks"
  failures=$((failures + 1))
fi

# 3. depends_on refs all resolve to declared ids
declared_ids=$(mktemp)
referenced_ids=$(mktemp)
trap 'rm -f "$declared_ids" "$referenced_ids"' EXIT

grep -oE '^- id: [A-Za-z0-9]+' "$YAML" | awk '{print $3}' | sort > "$declared_ids"
grep -oE '^  depends_on: \[[^]]*\]' "$YAML" \
  | sed 's/^  depends_on: \[//; s/\]$//' \
  | tr ',' '\n' \
  | tr -d ' ' \
  | grep -v '^$' \
  | sort -u > "$referenced_ids"

orphans=$(comm -23 "$referenced_ids" "$declared_ids")
if [ -n "$orphans" ]; then
  echo "FAIL: depends_on references unknown ids:"
  echo "$orphans" | sed 's/^/  /'
  failures=$((failures + 1))
fi

# 4. Per-entry checks: blocked-iff-depends_on, skill label present, eligibility present
# Parse entries into single-line records via awk so we can validate each
awk '
  /^- id: / {
    if (id) emit()
    id = substr($0, 7)
    has_ready = 0; has_blocked = 0; has_ae = 0; has_human = 0
    skill_count = 0; deps = ""
    in_labels = 0; in_deps = 0
    next
  }
  /^  labels:/ { in_labels = 1; in_deps = 0; next }
  /^  depends_on:/ {
    in_labels = 0
    # capture inline-array form (everything between brackets)
    line = $0
    sub(/^  depends_on: \[/, "", line)
    sub(/\].*$/, "", line)
    gsub(/[ ,]+/, " ", line)
    deps = line
    next
  }
  /^  body:/ { in_labels = 0; in_deps = 0; next }
  in_labels && /^    - / {
    label = $2
    if (label == "ready") has_ready = 1
    else if (label == "blocked") has_blocked = 1
    else if (label == "agent-eligible") has_ae = 1
    else if (label == "human-only") has_human = 1
    else if (label ~ /^skill:/) skill_count++
  }
  END { if (id) emit() }
  function emit() {
    has_deps = (deps !~ /^[ ]*$/)
    fail = ""
    if (has_ready && has_blocked) fail = fail " ready+blocked"
    if (!has_ready && !has_blocked) fail = fail " no-status"
    if (has_blocked && !has_deps) fail = fail " blocked-without-deps"
    if (!has_blocked && has_deps) fail = fail " ready-with-deps"
    if (!has_ae && !has_human) fail = fail " no-eligibility"
    if (has_ae && has_human) fail = fail " both-eligibilities"
    if (skill_count < 1) fail = fail " no-skill-label"
    if (fail) printf "%s:%s\n", id, fail
  }
' "$YAML" > /tmp/roadmap_entry_failures.txt

if [ -s /tmp/roadmap_entry_failures.txt ]; then
  echo "FAIL: per-entry validation errors:"
  sed 's/^/  /' /tmp/roadmap_entry_failures.txt
  failures=$((failures + 1))
fi
rm -f /tmp/roadmap_entry_failures.txt

# Summary
if [ "$failures" -gt 0 ]; then
  echo "FAIL: $failures check(s) failed"
  exit 1
fi

echo "OK: $declared_count entries across $(echo "$EXPECTED_TRACKS" | wc -w | tr -d ' ') tracks; all invariants hold"
