# PLAN: MultiAgency/kanban v0

> Implementation plan for the v0 deliverables defined in `SPEC.md`. Phase 2 of spec-driven development. Phase 3 task breakdown lives in `TASKS.md`.

## Overview

Eight implementation waves. Items within a wave run in parallel; later waves depend on earlier ones. Wave 0 includes a tracer-bullet IronClaw install whose written outcome de-risks Waves 6–7. Wave 5-pre is a roadmap-authoring session that produces the substantive seed-issue text Wave 5 pushes — without it, the v0 demo session (Wave 7) silently misses.

## Component waves

### Wave 0 — Foundation

- `package.json` (deps + scripts), `tsconfig.json`, `.prettierrc.json`, `.eslintrc.json`, `.gitignore`
- `LICENSE-MIT`, `LICENSE-APACHE` — clone IronClaw, copy verbatim, including any `NOTICE` or README license clause
- All `npm` scripts wired and runnable on empty source: `build`, `test`, `test:watch`, `lint`, `format`, `typecheck`
- **Tracer-bullet IronClaw install.** Install runtime, authorize GitHub extension against a private test repo, configure a `*/5` cron routine, attempt one trivial agent action against the test repo. Output is a written outcome doc — either "no blockers, ready for Wave 5" or a list of specific blockers with severity. Without this written outcome, the de-risking value evaporates and we discover IronClaw issues at Wave 6.

### Wave 1 — Pure utilities (parallel internals)

- `src/lib/handoff.ts` + `tests/handoff.test.ts` — first ` ```handoff ` fence wins; permissive JSON; null on missing/malformed; trailing prose tolerated
- `src/lib/dependencies.ts` + `tests/dependencies.test.ts` — checklist refs (`- [ ] #N`, `- [x] #N`), closing keywords (case-insensitive, word boundaries), malformed `#abc` skipped, cross-repo `org/repo#N` skipped, dedup. **Body-parsed only.** Native GitHub sub-issue / "Tracked by" relationships are out of scope per SPEC.md Deferred to v0.1 #4 (native sub-issue / "Tracked by" relationships).

### Wave 2 — Action

- `src/action/index.ts` — Octokit, `issues.closed` trigger, find children that link to the closed issue, check parent closure, promote `blocked` → `ready`, error semantics per SPEC §Action error semantics, **idempotent** (no-op if child is already `ready`)
- The Action's parent set comes solely from `parseDependencies(issueBody)` — no native sub-issue API queries
- `npm run build` → `dist/index.js` committed

### Wave 3 — GitHub plumbing

- `.github/labels.yml` — canonical label set per SPEC
- `.github/ISSUE_TEMPLATE/{task,meta,blocker}.yml`
- `.github/workflows/ci.yml` — lint + typecheck + test + **`dist/`-drift check**: `npm run build && git diff --exit-code dist/`
- `.github/workflows/promote-dependencies.yml` is a dual-purpose workflow file declaring both `on: workflow_call` (for downstream forks consuming via `uses: MultiAgency/kanban/.github/workflows/promote-dependencies.yml@v0`) and `on: issues: [closed]` (so upstream's own copy runs natively on this repo's issues). Needs Wave 2's `dist/index.js`; declares `permissions: issues: write, contents: read`
- `action.yml` at repo root publishes the Action as a JS action whose `runs.main` points at `dist/index.js`, enabling forks to consume either path: the reusable workflow above for the full pipeline, or the action directly via `uses: MultiAgency/kanban@v0` for forks composing it differently. Both paths reference the same `dist/index.js` artifact. Matches the `actions/checkout`-style ecosystem pattern and avoids the `actions/checkout + uses: ./` round-trip that adds 3–5s overhead per run.

### Wave 4 — Documentation (parallel; can start now)

- `README.md` — convention for humans, quickstart, links to SKILL.md
- `CLAUDE.md` — short, operational. Names build/test/lint/typecheck commands. Local conventions: named exports only, no default exports; JSDoc on exported functions and types; pure utilities in `src/lib/` (regex parsing, no `@actions/*` imports); Action handler in `src/action/index.ts` is the only place `@actions/*` appears. Pointer to `SPEC.md` as authoritative for everything else.
- `docs/handoff-format.md` — verbatim from SPEC §Handoff comment format + parser-rules table
- `docs/routines/cron.yaml.example` + `reactive.yaml.example` — IronClaw routine YAML
- `skills/kanban-worker/SKILL.md` — six rules verbatim, handoff format with one worked example, claim ritual (Rule 2 atomicity), skill-eligibility check (Rule 6 with `human-only` veto)
- `skills/kanban-worker/README.md` — skill metadata

### Wave 5-pre — Roadmap session

- 2–3 hour session with you (and Claude) drafting ~30–50 v1 application roadmap issues
- Each issue: title, body with acceptance criteria, skill labels, `agent-eligible` where appropriate, dependency links via `- [ ] #N` checklists where applicable
- Output is the literal issue text Wave 5 pushes — not a placeholder list, not stylistically-correct-but-substantively-thin filler
- Without this session, Wave 5 produces seed issues that look right but don't support a real demo; Wave 7 silently fails
- **v1 constraints carried into the roadmap session.** Every issue drafted must respect the ten v1 architectural commitments below. Constraints 8 (no paid-only features) and 9 (GitHub-only integration; no generic plugin architecture) are the most likely to be violated by an over-eager issue author — violations of any of the ten get redrafted, not logged-as-risk-and-proceeded.
  1. **Convention persists.** v1 ships alongside pure-convention deployments; no deprecation path.
  2. **Bidirectional GitHub sync is in v1.** Sync-mode is not a post-launch feature.
  3. **Single-tenant by default.** Multi-tenant is a flag, off until ops explicitly opt in.
  4. **Schema portable SQLite ↔ Postgres.** No features locked to either dialect.
  5. **GitHub OAuth (sessions) + GitHub PAT (API) only.** No NEAR-wallet dependency in v1.
  6. **Handoff format is the v0 spec, byte-identical.** `parseHandoff` is shared between the v0 Action and the v1 app.
  7. **`skill:*` semantics survive intact.** v1 reads/writes them on synced GitHub issues.
  8. **No paid-only features in v1.** Future hosted tier differs only on convenience, never capability.
  9. **GitHub-only integration in v1.** Generic plugin architecture is post-v1, justified only by a real second integration request.
  10. **Handoff format evolves additively.** v1 readers must accept all v0 handoffs; v0 writers must continue producing v0-format output. New fields are optional additions, never required replacements.

### Wave 5 — Bootstrap on GitHub

- Push to `github.com/MultiAgency/kanban` (assumes org exists)
- Mark "Template repository" in repo settings
- **Apply labels to the live repo.** Run a labeler Action (`crazy-max/ghaction-github-labeler` or equivalent) or a one-shot `gh label create` script against `.github/labels.yml`. T1–T4 fail silently without this — workflows run but label transitions no-op.
- Confirm CI green on `main`
- Push the seed issues authored in Wave 5-pre

### Wave 6 — Acceptance tests

Run in order of cost-to-set-up (cheapest first):

- **T2** — Human claim and complete (no IronClaw needed). Fastest signal that conventions hold and labels/templates work.
- **T3** — Dependency promotion (no IronClaw needed). Construct A/B parents and child C with `- [ ] #A` and `- [ ] #B`; close both; observe Action promotes C.
- **T1** — Single agent claim and complete. Needs IronClaw deployed with `kanban-worker` skill + `*/5` cron routine.
- **T4** — Multi-agent handoff. Needs three agent identities (one owner running three agents under different personas, or three owners).

### Wave 6.5 — Release tag

- Tag immutable patch release: `git tag v0.0.1 && git push origin v0.0.1`
- Force the moving major-version tag to point at the patch: `git tag -f v0 v0.0.1 && git push --force origin v0`
- Document this procedure in `README.md` so downstream forks know they can reference `MultiAgency/kanban@v0` for latest-within-major or `@v0.0.1` for stability
- The forced tag is intentional — `v0` always means "latest within v0.x" by design
- **Inert window.** The dual-purpose `promote-dependencies.yml` references `uses: MultiAgency/kanban@v0`, which resolves only after this tag is pushed. From Wave 5 push through Wave 6.5 tag, upstream's own `on: issues.closed` workflow runs but fails to resolve the action — dependency promotion is inert on upstream until v0 is tagged. T6.2 acceptance must run after Wave 6.5; re-tag `v0` if T6.2 surfaces fixes. The alternative (`uses: ./` with checkout, ~3–5s overhead per run) was rejected in T3.4; we pay the timing cost instead.

### Wave 7 — Demo session end state

- One IronClaw agent completes a real v1 issue end-to-end on the tagged release
- Substantive contribution (architecture decision, schema draft, research note, design sketch) — not a synthetic test
- Closed issue with parseable handoff comment from agent assignee
- **Substrate banked: cron.** T7.1 ran via the cron substrate on `MultiAgency/test` in v0.0.1 (see `docs/ironclaw-tracer-outcome.md` Phase 6). T6.4 MVP variant followed the same substrate (issues #4 → #5). Reactive substrate deferred to v0.1 — see SPEC.md §Deferred to v0.1 #6.

### Wave 8 — Reactive substrate (v0.1)

Delivered in v0.1, with one piece partially banked rather than fully proven. The convention is substrate-agnostic; v0.1 wires path 3 via a Cloudflare Worker adapter (`worker/`) fronting IronClaw's HTTP webhook channel. **Transport is empirically verified** (GitHub → Worker → IronClaw `/webhook`, 50–140ms forward latency, 200 OK on every fire visible in the webhook-delivery dashboard for both `MultiAgency/test` and `MultiAgency/kanban`). **Routine dispatch from webhook event to agent invocation is configured but unverified** — `routine_runs` records zero `trigger_type=webhook` fires in this deployment; the existing `kanban-test` webhook routine has placeholder config (`prompt="echo"`, `trigger_config={"path":null,"secret":null}`) and `run_count=0`. The end-to-end closure of `MultiAgency/test#9` (~1m 25s wall-clock label-to-close) referenced in `docs/ironclaw-tracer-outcome.md` Phase 9 was driven by a separate `sandbox`-source agent job (`agent_jobs.id=d9cc4169-...`) that consumed the webhook payload manually, not by a webhook-dispatched routine. v0.1.x work item to close the gap. Per SPEC §Deferred to v0.1 #6, paths 1 and 2 remain not viable:

- **Path 1** — github tool's `handle_webhook` action. Tool itself works, but the action operates on a payload that has to be handed to the agent by some other inbound mechanism. Path 1 collapses into "what underpins it" — there is no standalone path 1.
- **Path 2** — reactive routine `trigger_type: webhook`. **Empirically closed.** `routine_create` accepts the trigger type and stores the routine, but the daemon registers no HTTP route. Direct `POST /hooks/<routine-path>` returns 404; no `Registered ... endpoint` line appears in startup logs for webhook-trigger routines. Runtime support is not implemented in IronClaw v0.28.0.
- **Path 3 (shipped)** — HTTP webhook channel (`POST /webhook` with `{user_id, content}` body, HMAC-signed via `X-Hub-Signature-256` — same scheme GitHub uses outbound) plus a Cloudflare Worker that validates GitHub's signature, translates events into natural-language prompts, and re-signs for IronClaw. The Worker ships at `worker/`; deployment + GitHub-webhook setup documented in `worker/README.md`.

Acceptance criterion partially met: Worker forward latency 50–140ms (substrate-level proof banked). The ~1m 25s wall-clock label-to-close measurement for `MultiAgency/test#9` is true as observation but conflates substrates — the agent work for that closure was driven by a sandbox-source job, not by routine dispatch from the HTTP webhook. See `docs/ironclaw-tracer-outcome.md` Phase 9 honesty correction for the disentangled evidence.

## Dependency graph

```
Wave 0 (scaffold + IronClaw tracer bullet)
  ├── Wave 1 (lib + tests, parallel internals)
  │     └── Wave 2 (action) ── (dist/) ──┐
  │                                       ├── Wave 3 (workflows)
  │                                       │
  ├── Wave 3 (labels, templates, ci.yml — parallel with Waves 1–2)
  │
  └── Wave 4 (all docs in parallel)
                                          │
                                          ▼
                              Wave 5-pre (roadmap session, in parallel with later Wave 4 work)
                                          │
                                          ▼
                              Wave 5 (push, label, seed issues)
                                          │
                                          ▼
                              Wave 6 (T2 → T3 → T1 → T4)
                                          │
                                          ▼
                              Wave 6.5 (release tag)
                                          │
                                          ▼
                              Wave 7 (demo session)
```

## Parallelization

- Wave 1: `handoff.ts` and `dependencies.ts` independently
- Wave 4: all docs
- Wave 3: `labels.yml`, ISSUE_TEMPLATEs, `ci.yml` ship before Wave 2 finishes; only `promote-dependencies.yml` waits on `dist/`
- IronClaw install happens in Wave 0, in parallel with most code work — its written outcome is what Wave 5 keys off
- Wave 5-pre roadmap session is content work; happens in parallel with later Wave 4 docs

## Risks

1. **`dist/`-drift in PRs.** Mitigated by Wave 3's CI check (`npm run build && git diff --exit-code dist/`). No further action.
2. **Concurrent parent-closure events** can cause two failure modes:
   - _Double-promotion._ Mitigated by Wave 2's idempotency requirement (no-op if child is already `ready`).
   - _Missed promotion._ If A and B close within seconds, the Action triggered by A's close may query GitHub before B's close has propagated to read replicas, see B as still-open, and skip. In practice the second-closing parent's Action almost always saves the day — its own trigger event implies the trigger parent is closed, and by the time it queries the first parent, that parent's close has propagated. Real but rare. Mitigation deferred to v0.1 (cache-busting reads or retry-on-not-closed); not a v0 release blocker.
3. **IronClaw-side blockers** discovered late. Mitigated by Wave 0's tracer-bullet install with written outcome.
4. **Seed-issue substance.** Mitigated by Wave 5-pre as a dedicated session.

## Verification checkpoints + gate policy

| After Wave | Check                                                                                                      | Gate |
| ---------- | ---------------------------------------------------------------------------------------------------------- | ---- |
| 0          | `npm install && npm run lint && npm run typecheck` exits 0; IronClaw tracer outcome doc exists             | hard |
| 1          | `npm test` passes; coverage ≥80% on `src/lib/`                                                             | hard |
| 2          | `npm run build` produces no `dist/` diff after clean run                                                   | hard |
| 3          | `actionlint .github/workflows/*.yml` passes; CI green on smoke PR                                          | hard |
| 4          | Every file in SPEC §Project Structure exists; SKILL.md teaches the six rules verbatim                      | soft |
| 5-pre      | Roadmap doc with ≥30 issue drafts, substantive content, dependency links where applicable                  | soft |
| 5          | Repo on GitHub, marked Template; labels installed via labeler; ≥30 seed issues visible; CI green on `main` | hard |
| 6          | T1–T4 all ticked in release PR description                                                                 | hard |
| 6.5        | `v0.0.1` and `v0` tags pushed; release notes published                                                     | hard |
| 7          | Closed v1 issue with agent-authored parseable handoff                                                      | hard |

**Gate policy:**

- **Hard gates (Waves 0–3, 5, 6, 6.5, 7):** mechanically verifiable. Refuse to advance if check fails. Failure means returning to that wave's tasks, not pushing forward with debt.
- **Soft gates (Waves 4, 5-pre):** content-quality checkpoints. Advance is permitted with debt; failed criteria log as new Open Questions in `SPEC.md` and become explicit release blockers tracked in the release PR. This avoids deadlock on prose perfection while keeping content debt visible.
