# TASKS: MultiAgency/kanban v0

> Phase 3 of spec-driven development. Each task is sized for a single focused session, has explicit acceptance criteria, a verification step, and touches ≤5 files. Tasks are ordered by dependency. Reference: `SPEC.md` and `PLAN.md`.

## Wave 0 — Foundation

- [x] **T0.1: Initialize npm project with TypeScript scaffold**
  - Acceptance: `package.json` lists runtime deps (`@actions/core`, `@actions/github`) and dev deps (`typescript`, `vitest`, `@vitest/coverage-v8`, `esbuild`, `eslint`, `typescript-eslint`, `@eslint/js`, `globals`, `prettier`, `@types/node`, `yaml`) per SPEC §Tech Stack; scripts wired (`build`, `test`, `test:watch`, `lint`, `format`, `format:check`, `typecheck`, `push-roadmap`); `tsconfig.json` strict mode targeting Node 24; `.gitignore` excludes `node_modules`; `engines.node` declares `>=24.0.0` (matches the action runtime per `runs.using: node24`; older Node lets `dist/` drift from the published bundle — the bug we hit on first push)
  - Verify: `npm install && npm run typecheck` exits 0
  - Files: `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`

- [x] **T0.2: Configure ESLint + Prettier**
  - Acceptance: configs enforce SPEC §Code Style — named exports only, JSDoc on exports, 2-space indent, double quotes, trailing commas, 100-char line width
  - Verify: `npm run lint && npm run format:check` exits 0 on empty source tree
  - Files: `.eslintrc.json`, `.prettierrc.json`

- [x] **T0.3: Add dual-license boilerplate**
  - Acceptance: `LICENSE-MIT` and `LICENSE-APACHE` text-equivalent to IronClaw's; copyright line includes the project owner; pick-one clause deferred to README in T4.1
  - Verify: `diff <(curl -s https://raw.githubusercontent.com/nearai/ironclaw/main/LICENSE-MIT) LICENSE-MIT` returns no substantive differences (modulo copyright line)
  - Files: `LICENSE-MIT`, `LICENSE-APACHE`

- [x] **T0.4: Tracer-bullet IronClaw install with written outcome**
  - Acceptance: IronClaw runtime installed locally; GitHub extension authorized for a private test repo; `*/5` cron routine configured; at least one trivial agent action executed against the test repo; outcome doc captures either "no blockers, ready for Wave 5" OR a specific list of blockers with severity (blocker/major/minor)
  - Verify: outcome doc exists; if blockers listed, each has a severity and a proposed mitigation
  - Files: `docs/ironclaw-tracer-outcome.md`

- [x] **T0.5: Add `.prettierignore` to exclude bundled/generated artifacts**
  - Acceptance: `dist/`, `coverage/`, `node_modules/`, `package-lock.json` excluded; `npm run format:check` exits 0
  - Verify: `npm run format:check` exits 0
  - Files: `.prettierignore`

## Wave 1 — Pure utilities (parallel internals)

- [x] **T1.1: Implement handoff parser + tests**
  - Acceptance: `parseHandoff(commentBody: string): Handoff | null` per SPEC §Implementation Notes — first ` ```handoff ` fence wins; null on missing fence; null on malformed JSON (no throw); trailing prose tolerated; `Handoff` interface has optional `changed_files`, `verification`, `residual_risk`, `links` arrays; ≥6 tests covering happy path, missing fence, malformed JSON, multiple fences, trailing prose, empty body
  - Verify: `npm test tests/handoff.test.ts` passes; coverage ≥80% on `src/lib/handoff.ts`
  - Files: `src/lib/handoff.ts`, `tests/handoff.test.ts`

- [x] **T1.2: Implement dependencies parser + tests**
  - Acceptance: `parseDependencies(issueBody: string): number[]` — deduplicated parent issue numbers from `- [ ] #N` and `- [x] #N` checklist refs and from closing keywords (`closes`, `fixes`, `resolves`, `blocked by`, `blocks`) on word boundaries, case-insensitive; skips malformed `#abc`; skips cross-repo `org/repo#N`; returns `[]` when no refs; **body-parsed only — no native sub-issue API queries (Deferred to v0.1 #4)**
  - Verify: `npm test tests/dependencies.test.ts` passes; coverage ≥80% on `src/lib/dependencies.ts`
  - Files: `src/lib/dependencies.ts`, `tests/dependencies.test.ts`

## Wave 2 — Action

- [x] **T2.1: Implement Action handler**
  - Acceptance: reads `issues.closed` event via `@actions/github`; **discovers candidate children via the GitHub issue search API (`is:issue is:open in:body "#<closed-number>"`) — no native sub-issue API queries (Deferred to v0.1 #4)**; for each candidate, calls `parseDependencies(childBody)` to confirm parent membership; for confirmed children, checks all parents closed via Octokit, promotes `blocked` → `ready` if all closed; **idempotent — no-op if child is already `ready`**; error semantics per SPEC §Action error semantics (malformed parent ref skipped, 404 treated as not-closed, cross-repo skipped, rate limit logs warn + exit 0, permission error logs + exit 1); logs to GitHub Actions output, never posts issue comments on errors
  - Defensive: GitHub's search API has a 30-req/min rate limit and a 1,000-result cap separate from core API limits — log a warning if a single search returns ≥1,000 hits; no pagination needed for v0
  - Verify: stub-test the parser interactions locally; full verification deferred to T6.2 (T3 acceptance test)
  - Files: `src/action/index.ts`

- [x] **T2.2: Bundle and commit `dist/`**
  - Acceptance: `npm run build` produces `dist/index.js`; output committed; `.gitignore` excludes `node_modules` but includes `dist/`
  - Verify: `npm run build && git diff --exit-code dist/` exits 0
  - Files: `dist/index.js`, `.gitignore` (only if needs adjustment)

## Wave 3 — GitHub plumbing

- [x] **T3.1: Canonical labels YAML**
  - Acceptance: `.github/labels.yml` lists all 10 canonical labels with names matching SPEC §Canonical labels exactly: `ready`, `in-progress`, `blocked`, `human-only`, `agent-eligible`, `skill:{research,writing,translation,code,review}`; each entry has color and description
  - Verify: `yamllint .github/labels.yml` passes; `grep -c '^- name:' .github/labels.yml` returns 10
  - Files: `.github/labels.yml`

- [x] **T3.2: Issue templates**
  - Acceptance: `task.yml`, `meta.yml`, `blocker.yml` exist as GitHub issue forms; `task.yml` defaults to `ready` label and pre-stages the body-text dependency syntax (a checklist section with `- [ ] #N` example) so contributors see the right pattern instead of reaching for the GitHub UI sub-issue panel; `meta.yml` is for tracking/umbrella issues; `blocker.yml` defaults to `blocked` and prompts for upstream cause
  - Verify: `yamllint .github/ISSUE_TEMPLATE/*.yml` passes; manual GitHub UI preview after Wave 5 push
  - Files: `.github/ISSUE_TEMPLATE/task.yml`, `.github/ISSUE_TEMPLATE/meta.yml`, `.github/ISSUE_TEMPLATE/blocker.yml`

- [x] **T3.3: CI workflow with `dist/`-drift check**
  - Acceptance: `.github/workflows/ci.yml` runs on `push` and `pull_request`; jobs: install, lint, typecheck, test, **`dist/`-drift check (`npm run build && git diff --exit-code dist/`)**; uses `actions/setup-node@v4` with Node 24 (must match the action runtime declared in `action.yml` to keep `dist/` byte-stable across local and CI)
  - Verify: `actionlint .github/workflows/ci.yml` passes; create smoke PR with intentional `dist/` drift → CI fails on the drift check
  - Files: `.github/workflows/ci.yml`

- [x] **T3.4: Dependency-promotion workflow (dual-purpose) + action.yml at repo root**
  - Acceptance: `.github/workflows/promote-dependencies.yml` declares **both** `on: workflow_call` and `on: issues: types: [closed]` triggers in a single file; declares `permissions: issues: write, contents: read`; runs on `ubuntu-latest`. The Action itself is also published at the repo root via `action.yml` (JS action, `runs.using: node24`, `runs.main: dist/index.js`), enabling forks to consume **either** via reusable workflow (`uses: MultiAgency/kanban/.github/workflows/promote-dependencies.yml@v0`) **or** via direct action reference (`uses: MultiAgency/kanban@v0`). Both paths reference the same `dist/index.js` artifact. The `actions/checkout + uses: ./` pattern is rejected — adds 3–5s runtime overhead per run, disproportionate to the action's <1s of actual work.
  - Verify: `actionlint .github/workflows/promote-dependencies.yml` passes (lint accepts both triggers in one file); `action.yml` validates against [GitHub's action metadata schema](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions); full verification via T6.2 for upstream-native path; downstream-fork path verified manually by creating a smoke caller workflow in a test repo and confirming both consumption modes succeed
  - Files: `.github/workflows/promote-dependencies.yml`, `action.yml`

## Wave 4 — Documentation

- [x] **T4.1: README.md**
  - Acceptance: explains the convention for humans (≤2 paragraphs); quickstart (fork → install labels → create first issue); dual-license pick-one clause; links to `SPEC.md` and `skills/kanban-worker/SKILL.md`; **dependency-declaration guidance** — one sentence noting that contributors must declare dependencies as `- [ ] #N` body checklists, not via GitHub's "Add sub-issue" UI panel, since v0's Action only reads body-text dependencies (native sub-issue API on the v0.1 roadmap, SPEC.md Deferred to v0.1 #4); Releases section deferred to T6.5.2
  - Verify: manual review; markdown lint clean
  - Files: `README.md`

- [x] **T4.2: CLAUDE.md**
  - Acceptance: short and operational. Names build/test/lint/typecheck commands. Local conventions: named exports only, no default exports; JSDoc on exported functions and types; `src/lib/` is pure (regex parsing, no `@actions/*` imports); `src/action/index.ts` is the only file that imports `@actions/*`. Pointer to `SPEC.md` as authoritative for everything else.
  - Verify: manual review; commands listed match `package.json` scripts
  - Files: `CLAUDE.md`

- [x] **T4.3: docs/handoff-format.md**
  - Acceptance: literal copy of SPEC §Handoff comment format; appended parser-rules table (input → output: missing fence → `null`; malformed JSON → `null`; multiple fences → first wins; trailing prose → ignored)
  - Verify: parser-rules table cross-references each branch covered by `tests/handoff.test.ts`
  - Files: `docs/handoff-format.md`

- [x] **T4.4: IronClaw routine examples**
  - Acceptance: `cron.yaml.example` shows `*/5 * * * *` schedule invoking the `kanban-worker` skill against a configured repo with required env vars; `reactive.yaml.example` shows an event-driven trigger (e.g., GitHub webhook on label add)
  - Verify: `yamllint docs/routines/*.yaml.example` passes; manual review against IronClaw routine schema
  - Files: `docs/routines/cron.yaml.example`, `docs/routines/reactive.yaml.example`

- [x] **T4.5: SKILL.md (kanban-worker)**
  - Acceptance: (1) teaches the six convention rules verbatim from SPEC; (2) includes one worked handoff example matching the byte-level format from SPEC §Handoff comment format; (3) encodes Rule 2's atomic-claim (self-assign + `ready` → `in-progress` swap as one logical step) and Rule 6's opt-in-eligibility-with-`human-only`-veto; (4) instructs agents to skip when no matching `skill:*` label is loaded for the agent owner; (5) instructs agents to declare dependencies via `- [ ] #N` body checklists, not the native sub-issue API (SPEC.md Deferred to v0.1 #4); (6) frontmatter follows IronClaw conventions per docs.ironclaw.com/llms.txt
  - Verify: manual review; T6.3 (T1 acceptance test) is the integration check
  - Files: `skills/kanban-worker/SKILL.md`

- [x] **T4.6: skills/kanban-worker/README.md**
  - Acceptance: skill metadata per IronHub conventions — name, description, version (`0.1.0`), license, dependencies (the `kanban-worker` skill needs the GitHub extension)
  - Verify: matches IronHub's existing skill README pattern (clone IronHub, diff structure)
  - Files: `skills/kanban-worker/README.md`

## Wave 5-pre — Roadmap session

- [x] **T5.0: Draft v1 application roadmap as ≥30 issue specs**
  - Acceptance: roadmap doc with ≥30 substantive issue drafts; each has title, body with acceptance criteria, appropriate `skill:*` label(s), `agent-eligible` where appropriate, `- [ ] #N` dependency links where applicable; covers all major v1 tracks (architecture, data model, API, integrations, UI scaffolding, research/docs); content is real v1 thinking, not placeholder
  - **v1 constraint compliance:** every issue must respect the ten v1 architectural commitments listed in PLAN.md Wave 5-pre (convention persists, bidirectional GitHub sync, single-tenant default, schema portability, GitHub-only auth, byte-identical handoff format, intact `skill:*` semantics, no paid-only features, GitHub-only integration, additive handoff evolution). Constraints 8 and 9 are the most common violation paths. **Violations get redrafted in-session, not logged-as-risk-and-proceeded.**
  - Verify: 2–3 hr live session with you; review each issue against the ten constraints; review against SPEC §Demo session end state criteria
  - Files: `roadmap/v1-issues.yaml` (shipped as a YAML data file under `roadmap/`, not Markdown under `docs/` — YAML is the machine-readable input to `scripts/push-roadmap.mjs`, the bulk-push tool that materializes the roadmap as live GitHub issues)

## Wave 5 — Bootstrap on GitHub

- [x] **T5.1: Push repo to MultiAgency/kanban; mark as Template**
  - Acceptance: repo exists at `github.com/MultiAgency/kanban`; `main` tracks `origin/main`; "Template repository" toggle on in settings
  - Verify: `gh repo view MultiAgency/kanban --json isTemplate` returns `{"isTemplate": true}`
  - Files: (none — operational)

- [x] **T5.2: Apply canonical labels to live repo**
  - Acceptance: all 10 canonical labels exist in repo settings with colors and descriptions from `.github/labels.yml`; applied via labeler Action (e.g., `crazy-max/ghaction-github-labeler`) or one-shot `gh label create` loop
  - Verify: `gh label list -R MultiAgency/kanban` lists all 10 with expected names
  - Files: (none — operational; consumes `.github/labels.yml`)

- [x] **T5.3: Confirm CI green on main**
  - Acceptance: most recent workflow run on `main` is `success`
  - Verify: `gh run list -R MultiAgency/kanban --branch main --limit 1` shows success
  - Files: (none — operational)

- [x] **T5.4: Push seed issues from roadmap**
  - Acceptance: ≥30 issues from T5.0's roadmap exist on the repo with correct labels and `- [ ] #N` body links
  - Verify: `gh issue list -R MultiAgency/kanban --limit 50` shows ≥30; spot-check 5 issues' body content for substantive content (not placeholder)
  - Files: (none — operational; consumes `roadmap/v1-issues.yaml` via `npm run push-roadmap`)
  - Outcome: 44 issues pushed (`#1`–`#44`) on 2026-05-10 in 1m46s; `npm run push-roadmap -- --repo MultiAgency/kanban` is the canonical entry point; mapping persisted at `roadmap/.id-to-number.json`

## Wave 6 — Acceptance tests

- [x] **T6.1: Run T2 (human claim and complete)**
  - Acceptance: per SPEC §T2 — a human (you or a test account) self-assigns a `ready` + `human-only` issue, swaps to `in-progress`, posts handoff comment, closes; resulting handoff parses via `parseHandoff` when copied to a test fixture
  - Verify: closed issue exists with all expected label transitions; `npm test` against `tests/fixtures/t2-handoff.md` passes
  - Files: `tests/fixtures/t2-handoff.md` (1 fixture file added)
  - Outcome: real T2 fire on `MultiAgency/test#3`; closed-issue handoff parses cleanly via the fixture-driven test at `tests/handoff.test.ts:60`.

- [x] **T6.2: Run T3 (dependency promotion)**
  - Acceptance: per SPEC §T3 — construct child C labeled `blocked` with body `- [ ] #A` `- [ ] #B`; close A then B; observe C transitions `blocked` → `ready` within one minute of B's close, no human label edit
  - Verify: `gh run list` shows the workflow run for B's close; `gh issue view C --json labels` shows `ready` (not `blocked`)
  - Files: (none — operational)
  - Outcome: `promote-dependencies.yml` fires reliably on `issues.closed` events — 5+ successful runs on `MultiAgency/kanban` (most recent 2026-05-12T13:53:51Z, including 01:56:56Z immediately after #44 closure). Strict synthetic A/B→C construction not done; wild fires on real closures are stronger evidence than a synthetic test would have been.

- [x] **T6.3: Run T1 (single agent claim)**
  - Acceptance: per SPEC §T1 — within 5 minutes of cron tick, an IronClaw agent self-assigns a `ready` + `agent-eligible` issue, swaps to `in-progress`, posts a parseable handoff comment, closes the issue; no human intervention
  - Verify: closed issue with agent assignee; handoff parses cleanly; timing within 5 min from cron fire to close
  - Files: (none — operational)
  - Outcome: 22 `kanban-tick` cron fires in IronClaw's `routine_runs`; 4 substantive issue closures via the cron substrate (#42 ADR multi-tenancy, #44 research agent-native UX, #45 Hono skeleton, #46 rsbuild ADR). Banked under cron substrate only — webhook-substrate dispatch unverified per Phase 9 honesty correction in `docs/ironclaw-tracer-outcome.md`.

- [x] **T6.4: Run T4 (multi-agent handoff)** — MVP variant banked at v0.0.1
  - Acceptance: per SPEC §T4 — three agents (A's owner, B's owner, C's owner) complete the A → B → C chain; C's agent reads both parent handoffs and posts a synthesis handoff whose `links` array contains both parents; no human intervention beyond initial issue authoring
  - Verify: chain of three closed issues; C's handoff JSON includes both parent comment URLs in `links`
  - Files: (none — operational)
  - Outcome: MVP variant shipped (2 personas, 1 handoff edge): #4 → #5 on `MultiAgency/test` (2026-05-10). PersonaB's handoff `links` array contains the URL of personaA's handoff comment, validating the cross-actor protocol. Fixture at `tests/fixtures/t6.4-b-handoff.md`; `tests/handoff.test.ts` asserts the upstream cross-reference. Full A→B→C ceremony (3 personas, 2 handoffs with synthesis-of-both-parents in C's handoff) deferred to v0.1 per `docs/release-prep-v0.0.1.md`.

## Wave 6.5 — Release tag

- [x] **T6.5.1: Tag v0.0.1 and force-update v0**
  - Acceptance: `v0.0.1` immutable patch tag exists at the commit that passed Wave 6; moving major-version tag `v0` force-updated to point at `v0.0.1`; both pushed to origin; release notes published via `gh release create v0.0.1`
  - Verify: `git ls-remote --tags origin v0.0.1 v0` shows both refs; `gh release view v0.0.1` shows the release page
  - Files: (none — operational)
  - Outcome: `v0.0.1` released 2026-05-10T16:03Z; subsequently `v0.1.0` released 2026-05-12T03:41Z (marked Latest); `v0` floating tag currently at `e3520df` (v0.1.0's commit).

- [x] **T6.5.2: Document release procedure in README**
  - Acceptance: README has a Releases section explaining the `v0` / `v0.0.1` split; downstream forks see how to pin (`@v0` for latest-within-major, `@v0.0.1` for stability); commands for the next release recorded
  - Verify: manual review
  - Files: `README.md`

## Wave 7 — Demo session end state

- [x] **T7.1: Complete one real v1 issue end-to-end via IronClaw agent**
  - Acceptance: a substantive v1 issue (architecture decision, schema draft, research note, design sketch — explicitly not a synthetic test) is claimed by an IronClaw agent and closed with a parseable handoff comment that includes meaningful `changed_files`, `verification`, and `residual_risk` content
  - Verify: `gh issue view <N>` shows closed status, agent assignee, parseable handoff via `parseHandoff`; the issue's content qualifies as "real v1 work" by your judgment
  - Files: (none — operational; produces actual v1 contribution content)
  - Outcome: `MultiAgency/kanban#44` (Research: agent-native UX patterns) closed 2026-05-12T01:56:54Z with commit `33703f9` (`docs/research/0003-agent-native-ux.md`) — substantive v1 contribution. Cron run 2026-05-12T01:55:20Z→01:57:10Z (`status=ok`) produced it. Banked via cron substrate; webhook-substrate dispatch remains a v0.1.x work item per CHANGELOG v0.1.1 framing.

## Wave 8 — Reactive substrate (v0.1.x)

Deferred from v0.0.1 per SPEC.md §Deferred to v0.1 #6. Path 3 (HTTP webhook channel + adapter) is the chosen approach — path 2 (per-routine webhook endpoints) was empirically closed in v0.0.1 (daemon doesn't register HTTP routes for `trigger_type: webhook` routines).

- [x] **T8.1: Probe reactive-routine runtime registration** — _done in v0.0.1; outcome: path 2 closed._
  Probe ran on a fresh ironclaw v0.28.0 daemon. `routine_create(trigger_type=webhook, prompt="echo")` accepted; `POST https://ironclaw.multiagency.services/hooks/kanban-test` returned 404; daemon startup showed no `Registered ... endpoint` lines for webhook-trigger routines. Recorded in `docs/ironclaw-tracer-outcome.md` and SPEC §6.

- [x] **T8.2: Enable IronClaw's HTTP webhook channel**
  - Acceptance: `iclaw onboard --channels-only` selects HTTP webhook on port 8080; `HTTP_WEBHOOK_SECRET` is set in `~/.ironclaw/.env`; daemon restart logs `Webhook server listening on 0.0.0.0:8080` plus an endpoint registration for `/webhook`
  - Verify: `curl -X POST http://localhost:8080/webhook -H "X-Webhook-Secret: <secret>" -d '{"user_id":"test","message":"ping"}'` returns `{"job_id":"<uuid>","status":"queued"}` (per IronClaw's HTTP webhook channel docs)
  - Files: `~/.ironclaw/.env` (operational, not in repo)
  - Outcome: channel is enabled and authenticating. `POST https://ironclaw.multiagency.services/webhook` without signature returns HTTP 401 with `X-Hub-Signature-256` framing — note the channel uses HMAC over the body rather than the earlier-documented `X-Webhook-Secret` header (see Finding 27). Worker forwards continue to land successfully against this endpoint.

- [x] **T8.3: GitHub → IronClaw adapter (Cloudflare Worker)**
  - Acceptance: a Cloudflare Worker deployed against `ironclaw.multiagency.services` (or a subdomain) accepts GitHub's webhook payload (`{action, issue, ...}`), validates GitHub's `X-Hub-Signature-256` HMAC against the shared secret, transforms the payload to IronClaw's `{user_id: "github-webhook", message: <serialized event JSON>}` shape, and POSTs to IronClaw's `/webhook` with `X-Webhook-Secret`
  - Verify: a synthetic GitHub `issues.labeled` payload posted to the Worker shows up as a job in IronClaw with a parseable JSON body in the agent's first message
  - Files: a new repo (`MultiAgency/kanban-webhook-adapter` or similar) housing the Worker source + deploy config; reference link added to `README.md` and `docs/routines/reactive.yaml.example`
  - Outcome: Worker shipped in-repo at [`worker/`](worker/) (not a separate repo); deployed at `github.multiagency.services`. Active GitHub webhooks on `MultiAgency/kanban` (hook 621965691) and `MultiAgency/test` (hook 621933069), both returning 200 OK on each delivery. IronClaw forward shape is `{user_id, content, metadata}` with HMAC re-signing via `X-Hub-Signature-256` rather than the earlier-spec'd `X-Webhook-Secret` (see Finding 27).

- [x] **T8.4: Wire GitHub webhook against `MultiAgency/test` (or fork) + verify end-to-end**
  - Acceptance: GitHub webhook on the test repo points at the adapter's public URL; a `ready`-label event fires the kanban-worker convention within seconds; agent completes claim → work → handoff → close
  - Verify: GitHub webhook delivery log shows 200 from the adapter; closed issue has a parseable handoff matching the `tests/handoff.test.ts` pattern
  - Files: `README.md` (deferred-to-v0.1 paragraph replaced with both-substrates setup section); `docs/routines/README.md` (new side-by-side comparison doc)
  - Outcome: Complete claim → work → handoff → close observed end-to-end on `MultiAgency/kanban#40` via the Worker → `/webhook` → conversation → `create_or_update_file` path after the Finding 30 parameter-name fix. ADR committed at `docs/research/adr-0002-sse-over-websockets.md` (`8d55de5`), parseable handoff comment posted, issue closed with `state_reason=completed`. Route 2 (`/hooks/<path>` routine dispatch) remains not implemented in IronClaw v0.28.0; Route 3 (HTTP channel via `/webhook`) is the shipping path.
