# Tasks: v0.1.x — substrate hardening

> Decomposition of `docs/spec-v0.1.x.md` into ordered, verifiable tasks. Per spec ranking: Phase 1 (meta-repair) is the ship gate; Phases 2–3 (telemetry, benchmark) are sequential but Phase 3 may slip to a v0.1.x patch. Existing already-banked work tracked in Phase 0.

## Phase 0: Already banked in this session

- [x] **`follow_ups` handoff field.** `FollowUp` interface + `parseHandoff` validation in `src/lib/handoff.ts`; `createFollowUps` + `fetchHandoffComment` in `src/action/index.ts` (called from `run()` before promotion); 5 new parse tests + 8 new Action tests; SPEC.md, `docs/handoff-format.md`, `skills/kanban-worker/SKILL.md` updated with the field + worked example; `dist/index.js` rebuilt. Status: working tree, uncommitted.

## Phase 1: Meta-repair (ship gate)

### T1.1 — Canonical labels + SPEC Rule 6 amendment

**Description:** Add the two new convention labels to the canonical label set and amend Rule 6 to make `human-attention` an explicit hard-veto sub-condition (alongside `human-only`).

**Acceptance criteria:**
- `.github/labels.yml` lists `skill:repair` (color matching other `skill:*` entries) and `human-attention` (color matching `human-only`).
- `SPEC.md` Rule 6 prose explicitly names `human-attention` as the second hard-veto condition.
- `SPEC.md §Canonical labels` block includes both entries.
- The two labels are created on `MultiAgency/kanban` via `gh label create` so test fires can use them immediately.

**Verification:**
- `gh label list -R MultiAgency/kanban | grep -E 'skill:repair|human-attention'` returns both rows.
- `bash scripts/check-spec-refs.sh` still passes (no broken cross-references).

**Dependencies:** None.

**Files:** `.github/labels.yml`, `SPEC.md`.

**Size:** S.

### T1.2 — `kanban-worker` SKILL extension: handling repair issues + `human-attention` skip

**Description:** Extend the agent contract with two changes: teach `kanban-worker` to recognize and handle repair issues per the body template; add `human-attention` to the four-condition eligibility check, making it five.

**Acceptance criteria:**
- New SKILL.md subsection "Handling repair issues" describes the `**Repair target:**` body anchor, the three stuck patterns, the three strategies, and the close-the-repair-issue contract (handoff lands on the repair issue, not on `#N`).
- Eligibility check section updated to list five conditions, with condition 5 being `human-attention` not present.
- Worked example references a stuck issue body so the model has shape to mimic.

**Verification:**
- Manual read against the spec's repair-issue body template — no drift.
- A test fire on a manually-filed repair issue (covered in T1.5) successfully picks strategy and executes.

**Dependencies:** T1.1.

**Files:** `skills/kanban-worker/SKILL.md`.

**Size:** S.

### T1.3 — Repair-scanner routine prompt + DB registration

**Description:** Author the procedural prompt for `kanban-repair-scanner` (mirrors `cron-tick-prompt.md` in shape and discipline) and register it as an IronClaw cron routine on the `0 */30 * * * *` schedule.

**Acceptance criteria:**
- `docs/routines/repair-scanner-prompt.md` exists, structured like `cron-tick-prompt.md`: introduction, fenced procedural prompt, forking notes, known limits.
- The prompt directs the agent to: (1) list `agent-eligible + in-progress` open issues, (2) classify each into one of three stuck patterns, (3) check for existing open repair issue targeting the same `#N` (idempotency), (4) file a repair issue per the body template with `body=` (per Finding 30), `skills=["skill:repair"]`, `agent_eligible=true`, no parent-link checklist.
- Routine row in `~/.ironclaw/ironclaw.db` with `name=kanban-repair-scanner`, `trigger_type=cron`, `trigger_config={"schedule":"0 */30 * * * *"}`, `action_type=full_job`, `enabled=1`.
- Prompt-extraction sync: the doc's fenced block and the DB-stored prompt are byte-identical (per the same awk extraction pattern `cron-setup.md` uses).

**Verification:**
- `sqlite3 ~/.ironclaw/ironclaw.db "SELECT name, trigger_type, enabled FROM routines WHERE name='kanban-repair-scanner'"` returns `kanban-repair-scanner|cron|1`.
- First scheduled fire produces an `ok` run in `ironclaw routines history kanban-repair-scanner` (may file zero repair issues if no half-states present).

**Dependencies:** T1.1.

**Files:** `docs/routines/repair-scanner-prompt.md`, IronClaw DB (`routines` table).

**Size:** M.

### T1.4 — Repair-scanner setup doc

**Description:** Author `docs/routines/repair-scanner-setup.md`, the operator-facing setup recipe (parallel to `cron-setup.md`). Includes prerequisites, registration command, verification, troubleshooting.

**Acceptance criteria:**
- Doc structure mirrors `cron-setup.md` sections: Status, Prerequisites, Setup steps, Operational notes, Known limits.
- Setup steps are copy-paste runnable: extract prompt → `ironclaw routines create` with the right flags.
- Operational notes include the cadence-tuning guidance from the spec.
- Cross-link from `docs/routines/README.md` to the new doc.

**Verification:**
- `npm run format:check` passes.
- A fork user can follow the doc and register their own scanner without consulting the spec.

**Dependencies:** T1.3.

**Files:** `docs/routines/repair-scanner-setup.md`, `docs/routines/README.md`.

**Size:** S.

### T1.5 — End-to-end repair flow against accumulated half-states

**Description:** Empirically verify the meta-repair cycle on the three known stuck issues (`MultiAgency/kanban#21`, `#22`, `#38`). Each must reach either CLOSED (strategies 1 or 2) or `human-attention` (strategy 3) without manual cleanup beyond observing.

**Acceptance criteria:**
- Within two scanner cycles (60 minutes wall-clock max), each of #21/#22/#38 has an open repair issue filed by the scanner.
- Within two `kanban-tick` or webhook cycles after that, each repair issue closes with a posted handoff that names the chosen strategy.
- Each original issue ends in CLOSED state OR carries `human-attention`.
- No issue accumulates a second repair issue (idempotency check held).

**Verification:**
- `gh issue view 21 / 22 / 38` shows final state.
- `gh issue list -R MultiAgency/kanban --label skill:repair --state closed` lists three repair issues with handoff comments referencing strategy choice.

**Dependencies:** T1.1, T1.2, T1.3.

**Files:** none (operational verification).

**Size:** M (mostly observation time).

### Checkpoint: Phase 1 complete

- [ ] All Phase 1 tasks accepted.
- [ ] #21, #22, #38 each resolved to CLOSED or `human-attention`.
- [ ] No regressions: `npm test` + `npm run lint` + `npm run typecheck` + `npm run format:check` all green.
- [ ] **Ship-eligibility:** v0.1.x can tag at this checkpoint with Phases 2–3 marked as future patches.

## Phase 2: Telemetry write path

### T2.1 — `fire_outcomes` table schema + telemetry doc

**Description:** Apply the schema from the spec to `~/.ironclaw/ironclaw.db` and document the table's purpose, columns, and consumers in a new `docs/telemetry.md`.

**Acceptance criteria:**
- `sqlite3 ~/.ironclaw/ironclaw.db "SELECT sql FROM sqlite_master WHERE name='fire_outcomes'"` returns the spec's exact CREATE TABLE statement plus both indexes.
- `docs/telemetry.md` describes: purpose (observational vs comparative), column-by-column semantics, write-path (polling writer, migration plan to `OnSessionEnd` hook), retention status (open question).

**Verification:**
- `npm run format:check` passes.
- Schema-published in the doc matches the live `~/.ironclaw/ironclaw.db` schema.

**Dependencies:** None (independent of Phase 1).

**Files:** `docs/telemetry.md`, IronClaw DB schema.

**Size:** S.

### T2.2 — `scripts/telemetry-writer.mjs` polling writer

**Description:** Implement the external polling writer that watches `routine_runs` for newly finished runs and writes one `fire_outcomes` row per run. Computes outcome fields from `conversation_messages` (tool-call count, handoff comment presence, etc.) and the linked GitHub issue (closed cleanly?).

**Acceptance criteria:**
- `node scripts/telemetry-writer.mjs --once` does a single pass and exits zero.
- `node scripts/telemetry-writer.mjs --watch` polls at a configurable interval (default 60s) and writes new rows continuously.
- Idempotent: re-running over a `routine_run` that's already been recorded does not duplicate the row (UNIQUE constraint on `conversation_id` + UPSERT, or pre-check).
- Handles the webhook substrate's HTTP-channel conversations (where there's no `routine_run` row) by also polling `conversations.channel='http'`.
- `npm run telemetry-writer` script added.

**Verification:**
- After a kanban-tick fires, `--once` produces one new row in `fire_outcomes` with sensible values for all columns.
- Re-running `--once` immediately produces zero new rows (idempotency).
- `npm run lint` + `npm run format:check` pass.

**Dependencies:** T2.1.

**Files:** `scripts/telemetry-writer.mjs`, `package.json`.

**Size:** M.

### T2.3 — Telemetry-writer launch + verification

**Description:** Run the writer continuously (launchd job or background `nohup`) and accumulate at least 20 rows across recent and ongoing fires. Document the operator setup in `docs/telemetry.md`.

**Acceptance criteria:**
- Writer process running continuously, not exiting on transient errors (rate limit, network blip).
- `sqlite3 ~/.ironclaw/ironclaw.db "SELECT COUNT(*) FROM fire_outcomes"` ≥ 20.
- Each row's `model_id`, `closed_cleanly`, `handoff_valid` columns are populated correctly (sample 5 rows manually and verify against ground truth in `conversation_messages` + GitHub state).

**Verification:**
- Manual sample check.
- `docs/telemetry.md` has the operator-launch instructions section.

**Dependencies:** T2.2.

**Files:** `docs/telemetry.md` (extend).

**Size:** S.

### Checkpoint: Phase 2 complete

- [ ] All Phase 2 tasks accepted.
- [ ] Telemetry accumulating in real time.
- [ ] **Ship-eligibility:** v0.1.x is fully ready to tag with Phases 1+2; Phase 3 may follow as v0.1.1.

## Phase 3: Synthetic benchmark

### T3.1 — Test corpus definition + setup

**Description:** Define a 10-issue test corpus at `tests/benchmark/corpus.yaml` spanning the canonical skill labels and a range of body shapes. Implement `scripts/setup-benchmark.mjs` to apply the corpus to `MultiAgency/test` (or a fork-specified test repo), idempotently.

**Acceptance criteria:**
- `tests/benchmark/corpus.yaml` has 10 entries, schema documented in the file header.
- Each entry has: title, body, `skill:*` labels, expected-output-shape (ADR / research / file commit / comment).
- `node scripts/setup-benchmark.mjs --repo MultiAgency/test` creates the 10 issues, or updates them in place if they already exist (title-as-uniqueness-key, same pattern as `push-roadmap.mjs`).

**Verification:**
- `gh issue list -R MultiAgency/test --label ready --label agent-eligible` lists the 10 corpus issues.
- Re-running the setup script produces zero new issues (idempotency).

**Dependencies:** None (independent of T2.x for setup, but benchmarks against telemetry from T2).

**Files:** `tests/benchmark/corpus.yaml`, `scripts/setup-benchmark.mjs`, `package.json`.

**Size:** M.

### T3.2 — `scripts/bench-models.mjs` runner

**Description:** Implement the benchmark runner. Cycles through a configured model list; for each model, resets each corpus issue to `ready`, triggers the substrate, waits for the fire to complete (polls `fire_outcomes`), records the outcome model-tagged.

**Acceptance criteria:**
- `npm run bench-models -- --models 'a,b' --repo MultiAgency/test` runs end-to-end.
- For each `(model, issue)` pair, exactly one row lands in `fire_outcomes` with `model_id` set correctly.
- Rate-limit and timeout errors are caught per fire — bench continues with subsequent fires rather than aborting.
- Output: writes a summary line per fire (model, issue, outcome) to stdout.

**Verification:**
- Run with `--models gpt-oss-120b,gpt-oss-120b` (same model twice) and verify 20 rows land (10 per pass).
- Run with `--models gpt-oss-120b` against 3 issues; manually confirm via GitHub that each issue ended in its declared expected-output-shape.

**Dependencies:** T2.2 (writer must be running for fire_outcomes to populate), T3.1.

**Files:** `scripts/bench-models.mjs`, `package.json`.

**Size:** L.

### T3.3 — `scripts/report-fires.mjs` comparison report

**Description:** Read `fire_outcomes`, emit a markdown comparison table per the spec's example shape. Filters by date range, optionally by model list, optionally by repo.

**Acceptance criteria:**
- `npm run report-fires -- --since 2026-05-01 --format markdown` produces the spec's table shape.
- Column values computed correctly (closed-cleanly percentage, handoff-valid percentage, repair-filed percentage, avg duration).
- Returns non-zero exit on no matching rows (so operators notice empty queries instead of seeing a blank table).

**Verification:**
- Run against ≥20 accumulated rows; output renders cleanly in GitHub Markdown preview.
- Run with `--since` far-future; exit non-zero with informative message.

**Dependencies:** T2.3 (needs accumulated rows).

**Files:** `scripts/report-fires.mjs`, `package.json`.

**Size:** M.

### T3.4 — End-to-end comparative benchmark

**Description:** Run the benchmark against `openai/gpt-oss-120b` and one alternative (per success criterion #3); produce the comparison report; commit the report markdown as `docs/benchmark/2026-MM-DD-results.md` (date-headed per the CHANGELOG-exception clause for date-bearing artifacts).

**Acceptance criteria:**
- Benchmark completes with ≥10 fires per model (one per corpus issue).
- Report renders cleanly and shows a meaningful per-model differential (or honest "models perform comparably" if that's the truth).
- Committed report doc dated.

**Verification:**
- `gh repo view MultiAgency/kanban --json defaultBranchRef` confirms the docs file landed on main.
- Report numbers reproducible by re-running `report-fires.mjs` against the same `fire_outcomes` rows.

**Dependencies:** T3.1, T3.2, T3.3.

**Files:** `docs/benchmark/YYYY-MM-DD-results.md`.

**Size:** M (operator-time + waiting on fires).

### Checkpoint: Phase 3 complete

- [ ] All Phase 3 tasks accepted.
- [ ] Benchmark report committed.
- [ ] v0.1.x ready to tag with the full deliverable set.

## Phase 4: Ship v0.1.x

### T4.1 — CHANGELOG v0.1.x entry

**Description:** Write the v0.1.x release entry. Per the cohesive-release-narrative discipline: present meta-repair, telemetry, and benchmark as one unified release; include the empirical outcomes (half-states cleared, telemetry rows accumulated, benchmark numbers). Fold in `follow_ups` from Phase 0.

**Acceptance criteria:**
- `CHANGELOG.md`'s `[Unreleased] — v0.1.x` block updated with the unified narrative.
- "What's new for fork users" section covers all four deliverables.
- Empirical outcomes documented (no aspirational language).
- The v0.1.1 entry from earlier in this session is folded into the v0.1.x narrative or kept separate, depending on whether v0.1.1 was tagged independently.

**Verification:**
- `npm run format:check` passes.
- Manual read against the release-narrative memory's discipline.

**Dependencies:** Phase 1, Phase 2 minimum; Phase 3 if shipping the full deliverable.

**Files:** `CHANGELOG.md`.

**Size:** S.

### T4.2 — Tag + release

**Description:** Tag the release and move the floating `v0` tag.

**Acceptance criteria:**
- `git tag v0.1.x` and `git push origin v0.1.x` succeed.
- `v0` floating tag moved to the same commit.
- GitHub release notes extracted from CHANGELOG.

**Verification:**
- `gh release view v0.1.x` shows the release.
- `git tag -l v0` resolves to the release commit.

**Dependencies:** T4.1, and the final Phase decision (1 only, 1+2, or 1+2+3).

**Files:** git tags + GitHub release.

**Size:** S.

## Dependency graph (visual)

```
T1.1 ──┬─→ T1.2 ─┐
       │         ├─→ T1.5 ──→ (Phase 1 checkpoint)
       └─→ T1.3 ─┤
            │    │
            └─→ T1.4
                                                   │
T2.1 ──→ T2.2 ──→ T2.3 ──→ (Phase 2 checkpoint) ──┴─→ T4.1 ──→ T4.2
                            │
T3.1 ──┐                    │
        ├─→ T3.2 ──┐         │
T2.2 ──┘           │         │
                   │         │
T2.3 ──→ T3.3 ─────┤         │
                   │         │
                   └─→ T3.4 ─┴─→ (Phase 3 checkpoint)
```

T1.* and T2.* / T3.1 can proceed in parallel — they share no source files. T2.2 is the convergence point for benchmark work (the writer must exist before the benchmark can rely on `fire_outcomes`).

## Risks and mitigations

| Risk                                                                                                          | Impact                                | Mitigation                                                                                                       |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Repair-scanner prompt leaks placeholder markers into filed issues (F26 — literal-template prompt design)       | Scanner files cruft repair issues     | Revised F26 prompt structure (prose params, no literal templates; worked-example revision in progress) + `no-cruft.yml` CI gate |
| Scanner+webhook race: scanner files repair while webhook agent is mid-flight                                  | Unnecessary repair issue              | 15-min last-activity threshold (defensible per spec); strategy-1 idempotent close handles the no-op case cleanly |
| Telemetry writer drift from `routine_runs` schema in a future IronClaw release                                | Writer breaks silently                | Named-column inserts only; ALTER TABLE tolerance for added columns; pin IronClaw version in CI                   |
| Benchmark exhausts NEAR AI API quota mid-run                                                                  | Partial corpus run                    | Per-model rate-limit catch; record-as-skipped pattern in `fire_outcomes.notes`                                   |
| `gpt-oss-120b` is too unreliable on repair work; many repairs themselves stall and hit the 2-hour escalation  | All half-states surface as `human-attention` | Telemetry will surface this immediately; operator can switch model via Phase 3 data; v0.2 model-selection track  |

## Open items needing answer before Phase 1 starts

- None at task-breakdown time. The spec's open questions (corpus size, telemetry retention, multi-agent role partitioning, v1 forward-compat) all resolve in-flight or post-ship; none block T1.1.
