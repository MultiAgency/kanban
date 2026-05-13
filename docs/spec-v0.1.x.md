# SPEC: v0.1.x — substrate hardening

> Companion to `SPEC.md`. v0 ships the convention; v0.1.x hardens the autonomous loop so it stays running. v1 ships the hosted application; this spec is not for v1.

## Objective

Make the autonomous loop reliable enough to run unattended over a real backlog. Two deliverables, ranked:

**Primary deliverable: meta-repair eliminates half-state accumulation.** Today fork users hit operational pain when an issue stalls mid-cycle (claim ritual incomplete, work committed but handoff missing, etc.). The substrate must detect these and use itself to repair them. Without this, every fork running the substrate accumulates broken state over time. v0.1.x does not ship if meta-repair does not ship.

**Secondary deliverable: model telemetry + synthetic benchmark enable model-choice decisions.** Per-fire outcomes are recorded against the model that ran the fire. A synthetic benchmark exercises configured models so substrate operators have data when they choose which model to run. Valuable but less urgent than meta-repair — answers a decision-support problem, not an operational one. v0.1.x can ship without the benchmark complete if meta-repair is solid and telemetry has at least basic write-path coverage.

Neither subsystem changes the convention's six rules. Both are additive to v0's contract.

Success: a fork user can leave their `kanban-tick` cron running unattended for a week. Half-states clear themselves (or surface as `human-attention` if they're truly stuck), and at any point the operator can read a markdown report of which model is producing the most successful end-to-end fires on their backlog.

## Scope

### In scope

- A `kanban-repair-scanner` IronClaw routine that detects half-states and files repair issues using the existing convention.
- A new `skill:repair` capability label and a `human-attention` canonical label.
- A small extension to the `kanban-worker` SKILL teaching agents how to handle repair issues.
- A `fire_outcomes` table in `~/.ironclaw/ironclaw.db` populated on each routine or webhook fire.
- A `scripts/bench-models.mjs` runner that exercises a configured model list against a seeded test backlog.
- A `scripts/report-fires.mjs` script that emits a markdown comparison table from accumulated telemetry.

### Out of scope (and where they go)

- **Per-routine model override in IronClaw.** Required for clean comparison runs; tracked as an upstream PR against `nearai/ironclaw`. The benchmark script works around the gap by reconfiguring the daemon's `selected_model` between runs.
- **GitHub-side scheduled scanner.** A `.github/workflows/repair-scanner.yml` is plausible for fork users who don't run IronClaw locally, but v0.1.x assumes the IronClaw daemon is the scanner host. Externalizing the scanner to a GitHub Action is v0.2 or v1.
- **Repair strategies beyond the three named below.** Agents may invent richer recovery paths, but the spec fixes the three baseline strategies so the scanner output is interpretable.
- **The v1 hosted application.** v1 reads the same `fire_outcomes` data and the same repair-issue artifacts, but its own product features (real-time presence, dependency-graph visualization, etc.) live in the v1 spec.

### v1 forward-compatibility

Four design choices in v0.1.x affect what v1 inherits. Naming them now so v0.1.x doesn't accidentally hard-code a constraint v1 needs to undo. Resolution stays at v1-design-time except where noted.

1. **Is the `fire_outcomes` schema a v1 contract?** v0.1.x ships the schema in `~/.ironclaw/ironclaw.db`. v1 (hosted app) plausibly reads the same shape — same columns, same semantics. If the answer is yes at v1 time, the schema as drafted in this spec becomes a contract; column additions stay additive forever. Resolution: schema is published in this spec as candidate-stable. v1 design must confirm or reshape; either path is supported by the additive-only rule.
2. **Does meta-repair extend to multi-tenant v1?** v0.1.x runs one scanner per IronClaw daemon, scoped to whatever repos that daemon's PAT can see. v1 hosted potentially serves N tenants, each with their own scanner-scope. v0.1.x's scanner doesn't assume single-tenant in its prompts, but does assume one DB per scanner. Resolution: defer; v0.1.x ships single-tenant scanner; v1 design adds a `tenant_id` column to `fire_outcomes` and similar partitioning if needed.
3. **Is `skill:repair` operator-installed or auto-bootstrapped?** v0.1.x asks fork users to add `skill:repair` to their `.github/labels.yml` at setup. Cleaner ergonomics: the scanner auto-creates the label on first run if absent. Resolution: this spec ships with operator-installed (manual). v0.2 or v1 may auto-create to reduce setup footprint.
4. **Federated vs centralized fire-outcome aggregation in v1.** v0.1.x writes to local SQLite. v1 hosted app needs cross-fork-user visibility — either pulls from each fork's IronClaw DB (federated, latency-tolerant) or aggregates to a central store (centralized, lower-latency). v0.1.x's polling writer is local-only. Resolution: defer to v1 design; the polling writer can be extended with a `--export-to <url>` flag at that time without breaking the local-only path.

## Convention extensions

Additive to `SPEC.md`. Nothing existing is changed.

### New canonical labels

```
skill:repair       — agent declares it can handle half-state repair issues
human-attention    — auto-repair exhausted; HARD veto for all agents until human removes it
```

Both go into `.github/labels.yml` and the fork-setup recipe.

`human-attention` is a **hard veto**, semantically symmetric with `human-only` but auto-applied by the scanner rather than human-applied at issue creation. Concrete semantics:

- The `kanban-worker` eligibility check excludes any issue carrying `human-attention`. This is a Rule 6 sub-condition; the SKILL.md amendment names it explicitly.
- The `kanban-repair-scanner` eligibility filter excludes any issue carrying `human-attention`. The scanner does not re-attempt repair on a human-attention issue.
- The label is removed only by human action: a human edits the label off, closes the issue manually, or transitions it back to `ready` after fixing the underlying problem.

Soft semantics ("agents skip but next scanner pass might pick up again") were considered and rejected. The label's purpose is to mark "auto-repair gave up"; a soft signal would let the next scanner pass attempt repair anyway, contradicting the meaning.

### Repair-issue body template

When the scanner files a repair issue, the body follows this shape so `kanban-worker` agents recognize it:

```
**Repair target:** [#{N}](https://github.com/{owner}/{repo}/issues/{N})

**Stuck pattern:** {one of: incomplete-claim | unposted-handoff | unclosed-after-handoff}

**Evidence:**
- assignees: [...]
- labels: [...]
- last_activity: {ISO-8601 timestamp}
- existing commits referencing #{N}: [...]
- handoff comment present: {yes|no}

**Allowed strategies (pick one):**
1. **Complete the cycle.** Apply whichever remaining ritual steps are missing on #{N}. Post the handoff comment, close the issue.
2. **Reset to ready.** Remove `in-progress` and assignee from #{N}; restore `ready`; post a one-line comment on #{N} explaining the reset.
3. **Escalate.** Add `human-attention` to #{N}; close this repair issue with a handoff explaining why neither (1) nor (2) was appropriate (e.g., commit landed at wrong path, conflicting handoff drafts, etc.).
```

The reference to `#N` is a plain markdown link rather than a parser-anchored `- [ ] #N` checklist. The repair issue is *about* `#N`, not blocked-on `#N` — the work completes whether or not `#N` ever closes (strategies 2 and 3 don't close `#N`). Using the checklist syntax would tag the repair issue as `blocked` via the dependency-promotion Action and remove it from the `ready` pool, defeating the scanner-files → next-tick-claims flow.

Repair issues land as `ready` + `agent-eligible` + `skill:repair`, with no dependency declaration.

### SKILL.md extension

`kanban-worker` SKILL gets a new subsection (~10 lines): "Handling repair issues." Teaches the agent to recognize the `**Repair target:**` pattern, read #N's state, pick a strategy, and execute. No new convention rules; just a recipe for a particular issue shape.

## Meta-repair design

### Scanner

A new IronClaw cron routine `kanban-repair-scanner` fires on a slow cadence (`0 */30 * * * *` = every 30 minutes). Its prompt is procedurally explicit, like `cron-tick-prompt.md`. The prompt directs the agent to:

1. List open `agent-eligible` issues with `in-progress` label (the half-state surface).
2. For each, check three conditions to classify the stuck pattern:
   - **incomplete-claim**: `ready` and `in-progress` both present (step 3c failed)
   - **unposted-handoff**: assignee set, `in-progress` set, no comment containing a ```handoff``` fence, last activity > 15 min
   - **unclosed-after-handoff**: handoff comment exists with valid fence, but issue still open and `in-progress` still set
3. For each classified half-state where no open repair issue already targets it (idempotency: search for `**Repair target:**` referencing `#{N}` in open issues), file a repair issue per the body template above.
4. Exit. The repair work happens on the next `kanban-tick` or via the webhook substrate when someone toggles the repair issue's `ready` label (no-op since it's already ready).

The taxonomy is fixed at three patterns because they map cleanly to the three failure points of the convention pipeline: claim ritual (incomplete-claim), work execution (unposted-handoff), and close step (unclosed-after-handoff). If telemetry reveals failure modes that don't fit, v0.2 can extend the taxonomy; v0.1.x ships with three.

**Why `*/30` cadence and 15-min last-activity threshold.** Webhook-fired agents reach the claim ritual within seconds of label-add and typically post the handoff comment within 60–120s; a 15-min last-activity window is comfortably outside the active-work envelope, so the scanner won't misclassify an in-flight webhook fire as stuck. Cron-fired agents under `*/5` cadence run on similar timescales (1–3 min per fire). A `*/30` scanner cadence means at most one repair-issue-file per stuck state per 30 minutes, which keeps repair-issue volume low even on a noisy substrate. Fork users on very slow repos (agents take 10+ min per fire) should widen the threshold to 30+ min; fork users on very fast repos (sub-minute fires) can tighten to 5 min without false positives.

### Repair execution

A `kanban-worker` agent picks up the repair issue through the normal eligibility check. The agent reads the repair body, applies the corresponding strategy on `#N`, and posts a handoff on the repair issue (not on `#N` — `#N` is the target, the repair issue is the work).

For strategy 1 (complete the cycle), the agent also posts a handoff comment on `#N` and closes it. This means strategy 1 closes two issues per fire.

For strategy 3 (escalate), the agent adds the `human-attention` label to `#N`. The next scanner pass sees `human-attention` and skips `#N` per the hard-veto semantics in Convention extensions. The label is removed only by human action.

### Repair-of-repair bounds

If a repair issue itself stalls (gpt-oss-120b is also fallible on repair work), the next scanner pass would file a meta-repair on the repair. Two structural bounds prevent unbounded recursion:

- The scanner's eligibility filter excludes any issue with `**Repair target:**` in its body (don't file repairs on repairs).
- A repair issue stalled for > 2 hours gets `human-attention` auto-applied. Per the hard-veto semantics, that issue is then permanently invisible to both the scanner and the kanban-worker until a human removes the label.

### Labels added at this layer

- `skill:repair` — set on repair issues at creation. Agents with `skill:repair` in their installed-skills set claim repair work; others skip.
- `human-attention` — auto-applied to issues whose repair attempts exhausted.

## Telemetry: `fire_outcomes` table

### Schema

```sql
CREATE TABLE fire_outcomes (
  id              TEXT PRIMARY KEY,         -- UUID
  conversation_id TEXT NOT NULL,            -- FK to conversations.id
  routine_id      TEXT,                     -- FK to routines.id; NULL for webhook fires
  trigger_type    TEXT NOT NULL,            -- 'cron' | 'webhook'
  model_id        TEXT NOT NULL,            -- e.g., 'openai/gpt-oss-120b'
  issue_number    INTEGER,                  -- the kanban issue worked on; NULL if none
  started_at      TIMESTAMP NOT NULL,
  ended_at        TIMESTAMP NOT NULL,
  duration_ms     INTEGER NOT NULL,
  tool_call_count INTEGER NOT NULL,
  closed_cleanly  INTEGER NOT NULL,         -- 0 or 1: did the issue reach state=closed?
  handoff_valid   INTEGER NOT NULL,         -- 0 or 1: did parseHandoff succeed on the posted comment?
  repair_filed    INTEGER NOT NULL,         -- 0 or 1: was a repair issue filed against this fire's target later?
  notes           TEXT                      -- free-form, e.g., last error message
);
CREATE INDEX fire_outcomes_model_idx ON fire_outcomes(model_id);
CREATE INDEX fire_outcomes_started_idx ON fire_outcomes(started_at);
```

### Write path

After each fire's agent conversation closes (whether through clean issue closure or timeout), an IronClaw hook writes one row. The hook fires regardless of outcome — partial fires record `closed_cleanly=0`. The `repair_filed` column is updated retroactively by the scanner when it files a repair targeting this fire's `issue_number`.

`repair_filed` retroactivity is acceptable because the metric is for offline analysis (reports run on accumulated data); there's no read-after-write ordering requirement.

### Hook implementation

Three candidate placements:

1. **IronClaw-internal `OnSessionEnd` hook** — requires upstream PR per the existing F29 thread. Best long-term, longest path to ship.
2. **External SQLite writer driven by `routine_runs` polling** — a small script that polls `routine_runs` for new finished runs and computes the outcome from `conversation_messages`. Ships immediately, doesn't require upstream changes.
3. **Agent-side write via a new tool** — agent calls a `record_fire_outcome` tool as its last action. Brittle (depends on agent doing it correctly).

v0.1.x ships option (2): polling writer at `scripts/telemetry-writer.mjs`, runnable as a launchd job or cron tick. Option (1) is filed as an upstream PR. Option (3) is rejected.

**Migration path.** v0.1.x ships option (2). v0.2 or v1 migrates to option (1) once the upstream `OnSessionEnd` hook lands in `nearai/ironclaw`. The `fire_outcomes` schema is identical across both write paths — only the writer changes. At migration time, `scripts/telemetry-writer.mjs` can be deleted; existing rows remain valid; the hook fires inline at session-end rather than via polling. No data migration needed.

## Synthetic benchmark

Telemetry and benchmark answer different questions and are not redundant:

- **Real-fire telemetry (`fire_outcomes` table) — observational.** "How is my current model doing on my actual backlog?" Each row records one fire's outcome under whatever model the operator had configured at that moment. Telemetry accumulates passively over time. It cannot directly compare models because each fire runs only one model on one issue.
- **Synthetic benchmark — comparative.** "Should I switch models? Which alternative would be better than my current?" The benchmark runs a fixed corpus across multiple configured models, holding the issue set constant so the only varying dimension is the model. Comparable rows in `fire_outcomes` are produced in a single run; the comparison report joins them.

Both write to the same `fire_outcomes` table. The benchmark is the controlled experiment; the telemetry is the production observation. v0.1.x ships both.

### Test corpus

Seed `MultiAgency/test` with a fixed set of 10 representative kanban issues spanning the canonical skill labels and a range of body shapes (ADR-style, research-style, file-commit, comment-only). The corpus is versioned at `tests/benchmark/corpus.yaml` and reproducibly applied via a setup script.

### Runner: `scripts/bench-models.mjs`

```
npm run bench-models -- --models 'gpt-oss-120b,claude-sonnet-4-6' --repo MultiAgency/test
```

For each model in the list:

1. Set IronClaw's `selected_model` (via `ironclaw config set`; restart not required if the daemon re-reads on next conversation).
2. For each issue in the corpus:
   - Reset the issue to `ready` (`gh issue edit` to add `ready`, remove `in-progress` / `agent-eligible` if reset).
   - Trigger the webhook substrate (toggle `ready` to re-fire).
   - Wait for the fire to complete (poll `fire_outcomes` for a new row matching `model_id` and `issue_number`).
   - Record the outcome row.
3. After all models, emit a markdown comparison table.

### Comparison report: `scripts/report-fires.mjs`

```
npm run report-fires -- --since 2026-05-01 --format markdown
```

Output:

```markdown
## Fire-outcome comparison

Range: 2026-05-01 .. 2026-05-13 (12 days)

| Model                | Fires | Closed cleanly | Handoff valid | Repair filed | Avg duration |
| -------------------- | ----- | -------------- | ------------- | ------------ | ------------ |
| openai/gpt-oss-120b  |    47 |      29 (62%)  |     31 (66%)  |    18 (38%)  |        62s   |
| claude-sonnet-4-6    |    10 |      10 (100%) |     10 (100%) |     0  (0%)  |        38s   |
```

The report is committed nowhere (just printed). Operators run it on demand.

## Success criteria

The v0.1.x release ships when:

1. Half-states accumulated on `MultiAgency/kanban` (#21, #22, #38 and any new ones) are cleared by the scanner-driven repair flow within two scanner cycles, with handoffs posted on the repair issues documenting which strategy was chosen.
2. `fire_outcomes` table has at least 20 rows accumulated across both `kanban` and `test` repos, written by the polling writer without manual intervention.
3. `scripts/bench-models.mjs` runs the 10-issue corpus against `openai/gpt-oss-120b` and at least one alternative model end-to-end, producing a comparison table.
4. The `scripts/report-fires.mjs` output matches the schema above and renders cleanly in GitHub Markdown.

Failing acceptance: a half-state that the scanner attempted to repair and got stuck on — without escalating to `human-attention` — is a v0.1.x release blocker.

## Failure modes considered

- **Scanner fires while a webhook fire is mid-flight.** The webhook agent has the assignee set and `in-progress` label within seconds; the scanner's 15-min last-activity threshold prevents premature classification (webhook fires complete in 60–120s, comfortably inside the window). Worst case: the scanner files a repair on an issue the webhook agent is about to close in 20s; the repair issue surfaces a moment later and is itself unnecessary work, which a `kanban-worker` agent then claims and resolves as a no-op via strategy 1's idempotent check (handoff already posted, just close). Mitigation if observed empirically: bump threshold to 30 min in the routine prompt config.
- **Repair issue is itself stuck on a hallucinating model.** Covered by the repair-of-repair bounds: scanner doesn't recurse, and a 2-hour-stuck repair gets `human-attention` per the hard-veto semantics.
- **Multiple agents collide on a repair issue.** v0.1.x assumes one agent per substrate has `skill:repair` installed; a fork user running multiple agents with `skill:repair` could see concurrent claim attempts. The existing concurrent-claim race protocol (SPEC §Deferred to v0.1 #3) applies — GitHub serializes assignee writes; the second agent sees the post-first-call assignee state and skips. Cost is one wasted work unit per occurrence.
- **Benchmark exhausts API quota mid-run.** Bench script catches rate-limit errors per model, marks remaining-corpus rows as `skipped`, continues with next model. Partial runs are still informative.
- **`fire_outcomes` schema evolves.** New columns added via `ALTER TABLE`; the polling writer tolerates extra columns gracefully (named-column inserts only). No row migrations.
- **Model swap mid-corpus run** (operator changes `selected_model` while bench is running). Bench script reads `selected_model` per-fire from `fire_outcomes.model_id`, so the comparison stays honest even if the operator interferes.

## Open questions

1. **Should the repair issue be `agent-eligible` by default?** Recommended: yes. The whole point is auto-repair. A fork user wanting human-driven repair removes `agent-eligible` from `skill:repair` issues in their setup script.
2. **Benchmark corpus size.** Ships at 10 issues. After the first benchmark run completes, evaluate whether the signal-per-model is strong enough to inform a model-switch decision. Too few (e.g., 5) means weak per-model signal; too many (20+) burns API quota with diminishing returns. Treat 10 as a starting hypothesis, not a designed-in commitment; adjust based on observed signal quality.
3. **Telemetry retention.** SQLite grows unbounded over time. v0.1.x ships without retention; v0.2 may add a `vacuum-fires.mjs` that drops rows older than N days.
4. **Multi-agent role partitioning.** v0.1.x assumes one IronClaw agent has both `kanban-worker` and `skill:repair` installed. Fork users running multiple agents may want partitioning (e.g., one agent claims work issues, a different agent claims repair issues). The convention's skill-coverage check already supports this (agents with `skill:repair` claim repair issues; agents without skip). Whether to add explicit guidance for the multi-agent fork-user case in setup docs is open; v0.1.x ships single-agent assumption without forbidding multi-agent.
5. **v1 forward-compat (see Scope subsection above).** Four questions worth flagging back to the v1 spec author: `fire_outcomes` schema as v1 contract; multi-tenant scanner scope; auto-bootstrap of `skill:repair` label; federated-vs-centralized fire-outcome aggregation. v0.1.x makes provisional choices; v1 design ratifies or revises.

## Deferred to v0.2

- `OnSessionEnd` hook upstream PR (ships telemetry writer as polling external script in v0.1.x).
- Per-routine model override upstream PR (manual `selected_model` flips in v0.1.x).
- GitHub-Action-based external scanner for fork users who don't run IronClaw locally.
- Self-tuning repair strategies (the agent learns which strategy works best per stuck pattern — currently the agent picks at-fire-time without memory).
- v0.1.x → v0.2 graduation criteria.
