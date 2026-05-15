# Changelog

All notable changes to `MultiAgency/kanban` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — v0.1.1

Post-v0.1.0 honesty pass: an apparent "model fabricates completion narration" failure mode turned out to be an IronClaw http-tool parameter-name mismatch (`json=` in prompts vs. `body=` in tool schema — Finding 30). After the fix, the reactive substrate closed `MultiAgency/kanban#40` end-to-end (claim → ADR commit → handoff → close) and the cron `kanban-tick` routine produced a real ADR commit on a fresh fire against #21. The cron fire on #21 stalled before posting the handoff comment and close, leaving an `in-progress` half-state — representative of the residual mid-cycle stall rate under the default model. Both substrates run alongside each other safely: cron's step-2 condition (e) excludes `in-progress` so it cannot race a webhook fire-in-flight.

### What's new for fork users

- **F26 placeholder-leak mitigation.** The `kanban-tick` cron prompt embedded literal tool-call templates with placeholder markers for the agent to substitute into; the agent often emitted a transformation of the marker instead, committing files at placeholder paths. An earlier sweep that made the marker more distinctive (`[FILL: name]`) did not lower the leak rate — it only rotated the leaked surface form. The fix that landed: both substrate prompts (`docs/routines/cron-tick-prompt.md`, `worker/src/index.ts`) were rewritten to drop literal templates entirely, describing each parameter in prose with a concrete worked example. `.github/workflows/no-cruft.yml` rejects commits whose changed paths contain `<` or `>` as a structural backstop. See Finding 26 in the tracer doc.

### Findings recorded against IronClaw v0.28.0

Three findings in [`docs/ironclaw-tracer-outcome.md`](docs/ironclaw-tracer-outcome.md):

- **Finding 28** — `create_job` is invoked during the work-execution phase. Verified: 7 invocations, all 2026-05-12 — one capability probe under `Qwen/Qwen3.5-122B-A10B`, six under `gpt-oss-120b` during ADR-40/41 work spread across 13+ hours. The work completed: the #40/#41 ADRs committed and the spawned sandbox sub-jobs ran to completion. Recorded in `conversation_messages`, not `job_events`. Whether routine `create_job` use is a behavioral preference or a reasonable orchestration choice is unestablished; it needs a controlled re-test with the F26/F30 prompt confounds removed before it can inform model selection.
- **Finding 29** — Hypothesis, untested: `tool_permissions.<tool> = ask_each_time` may degrade to auto-allow in headless contexts (no human attached to prompt for TUI approval). There is no config-change audit log confirming the permission was set when the observed `create_job` calls executed, so the claim is unverified. The remediation options stand regardless: don't install the tool, wrap dispatch with a validation layer, or file an upstream `tool_permissions.<tool>: deny` request.
- **Finding 30** — Prompt/tool parameter-name mismatch silently drops the http request body. IronClaw's built-in `http` tool schema declares `body` as its body parameter; the Worker prompt and `AGENTS.md` examples had `json=` / `"json": [...]`. IronClaw silently dropped the unrecognized key, GitHub received an empty body and rejected with `"nil is not an array"`, and the model bailed into completion-narration after two consecutive errors. The bug was the host layer, not the model. After the one-line fix (`json=` → `body=` in `worker/src/index.ts` and four AGENTS.md examples), the webhook substrate closed #40 end-to-end and the cron substrate produced a substantive ADR commit on a fresh fire against #21.

### Honest autonomous-loop assessment

Both substrates exercised against `MultiAgency/kanban` (the canonical roadmap repo, not just `MultiAgency/test`):

- **Reactive path — full cycle.** `MultiAgency/kanban#40` (`ADR: SSE over WebSockets`) closed end-to-end: webhook → Worker → IronClaw HTTP channel → kanban-worker agent → claim ritual → `docs/research/adr-0002-sse-over-websockets.md` committed (`8d55de5`) → parseable handoff comment → issue closed with `state_reason=completed`. Single fire, no human in the loop.
- **Cron path — partial cycle.** `kanban-tick` routine at `0 */5 * * * *` fired against issue #21 and committed `docs/integration/0000-philosophy.md` (`ddee816`, 32 lines of real content) in tick `8aeca935` on 2026-05-13 07:30. The same fire also produced one placeholder-leak commit (`<output_path>` cruft) — the kind the staged `no-cruft.yml` CI gate will reject once it lands on main. The fire stalled before posting the handoff comment and closing the issue, leaving #21 in an `in-progress` half-state.

A non-trivial fraction of fires under `gpt-oss-120b` still stall mid-cycle (commit lands, handoff or close doesn't). Cron's step-2 condition (e) excludes `in-progress` so the two substrates don't race — but the same exclusion means cron does not currently repair half-states. Manual repair (toggle `ready` to re-fire the webhook substrate, or finish the cycle by hand) is required until a dedicated repair routine lands. Both a repair routine and a comparative model evaluation are on the v0.1.x track.

### Versioning

Use `MultiAgency/kanban@v0` for latest-within-major. v0.1.1 will be tagged once this entry is finalized; for now, the v0 floating tag remains at v0.1.0's commit (`e3520df`).

## [Unreleased] — v0.1

Reactive substrate end-to-end. Delivers SPEC §Deferred to v0.1 #6.

### What's new for fork users

- **`worker/` Cloudflare Worker adapter** — translates GitHub `issues` webhook events into natural-language prompts the kanban-worker skill activates on, validates GitHub's `X-Hub-Signature-256` HMAC against `GITHUB_WEBHOOK_SECRET`, re-signs the forwarded body with `IRONCLAW_WEBHOOK_SECRET`, posts to IronClaw's HTTP webhook channel. ~120 lines TypeScript, no dependencies beyond Cloudflare Workers runtime. Setup in `worker/README.md`: `wrangler login` → two `wrangler secret put` calls → `wrangler deploy` → configure GitHub webhook with `Issues` event selected. Default deployment URL `kanban-webhook.<account>.workers.dev`; custom domain `kanban-webhook.<your-zone>` supported via the `[[routes]]` block in `wrangler.toml`.
- **Reactive substrate is the canonical v0.1 deployment.** Cron substrate from v0.0.1 remains available as an opt-in alternative for fork users who want backlog-processing on a tick rather than event-driven response. Both substrates share the same kanban-worker skill and same convention rules; the substrate is where the agent learns about new work, not how the agent operates on it.
- **Per-event latency:** sub-second at the substrate layer (Worker forwards in 50–140ms, IronClaw queue-to-agent-pickup ~5s). Total wall-clock label-to-issue-close on the v0.1 demo (`MultiAgency/test#9`): ~1m 25s, most of which is the agent doing the work.

### What this validates

Per `docs/ironclaw-tracer-outcome.md` Phase 9 (added in this release): a `ready`-label event on `MultiAgency/test#9` fired the kanban-worker convention end-to-end — claim ritual via http, README update via `github.create_or_update_file`, handoff comment, close — all autonomous, no human in the loop, in ~85 seconds.

The structural failure modes that surfaced in v0.0.2's cron substrate (placeholder-substitution leakage, misfired tool selection on the issue-discovery step — see Findings 21, 26) **do not manifest under webhook delivery**. The trigger payload identifies the work up front, so the agent skips the discovery step entirely — there is no `tool_search` to misfire, and the issue identifier is substituted server-side rather than by the agent.

### Versioning

Use `MultiAgency/kanban@v0` for latest-within-major. Pin to `@v0.1.0` once tagged for stability. The `v0` floating tag moves with each release; `v0.1.0` itself will be immutable.

## [Unreleased] — v0.0.2

Operational hardening based on the first sustained autonomous-loop runs against the v1 roadmap. v0.0.1 proved the convention works for an interactive agent closing a real issue end-to-end; v0.0.2 hardens it for the case where the agent is cron-driven, alone, and overnight.

### What's new for fork users

- **SKILL.md "Execute, don't just draft" rule** — explicit guidance that drafting the work in reasoning is not the same as posting it via API. Half-states from agents that compose a comment in their head but never invoke the http tool are now an explicit failure mode the canonical skill warns against. Ships with the skill, so every fork inherits the rule.
- **`docs/maintenance.md` daemon-vs-interactive runbook** — the two-mode port-8080 collision is documented with the rename-the-plist recovery pattern. `launchctl unload -w` does not always persist across system events; renaming `~/Library/LaunchAgents/com.ironclaw.daemon.plist` is the reliable defense.
- **`docs/ironclaw-tracer-outcome.md` Recovery playbooks section** — the F12c + UNIQUE-constraint + F13 compound failure (broken GitHub credentials that survive `ironclaw tool auth github` because the secret-store write silently no-ops on conflict) now has a documented sequential recipe: inspect the `secrets` table, `DELETE` stale rows, re-auth with the env-var path, accept the F13 "Save anyway?" prompt.
- **`README.md` web-gateway section** — documents the `http://127.0.0.1:3000/` interaction surface for the running daemon. When `iclaw` errors with `Another IronClaw instance is already running`, the gateway lets you interact with the existing productive process instead of killing it.

### Findings recorded against IronClaw v0.28.0

Eight new findings in [`docs/ironclaw-tracer-outcome.md`](docs/ironclaw-tracer-outcome.md):

- **Finding 20** — On one run, the work-execution step's `http` call to post a large comment was malformed — it omitted the required `url` parameter — and the agent then emitted the ~15K-char comment body as plain assistant text instead of retrying the call, leaving the issue `in-progress` with no handoff. Cause not established from a single instance. Workaround: relay the agent's content via `gh issue comment` from the IronClaw conversation DB. See Finding 20 in the tracer doc.
- **Finding 21** — A `kanban-tick` cron fire opened with a `tool_search` call enumerating ~200 skill labels instead of the direct `http GET …?labels=ready,agent-eligible` path the prompt invites, burning ~12K extra tokens. One misfire in three fires — too small to characterize a rate, and cause not established. Mitigation: the routine prompt now names the exact first tool call rather than leaving the agent to choose. See Finding 21 in the tracer doc.
- **Finding 22** — T7.1 banked at three escalating tiers of evidence (synthetic-seed smoke test → research synthesis on `MultiAgency/kanban` → architectural decision ADR on the canonical roadmap). Evidence-banking entry that sharpens the outcome doc's confidence claim.
- **Finding 23** — IronClaw's bundled `github` WASM tool's action enum lacks convention-primitive actions (`add_assignees`, `add_labels`, `remove_label`, `update_issue`). Routine agents default to it and fail the claim ritual. Workaround: routine prompt directs the agent to use the `http` tool for claim-ritual operations; the `github` tool is fine for `list_issues`, `get_issue`, `create_issue_comment`, `create_or_update_file`.
- **Finding 24** — `full_job` action_type + `sandbox.enabled=true` successfully writes repo files via `create_or_update_file`. Addresses the file-commit residual_risk from F22 tier-3 (#1's Hono ADR closure had to graduate from comment-body to file via human relay). First agent-authored repo file landed via this path: `docs/adr/0005-ui-bundler.md`.
- **Finding 25** — Setting `action_type=full_job` via DB edit without the required action_config fields (`title`, `description`, `max_iterations`) breaks the routines table deserialization. `ironclaw routines list` errors and **no routines fire** until the row is repaired. Mitigation: revert action_type to `lightweight` first, then re-do the migration with both fields together.
- **Finding 26** — The `kanban-tick` cron prompt embedded literal tool-call templates with placeholder markers for the agent to substitute into; on roughly half of file-commit fires the agent emitted a transformation of the marker instead of the real value, committing files at placeholder paths. The cause is the prompt's literal-template design, not the model. Fixed by rewriting both substrate prompts to describe each parameter in prose with a concrete worked example; `.github/workflows/no-cruft.yml` is the structural backstop. See Finding 26 in the tracer doc.
- **Finding 27** — IronClaw's HTTP webhook channel uses `X-Hub-Signature-256` HMAC (the same scheme GitHub uses for its outbound webhooks), not a shared-secret header. Docs reference `X-Webhook-Secret` but the runtime requires the HMAC-signed body. Body schema is `{user_id, content}`, not `{user_id, message}` as some docs imply.

### Versioning

Use `MultiAgency/kanban@v0` for latest-within-major. Pin to `@v0.0.2` once tagged for stability. The `v0` floating tag moves with each patch; `v0.0.2` itself will be immutable.

## [v0.0.1]

First immutable patch in the v0.x line.

### What's in v0.0.1

- **The convention** — six rules for status, claim, dependencies, handoffs,
  blocking, and skill-eligibility. Documented in [SPEC.md](SPEC.md) and
  taught to agents via the `kanban-worker` IronClaw skill at
  [`skills/kanban-worker/SKILL.md`](skills/kanban-worker/SKILL.md).
- **The Action** — `MultiAgency/kanban@v0` is a JS GitHub Action
  (`runs.using: node24`) that promotes `blocked` issues to `ready` when
  all body-declared parents close. Body-text dependencies only (`- [ ] #N`
  checklists or closing-keyword refs); native sub-issue API is deferred
  to a future release.
- **Dual-purpose workflow** — `.github/workflows/promote-dependencies.yml`
  is consumable both as a reusable workflow
  (`uses: MultiAgency/kanban/.github/workflows/promote-dependencies.yml@v0`)
  and as a direct action (`uses: MultiAgency/kanban@v0`).
- **Template repository** — fork via the GitHub "Use this template"
  button. Apply canonical labels from
  [`.github/labels.yml`](.github/labels.yml) at fork time.
- **v1 application roadmap** — 44 v1 issues across six tracks
  (architecture, data model, API, integration, UI, research/docs)
  materialized on this repo from
  [`roadmap/v1-issues.yaml`](roadmap/v1-issues.yaml). Source of truth
  is the YAML; live issues are its materialization via
  `npm run push-roadmap`.

### Setup notes for fork users

IronClaw v0.28.0 has setup quirks documented in
[`docs/ironclaw-tracer-outcome.md`](docs/ironclaw-tracer-outcome.md).
Findings 11a, 11b, 12, and 12c affect every fork-user setup. Findings
13, 14, 15, 17, 18, and 19 are recorded as upstream PR candidates
against `nearai/ironclaw`.

- **Finding 11a** — `iclaw config set sandbox.enabled false` to skip a
  ~4-minute Docker probe timeout when Docker isn't running.
- **Finding 11b** — keychain wrapper for the NEAR AI session-token gap.
  The provider initializes with a missing credential; mitigated by
  injecting `NEARAI_API_KEY` from macOS Keychain via a wrapper script.
- **Finding 12** — `GITHUB_TOKEN=<pat> iclaw tool auth github` to seed
  a per-token scope record. Generate a PAT at github.com/settings/tokens
  (classic) with scopes `repo, workflow, read:org`. **For SAML-SSO orgs
  like `MultiAgency`, click "Configure SSO" → Authorize after
  generation**, otherwise the PAT 404s on private repos. The env-var
  path is preferred over the legacy OAuth App flow.
- **Finding 12c** — re-auth every tool whose credentials predate the
  current master key after `ironclaw onboard`'s "fresh keychain master
  key" option (silent invalidation of pre-existing encrypted blobs).
- **Finding 13** — `iclaw tool auth github` will 403 every PAT
  validation against `api.github.com` until ironclaw's `validate_token`
  function sets a `User-Agent` header. Local one-line patch documented
  in the tracer outcome; upstream PR candidate.
- **Finding 18** — WASM tool ABI mismatch (`near:agent/host@0.3.0` not
  in linker) initially blocked the github WASM tool. Resolved by a
  re-bindgen rebuild of ironclaw against `wit/tool.wit`; the github
  tool's full action set is usable directly. Root cause (upstream
  incremental-rebuild cache invalidation) is filed as an upstream PR
  candidate. Fork users running an older ironclaw build can fall back
  to the built-in `http` tool with explicit Bearer headers as a workaround.

### Versioning

Use `MultiAgency/kanban@v0` for latest-within-major (recommended for
forks). Pin to `@v0.0.1` for stability. The `v0` tag moves with each
`v0.x.y` patch; `v0.0.1` itself is immutable.

### Acceptance status

T1, T2, T3, T4 acceptance scripts in SPEC.md §Acceptance Test Scripts
ran cleanly on `MultiAgency/test`:

- **T6.1** — Human-claim ritual on
  [#3](https://github.com/MultiAgency/test/issues/3). Fixture in
  `tests/fixtures/t2-handoff.md`; parser test green.
- **T6.3 = T7.1** — Single-agent claim end-to-end on
  [#1](https://github.com/MultiAgency/test/issues/1) (substantive
  reading; cron-tick variant deferred to v0.1).
- **T6.4 (MVP variant)** — Two-persona, one-handoff chain on
  [#4](https://github.com/MultiAgency/test/issues/4) →
  [#5](https://github.com/MultiAgency/test/issues/5). PersonaB's
  handoff `links` array contains the URL of personaA's handoff
  comment, validating cross-actor coordination. Fixture in
  `tests/fixtures/t6.4-b-handoff.md`; parser test asserts the
  upstream cross-reference. Full A→B→C ceremony (3 personas, 2
  handoffs) deferred to v0.1.
- **T7.1** — Demo headline: one IronClaw agent closes a real
  issue end-to-end with parseable handoff. See
  [`docs/ironclaw-tracer-outcome.md`](docs/ironclaw-tracer-outcome.md)
  Phase 6 for the full evidence trail.

**T6.2** — Dependency promotion verified live on `MultiAgency/test`.
Parents A=#6, B=#7; child C=#8 with `- [ ] #6` `- [ ] #7` body links.
Closing A fired the workflow once with no promotion (B still open).
Closing B fired again and transitioned C from `blocked` → `ready`
within ~60 seconds. Two `completed success` workflow runs visible on
`MultiAgency/test`. The Action's full path is verified end-to-end.

### Deferred to future releases

- Native sub-issue / "Tracked by" relationships (preview API)
- Configurable cron cadence
- Half-state lint
- Concurrent-claim race protocol
- Cron-tick-driven single-agent claim (T6.3 strict reading)
- Full A→B→C multi-agent handoff (T6.4 strict reading)
- Six upstream-bug candidates against `nearai/ironclaw` (Findings
  11a, 11b, 12c, 13, 14, 18; see
  [`docs/ironclaw-tracer-outcome.md`](docs/ironclaw-tracer-outcome.md))

### License

Dual MIT / Apache-2.0 at your choice.
