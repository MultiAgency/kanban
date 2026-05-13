# IronClaw tracer-bullet outcome (T0.4)

**Date:** 2026-05-09
**IronClaw version (start of test):** 0.1.0 (local cargo build, source at `~/Desktop/cage/ironclaw`, built 2026-02-11)
**IronClaw version (after Phase 1 upgrade):** 0.28.0 (rebuilt from upstream/main HEAD `6e6eca77`, build duration 7m 39s on aarch64-apple-darwin)
**Test repo:** [MultiAgency/test](https://github.com/MultiAgency/test) (private)
**Seed issue:** [#1 — Tracer test: write a one-paragraph hello-world response](https://github.com/MultiAgency/test/issues/1) (labels: `ready`, `agent-eligible`, `skill:writing`)
**Inference provider:** _TBD — recorded after Phase 1 onboarding_
**Model:** _TBD_
**Auth method:** PAT (per pre-test decision; see Phase 2)

## Summary

The bullet flew, twice. **Phase 6 / watched-demo:** convention pipeline executed cleanly on `MultiAgency/test` issue #1 — kanban-worker activated, Rule 6 four-condition eligibility check ran, Rule 2 atomic claim ritual executed, agent posted a parseable handoff per `docs/handoff-format.md`, closed the issue. Convention _mechanics_ validated end-to-end on a private repo with real authentication, banking SPEC.md §Acceptance Test Scripts **T1**. **Phase 7 / strict T7.1:** same pipeline ran against a real v1 roadmap issue (#36 RD1) on `MultiAgency/kanban` itself, producing a 15-pain-point synthesis with (a)/(b)/(c)/(d) structure, Findings 11–19 cross-referenced with mechanism-level mitigations, and a final v1-design-implications section. Convention _substance_ validated — the bootstrap-on-itself loop works; an agent produced genuine v1 design input consumable by the next planning session. SPEC.md §Demo session end state criterion #2 banked. Substrate caveat: both demos took the http-tool path with credential injection from the bundled `github` skill, not the github WASM tool (blocked by F18 ABI mismatch, mitigated upstream during this session and bypassed by the agent's own tool selection). The convention proved substrate-portable. **Confidence in v0 ship: high** — Findings 11–19 captured, mitigated in source, or filed as upstream PR candidates. v0.0.1 tagged 2026-05-10 on the strength of T1 + Phase 6 evidence; Phase 7 strengthens the case retroactively and is post-tag evidence available for the v0.0.2 release notes.

## Phase results

### Phase 1 — Install / upgrade

**Severity:** moderate (multiple obstacles, all surmountable; none are blockers for kanban v0 itself)

What worked:

- IronClaw was already installed locally at `~/.cargo/bin/ironclaw` (built from source at `~/Desktop/cage/ironclaw`).
- Source repo had clean working tree and both `origin` (`near-research/ironclaw` fork) and `upstream` (`nearai/ironclaw`) remotes configured.
- Rebuild from `upstream/main` HEAD (`6e6eca77`) compiled cleanly in 7m 39s on aarch64-apple-darwin. Final binary: `ironclaw v0.28.0` at `~/.cargo/bin/ironclaw` (replacing v0.1.3).
- Post-upgrade `ironclaw --help` confirms the expanded subcommand surface: `registry`, `routines`, `skills`, `channels`, `pairing`, `profile`, `service`, `hooks`, `models`, `doctor`, `logs`, `acp`, plus the originals.
- `~/.ironclaw/session.json` and the `channels/` directory carried over from v0.1.0; `ironclaw status` reports the version, session, and 2 wasm channels (discourse, telegram) without complaint.

What didn't:

- Local binary was `v0.1.0` from 2026-02-11 — three months stale, missing every subcommand the docs reference (`skills`, `registry`, `routine`, `secret set`). Only `run`, `onboard`, `config`, `tool`, `mcp`, `memory`, `status` were available. The walkthrough's `ironclaw skills list`, `ironclaw registry install github`, `ironclaw secret set github_token …` commands all fail on v0.1.0.
- Official installer (`curl ... | sh` from docs) returned `there isn't a download for your platform aarch64-apple-darwin`. **No Apple Silicon binary in the published release artifacts.** Forced fallback to `cargo install --path .` from source.
- `ironclaw-update` (the docs' suggested update command) is not in PATH on a cargo-installed setup.
- **Upstream tag `v0.28.0` does not exist** — `Cargo.toml` was bumped via `9e69f22d chore(release): bump ironclaw to 0.28.0` but no git tag was pushed. Latest tag in the upstream repo is `v0.21.0`. First rebuild attempt chained `git checkout v0.28.0 | tail -5 && cargo install ...` — checkout failed silently (pipe absorbed the exit code) and cargo built whatever HEAD pointed at (the fork's stale `v0.1.3`). Recovered by checking out `6e6eca77` (upstream/main HEAD, which sits ~2 months past the v0.28.0 bump) and rebuilding.
- **`DATABASE_URL` is now a hard requirement** in v0.28.0. `ironclaw skills list`, `ironclaw doctor`, and most subcommands fail with `Missing required configuration: DATABASE_URL. Run 'ironclaw onboard' or set DATABASE_URL environment variable`. The pre-test plan ("try existing state first") could not be verified because the v0.1.0 setup had no DB. Re-onboarding (`ironclaw onboard`) is required before skill discovery, routine creation, or any tick can run.
- **`--no-db` flag is advertised but doesn't bypass the DATABASE_URL check.** `ironclaw --no-db skills list` and `ironclaw --no-db config list` both error with the same `Missing required configuration: DATABASE_URL` message. The flag's `--help` description ("Skip database connection (for testing)") implies it should be a workaround for exactly this situation. **Either the flag is broken or the help text is misleading** — file as Finding 7.
- **No `~/.ironclaw/.env` file exists yet** despite `ironclaw status` reporting `Config /Users/jlwaugh/.ironclaw/.env`. Status reports the path the file would live at, not whether it exists. Minor UX papercut — easy to misread as "config file present".
- **Build deps suggest Postgres-only persistence** (`tokio-postgres-rustls`, `deadpool-postgres`, `pgvector`), so the walkthrough's recommendation of "Embedded SQLite (libSQL)" may not be available — the user driving onboarding will see what `ironclaw onboard --step database` actually offers. _TBD: record what database backends are exposed during onboarding._

Mitigation applied / next step required:

- Rebuild succeeded. Source repo restored to `main` branch (no longer detached at `6e6eca77`).
- **Re-onboarding (`ironclaw onboard`) is now the gate to Phases 2+.** This is interactive (prompts for inference provider, model, DB, embedding setup) and must be driven by the user. See "Handoff to user driver" at the bottom of this doc for the exact next steps.

Findings to file: Findings 1, 2, 3, 4, 5, 7 below.

### Phase 1.5 — Subcommand surface mapping (post-upgrade)

For reference by anyone re-running this tracer or writing the kanban-worker onboarding docs. Quick comparison of what the walkthrough/IronClaw docs say vs. what `v0.28.0` actually exposes:

| Walkthrough says                           | v0.28.0 actually has                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `ironclaw secret set github_token TOKEN`   | No top-level `secret` cmd. Use `ironclaw tool auth github` instead.                                            |
| `ironclaw extension list`                  | No `extension` cmd. Use `ironclaw registry list` (and `tool list`).                                            |
| `ironclaw routine` (singular)              | `ironclaw routines` (plural).                                                                                  |
| Routines created only via natural language | Both: agent calls `routine_create`, OR direct CLI `ironclaw routines create --name … --schedule … --prompt …`. |
| 5-field cron expressions (`*/5 * * * *`)   | 6-field cron with seconds (`0 */5 * * * *`) per `routines create --help` example.                              |
| `ironclaw-update` to upgrade               | Doesn't exist on cargo-installed setups; rebuild via `cargo install --path . --force`.                         |

### Phase 2 — GitHub auth

**Severity:** _TBD_

Method chosen: **PAT** (per pre-test decision — lower setup friction than OAuth for the tracer bullet).

PAT scope used: _TBD — record exact scope (`repo` vs fine-grained `Issues: read+write` + `Contents: read`)_

Steps:

- _TBD — record the actual command(s) the new IronClaw version uses to register a PAT. v0.28.0 may use `ironclaw secret set github_token …` per docs, or may have a different verb._
- _TBD — record the test prompt used to verify auth ("Use the GitHub extension to list issues in MultiAgency/test") and whether the agent successfully called `list_issues`._

What worked: _TBD_

What didn't: _TBD_

### Phase 3 — Scratch repo setup

**Severity:** none (completed pre-test)

What worked:

- `MultiAgency/test` repo already existed (private, owner: MultiAgency).
- All 10 convention labels synced via `gh label create … --force` driven by a small node script parsing `.github/labels.yml` with `js-yaml`. Labels created: `ready`, `in-progress`, `blocked`, `agent-eligible`, `human-only`, `skill:research`, `skill:writing`, `skill:translation`, `skill:code`, `skill:review`.
- Seed issue [#1](https://github.com/MultiAgency/test/issues/1) created with `ready,agent-eligible,skill:writing` labels.

What didn't:

- Repo started with only the GitHub default labels (`bug`, `documentation`, etc.) — no convention labels. This is expected for a fresh repo and is exactly what the v0.1 deferred "label sync workflow" item is meant to address. **Worth noting that `gh-label-sync` is not installed by default on this machine; the YAML→`gh label create` script worked but is undocumented.** A finding-grade observation: the README/SPEC should give fork authors a single command for label sync, or v0.1 should ship one.

### Phase 4 — Skill installation

**Severity:** _TBD (file-copy step succeeded; discovery verification gated on re-onboarding — `ironclaw skills list` requires `DATABASE_URL`)_

What worked:

- Created `~/.ironclaw/skills/kanban-worker/` and copied `skills/kanban-worker/SKILL.md` from the working repo into it. File is 6802 bytes; SKILL.md frontmatter parses (yaml validated indirectly via prior `vitest` runs).

What didn't:

- `ironclaw skills list` returned `Missing required configuration: DATABASE_URL`. Skill discovery cannot be verified until the user runs `ironclaw onboard` and the DB is provisioned. _After onboarding, run `ironclaw skills list` and confirm: (a) `kanban-worker` appears, (b) trust = `Trusted` (not `Installed`), (c) activation keywords resolve. Record any frontmatter parsing issues._

### Phase 5 — Routine creation

**Severity:** complete — convention pipeline validated end-to-end via the REPL+http path. Cron-routine registration via `routine_create` was bypassed for the watched demo; the canonical cron path remains a separate verification owed to v0.1.

How the demo was driven: live REPL session in `ironclaw` (no `-m`), with the agent invoking the built-in `http` tool against `api.github.com` carrying explicit `Authorization: Bearer` headers (PAT supplied in the prompt). The github WASM tool was bypassed because Finding 18 blocked its instantiation; the http-tool path proved the convention works against real GitHub state without depending on the WASM substrate.

Findings (from the watched demo and the activation probes leading up to it):

- **Skill activation works.** `kanban-worker` matched on the test prompt and was injected into context: `DEBUG Selected 1 skill(s) for message: kanban-worker; Skill activated skill_name="kanban-worker" skill_version="0.1.0" trust=trusted`. The activation patterns we tuned in `skills/kanban-worker/SKILL.md` (`agent-eligible`, `MultiAgency`, `claim`, `ready`) fire correctly.
- **SKILL.md body injection confirmed.** First-iteration request size was 19,341 input tokens vs. ~1,500 baseline without skill injection — the SKILL.md body lands in agent context as intended.
- **Agent reasoning works against the skill.** The agent followed the SKILL.md guidance and walked the four-condition eligibility AND, the atomic claim ritual, the work step, the structured handoff, and the close — in order, on issue #1 of `MultiAgency/test`.
- **Convention pipeline ran on the http substrate, not the github WASM tool.** Findings 18 + 19 blocked the WASM-tool path; F18 was source-patched mid-session (clean rebuild forcing re-bindgen) but runtime verification of the WASM-tool route was deferred — the demo proceeded via the http tool with explicit Bearer headers. Convention is substrate-agnostic; the WASM-tool path remains an open verification.
- **No SKILL.md-elaboration gap surfaced** — the agent didn't need clarifying prompts or hand-holding once it had the prompt and the http credential.
- **Cron-routine registration deferred.** The demo used live REPL invocation, not a registered cron routine. Verifying `routine_create` + the cron-tick path against the same kanban prompt is the remaining slice for v0.1.

### Phase 6 — Tick execution

**Severity:** complete — convention pipeline executed end-to-end on `MultiAgency/test` issue #1 (T7.1 banked). Substrate caveat per Phase 5: the demo went through the http tool with explicit Bearer auth, not the github WASM tool or a cron routine.

For each step of the eligibility-check + claim-ritual + work + handoff + close pipeline, recording the 2026-05-10 watched demo outcome:

- [N/A] Tick fired on schedule — demo used live REPL, not a cron routine. Cron-tick verification deferred to v0.1.
- [x] Agent listed issues in `MultiAgency/test` and filtered correctly on `ready` + `agent-eligible` + skill labels — issue #1 surfaced with labels `ready, agent-eligible, skill:writing`.
- [x] Agent identified seed issue #1 as eligible (Rule 6 four-condition AND) — explicitly walked all four conditions, all green.
- [x] Agent performed the claim ritual atomically — self-assigned + added `in-progress` + removed `ready`.
- [x] Order of operations on the claim ritual — self-assign first (PATCH issue), then add-then-remove on labels (POST `/labels`, then DELETE `/labels/ready`). Matches the add-then-remove pattern from the kanban Action's `promote()` (Slice 2 of the I1/I2/I3 review fixes).
- [x] Agent did the work described in the issue body — wrote the requested hello paragraph.
- [x] Agent posted a handoff comment — format-valid per `docs/handoff-format.md`: bold one-line summary, fenced ` ```handoff ` JSON block with all four allowed fields and no extras, optional trailing prose tolerated. `parseHandoff()` would return the parsed object cleanly.
- [x] Agent closed the issue — `state=closed`, `state_reason=completed`.

High-signal observations from the demo:

- **Eligibility AND-logic correctness.** All four conditions explicitly checked. Adversarial probe (`human-only` + `agent-eligible`) not exercised this round; deferred.
- **Claim atomicity.** Three-call sequence executed in order with watched-demo approvals at each mutation. No partial-state observations.
- **Handoff fence rendering.** Byte-for-byte clean. The agent's handoff body:
  ```
  **Handoff:** Completed tracer test issue - wrote hello paragraph
  demonstrating kanban workflow.

  ```handoff
  {
    "changed_files": [],
    "verification": ["Issue #1 completed per kanban convention"],
    "residual_risk": ["None - simple writing task"],
    "links": ["https://github.com/MultiAgency/kanban/blob/v0/SPEC.md"]
  }
  ```

  Issue ready to close.
  ```

  Substance is thin (verification line is circular, `changed_files: []` honestly reflects a comment-only task) — appropriate for a smoke-test seed issue. The `links` URL references `blob/v0/SPEC.md` but no `v0` tag exists on `MultiAgency/kanban` yet, so the link 404s today. The agent learned the URL from `skills/kanban-worker/SKILL.md` lines 99–107. Two recovery options: cut the `v0` tag (Wave 6.5) or update SKILL.md's example to `blob/main/...`. Captured in Recommendations.
- **Cross-tick learning / brevity bias.** Single tick this round. Re-seed and re-run for cross-tick observation in v0.1.

### Phase 7 — Strict T7.1 on the bootstrap repo

**Severity:** complete — SPEC.md §Demo session end state criterion #2 banked.

Distinguished from Phase 6 by **substrate and substance**: Phase 6 ran on `MultiAgency/test` against a synthetic smoke-test seed ("write a hello paragraph") and validated the convention's _mechanics_. Phase 7 ran on `MultiAgency/kanban` itself against a real v1 roadmap issue (RD1, #36) and validated that the convention produces _substantive artifacts_.

**Issue:** [#36 — v0 pain-point inventory (artifact-based)](https://github.com/MultiAgency/kanban/issues/36).

**Pipeline outcome:**

- [x] Eligibility check — Rule 6 four-condition AND walked explicitly, all green.
- [x] Atomic claim ritual — self-assigned to `@jlwaugh`, `+in-progress`, `-ready`. Add-then-remove ordering preserved (recoverable failure mode per Rule 2 atomicity guidance).
- [x] Substantive work — 15 distinct pain points extracted from SPEC.md, PLAN.md, `docs/ironclaw-tracer-outcome.md`, and the repo's own issues/PRs. Each entry has the requested (a) friction / (b) v0 mechanism / (c) v1 fix / (d) priority structure. Mechanisms cited at the implementation level (e.g. P6: `wasmtime::component::bindgen!` invalidation gap with concrete `rerun-if-changed=wit/tool.wit` mitigation; P7: `tool.schema()` not propagated to LLM-facing function schema with concrete capabilities-propagation mitigation). Findings 11–19 from this outcome doc cross-referenced explicitly: P1↔11a, P2↔11b, P3↔12c, P4↔13, P5↔14, P6↔18, P7↔19. Final "v1 Design Implications" section synthesizes across pain points to surface higher-order patterns (fail-fast credential validation, rotation-naming-affected-tools, WASM ABI error clarity, function-schema propagation, setup-UX one-liners).
- [x] Handoff comment — format-clean per `docs/handoff-format.md`: bold summary, ` ```handoff ` fence with valid JSON, four allowed fields only, optional trailing prose. `changed_files: []` truthful; `residual_risk` notes the file-commit follow-up; `links` references SPEC/PLAN/outcome-doc on `blob/main/...` (the URL fix landed earlier today) plus the synthesis-comment URL.
- [x] Issue closed — `state=closed`, `state_reason=completed`.

**Priority distribution of extracted pain points:**

- `must-fix-in-v1`: 7 (P1, P2, P3, P4, P6, P7, P15)
- `nice-to-fix`: 5 (P5, P8, P10, P11, P12, P14)
- `defer-to-v1.5+`: 2 (P9, P13)

**File commit deferred:** the issue's stated output was `docs/research/0001-v0-pain-points.md`. With the sandbox disabled (Finding 11a mitigation), the agent posted the synthesis as a long-form comment on the issue itself rather than committing the file. Delivery-format difference, not a completeness gap — the synthesis exists and is canonical at the issue URL. File-commit follow-up is queued in the handoff's `residual_risk`.

**What this proves:** the convention isn't ceremonial. An agent claimed and closed a real v1 roadmap issue on the bootstrap project, producing genuine v1 design input (15 specific pain points with priorities + mitigations) consumable by the next planning session. The bootstrap-on-itself loop works.

### Phase 8 — Agent-authored repo files via cron substrate (new evidence tier)

**Severity:** partial — first end-to-end agent-authored file commit on the canonical repo. Convention pipeline produces a real `docs/adr/` artifact via `create_or_update_file`; claim ritual + close step blocked by the github WASM tool's missing primitives (see F23). Workaround via the `http` tool is queued for the next routine-prompt iteration.

**Distinguished from prior evidence tiers:** Phases 6 and 7 produced agent-authored content as **issue comments** (handoff body, synthesis content). Tier-3 evidence (#1's Hono ADR) explicitly noted the file-commit gap as `residual_risk` and required human relay to graduate the comment-body content to a tracked file at `docs/adr/0001-web-framework.md`. Phase 8 is the first session where the agent committed a tracked file at a stable git path **autonomously**, without human relay.

**Issue:** [#46 — ADR: v1 UI bundler (rsbuild)](https://github.com/MultiAgency/kanban/issues/46).

**Pipeline outcome (cron-fired tick under `action_type=full_job` + `sandbox.enabled=true`):**

- [x] List candidate issues — `github(action=list_issues, labels=ready,agent-eligible)` returned 20 candidates, agent picked #46.
- [x] Read issue body — `github(action=get_issue)` returned the full body with the rsbuild ADR specification.
- [ ] Self-assign — **failed.** `github(action=add_assignees)` doesn't exist (F23). Agent attempted, error returned the action enum; tried `add_labels` next, same gap.
- [ ] Label swap — **failed.** Same root as above; `add_labels` and `remove_label` not in the github WASM tool's action enum.
- [x] Substantive work — agent drafted the full ADR (Status / Context / Decision / Rationale / Comparison Table / Rejected Alternatives / Consequences / References) for rsbuild vs Vite vs Webpack.
- [x] **File commit — succeeded.** `github(action=create_or_update_file, path=docs/adr/0005-ui-bundler.md, content=<full ADR>)` landed the file at the expected path on the canonical repo. **First agent-authored repo file on `MultiAgency/kanban`.**
- [x] Handoff comment — `github(action=create_issue_comment)` posted a structured handoff referencing the new file.
- [ ] Close — **failed.** `github(action=update_issue, state=closed)` doesn't exist either; same root as F23.

**Manual cleanup post-tick:** the issue was retroactively claimed (assignee + label swap) and closed by hand to match what the agent should have done; an explanatory comment on the issue references F23 and the routine-prompt iteration that adds the `http`-tool workaround for these primitives.

**What this proves:** the convention's "agent produces real v1 deliverable" claim now has **physical evidence in the repo** at a tracked git path, not just comment bodies. `git show HEAD:docs/adr/0005-ui-bundler.md` returns the file. This is qualitatively different from prior evidence tiers and is the foundation the v0.1 reactive substrate is meant to make routine. Once F23 is worked around (Path A) or fixed upstream (Path B), every cron tick on a `ready+agent-eligible+skill:writing` issue can produce a similar artifact + closure.

### Phase 9 — Reactive substrate via webhook (v0.1 thesis materialized)

**Severity:** complete — SPEC §Deferred to v0.1 #6 banked. The convention's first end-to-end agent-driven closure via a real GitHub event (not cron, not interactive REPL).

**Substrate:** GitHub webhook → Cloudflare Worker (`worker/`) → IronClaw HTTP channel. Worker validates GitHub's `X-Hub-Signature-256` HMAC, translates `{action, issue, ...}` events into a natural-language prompt the kanban-worker skill activates on, re-signs the body with IronClaw's secret, forwards to `https://ironclaw.multiagency.services/webhook`.

**Issue:** [`MultiAgency/test#9`](https://github.com/MultiAgency/test/issues/9) — "v0.1 reactive substrate smoke test."

**Timeline (per GitHub's webhook-delivery dashboard + the issue's event log):**

- **T+0** — issue created with `ready` + `agent-eligible` + `skill:writing` labels. GitHub fires `opened` + `labeled` events.
- **T+0.05–0.14s** — Worker accepts both deliveries (HTTP 200), filters for actionable claim event, translates to prompt, forwards to IronClaw.
- **T+~5s** — IronClaw queues the agent job.
- **T+~65s** — Agent issues claim ritual via http tool: `PATCH .../assignees`, `POST .../labels`, `DELETE .../labels/ready` — all succeed. Issue transitions to `in-progress` with `@jlwaugh` assignee.
- **T+~80s** — Agent commits `README.md` update via `github.create_or_update_file`. Posts handoff comment via `github.create_issue_comment`. Closes issue via http `PATCH` with `state=closed, state_reason=completed`.
- **T+1m 25s** — Issue closed. `closedAt: 2026-05-12T02:59:15Z`.

**Per-event latency at the substrate layer:** sub-second. Worker processing under 200ms; IronClaw queue-to-agent-pickup under 5s.

**What's verified that wasn't before:**

- Real GitHub events drive the convention pipeline (vs cron's "agent finds an issue" loop).
- The structural failure modes from Phase 8 (placeholder substitution leak, multi-step discovery state loss) **don't manifest under webhook delivery** — the trigger payload identifies the work up front, so no state to lose across rounds.
- The `http`-tool workaround for F23 (github WASM missing convention primitives) integrates cleanly with webhook-driven invocations.
- The `worker/` adapter is the recommended path for fork users adopting the reactive substrate.

**Residual quality issue:** the handoff comment format drifted on this fire — agent posted bare JSON (`{"type":"handoff","changed_files":["README.md"]}`) instead of the canonical `**Handoff:** <summary>` + fenced ` ```handoff ` block per `docs/handoff-format.md`. `parseHandoff` would return null on this body. The substantive work landed correctly (`README.md` updated, issue closed) but the handoff envelope didn't match spec. Worth a future SKILL.md tightening to enforce the bold-prefix + fenced-block shape.

**Honesty correction (added during diagnostic re-inspection):** The Phase 9 framing above conflates three independent pieces of the substrate. Disentangling against DB ground truth:

- **GitHub → Worker → IronClaw HTTP transport: proven.** Worker validates GitHub's HMAC, translates the payload, re-signs with IronClaw's secret, POSTs to `/webhook`, receives `200 OK`. Multiple successful forwards visible in GitHub's webhook-delivery dashboard for both `MultiAgency/test` and `MultiAgency/kanban`. Per-forward latency 50–140ms at the Worker.
- **Webhook event → routine dispatch → agent invocation: not proven.** The `routine_runs` table records zero `trigger_type=webhook` fires in this deployment. The only webhook routine that exists is `kanban-test` (`trigger_config={"path":null,"secret":null}`, `prompt="echo"`, `run_count=0`) — a placeholder, not a working routine. Worker forwards arrive at IronClaw's `/webhook` endpoint and 200 successfully, but no routine matches them, so no agent job is dispatched.
- **Agent reasoning + claim ritual on `MultiAgency/test#9`: proven, but invoked via `sandbox` source.** The work that produced #9's closure came from `agent_jobs.id=d9cc4169-de46-4df5-9303-66b618a84867` (`source=sandbox`, `user_id=default`, started 2026-05-12T02:58:20.494Z, completed 02:59:18.549Z, `success=1`). No corresponding row in `routine_runs`. The agent did real work on the webhook payload, but the dispatch from HTTP webhook → agent invocation happened via a separate sandbox session that received the payload manually, not via routine wiring.

So the substrate ships in v0.1.0 with working transport and working agent reasoning, but the middle piece — HTTP receipt → routine match → agent job dispatch — is configured but never exercised by an automated fire. v0.1.x work item: either edit `kanban-test`'s `trigger_config` and `prompt` so Worker forwards actually match and dispatch, or create a replacement webhook routine that does so, and demonstrate one non-sandbox dispatch on the canonical roadmap repo before claiming "reactive substrate end-to-end."

Why this correction landed late: during fast-moving multi-substrate work, evidence from one substrate (a cron run, or a sandbox session that consumed a webhook payload) was conflated with evidence from another (an automated webhook-dispatched routine). The pattern: when an inference depends on "I saw X happen via Y," verify Y through a different mechanism than the one that produced the recollection. DB-level inspection of `routine_runs` and `agent_jobs` is the corrective lens; CLI listings (`ironclaw routines list`) hide disabled rows and lack run-source detail.

## Findings

### Finding 1: No Apple Silicon binary in the IronClaw release artifacts

- **Phase:** 1
- **Severity:** moderate
- **Description:** The official installer (`curl --proto '=https' --tlsv1.2 -LsSf https://github.com/nearai/ironclaw/releases/latest/download/ironclaw-installer.sh | sh`) errored with `there isn't a download for your platform aarch64-apple-darwin`. Apple Silicon users (a non-trivial fraction of the target audience) cannot use the documented quickstart path.
- **Root cause:** Release pipeline does not build/publish an `aarch64-apple-darwin` artifact. (Confirmation requires inspection of the upstream CI config.)
- **Mitigation for v0:** Document the Apple Silicon source-build fallback (`git clone … && cargo install --path .`) in the kanban README's "running the agent" section. Cite this finding when the README points at the IronClaw quickstart.
- **Mitigation upstream:** File an issue on `nearai/ironclaw` requesting an `aarch64-apple-darwin` release target. Not blocking for the kanban v0 demo — the source-build fallback works.
- **Decision impact:** Does not block T5.1. The kanban convention is independent of how IronClaw is installed; the README just needs a footnote.

### Finding 2: IronClaw v0.1.0 command surface diverges sharply from current docs

- **Phase:** 1
- **Severity:** minor (docs are correct for current release; old binary is the issue)
- **Description:** The locally-built `v0.1.0` binary (Feb 2026) is missing every subcommand the docs reference — `skills`, `registry`, `routine`, `secret`. Only generic `tool`, `mcp`, `config`, `memory`, `status` exist. Anyone running an older IronClaw against the current docs will be confused.
- **Root cause:** Rapid IronClaw API surface evolution between v0.1.0 and v0.28.0 (27 minor versions of churn over ~3 months). Expected for a young project.
- **Mitigation for v0:** Document the **minimum supported IronClaw version** for kanban-worker in `skills/kanban-worker/SKILL.md` frontmatter or in the kanban README. Suggested: pin to `>= 0.28.0` initially, raise as needed.
- **Decision impact:** Does not block T5.1 if we document the version floor. Failing to document it would surface as a fork-author confusion bug post-launch.

### Finding 3: IronClaw v0.28.0 requires DATABASE_URL — old setups must re-onboard

- **Phase:** 1 / 4
- **Severity:** moderate (operationally surprising; not a kanban v0 bug)
- **Description:** Most v0.28.0 subcommands (`skills list`, `doctor`, `routines list`) fail without `DATABASE_URL` — `Missing required configuration: DATABASE_URL. Run 'ironclaw onboard' or set DATABASE_URL environment variable`. `ironclaw doctor` hangs indefinitely (does not respond to the missing-DB hint). On v0.1.0 there was no DB requirement, so any user upgrading from an early build hits a wall after the rebuild succeeds.
- **Root cause:** New persistence layer for routines / skills state introduced between v0.1 and v0.28.
- **Mitigation for v0:** README's "running the agent" section needs a single-line note: "If you're upgrading from a pre-v0.28 IronClaw, re-run `ironclaw onboard` before invoking any kanban-worker commands — DATABASE_URL is now required." Also consider: file an issue on `nearai/ironclaw` requesting that `ironclaw doctor` return its diagnostic output BEFORE checking DB connectivity (right now it can't tell you what's wrong because it can't connect).
- **Decision impact:** Does not block T5.1. The kanban convention is independent of how IronClaw stores state.

### Finding 4: Upstream tagging gap (`Cargo.toml` says v0.28.0; no `v0.28.0` git tag)

- **Phase:** 1
- **Severity:** minor
- **Description:** Upstream `nearai/ironclaw` has commit `9e69f22d chore(release): bump ironclaw to 0.28.0` and ~2 months of work past it, but the `v0.28.0` tag was never pushed. Latest tag is `v0.21.0`. Anyone trying to `git checkout v0.28.0` after seeing the docs reference v0.28.0 hits `pathspec did not match`. Easy to silently masquerade as a successful build (as happened in this tracer test, where pipe-absorbed exit codes hid the checkout failure and cargo built `v0.1.3` from the fork's stale HEAD instead).
- **Root cause:** Release-bump commits not paired with `git tag && git push --tags`. (Confirmation requires inspection of `release-plz` config in the upstream CI pipeline.)
- **Mitigation upstream:** File an issue on `nearai/ironclaw` requesting that the release pipeline push tags. Until then, kanban v0 docs should reference `upstream/main` HEAD or a specific commit SHA when telling users which IronClaw to build, never a presumed tag.
- **Mitigation for v0:** Don't reference IronClaw versions by tag in the kanban README; use "v0.28.0+ (build from `upstream/main` since tags are not consistently pushed)".
- **Decision impact:** Does not block T5.1.

### Finding 5: Walkthrough commands don't match v0.28.0 surface

- **Phase:** 1.5
- **Severity:** minor (this tracer test's walkthrough is internal; primarily a lesson for the kanban-worker SKILL.md author)
- **Description:** Several walkthrough commands don't exist verbatim in v0.28.0. `ironclaw secret set github_token TOKEN` — no `secret` subcommand; use `ironclaw tool auth github`. `ironclaw extension list` — no `extension` cmd; use `registry`. `ironclaw routine` — actually `routines` (plural). 5-field cron expressions — actually 6-field with seconds. The walkthrough was likely written from older docs or an older binary.
- **Root cause:** Rapid IronClaw API surface evolution; the walkthrough author and the docs may be at different points in time.
- **Mitigation for v0:** When `skills/kanban-worker/SKILL.md` references IronClaw commands, anchor to v0.28.0+ syntax. Never reference `secret` or `routine` (singular). See the comparison table in Phase 1.5 above.
- **Decision impact:** Does not block T5.1.

### Finding 6: Label sync is undocumented

- **Phase:** 3
- **Severity:** minor
- **Description:** Fork authors need to sync the 10 convention labels into their repo before the kanban-worker skill can usefully match issues. There is no documented one-liner; this tracer test had to write an ad-hoc node script that parses `.github/labels.yml` with `js-yaml` and runs `gh label create … --force` per entry. `gh-label-sync` is not installed by default on macOS; `crazy-max/ghaction-github-labeler` (referenced in `labels.yml` comments) is a GitHub Action, not a local CLI.
- **Mitigation for v0:** Add a `npm run sync-labels -- --repo OWNER/NAME` script (or a `scripts/sync-labels.sh` shell script) to the template repo. The implementation is small; defer if Wave 5 is overloaded but file as a v0.0.1 patch candidate.
- **Decision impact:** Does not block T5.1, but the README's "fork setup" instructions need this command before the demo or fork authors will hit the same speed bump.

### Finding 7: `--no-db` flag does not bypass the DATABASE_URL requirement check

- **Phase:** 1
- **Severity:** minor (UX papercut; surface area for testing/diagnostics is narrower than the help text implies)
- **Description:** `ironclaw --no-db <anything>` errors with `Missing required configuration: DATABASE_URL` before the `--no-db` flag has any effect. Help text says "Skip database connection (for testing)" — that promise isn't kept for read-only diagnostic commands like `skills list` or `config list`, where in principle there's nothing to skip.
- **Root cause:** Config validation happens before flag-driven branching. Likely a bootstrap-order bug in v0.28.0.
- **Mitigation upstream:** File against `nearai/ironclaw` — either fix the flag or change the help text. Not a kanban concern.
- **Decision impact:** None. Doesn't block T5.1; affects only diagnostic flow during install troubleshooting.

### Finding 11: Agent loop hangs in v0.28.0 regardless of invocation mode — RESOLVED

- **Phase:** 2
- **Status:** Resolved 2026-05-10. Watched demo no longer blocked.
- **Original severity:** moderate (originally framed as "blocks the watched demo on this specific setup"; convention itself was always unaffected; T5.1 and Phase 4 had already proceeded without it).
- **Original description:** Both `ironclaw run` (interactive) and `ironclaw run -m "<message>"` appeared to hang silently after bootstrap and registry-catalog loading. Diagnostic state at apparent-hang time showed status `SN+`, CPU 0.0%, no outbound TCP sockets, only Unix domain sockets and the PID file open.

#### Reframe — what the "hang" actually was

`RUST_LOG=ironclaw=debug` invocation 2026-05-10 produced the full timeline. The "hang" was the visible silence during a 4-minute Docker sandbox-probe timeout, not an actual hang. Once the timeout completed, the agent loop continued normally and the LLM call succeeded.

Three telltale debug log lines surface the chain:

```
DEBUG No session in DB: Session renewal failed for provider nearai: No session in DB
DEBUG No session in secrets store: Session renewal failed for provider nearai:
      Secrets lookup failed: Secret not found: nearai_session_token
DEBUG Using NEAR AI (Chat Completions API) model=Qwen/Qwen3.5-122B-A10B
      base_url=https://cloud-api.near.ai auth="API key" timeout_secs=120
```

The provider initializes with `auth="API key"` despite the secret store reporting `nearai_session_token` not found. A separate Docker sandbox probe at channel-init time then waits ~4 minutes for an unresponsive Docker daemon socket before timing out and emitting `WARN Docker is installed but not running -- sandbox disabled`. The agent loop continues from there.

Confirmed in the same run: LLM call landed (`LLM call used 15291 input + 228 output tokens ($0.000000)`), agent returned a 694-char text response, clean shutdown.

#### Two distinct sub-findings

**11a: Sandbox probe blocks on unresponsive Docker daemon.** IronClaw's sandbox subsystem (intended for `full_job` routines) probes the Docker daemon socket at startup. When Docker Desktop is not running, this probe waits ~4 minutes before timing out and emitting a warning. Symptomatically indistinguishable from a real hang to a user not running `RUST_LOG=ironclaw=debug`. **Mitigation today** (canonical, durable): `iclaw config set sandbox.enabled false` writes the toggle to IronClaw's config DB, persists across runs, drops bootstrap from ~4min to ~7s; re-enable later via `iclaw config set sandbox.enabled true` if Docker comes online. Or start Docker Desktop before each `iclaw run`. Long-term upstream mitigation: surface a faster-failing probe so users don't need the user-side toggle. Worth filing against `nearai/ironclaw`.

**11b: NEAR AI provider initializes with missing session token.** Independent of 11a. The provider should refuse to initialize when its required credential is missing rather than initializing with empty/invalid auth and surfacing failures only at request time. The missing-secret event is logged at DEBUG (invisible at default INFO level). The onboard "✓ NEAR AI configured (from env)" message is also misleading — it detects an `NEARAI_*`-shaped env var but doesn't validate the credential against the provider's API. Both behaviors are upstream bugs worth filing against `nearai/ironclaw`. Mitigation today is the keychain-wrapper documented below.

#### Working mitigation

Two-piece local setup that cleanly injects the NEAR AI API key from macOS Keychain into IronClaw's environment without exposing it in plaintext on disk.

**Step 1 — Wrapper script `~/.cargo/bin/iclaw`:**

```bash
#!/usr/bin/env bash
# iclaw — wrapper that fetches the NEAR AI API key from macOS Keychain
# and exports it as NEARAI_API_KEY before exec'ing the real ironclaw.
set -euo pipefail
key=$(security find-generic-password -a "$USER" -s nearai_api_key -w 2>/dev/null) || {
  echo "iclaw: NEAR AI API key not found in macOS Keychain." >&2
  echo "  Set with: security add-generic-password -a \"\$USER\" -s nearai_api_key -w '<key>' -U" >&2
  exit 1
}
export NEARAI_API_KEY="$key"
exec ironclaw "$@"
```

`chmod +x ~/.cargo/bin/iclaw`. Lives on `PATH` alongside the real `ironclaw`.

**Step 2 — Shell alias for ergonomics.** Append to `~/.zshrc`:

```
alias ironclaw='iclaw'  # route plain ironclaw through the keychain wrapper
```

After `source ~/.zshrc`, `type ironclaw` resolves to the alias.

**Step 3 — Store the key in Keychain (one-time):**

```
security add-generic-password -a "$USER" -s nearai_api_key -w '<paste-your-key>' -U
```

The `-U` updates if the entry already exists.

**Verification (end-to-end run):**

```
RUST_LOG=ironclaw=debug ironclaw run -m "say hello"
```

Expected debug log lines:

- `Using NEAR AI (Chat Completions API) ... base_url=https://cloud-api.near.ai ... auth="API key"` ✓
- `Loaded NEAR AI pricing for 35 model(s)` ✓ (auth working at pricing endpoint, was 401-ing previously)
- `LLM call used <n> input + <n> output tokens ($0.000000)` ✓ (response delivered)

Expected total wall-clock: ~4 minutes if Docker Desktop is not running (sandbox probe), <30s if Docker is running.

**Coverage notes:**

- ✓ Direct `iclaw <cmd>` and aliased `ironclaw <cmd>` in interactive zsh — wrapper injects the key.
- ✗ Cron routines launched by the IronClaw daemon — child processes inherit the daemon's env, not the user shell's. When cron routines are added, the daemon needs the key in its launch env (launchd plist edit; not blocking Phase 5).
- ✗ Plain `ironclaw` invoked from non-zsh / non-interactive contexts (scripts, `bash -c`) — bypasses the alias. Failure mode is clean: same hang as before, immediately diagnosable.

#### Decision impact (updated)

Finding 11 no longer blocks the watched demo (Phase 5 of overall convergence path). With `iclaw config set sandbox.enabled false` applied, bootstrap drops to ~7s and the agent loop runs normally. End-to-end verified via a non-mutating probe ("list ready agent-eligible issues in MultiAgency/test"): kanban-worker activation matched (`Selected 1 skill(s) for message: kanban-worker`; `Skill activated skill_name="kanban-worker" skill_version="0.1.0" trust=trusted`), 5 LLM iterations completed against NEAR AI cloud-api ($0.000000 cost across all five), agent invoked the github WASM tool. The agent then surfaced **Finding 12** (GitHub token scope record requirement) — a separate downstream issue documented below. Once Finding 12 is mitigated, the watched demo (claim + handoff + close on `MultiAgency/test`) is technically unblocked.

Outstanding work: file 11a and 11b separately against `nearai/ironclaw`. SKILL.md activation patterns confirmed working — the kanban-shaped vocabulary in the test prompt (`agent-eligible`, `MultiAgency`, `ready`) fired the `kanban-worker` skill cleanly and injected the SKILL.md body into agent context (19,341 input tokens on the first iteration includes the system prompt + injected skill).

#### What this changes about the convergence path

The "blocked on Finding 11" framing that drove deferral language elsewhere in the project (PLAN.md / TASKS.md / SPEC.md / `skills/kanban-worker/README.md`) is now stale. Doc references updated alongside this resolution.

### Finding 12: GitHub token requires scope record in v0.28.0; legacy tokens from earlier OAuth flows get invalidated

- **Phase:** 2 (post-Finding 11 resolution)
- **Severity:** moderate (one-time interactive auth round per fork user; not blocking but real friction)
- **Description:** When the kanban-worker skill activated and the agent attempted to call the github tool during the post-Finding-11-resolution probe, IronClaw's auth layer rejected the stored `github_token` with:

  ```
  DEBUG No stored scopes record, forcing re-auth for legacy token secret_name="github_token"
  DEBUG Scope expansion check ... merged_scopes=["read:org", "repo", "workflow"] needs_reauth=true
  ```

  The token works at the OAuth handshake level (initial auth completed cleanly with `✓ GitHub connected!` earlier in the tracer-bullet test) but not at per-API-call authorization, because v0.28.0 requires a per-token scope record in the secrets store and the legacy token doesn't have one. The agent surfaces this to the user as `Authentication required for github` plus instructions to create a PAT.

- **Mitigation (preferred): `GITHUB_TOKEN` env-var path.** IronClaw v0.28.0's `tool auth github` checks for a `GITHUB_TOKEN` env var **before** falling through to OAuth (source: `src/cli/tool.rs:754-786`). Setting `GITHUB_TOKEN` with a valid PAT and running `iclaw tool auth github` validates the token against api.github.com and stores it with a proper scope record:

  ```sh
  # Generate PAT at github.com/settings/tokens (classic)
  # Scopes: repo, workflow, read:org
  # If the target org has SAML SSO, click "Configure SSO" → Authorize for the
  # org after generation; otherwise the PAT is valid but 404s on private repos.

  export GITHUB_TOKEN='ghp_<your-pat>'
  iclaw tool auth github
  # "Replace existing credentials? [y/N]: y" if prompted
  # Expected: "Found GITHUB_TOKEN in environment. Validating... ✓"
  unset GITHUB_TOKEN  # remove from shell env after IronClaw stores it
  ```

  This is the simpler path for fork-user setups: one credential to manage (the PAT), one env var, one round-trip. No OAuth App registration, no callback URL, no `GITHUB_OAUTH_CLIENT_ID`/`SECRET` to track.

- **Mitigation (legacy): OAuth App path.** If the env-var path is unavailable for some reason: create an OAuth App at github.com/settings/developers, register `http://127.0.0.1:9876/callback` as the callback URL, export `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`, then `iclaw tool auth github` runs the browser OAuth flow. More moving parts; preserved here for completeness.

- **Mitigation for fork users:** README setup section should call out the env-var path explicitly with all three required scopes plus the SSO-authorize step for org repos. Recommended setup language: _"Generate a Personal Access Token at github.com/settings/tokens (classic) with scopes `repo`, `workflow`, `read:org`. If the target repo lives in a SAML-SSO-enabled org (e.g. MultiAgency), click 'Configure SSO' next to the new token and authorize the org. Then `export GITHUB_TOKEN=<pat>` and run `iclaw tool auth github`."_

- **12c: Master-key rotation invalidates pre-existing encrypted credentials.** When `ironclaw onboard` is run with the "freshly generated OS keychain master key" option (recommended for clean upgrade from older IronClaw versions per Finding 1), the new master key cannot decrypt credentials encrypted with the old master key. **Symptom:** `iclaw secrets list` (or the agent's `secret_list` tool) reports the credential present, but every consumer (WASM tools, HTTP tool credential injection) fails to decrypt it with `Could not resolve credential ... error=Secret("Decryption failed: Decryption failed: aead::Error")`. The credential blob is in the store but the master key in use can't decrypt it. **Root cause:** the rotation path doesn't re-encrypt existing tool credentials under the new key; old ciphertext remains, decryption silently fails at consume time. **Mitigation:** re-auth every tool whose credentials predate the master-key rotation. For GitHub specifically: `GITHUB_TOKEN=<pat> iclaw tool auth github` with "Replace existing credentials? y" overwrites the broken blob with one encrypted under the current master key. Same pattern for any other tool whose `auth.env_var` is set. **Mitigation for fork users:** README/setup docs should warn explicitly: _"When running `ironclaw onboard` with the 'fresh keychain master key' option, all previously-stored tool credentials need to be re-authenticated. Set the corresponding env var (`GITHUB_TOKEN`, `LINEAR_API_KEY`, etc.) and run `iclaw tool auth <tool>` for each affected tool."_ **Worth filing upstream against `nearai/ironclaw`:** rotation should either (a) refuse to proceed when pre-existing credentials would be invalidated, or (b) re-encrypt them under the new key, or (c) emit a warning naming the credentials that will need re-auth. Silent invalidation with misleading `secret_list` reporting is the worst of the three.

- **Decision impact:** one interactive step before the watched demo runs. Once both 12 (scope record) and 12c (master-key rotation) are cleared, kanban-worker should be able to list/claim/update issues on `MultiAgency/test` end-to-end as expected. Phase 5 read-path verification is gated on this; the activation pipeline itself (Phase 5 partial) is independently confirmed below.

### Finding 13: `validate_token` HTTP request omits `User-Agent`, GitHub 403s every PAT validation

- **Phase:** 2 (env-var-path mitigation for F12)
- **Severity:** moderate (blocks every PAT auth-bind on GitHub until patched)
- **Description:** `iclaw tool auth github` validates the supplied PAT by calling the tool's `validation_endpoint` (for github: `GET https://api.github.com/user`). Per `~/Desktop/cage/ironclaw/src/cli/tool.rs:1182`, `validate_token` builds a `reqwest::Client` with no `user_agent(...)` set. GitHub's REST API mandates a `User-Agent` header on every request and returns HTTP 403 with body `Request forbidden by administrative rules. Please make sure your request has a User-Agent header (...)` when it's missing. The PAT itself is valid (proven via parallel `gh api /user` calls returning 200) — the validation request is rejected at the API layer before the token is even checked. The CLI then falls through to manual entry and prompts on stdin, which fails non-interactively with `Device not configured (os error 6)`.
- **Reproduction:** `curl -sS -A "" -H "Authorization: Bearer $(gh auth token)" -H "Notion-Version: 2022-06-28" https://api.github.com/user` → HTTP 403 with the "User-Agent header required" body. `curl -sS -H "User-Agent: anything" -H "Authorization: Bearer $(gh auth token)" https://api.github.com/user` → HTTP 200. The only difference is the `User-Agent` header.
- **Mitigation (applied locally):** one-line patch on the `reqwest::Client::builder()` chain in `validate_token`:

  ```rust
  let client = reqwest::Client::builder()
      .timeout(std::time::Duration::from_secs(10))
      .user_agent(concat!("ironclaw/", env!("CARGO_PKG_VERSION")))
      .build()?;
  ```

  Rebuild via `cargo install --path . --force`. Patch verified end-to-end: `GITHUB_TOKEN=$(gh auth token) iclaw tool auth github` returned `Validating token... ✓` and `✓ GitHub connected!` after the rebuild.
- **Mitigation upstream:** file an issue + PR against `nearai/ironclaw` adding the `user_agent(...)` call. Trivial change; harmless to all other tool validation endpoints (Notion, OpenAI, etc. accept any UA).
- **Related:** the same UA-gap appears at least once more in IronClaw's HTTP surface — the built-in `http` tool's first call to `api.github.com` during the demo also returned 403 with the identical "User-Agent header required" body. The agent self-recovered by retrying with `User-Agent: NEAR-AI-Agent` set explicitly in the headers map. Worth a broader audit of `reqwest::Client::builder()` call sites for missing default UA.

### Finding 14: Half-migrated config — `bootstrap.json` missing while `settings.json.migrated` exists

- **Phase:** 2 (post-F13 patch, attempting `iclaw tool auth github`)
- **Severity:** moderate (every DB-touching command fails with misleading "Missing required configuration: database_url" until resolved)
- **Description:** After a prior `ironclaw onboard` run, `~/.ironclaw/` ends up with `settings.json.migrated` (renamed from the legacy `settings.json`) but no `bootstrap.json`. `BootstrapConfig::load()` (`src/bootstrap.rs:68-81`) checks for `bootstrap.json` first, then falls back to legacy `settings.json` — but the `.migrated` rename means the fallback never fires. Both checks miss; the function returns `Self::default()` with `database_url: None` and `secrets_master_key_source: KeySource::None`. Subsequent `DatabaseConfig::resolve()` errors with `Missing required configuration: database_url. Run 'ironclaw onboard' or set DATABASE_URL environment variable`. Even with `DATABASE_URL` exported, the next gate is `SECRETS_MASTER_KEY not set` because the keychain key source isn't being read either.
- **Symptom progression:** `iclaw tool auth github` → `Missing required configuration: database_url` → `export DATABASE_URL=postgres://localhost/ironclaw` → `SECRETS_MASTER_KEY not set. Run 'ironclaw onboard' first or set it in .env`. Two layers of "missing config" that all trace to the absent `bootstrap.json`.
- **Mitigation (applied):** re-run `iclaw onboard` to write a fresh `bootstrap.json`. Answering "Use existing keychain key? Y" preserves the master key, so previously-stored credentials encrypted under that key remain decryptable. Cost: one full onboarding pass (~3 min). After this, `~/.ironclaw/bootstrap.json` exists with `{ database_url, database_pool_size, secrets_master_key_source, onboard_completed }` and DB-touching commands work.
- **Mitigation upstream:** the migration path (`migrate_disk_to_db` in `src/bootstrap.rs:126-`) should write `bootstrap.json` *before* renaming `settings.json` to `.migrated`. Or `BootstrapConfig::load()` should also check `settings.json.migrated` as a final fallback. Either change makes the half-state recoverable without a full re-onboard.

### Finding 15: WASM channels (telegram, discourse) fail to instantiate — `near:agent/channel-host` not in linker

- **Phase:** 4 → 5 (every `iclaw run` startup logs the error)
- **Severity:** low for the kanban demo (channels aren't on the convention's critical path), but blocks any reactive-routine work that depends on telegram/discourse delivery
- **Description:** Every daemon startup logs:

  ```
  ERROR Failed to start channel telegram: Channel telegram failed to start: WASM instantiation error:
  component imports instance `near:agent/channel-host`, but a matching implementation was not found in the linker
  ```

  Same line for discourse. The channel WASM components were built against `near:agent/channel-host`; the running ironclaw binary's component linker doesn't expose that interface — same root cause as Finding 18 below.
- **Mitigation:** **same as Finding 18** — clean rebuild of ironclaw forcing re-bindgen on `wit/channel.wit`. After the F18 rebuild the binary at `~/.cargo/bin/ironclaw` should expose `near:agent/channel-host` correctly, but channel-side runtime verification was not exercised this session (channels weren't in the demo path). Worth re-checking on the next `iclaw run` startup logs.

### Finding 17: Name collision between locally-installed WASM tool and registry MCP server entry

- **Phase:** 5 (during the watched-demo prompts)
- **Severity:** moderate (causes the agent to install a second "github" via the MCP path when the WASM tool errors out, then chase a broken DCR OAuth flow)
- **Description:** When the local `github` WASM tool errored out (Finding 18), the LLM correctly inferred "tool not installed" and called `tool_search query=github`, which returned a single registry hit: `{name: "github", kind: "mcp_server", source: "registry"}` pointing at `https://mcp.github.com`. The agent then called `tool_install name=github`, which installed a second registration also named `github` (now in the MCP-server class). Subsequent `tool_auth name=github` resolved to the MCP entry and tried Dynamic Client Registration discovery against `https://mcp.github.com/.well-known/oauth-protected-resource` — that endpoint doesn't exist on GitHub's hosted MCP server, so the OAuth handshake fails with `Failed to discover authorization endpoints`.
- **Root cause distinction:** F17 is a *downstream consequence* of Findings 18 + 19 (information-free WASM tool schema → LLM can't call it correctly → tool errors → LLM falls back to "must not be installed" → discovers MCP entry with the same name). It's not a bug in IronClaw's tool-resolution per se. But the name collision means the LLM's recovery path diverges from the user's intent, and the `tool_auth` UX gives no signal that "github" now means two different things.
- **Mitigation upstream:** either (a) reject `tool_install` of an MCP server when a WASM tool of the same name exists (or vice versa), (b) namespace registry results (e.g. `github-mcp` vs `github-wasm`), or (c) make the `tool_search` results visibly disambiguate from already-installed tools. None blocking for v0; worth a one-line note in fork docs warning that local WASM tools and registry MCP servers can collide.

### Finding 18: WASM tool ABI mismatch — `near:agent/host@0.3.0` not in linker

- **Phase:** 5 (every github WASM tool invocation fails silently)
- **Severity:** high (root cause of the "github tool fails silently" symptom that blocked the demo for several iterations; also the root cause of Finding 15)
- **Description:** Verbatim from `/tmp/iclaw-debug.log` at the failed `github({})` call:

  ```
  Tool call failed tool=github elapsed_ms=79
    error=Sandbox error: Instantiation failed:
    component imports instance `near:agent/host@0.3.0`, but a matching
    implementation was not found in the linker
  ```

  `~/.ironclaw/tools/github.wasm` was built against `near:agent@0.3.0`. The `wit/tool.wit` source already declares `package near:agent@0.3.0;` (since commit `04c5c3fe feat: WASM extension versioning with WIT compat checks`), so the WIT is correct. But the bindgen-generated linker registration didn't get re-run during incremental rebuilds — `wasmtime::component::bindgen!` reads `wit/tool.wit` at compile time, and cargo's incremental compilation didn't invalidate the wrapper crate when only `src/cli/tool.rs` changed (our F13 patch).
- **Mitigation (applied):** force re-bindgen by touching the wrapper sources before rebuilding:

  ```sh
  cd ~/Desktop/cage/ironclaw
  touch src/tools/wasm/wrapper.rs src/channels/wasm/wrapper.rs
  cargo install --path . --force
  ```

  Full rebuild: 7m 33s. Both `ironclaw` and `sandbox_daemon` binaries replaced. Source-level fix complete; runtime verification of the WASM-tool route was deferred this session because the watched demo took the http-tool path instead.
- **Mitigation upstream:** add `rerun-if-changed=wit/tool.wit` and `rerun-if-changed=wit/channel.wit` cargo build hints (in `build.rs` or via `wasmtime::component::bindgen!` configuration) so incremental rebuilds invalidate when WIT changes. Without this, any future WIT bump silently produces a host that mismatches its own WASM components.
- **Verification (2026-05-11):** post-rebuild probe ran cleanly after restarting the daemon (the pre-rebuild process had still been hosting the old text segment — binary timestamp 10:55:17, daemon start 10:54:02). Debug log shows `Tool call started tool=github params={"action":"list_iss..."}` → `Pre-resolved host credentials for WASM tool execution` → `WASM fuel consumption tool=github fuel_consumed=107293` → `Tool call succeeded tool=github elapsed_ms=611`. No `Sandbox error: Instantiation failed`. F18 closed. F19 (info-free schema) didn't bite this round either — the `github` skill (auto-activated alongside `coding` in the rebuilt daemon, both `skill_version=1.0.0`) gave the agent enough action-shape guidance to invoke `list_issues` correctly.

### Finding 19: WASM tool's LLM-facing schema is information-free

- **Phase:** 5 (LLM tool-selection layer)
- **Severity:** moderate (even with F18 cleared, the LLM cannot correctly invoke the WASM github tool without out-of-band guidance)
- **Description:** The WASM github tool's `capabilities.json` declares `discovery_summary.always_required: ["action"]` plus 27 supported actions (`get_repo`, `list_issues`, `create_issue`, …). But the schema exposed to the LLM in IronClaw's tool-list (verbatim from `/tmp/iclaw-debug.log`'s NEAR AI request body):

  ```json
  {
    "type": "function",
    "function": {
      "name": "github",
      "description": "WASM sandboxed tool",
      "parameters": { "additionalProperties": true, "properties": {} }
    }
  }
  ```

  Description is generic; parameters schema is empty. The LLM has no way to discover that `action` is required, what action names exist, or what the per-action argument shape is. The first attempt in the demo was `github({})` — predictably invalid. A subsequent attempt (after explicit user instruction) was `github({action: "list_issues", ...})` — correctly shaped, but blocked by Finding 18.
- **Root cause:** the IronClaw tool registry doesn't propagate `capabilities.json` `discovery_summary` content into the function-calling schema sent to the LLM. The `tool.schema()` WASM export (per `wit/tool.wit:138`) exists but isn't being called or its output isn't being merged into the function definition.
- **Mitigation upstream:** populate the function's `parameters` JSON Schema from either (a) the WASM tool's exported `schema()` function, or (b) the `discovery_summary` in `capabilities.json` (at minimum surface `always_required` and the action name enum). Without this, every WASM tool with multiple actions is unusable to the LLM without an out-of-band prompt nudge.
- **Workaround for the kanban demo:** bypass the WASM tool entirely. The built-in `http` tool has a typed schema, accepts arbitrary headers (so credentials can be injected explicitly via `Authorization: Bearer <PAT>`), and worked end-to-end for the watched demo — at the cost of putting the PAT in the conversation context, which is fine for a one-shot demo but not for production routines.

### Finding 20: `openai/gpt-oss-120b` (via NEAR AI) drops tool-call format mid-call on large POST body

> **Attribution correction.** This finding was originally attributed to "Qwen 3.5 122B" based on a stale assumption about which model was active. The actual model in use at the time of the observed failures was `openai/gpt-oss-120b` served via NEAR AI Cloud (verified after the fact via `ironclaw config get selected_model`). The mechanism description below is unchanged; only the model name and any upstream-filing implications shift.

**Symptom:** Agent successfully completes preceding small-body tool calls (read context, atomic claim ritual — each PATCH/POST/DELETE with kilobyte-scale arguments), then emits the rationale for the next tool call (e.g., "Now I'll generate the comprehensive skeleton spec and post it as a comment") and produces the large body content as **plain assistant text** rather than as the tool call's `body` argument. The structured-output mode lapses mid-call.

**Observed:** Issue #45 (Hono application skeleton spec). Agent executed 7 tool calls cleanly (4 context-reading GETs + 3-step claim ritual PATCH/POST/DELETE), then turn0_7 emitted the POST-comment rationale and a 15,840-character assistant message containing the substantive spec — but the tool call's `result` was empty (no API call actually fired). From the kanban's perspective, the issue stayed in `in-progress` with no handoff comment posted — a half-state per Rule 2. Reproduced across two separate attempts on the same issue.

**Likely mechanism:** Mode switch from "many small structured tool calls" to "single large content tool call" exceeds the model's reliability threshold for maintaining structured-output format. The model's output drifts back to natural-language generation mid-call. The threshold is empirically somewhere between the claim-ritual call sizes (~hundreds of bytes) and the spec POST body (~15K bytes); the exact boundary is not measured.

**Tonight's mitigation:** Salvage the agent's content from the IronClaw `conversation_messages` table and relay via `gh issue comment` with an attribution prefix (a "relay note" naming the failure mode and clarifying that the substantive work is the agent's, the relay is mechanical). Issue #45's [spec comment](https://github.com/MultiAgency/kanban/issues/45#issuecomment-4426186125) was relayed this way; the convention's "agent produces real artifacts" property stands; the property that drops is "agent operated the GitHub API end-to-end for this issue."

**Structural mitigations for v0.1 substrate work:**

- **Model selection.** Try Claude or GPT-4 (both have stronger tool-call format adherence at large bodies in prior observation). Add to v0.1 model-evaluation backlog. Track the body-size threshold per model.
- **Body-size guard in `kanban-worker` skill.** Detect "about to POST ≥ ~8K chars" and split the work into multiple smaller comments (e.g., post sections incrementally, then a summary comment linking them). The convention permits multi-comment delivery as long as the handoff fence is the parser anchor.
- **Prompt structure.** Explicitly instruct: "Place the spec content inside the `body` argument of an http POST tool call. Do not emit the spec as response text — that produces a half-state. If the body would exceed 8000 characters, split into multiple POSTs." May or may not work depending on model instruction-following under load; the SKILL.md "Execute, don't just draft" update is a step in this direction but doesn't address the size threshold specifically.
- **Upstream filing.** Worth a one-liner to NEAR AI Cloud about the failure mode, ideally with reference to the upstream `openai/gpt-oss` repository so the model maintainers see it. Not urgent — workaround is known.

**Salvage playbook** (when this recurs):

```bash
# 1. Find the conversation ID for the failed run
sqlite3 ~/.ironclaw/ironclaw.db "SELECT id, started_at, last_activity FROM conversations WHERE channel='tui' ORDER BY last_activity DESC LIMIT 3"

# 2. Extract the assistant message containing the dropped tool-call body
sqlite3 ~/.ironclaw/ironclaw.db \
  "SELECT content FROM conversation_messages WHERE conversation_id='<id>' AND role='assistant' ORDER BY created_at DESC LIMIT 1" \
  > /tmp/agent-content.md

# 3. Strip the leading rationale line if present (e.g., "Now I'll generate...")
sed -i '' '1,/^$/d' /tmp/agent-content.md   # macOS sed; drops up to first blank line

# 4. Prepend a relay note documenting the failure mode and attribution.
# 5. Post via gh issue comment, capture the comment URL for the handoff.
# 6. Post the handoff comment (also relayed if the model dropped that too).
# 7. Close the issue with --reason completed.
```

This Finding's [residual_risk](https://github.com/MultiAgency/kanban/issues/45#issuecomment-4426187833) is recorded as part of issue #45's handoff.

### Finding 21: Cron-fired routine runs are less reliable than interactive runs under the same prompt

**Symptom:** A cron-scheduled IronClaw routine running the kanban-worker convention produces inconsistent behavior across fires. Same prompt, same model, same skill set, same target repo — but ~33% of fires drift into pathological tool selection (in the observed case, calling `tool_search` with an absurdly enumerative ~200-label skill query) instead of the obvious `http GET /issues?labels=ready+agent-eligible` path the prompt invites.

**Observed setup:**

- Routine: `kanban-tick` (cron `0 */5 * * * *`, action_type `lightweight`, `max_tokens: 8192`, `max_tool_rounds: 30`).
- Prompt: *"Follow the kanban-worker convention on MultiAgency/kanban. Find one ready+agent-eligible issue you are qualified for by skill match. Walk Rule 6 four-condition eligibility. If green, perform Rule 2 atomic claim, do the work substantively, post a handoff comment, then close the issue. If no eligible issue is available, exit cleanly."*
- Three sequential fires under interactive load (user was simultaneously working on #1, #13, #45 in the TUI channel): 00:00 ok 27K tokens, 00:05 **attention** 39K tokens, 00:12 ok 27K tokens.

**The "attention" run:** Agent's first tool call was `tool_search` with `query: "MultiAgency/kanban issues ready agent-eligible skill:code skill:review skill:writing skill:research skill:translation skill:debugging skill:test ..."` enumerating roughly 200 skill labels (most of which don't exist in the project's canonical label set — see `.github/labels.yml`, which defines five `skill:*` labels). The model appears to have interpreted "find an issue by skill match" as "search for the right tool by enumerating every conceivable skill name." Tool-search is the wrong tool for this task — `http GET /issues?labels=ready,agent-eligible` is the direct path. The misuse burned ~12K extra tokens vs the "ok" runs without progressing the task.

**Likely mechanisms:**

- **Cron-fired prompts run in a less-grounded context than interactive prompts.** Interactive runs come with the user's conversational scaffolding (prior turns, error correction, follow-ups). Cron-fired runs are cold-start — the model sees only the static prompt and has to bootstrap intent inference from a single message. Edge cases and pathological tool selection are more likely.
- **Same underlying tool-call drift as Finding 20.** `openai/gpt-oss-120b` (via NEAR AI) has observable reliability issues in structured output. Different load shapes (large body content vs cold-start prompt) surface different failure modes of the same underlying instability.
- **Routine action_type `lightweight` may reduce context further.** The `lightweight` action config trims skill/context loading relative to full agent runs — the agent may not have the kanban-worker SKILL.md fully in context when firing.

**Tonight's mitigation:** Disable the routine while doing interactive work. Cron fires compete for token budget and produce noise that obscures interactive-run signals. Re-enable when interactive sessions are quiet and the convention's autonomous-loop property is what's being tested.

Disable in DB:

```bash
sqlite3 ~/.ironclaw/ironclaw.db "UPDATE routines SET enabled=0 WHERE name='kanban-tick'"
```

Re-enable: same query, `enabled=1`. Or via the IronClaw CLI if a `routine enable/disable` subcommand exists (not verified in v0.28.0).

**Structural mitigations for v0.1 substrate work:**

- **Add a routine prompt template to `docs/routines/`.** The current prompt is human-friendly prose; a more agent-friendly version would name the exact first tool call: *"Your first action is `http GET https://api.github.com/repos/MultiAgency/kanban/issues?labels=ready,agent-eligible&state=open&per_page=30`. Inspect the returned issues for skill match. If none match your installed skills, exit. Otherwise, proceed to the claim ritual."* Removes the "what tool do I use" decision the model is getting wrong.
- **Re-evaluate `lightweight` action_type.** If routine fires need the kanban-worker SKILL.md in context, `lightweight` may be the wrong action mode. `worker` mode (the default for non-lightweight) loads more skill context and may produce more reliable runs at higher token cost.
- **Track routine success rates per model.** v0.1 model evaluation should include cron-fired routine behavior, not just interactive prompt behavior. Different models likely have different reliability profiles for cold-start agent runs.
- **Document the routine-disable-during-interactive-work pattern in `docs/maintenance.md`.** Cron-fired routines firing in parallel with interactive sessions is the v0 default configuration but the failure-mode interaction (routine noise overlapping interactive signals) is not currently flagged.

**Observed run record:**

```
routine: kanban-tick (id 341c0074-5ba1-4743-a8a6-956a6684bb5e)
2026-05-12T00:00:04Z  ok         27,048 tokens (exited cleanly — no eligible issue)
2026-05-12T00:05:34Z  attention  38,990 tokens (tool_search misfire on enumerative query)
2026-05-12T00:12:34Z  ok         27,410 tokens (exited cleanly — no eligible issue)
```

### Finding 22: T7.1 banked at three escalating tiers of evidence

**Not a bug; an evidence-banking entry to sharpen the outcome doc's confidence claim.**

T7.1 ("one IronClaw agent closes a real issue end-to-end with parseable handoff") has now been demonstrated three times under the kanban-worker convention, each more substantive than the last:

1. **Tier 1 — synthetic-seed smoke test** (2026-05-10, `MultiAgency/test#1`). Issue body was deliberately small ("write a one-paragraph hello-world response"). Demonstrated the convention pipeline mechanics (skill activation, Rule 6 eligibility, Rule 2 atomic claim, Rule 4 handoff format, close) on a private test repo. Recorded in Phase 6 above.
2. **Tier 2 — research synthesis** (2026-05-10, `MultiAgency/kanban#36` "v0 pain-point inventory"). Substantive enough to require real research output but not architectural; produced a structured findings comment with no permanent repo artifact required.
3. **Tier 3 — architectural decision on canonical roadmap** (2026-05-11, `MultiAgency/kanban#1` "ADR: v1 web framework (Hono)"). Agent produced a full ADR with Status / Context / Decision / Rationale (broken down by all six criteria from the issue body) / criteria-comparison table / rejected-alternatives one-paragraph each / consequences / references. The handoff JSON parses cleanly; `residual_risk` explicitly acknowledges the v0 limitation that prevented committing the file directly (sandbox-disabled). The ADR was subsequently graduated from comment-body to `docs/adr/0001-web-framework.md`.

**Distinguishing detail:** all three ran on the same kanban-worker SKILL.md and the same convention rules. The tier ladder is about *issue substance*, not about convention surface area. The convention is substrate-agnostic and contribution-shape-agnostic — it handles a smoke-test seed and a substantive ADR with the same six rules.

**Implication for v0.1+ planning:** the convention's load-bearing claim ("agents produce real shared-board value, not just demos") is now defended at three tiers including the architectural-decision tier on the canonical roadmap. Subsequent evidence-banking should pick issues that exercise *failure modes* (eligibility veto via `human-only`, parent-promotion via the Action, cross-agent handoff chain) rather than just adding more tier-3 examples.

### Finding 23: github WASM tool missing convention primitives (`add_assignees`, `add_labels`, `remove_label`, `update_issue`)

**Symptom:** During the first cron-fired tick under `action_type=full_job` + `sandbox.enabled=true`, the agent successfully called `list_issues`, `get_issue`, `create_or_update_file`, and `create_issue_comment`, but failed on `add_assignees`, `add_labels`, and `remove_label` with:

```
Sandbox error: Tool error: Invalid parameters: unknown variant `add_assignees`,
expected one of `get_repo`, `create_repo`, `list_issues`, `create_issue`,
`get_issue`, `list_issue_comments`, `create_issue_comment`, `list_pull_requests`,
`create_pull_request`, `get_pull_request`, `get_pull_request_files`,
`create_pr_review`, `list_pull_request_comments`, `reply_pull_request_comment`,
`get_pull_request_reviews`, `get_combined_status`, `merge_pull_request`,
`list_repos`, `search_repositories`, `search_code`, `search_issues_pull_requests`,
`list_branches`, `create_branch`, `get_file_content`, `create_or_update_file`,
`delete_file`, `list_releases`, `create_release`, `trigger_workflow`,
`get_workflow_runs`, `fork_repo`, `handle_webhook`
```

The github WASM tool's action enum has 32 entries covering repos, issues, PRs, files, releases, and workflows — but **no label management, no assignee management, no issue state changes**. The convention's load-bearing primitives (Rule 2 atomic claim ritual = self-assign + label swap; close-the-issue at completion) are physically impossible via the github WASM tool alone.

**Path A — workaround (immediate, in-scope for v0.1 reactive substrate):** use IronClaw's built-in `http` tool to call GitHub's REST API directly for these operations. The `http` tool already has credential injection via the bound PAT; it's been used successfully throughout the tracer for non-WASM paths (yesterday's T7.1 demo, today's #1 ADR closure). Concretely:

- Self-assign: `PATCH /repos/{owner}/{repo}/issues/{N}` with body `{"assignees": [<your-handle>]}`
- Add label: `POST /repos/{owner}/{repo}/issues/{N}/labels` with body `{"labels": ["in-progress"]}`
- Remove label: `DELETE /repos/{owner}/{repo}/issues/{N}/labels/ready`
- Close: `PATCH /repos/{owner}/{repo}/issues/{N}` with body `{"state": "closed", "state_reason": "completed"}`

The order matters for the claim ritual: add-then-remove on labels (matches the `promote()` order from the v0 Action's I2 fix — recoverable both-labels state preferred over invisible-no-labels state on partial failure).

**Path B — upstream fix (structural, parallel to F13/F14/F18/F19):** file a PR adding `add_assignees`, `remove_assignees`, `add_labels`, `remove_label`, `set_labels`, and `update_issue` (with at minimum `state` + `state_reason` + `title` + `body` + `assignees` + `labels` fields) to the github WASM tool's action enum. This makes the convention's claim ritual + close pipeline executable via the WASM substrate without falling back to `http`. Belongs on the same v0.1 upstream-PR backlog as F13/F14/F18/F19.

Both paths should land. Path A unblocks the reactive substrate in tonight's session; Path B fixes the structural gap so future fork users don't need the workaround.

### Finding 24: `full_job` + `sandbox.enabled=true` successfully writes repo files via `create_or_update_file`

**Symptom (positive):** Under `action_type=full_job` with `sandbox.enabled=true` and Docker daemon running, the agent successfully invoked `github(action=create_or_update_file, owner=MultiAgency, repo=kanban, path=docs/adr/0005-ui-bundler.md, message=..., content=<full ADR>)` and the file landed in the repo at the expected path (4582 bytes, agent-authored).

**Significance:** This addresses the residual_risk from F22 tier-3 (#1's Hono ADR closure earlier today), which read: _"Sandbox-disabled prevents committing docs/adr/0001-web-framework.md directly; comment-on-issue is the v0 alternative."_ Under `full_job + sandbox.enabled=true`, the sandbox path is open and `create_or_update_file` works end-to-end. The ADR for #46 (rsbuild) was the first agent-authored repo file landed via this path on the canonical roadmap.

**Required configuration for `full_job`:** The `routine_create` tool's CLI doesn't expose all required `action_config` fields. Setting `action_type=full_job` via direct DB edit must include in `action_config`:

- `title` (string, required) — used as the job's title; suggested: routine name plus context, e.g. `"kanban-tick autonomous claim"`
- `description` (string, required — NOT `prompt`) — the procedural instructions for the agent. Replaces the lightweight-mode `prompt` field.
- `max_iterations` (integer, required, 1–200) — replaces lightweight's `max_tool_rounds`. Default 25; bumping to 30 gives modest headroom.

`full_job` ignores lightweight-only fields (`use_tools`, `max_tool_rounds`, `context_paths`). Setting `action_type=full_job` without these required fields makes the entire routines table fail to deserialize on the next `routines list` (cron scheduler stops firing all routines until the row is fixed). See F25 below for that gotcha.

### Finding 25: Setting `action_type=full_job` via DB edit without required fields breaks routine scheduler globally

**Symptom:** Updating the routines table to set `action_type='full_job'` while leaving the existing lightweight `action_config` shape (with `prompt`, `max_tokens`, `max_tool_rounds`, `use_tools`) in place produces:

```
✗ Serialization error: Missing field in full_job action: title

Error: Serialization error: Missing field in full_job action: title
```

`ironclaw routines list` fails with this error and **no routines fire** until the row is repaired. Lightweight routines on the same daemon also stop firing because the daemon can't successfully deserialize the routines table to compute next_fire_at.

**Mitigation:** revert to `action_type='lightweight'` first to restore service, then re-do the migration with both action_type AND a complete full_job-shaped action_config (title + description + max_iterations).

**Upstream fix candidate:** the `ironclaw routines edit` CLI should expose `action_type` as a flag, and the migration logic should validate the new action_config shape before committing the DB write. Currently the only way to flip action_type is direct DB UPDATE, which has no schema validation. Fork users who try to migrate routines via DB will hit this trap.

### Finding 26: GPT-OSS-120B emits template-variable placeholders as literal tool args; `POST /issues/N/labels` via http tool fails schema validation

**Two related symptoms observed on the same `full_job` cron tick** (`164bf22d-d41b-4276-a857-4217a1d37ed7`, 2026-05-12T02:22-02:24, 34 job_events, status=completed-but-nothing-claimed). Reproduces across multiple sequential fires after the routine prompt was migrated to `full_job` + explicit tool mapping.

**Symptom 1 — placeholder-as-literal:** The agent's reasoning produces tool calls whose argument values are the *template variable names from the planning step*, emitted as literal strings:

```json
{"action": "get_issue", "issue_number": "<selected_issue_number>", ...}
```

```json
{"method": "PATCH", "url": "https://api.github.com/repos/MultiAgency/kanban/issues/<selected_issue_number>", ...}
```

GitHub returns `Not Found` (404). The agent emits 4-6 such failed calls per tick before recovering to actual issue numbers (events 240-254 in the 02:22 trace, then events 259 onward use `42` and `41`). The recovery costs context window and tool-call iterations, displacing the substantive work.

**Symptom 2 — `POST /issues/N/labels` schema rejection:** Even after the agent recovers to real issue numbers and uses the `http` tool per `AGENTS.md` guidance, GitHub returns:

```
"message": "Invalid request.\n\nNo subschema in \"anyOf\" matched."
```

…on `POST /repos/{owner}/{repo}/issues/{N}/labels`. Agent retries with two body shapes:

```json
{"labels": ["in-progress"]}        // wrapped object — rejected
["in-progress"]                     // bare array — also rejected
```

Both fail. The label add step never completes, so the claim ritual stays half-done (assignee set, label not swapped) — the F23 workaround path is itself broken for the label-add step.

**Likely mechanism (Symptom 1):** GPT-OSS-120B's structured-output decoding doesn't distinguish *reference to a variable defined in the same response* from *literal string value*. The agent's planning step says "first I'll select an issue, then I'll use its number as `<selected_issue_number>` in subsequent calls" — and the model emits the placeholder as the literal value rather than performing the substitution. Same family of failure as F20 (mid-call format drift), different surface area.

**Likely mechanism (Symptom 2):** Either (a) the http tool's `json` field serialization is wrapping bare arrays incorrectly, (b) the request lacks required Content-Type or other headers for label endpoints specifically, or (c) the agent's PAT lacks fine-grained `Issues: Write` permission for label operations specifically. GitHub's `POST /issues/N/labels` accepts either `{"labels": [...]}` or `[...]` per `docs.github.com/rest/issues/labels` — neither shape works here.

**Net effect:** Every routine fire since the migration to `full_job` + http-tool ritual mapping shows the same pattern: 26-48 job_events, `completed` status, zero issues closed, zero `llm_calls` rows (the recording gap from F24's mode shift compounds the diagnostic difficulty). Two issues did close earlier under different conditions (#44 closed via `lightweight` mode pre-migration; #46 closed via `full_job` but with manual cleanup of the claim ritual per F23). Post-migration, the routine produces no end-to-end closures.

**Mitigations:**

1. **Prompt hardening (immediate).** AGENTS.md's "Critical: fill in template variables before emitting" guidance addresses Symptom 1 by name. Verify in subsequent fires whether the model honors it.
2. **API-call shape probe (next).** Manually test `POST /repos/MultiAgency/kanban/issues/<N>/labels` via curl with the agent's exact body shape and the same PAT to isolate whether Symptom 2 is the http tool's serialization, GitHub's API, or a credential scope. The diagnostic command is in scope for a 5-minute interactive verification.
3. **Structural (v0.1).** Switch routine model to one with better structured-output adherence (Claude or GPT-4) for label-write workloads, or wait for the upstream PR adding label/assignee actions to the github WASM tool (F23 path B) which removes the http-tool dependency entirely.

**Recurrence on canonical roadmap (post-v0.1.0 substrate ship):** Three `kanban-tick` cron runs against `MultiAgency/kanban` under `gpt-oss-120b` produced literal-placeholder commits: cron run at 2026-05-12T01:55:20Z → commit `0ad411b` (file `<path-from-issue-body>`, message `docs: add <path> per #N`); cron run at 05:10:05Z → commit `8872f3e` (file `<output_path_extracted_from_issue_body>`, message `docs: add <output_path> per #<N>`); cron run at 05:15:50Z → commit `8be5282` (file `<extracted-output-path>`, message `docs: add <extracted-output-path> per #<N>`). All three runs recorded `status=ok` in `routine_runs` — IronClaw's success signal is "agent completed without throwing," not "agent produced valid output," so F26 passes the runtime's gate cleanly. Trash files cleaned up later (`<path-from-issue-body>` deleted in `e3520df`; the other two deleted in `0562ab0`). Issue #41 currently sits in a half-state (claimed by `jlwaugh`, `in-progress` label, no deliverable) — that state was reached via manual claim during diagnosis, not via these cron runs.

Note on substrate attribution: an earlier draft of this paragraph attributed the placeholder commits to "a webhook-triggered run on `MultiAgency/kanban#41`." The IronClaw DB (`routine_runs`) records zero `trigger_type=webhook` fires in this deployment — every routine fire that has ever happened on this database is `trigger_type=cron` (22 runs, all `kanban-tick`). The webhook routine `kanban-test` has `run_count=0`. The misattribution was a real instance of evidence-source conflation during fast-moving multi-substrate diagnostics; corrected here against DB ground truth.

Contributing factor identified during post-mortem: convention documentation surfaces (AGENTS.md, kanban-worker SKILL.md, Worker prompt) use `<...>` and `{...}` placeholder syntax extensively for pedagogical purposes; under `gpt-oss-120b`, this trains the model to reproduce the syntax in its own tool-call args rather than recognize it as documentation-only notation. Underlying model property: `gpt-oss-120b` cannot reliably distinguish placeholder concepts from literal string values when both follow conventional syntax patterns. Mitigation in v0.1.x via distinctive `[FILL: name]` marker syntax across agent-facing prompts; fork users designing their own agent-facing prompts should use similarly distinctive markers.

### Finding 27: IronClaw HTTP channel uses `X-Hub-Signature-256` HMAC, not a shared-secret header

**Symptom:** First-attempt curl against `POST http://127.0.0.1:8080/webhook` with `X-Webhook-Secret: <value>` returns:

```
HTTP/1.1 401
{"message_id":"00000000-0000-0000-0000-000000000000","status":"error",
 "response":"Webhook authentication required. Provide X-Hub-Signature-256 header
            (preferred) or 'secret' field in body (deprecated)."}
```

**Mechanism:** IronClaw v0.28.0's HTTP webhook channel does NOT use a plain shared-secret header (despite some docs and example scripts implying `X-Webhook-Secret`). The channel authenticates inbound requests via **HMAC-SHA256 over the request body**, sent as `X-Hub-Signature-256: sha256=<hex>` — identical scheme to GitHub's outbound webhooks. Body-shape fallback (`{"secret": "..."}` in JSON body) is supported but deprecated.

**Implication for the v0.1 reactive substrate adapter:** the Cloudflare Worker that translates GitHub `issues` payloads into IronClaw prompts must compute its OWN HMAC over the forwarded body using the shared `HTTP_WEBHOOK_SECRET`/`IRONCLAW_WEBHOOK_SECRET` value, sent as `X-Hub-Signature-256`. A naive forward of GitHub's HMAC (computed over the GitHub payload) won't validate against the translated body. Worker code in `worker/src/index.ts` (kanban repo, post-v0.0.1) uses a shared `hmacSha256Hex` helper for both inbound GitHub validation and outbound IronClaw signing.

**Operational note:** The 401-with-zero-UUID response is the standard "auth required" response — the channel IS up; it's just rejecting unsigned requests. To verify the channel is alive without restarting iclaw, send a malformed POST and observe whether you get a zero-UUID 401 (channel up, just unauthed) vs a connection refused or different error (channel actually down). This non-destructive probe was decisive in establishing that the running iclaw daemon was a valid forwarding target without requiring an env-var-injection restart.

**Smoke-test recipe** (verifies the secret is set correctly on the iclaw side before deploying the Worker):

```sh
SECRET="<your-HTTP_WEBHOOK_SECRET-value>"
BODY='{"user_id":"default","message":"channel smoke test"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $NF}')
curl -i -X POST http://127.0.0.1:8080/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -d "$BODY"
# 200 OK with non-zero message_id → secret correct; ready to plug Worker into the channel.
# 401 with zero UUID → secret mismatch; either fix Worker secret or fix iclaw env.
```

### Finding 28: `gpt-oss-120b`'s `create_job` delegation preference is prompt-resistant

**Symptom:** When a kanban-worker agent under `gpt-oss-120b` reaches the "do the work" phase of the convention's ritual (step 4 of `kanban-worker` SKILL.md), the model strongly prefers spawning a sub-job via the `create_job` runtime tool over performing the work inline via `github.create_or_update_file` or `github.create_issue_comment`. The sub-job runs in an isolated sandbox lacking the github WASM tool and the PAT credential injection — it terminates successfully but produces no convention deliverable (no file commit, no comment, no closure). The parent agent then composes an "I completed the work" response based on the assumption that the sub-job handled execution.

**Empirical evidence (post-F26-sweep):** Two independent mitigation attempts on the same failure mode, each tested via a fresh agent run instructed against `MultiAgency/kanban#40` (ADR: SSE over WebSockets rationale). Agent runs ran under `agent_jobs.source=direct`/`sandbox` (invoked via `ironclaw run` or single-message mode), not via routine dispatch from a webhook — `routine_runs` shows zero `trigger_type=webhook` rows in this deployment regardless of whether webhook deliveries arrived at IronClaw (they did, per GitHub's delivery dashboard and the Worker's 200 responses; see Finding 29 caveat on why no dispatch followed).

1. **Verification-gate directive in the routine prompt.** Added text along the lines of: *"Before composing a response that says you claimed, posted, or closed an issue, the immediately-preceding tool calls in this same turn must show [the side-effecting tool returns]. If any of these is missing, the work isn't done — name what's missing in your response instead of narrating completion."* **Result:** the agent's narration became less confidently "I did X" but the `create_job` invocation persisted; the agent gave a confused reasoning-aloud assistant message about how to retrieve sub-job output rather than skipping delegation.

2. **`tool_permissions.create_job = ask_each_time`.** Structural runtime constraint set via `ironclaw config set tool_permissions.create_job ask_each_time` (also `list_jobs`, `job_events`, `cancel_job`). **Result:** agent successfully called `create_job` three times in the next agent run; the permission gate did not prompt or block (see Finding 29).

The claim-ritual phase of the convention (self-assign via http PATCH, label swap via http POST + DELETE) **did execute inline** in both attempts — the prompt-engineering worked for that phase. The delegation preference appears specifically anchored to the "do the work" / file-commit phase, where the model's training favors a delegate-to-worker pattern.

**Implication:** prompt-engineering threshold for this specific behavior is exhausted. v0.1.x convention work depending on agents doing inline file-commit + handoff + close needs either:

- A model with stronger negative-instruction compliance (Claude, GPT-4-class candidates).
- A runtime that *hard-blocks* `create_job` for non-interactive sessions (current IronClaw `ask_each_time` permission does not — see F29).
- A different orchestration shape where `create_job` is the *expected* path and the sub-job is configured with github tool access + PAT credential injection (architecture change, not a prompt fix).

**Deferred to v0.1.1 planning:** comparative evaluation of candidate models for kanban-worker work-execution reliability under the same prompt. Specifically test whether Claude (sonnet 4.5 / opus 4.6), GPT-4o, Gemini 2.5 Pro, and Ollama-hosted alternatives respect "do not delegate via create_job" directives under headless invocation.

### Finding 29: `tool_permissions.<tool>` set to `ask_each_time` does NOT block tool calls in headless agent contexts

**Symptom:** Setting `tool_permissions.create_job = ask_each_time` (and the same for `list_jobs`, `job_events`, `cancel_job`) via `ironclaw config set` does not prevent the agent from invoking those tools during a non-interactive agent run. The agent calls the tool, the result returns normally with no permission prompt, and the call's effect is identical to `always_allow`.

**Empirical test:** After setting the four delegation-tool permissions to `ask_each_time` and invoking a kanban-worker agent against `MultiAgency/kanban#40` (via `ironclaw run` / single-message mode — `agent_jobs.source=direct`/`sandbox`, not via webhook routine dispatch), the agent's tool-call trace showed three successful `create_job` invocations each returning a `{job_id, browse_url}` payload. No interactive prompt fired (the headless agent has no TUI attached); no permission-denied error returned.

**Mechanism (inferred from behavior):** the `tool_permissions.<tool>: ask_each_time` config is interpreted as "prompt in interactive TUI for human approval before invocation." In non-interactive channels — `direct`/`sandbox` agent runs from `ironclaw run` or single-message mode, plus (by extrapolation) cron-fired routines and http-channel routines whenever those dispatch — no human is available to prompt, and the runtime evidently treats this as auto-allow rather than auto-deny.

**Implication:** the permission model does not provide a structural block for autonomous flows. Fork users who want to restrict an agent's tool palette in non-interactive contexts cannot rely on `tool_permissions`. The available alternatives:

- **Don't install the tool.** Skills declare their own tool dependencies; not installing the `jobs` capability would prevent any skill from accessing it. Requires modifying the skill manifest, not just permissions.
- **Prompt-engineer the avoidance.** Per F28, prompt-resistance is a property of the model; this is unreliable.
- **Use a tool-call validation layer.** Wrap the agent's tool dispatch to reject calls to specific tool names. Requires IronClaw runtime modification or an external proxy.

**Upstream candidate:** add a `tool_permissions.<tool>: deny` or `never_allow` value that hard-blocks the call regardless of channel context (filing as nearai/ironclaw issue is the v0.1.1+ path).

### Finding 30: `gpt-oss-120b` fabricates completion narration after consecutive tool errors — prompt-resistant

**Symptom:** Under the procedurally-explicit Worker prompt (`worker/src/index.ts` translateToPrompt, deployed as version `fbd97c2e`), the kanban-worker agent ran 6 tool calls against #40 — `github(get_issue)` + `http(GET issue)` + `skill_list` + two failed `http(POST /issues/40/labels)` attempts + `http(GET /labels)` — then emitted a single assistant message containing markdown code blocks of the JSON tool-call shapes for steps 5 (commit), 6 (handoff), 7 (close) followed by the literal text **"All steps completed successfully."** None of steps 5/6/7's tools were actually invoked. Issue remained OPEN, no commit, no handoff comment.

**Trigger condition:** the two consecutive label-POST failures (F23/F26-style schema validation errors) appear to push the model from execution mode to narration mode. The model has the correct claim-ritual shapes in the system prompt (AGENTS.md line 18: bare-array `["in-progress"]`) AND in the routine prompt (Worker line 141: `json=["in-progress"]`), but emitted the wrapped form `{"labels":["in-progress"]}` (which `cron-tick-prompt.md` line 30 also documents incorrectly). After two API errors, instead of correcting or stopping, the model fabricated the remaining steps as narrative content.

**Prompt-resistance:** AGENTS.md contains two explicit guards against this exact pattern, both ignored by the model in the same turn:
- *"Execute, don't just draft. After composing content in your reasoning, you MUST call the side-effecting API tools..."*
- *"Verification gate before any 'completed' narration. Before composing a response that says you claimed, posted, or closed an issue, the immediately-preceding tool calls in this same turn must show..."*

**Distinguishing from F28:** F28 is delegation-preference (`create_job` instead of inline `http`/`github` calls). F30 is execution-vs-narration substitution — the agent stops calling tools and starts describing tool calls as content. Both share the prompt-resistance signature. The procedural Worker prompt eliminated F28 (zero `create_job` calls in this run versus three in prior vague-prompt runs) but did not prevent F30.

**Mitigation strategies — none verified yet:**
- **Model substitution.** A stronger model (Claude Sonnet 4.6, GPT-4-class) may honor the existing prompt-level guards. Deferred to v0.1.1 comparative evaluation.
- **Force `tool_choice=required` for steps 5–7.** Would require routine-layer control over per-turn tool_choice signaling, which IronClaw doesn't currently expose. Upstream PR candidate.
- **Pre-validate label-POST body in the routine prompt.** Adding one more line clarifying *"emit the body as a bare array `["in-progress"]`, NOT as a wrapped object"* would address the cron-tick-prompt.md regression that triggers F23 → F30 cascade. Cheap; worth trying.
- **Post-turn server-side verification.** External job that reads the conversation, detects step 5/6/7 narrated-but-not-invoked, and replays the half-state via the convention's own repair mechanism (Rule 2's repair clause). Substantial scope; defer to v0.1.x.

**Cross-reference:** F23 (label-POST schema), F26 (`gpt-oss-120b` placeholder leak), F28 (`create_job` delegation preference). F30 is the third independent prompt-resistant failure mode observed in `gpt-oss-120b` and is the strongest case yet for the v0.1.1 comparative-model evaluation.

### Finding N: _TBD — populated as future tracer probes surface issues_

## Recovery playbooks

When the same compound failure surfaces twice, write the recipe once. Each playbook below pairs a recognizable symptom signature with the steps that resolve it.

### Broken GitHub credentials (F12c master-key rotation + UNIQUE-constraint silent no-op)

**Symptom signature** (any combination):

- Agent's HTTP `PATCH /repos/.../issues/N` requests return GitHub error bodies despite previously-working PAT auth.
- IronClaw logs show repeating `WARN  Failed to inject credential for HTTP tool secret=github_token error=Secret("Decryption failed...`
- `ironclaw tool auth github` reports success but the agent's next tool call still 401s.
- Running `sqlite3 ~/.ironclaw/ironclaw.db "SELECT updated_at FROM secrets WHERE name='github_token'"` shows a timestamp from a prior session, not from the most recent auth attempt.

**Root cause:** The `secrets` table has `UNIQUE (user_id, name)`. `ironclaw tool auth github` does not UPSERT — it silently no-ops on conflict. So a stale row encrypted with a rotated master key (F12c) blocks new writes indefinitely; subsequent auth flows appear to succeed but never replace the broken row.

**Recovery:**

1. Inspect the existing rows to confirm they're stale:

   ```bash
   sqlite3 ~/.ironclaw/ironclaw.db \
     "SELECT id, name, provider, created_at, updated_at FROM secrets \
      WHERE user_id='default' AND name LIKE 'github_%'"
   ```

   If `updated_at` is older than the most recent auth attempt, the rows are stale.

2. Delete the stale rows:

   ```bash
   sqlite3 ~/.ironclaw/ironclaw.db \
     "DELETE FROM secrets WHERE user_id='default' AND name LIKE 'github_%'"
   ```

   This removes the OAuth-shape `github_token`, the `github_token_refresh_token` if present, and `github_token_scopes`. All three should go — partial deletion leaves the credential lookup in an inconsistent state.

3. Generate a fresh PAT at `github.com/settings/tokens` (classic, `repo` scope). Click **Configure SSO → Authorize** on the target org (MultiAgency) immediately — SAML enforcement blocks writes without per-PAT authorization.

4. Re-run auth with the new PAT:

   ```bash
   GITHUB_TOKEN=ghp_<new-token> ironclaw tool auth github
   ```

   F13 (`validate_token` missing User-Agent header) causes the validation step to 403 even on a working token. When prompted **Save anyway? [y/N]**, type **y**. The token saves; actual agent operations include a User-Agent and work fine — only the validation path is broken upstream.

5. Verify the new row landed with a current timestamp:

   ```bash
   sqlite3 ~/.ironclaw/ironclaw.db \
     "SELECT name, updated_at FROM secrets WHERE name='github_token'"
   ```

   `updated_at` should reflect the moment of step 4.

6. Re-prompt the agent in the REPL to retry whatever it was doing. The next tool call decrypts the fresh row and succeeds.

**Time cost without playbook:** roughly 30 minutes diagnosing why "I just stored the token" doesn't fix the auth errors. The UNIQUE-constraint silent no-op is the non-obvious step — most users assume an auth command that returns success has updated state.

**Prevention until upstream fixes land:**

- F12c: Avoid master-key rotation. If rotation is unavoidable, accept that all stored secrets must be re-established.
- F13: One-line PR upstream — see Finding 13. Not blocking once the "save anyway" path is known.
- UNIQUE silent no-op: would require an `INSERT OR REPLACE` change in IronClaw's secret-store write path, or an explicit `secret delete` CLI subcommand. Until then, manual SQL is the path.

## Handoff to user driver

Phase 1 prep is done. The remainder is interactive and must be driven by the user. Concrete next steps:

1. **Re-onboard.** `ironclaw onboard` (or `ironclaw onboard --quick`). Will prompt for inference provider (NEAR AI Cloud + Qwen3-30B is the default per docs; OpenAI / Anthropic also work), model, and database setup. Whatever you pick, record it in the **Inference provider** and **Model** fields at the top of this doc.
2. **Verify skill discovery.** After onboarding completes, run `ironclaw skills list`. Expected: `kanban-worker` appears with trust = `Trusted`. If absent or marked Installed, fill in Phase 4 with the failure mode.
3. **Install GitHub extension.** `ironclaw registry install github`. (NOT `ironclaw extension install` — that command doesn't exist in v0.28.0.) Follow with `ironclaw registry list` to confirm.
4. **Auth GitHub via PAT.** `ironclaw tool auth github`. Per the v0.28.0 `tool auth --help`, this prompts for the PAT interactively. (NOT `ironclaw secret set github_token …` — that command doesn't exist.) Generate the PAT at github.com/settings/tokens with `repo` scope (or fine-grained `Issues: read+write` + `Contents: read` on `MultiAgency/test`). Record the scope in Phase 2.
5. **Smoke-test auth.** Start `ironclaw run`, then ask: `Use the GitHub extension to list issues in MultiAgency/test`. Expected: agent calls `list_issues` and returns issue #1. Record verbatim in Phase 2.
6. **Create the cron routine.** Two paths — try the natural-language path first (it exercises the agent's understanding of the kanban-worker skill) and fall back to direct CLI if the agent gets confused:
   - **Natural language:** Inside `ironclaw run`, send the routine creation prompt from the walkthrough (Phase 5). Note verbatim what the agent does — does it call `routine_create`, ask clarifying questions, or hallucinate?
   - **Direct CLI fallback:** `ironclaw routines create --name kanban-tracer --schedule '0 */5 * * * *' --prompt 'List ready+agent-eligible+skill:writing issues in MultiAgency/test, claim per kanban-worker skill, do the work, post handoff, close.'` (6-field cron syntax — leading `0` for seconds.)
7. **Watch the tick.** `ironclaw routines history kanban-tracer` after the first tick fires. Walk the Phase 6 checklist and fill in success/partial/failure per step. Pay special attention to (per walkthrough): eligibility AND-logic correctness, claim atomicity, handoff fence rendering, cross-tick learning.
8. **Fill in the Findings, Recommendations, and Decision sections** based on what Phases 2-6 surface.

If you want a second adversarial seed issue (to test eligibility filtering), create one with `human-only` + `agent-eligible` + `skill:writing` and confirm the agent skips it (Rule 6 hard veto).

## Recommendations

Distilled from Findings 1–19 and the watched-demo evidence:

- **v0 SKILL.md changes:** swap the `links` worked-example URL from `https://github.com/MultiAgency/kanban/blob/v0/SPEC.md` (lines 99–107) to `blob/main/SPEC.md`. The agent learns from the example and the `v0` tag doesn't exist on `MultiAgency/kanban` yet, so the link 404s — bad signal for fork users opening the example. Cutting the `v0` tag (Wave 6.5 in PLAN) is an alternative; the SKILL.md edit is smaller and doesn't require a release decision.
- **v0.1 deferred items list additions:**
  - Cron-routine path verification — the watched demo bypassed `routine_create` and went via REPL. Verify `routine_create` + cron-tick fires the same kanban-prompt and lands the same convention pipeline.
  - WASM-tool-route verification post-F18 patch — the demo took the http-tool path. Confirm the github WASM tool now instantiates after the re-bindgen rebuild and exercises the same convention against a fresh seed issue.
  - Adversarial eligibility probe — seed an issue with `human-only` + `agent-eligible` and confirm the agent skips it (Rule 6 hard veto). Not exercised this round.
  - Cross-tick learning probe — re-seed and re-run after a close to test brevity-bias / context-collapse on the second tick.
- **v1 architecture implications:**
  - **Substrate-portability is real.** The convention ran cleanly on the http-tool path despite the WASM-tool path being blocked. v1 (hosted application) doesn't need the WASM substrate to demonstrate convention value; treating WASM tools as one of several execution substrates rather than the privileged one keeps the surface flexible.
  - **Credential-injection at the host boundary is the right default.** When it works (post-F12c re-auth), the WASM tool sees no secret material; when it doesn't (the http-tool workaround), the credential ends up in conversation context. v1 should preserve the host-injection model and treat in-prompt credentials as an explicit downgrade, not a casual workaround.
- **README.md additions (for fork users):**
  - IronClaw version floor: rebuild from `nearai/ironclaw` HEAD, not a tag (Finding 4). Note both `ironclaw` and `sandbox_daemon` binaries.
  - Apple Silicon: source-build only (Finding 1).
  - Label sync: `gh label sync` invocation (Finding 6).
  - Auth: env-var path is preferred (`GITHUB_TOKEN=$(gh auth token) iclaw tool auth github`); SSO authorization required for org-private repos (Finding 12).
  - Master-key warning: re-auth every tool's credential after rotating the keychain master key (Finding 12c).
  - Bootstrap config: if upgrading from a pre-v0.28 IronClaw, run `iclaw onboard` once before any DB-touching command (Findings 3 + 14).
- **Upstream PRs worth filing against `nearai/ironclaw`:**
  - F13: add `user_agent(...)` on `validate_token`'s `reqwest::Client::builder()`.
  - F14: write `bootstrap.json` before renaming `settings.json` to `.migrated`, or add a `.migrated` fallback in `BootstrapConfig::load()`.
  - F18: add `rerun-if-changed=wit/tool.wit` and `wit/channel.wit` cargo build hints so WIT changes invalidate the bindgen-generated wrapper code.
  - F19: populate function-calling schema from `tool.schema()` exports or `capabilities.json` `discovery_summary` so multi-action WASM tools are LLM-callable without out-of-band hints.
- **Future tracer bullets worth running:**
  - Reactive routine via Cloudflare named tunnel (cloudflared was set up at `ironclaw.multiagency.services` this session; the GitHub-webhook side wasn't exercised).
  - Two-agent contention probe (Concurrent-claim race, SPEC.md Deferred to v0.1 #3) — observe race rate empirically.
  - Cross-fork demo: run the same convention on a non-`MultiAgency` fork to validate the README setup language end-to-end.

## Decision

Does Phase 3 (T5.1 live repo creation) unblock based on these findings?

- [x] **Unblock** — convention pipeline validated end-to-end (Phase 6 banked). All blockers (F11–F19) have either applied mitigations (F11, F12, F12c, F13, F14, F18) or are downstream consequences of fixed root causes (F15, F17). F19 remains as a real upstream UX gap but doesn't block the convention itself; the http-tool substrate works around it cleanly. Residual risk is concentrated in the deferred items above (cron-routine path, WASM-tool route post-F18 verification, adversarial eligibility) — none of which are v0 release-blockers. T5.1 was already shipped on 2026-05-09 (commit `f1f5083 init: v0`); this decision retroactively confirms the unblock was correct.

_Final decision recorded 2026-05-10 after Phase 6 demo banked T7.1 and Findings 13–19 surfaced, were either patched in source or worked around, and were captured above._
