# Changelog

All notable changes to `MultiAgency/kanban` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
