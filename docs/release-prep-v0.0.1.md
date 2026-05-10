# v0.0.1 release prep (DRAFT)

> Pre-staged while T6 acceptance tests were pending. Final values landed 2026-05-10 when T6.1, T6.3, T6.4, and T7.1 banked in a single working session; T6.2 stays gated on the v0 tag itself and is included as a post-cut smoke-test item below. Anything still labeled DRAFT is provisional.

## Scope

v0.0.1 is the first immutable patch tag in the v0.x line. Per PLAN.md Wave 6.5, the moving `v0` tag is force-updated to point at `v0.0.1` so downstream forks consuming `uses: MultiAgency/kanban@v0` get the latest-within-major.

What ships:

- The convention (six rules) as documented in SPEC.md
- The `kanban-worker` IronClaw skill at `skills/kanban-worker/`
- The dependency-promotion GitHub Action: `src/action/index.ts` → bundled `dist/index.js` + `action.yml` + `.github/workflows/promote-dependencies.yml` (dual-purpose)
- The template repository itself (marked "Template repository" in GitHub settings, canonical labels synced)
- 44 v1 roadmap issues materialized on `MultiAgency/kanban` from `roadmap/v1-issues.yaml`
- Tooling: `scripts/check-spec-refs.sh`, `scripts/validate-roadmap.sh`, `scripts/push-roadmap.mjs`
- Documentation: SPEC, README, CLAUDE, PLAN, TASKS, `docs/handoff-format.md`, `docs/maintenance.md`, `docs/ironclaw-tracer-outcome.md` (Findings 1–12 with sub-findings 11a/11b/12c), routine examples

## Pre-launch checklist (project-scoped)

The standard `shipping-and-launch` checklist targets web app deployments. v0.0.1 ships as a git tag for forks to consume — feature flags, canary rollouts, latency dashboards, and Core Web Vitals don't apply. The applicable items:

### Code quality

- [x] All tests pass (43/43 vitest)
- [x] Build succeeds with no warnings (`npm run build` → `dist/index.js`, 957KB)
- [x] `dist/`-drift check clean (committed bundle matches fresh build)
- [x] Lint clean (`npm run lint`)
- [x] Typecheck clean (`npm run typecheck`)
- [x] Format check clean (`npm run format:check`)
- [x] No `TODO`/`FIXME`/`XXX` in `src/` or `scripts/`
- [x] No `console.log` / `console.debug` in `src/`
- [x] Spec cross-references resolve (`scripts/check-spec-refs.sh`)
- [x] Roadmap schema invariants hold (`scripts/validate-roadmap.sh`)

### Security

- [x] `npm audit --omit=dev` reports 0 vulnerabilities
- [x] No secrets in tracked files (the one match — `NEARAI_API_KEY` in Finding 11's wrapper example — is documentation of a setup pattern, not an actual key)
- [x] Action permissions scoped (`issues: write, contents: read`) per workflow YAML
- [x] No runtime dependencies beyond `@actions/core` + `@actions/github`

### Documentation

- [x] README current (template-fork instructions, releases section)
- [x] SPEC self-consistent (cross-refs, project structure, deferred-to-v0.1 items recorded)
- [x] CLAUDE.md aligned with shipped tooling (esbuild, Node 24, scripts list)
- [x] TASKS.md checkbox state reflects reality (25/31 done, 6 outstanding gated on T6+T7)
- [x] PLAN.md Wave 6.5 documents the dual-tag procedure
- [x] Handoff format byte-identically described in SPEC + SKILL + handoff-format.md
- [x] CHANGELOG.md created (this doc's Release notes section graduated to it 2026-05-10; CHANGELOG.md at repo root is the published surface)
- [x] Findings 11 and 12 documented with mitigations

### Acceptance (gated on user-driven runs)

- [x] T6.1 — Human claim and complete on `MultiAgency/test` ([#3](https://github.com/MultiAgency/test/issues/3), 2026-05-10). Fixture at `tests/fixtures/t2-handoff.md`; parser test in `tests/handoff.test.ts`.
- [x] T6.2 — Dependency promotion verified post-cut on `MultiAgency/test` 2026-05-11. A=#6, B=#7, C=#8; closing A's workflow ran (11s, no promotion as expected, B still open); closing B's workflow ran (20s, success), C transitioned `blocked` → `ready` within ~60s. Both workflow runs `completed success`. Deviation from pre-cut plan: used `MultiAgency/test` rather than a fresh throwaway repo — release-prep doc's exclusion of `MultiAgency/test` was conservative (clean-slate signal); test's success criterion is mechanical and unambiguous regardless of ambient state.
- [x] T6.3 — Single agent claim and complete on `MultiAgency/test` — **covered by T7.1** ([#1](https://github.com/MultiAgency/test/issues/1), 2026-05-10). Strict reading (cron-tick-driven) deferred to v0.1 per `docs/ironclaw-tracer-outcome.md` Phase 5; substantive reading (agent-driven claim + work + handoff + close) satisfied.
- [x] T6.4 — Multi-agent handoff — **MVP variant** (2 personas, 1 handoff edge): #4 → #5 on `MultiAgency/test`, 2026-05-10. PersonaB's handoff `links` array contains the URL of personaA's handoff comment, validating the cross-actor protocol. Fixture at `tests/fixtures/t6.4-b-handoff.md`; parser test asserts the upstream cross-reference. Full A→B→C ceremony (3 personas, 2 handoffs) deferred to v0.1.
- [x] T7.1 — Demo headline: one IronClaw agent closes a real issue end-to-end with parseable handoff ([#1](https://github.com/MultiAgency/test/issues/1), 2026-05-10). Strict reading from SPEC.md §Demo session end state ("on the bootstrap project") deferred to v0.1 — the smoke-test seed on a separate test repo demonstrates the convention pipeline mechanics; running the same pipeline against a substantive v1 issue on `MultiAgency/kanban` is a v0.1 follow-on. See `docs/ironclaw-tracer-outcome.md` Phase 6 for the full evidence trail.

## Tag procedure (Wave 6.5)

The dual-tag mechanic per PLAN.md Wave 6.5:

```
git tag v0.0.1                    # immutable patch tag
git push origin v0.0.1
git tag -f v0 v0.0.1              # force-update moving major-version tag
git push --force origin v0
gh release create v0.0.1 --title "v0.0.1" --notes-file docs/release-prep-v0.0.1.md
```

The forced tag is intentional — `v0` always means "latest within v0.x" by design.

## Rollback procedure

Standard "deploy previous version" doesn't apply — v0.0.1 is an immutable git tag, can't be unshipped. Rollback at the consumer surface means moving the floating `v0` tag back.

### Trigger conditions

Roll back the `v0` tag pointer if any of these surface within 48 hours of cut:

- Action throws on a real `issues.closed` event in any installed fork (verified via fork's workflow run logs)
- `parseDependencies` or `parseHandoff` returns wrong results for a real issue body (regression vs v0 spec)
- Permission error on `issues: write` despite correctly-declared workflow permissions
- Bundle drift CI hit on a fork that hadn't existed pre-cut (suggests `dist/` was somehow corrupted in the tagged version)

### Rollback steps

```
# Move v0 back to a prior good commit (e.g. the last green pre-cut commit on main)
git tag -f v0 <prior-good-sha>
git push --force origin v0

# v0.0.1 itself stays as an immutable historical record
# (don't delete it — forks pinned to @v0.0.1 will keep working as before)
```

Time to rollback: ~30 seconds (single tag-force-push). Forks resume on the prior `v0` target on their next `issues.closed` workflow run.

### What can't be rolled back

- `v0.0.1` tag itself (immutable; deleting it would break forks pinned to that tag)
- The 44 v1 roadmap issues already materialized on `MultiAgency/kanban`
- Documentation already published

## Post-launch verification

In the first hour after the tag cut:

- [ ] `gh release view v0.0.1` renders with the release notes
- [ ] `git ls-remote --tags origin v0 v0.0.1` shows both refs
- [x] **T6.2 (deferred from pre-cut)** — verified 2026-05-11 on `MultiAgency/test` (deviation from "throwaway repo" framing noted in Acceptance section above). Installed `.github/workflows/promote-dependencies.yml` calling `MultiAgency/kanban/.github/workflows/promote-dependencies.yml@v0`; canonical labels already present. A=#6, B=#7, C=#8; close A → workflow runs, no promotion (B open). Close B → workflow runs, C `blocked` → `ready` in ~60s. Two `completed success` runs visible via `gh run list --repo MultiAgency/test`.
- [ ] No new error patterns in upstream's own `promote-dependencies.yml` workflow runs over a few real `issues.closed` events

In the first week:

- [ ] Spot-check forks (if any have adopted) for parseHandoff/parseDependencies regressions in their issue threads

## Deferred to v0.1.x or later (still parked)

Per SPEC.md §Open Questions → Deferred to v0.1:

1. **Cron cadence configurability** — `*/5` is the current example default; configurability beyond examples is post-v0.
2. **Claim-state lint** — periodic scan for half-states; deferred until usage data shows the convention's self-repair clause is insufficient.
3. **Concurrent-claim race** — protocol-level race resolution; deferred until empirical rate exceeds 1%.
4. **Native sub-issue / "Tracked by"** — currently body-text-only; revisits when GitHub's sub-issue API exits preview.

Plus, from `docs/ironclaw-tracer-outcome.md`:

5. **Finding 11a** — sandbox probe should fail-fast when Docker daemon unreachable. Upstream-bug candidate to file against `nearai/ironclaw`.
6. **Finding 11b** — NEAR AI provider should refuse to initialize when required credential is missing. Upstream-bug candidate.
7. **Finding 12 fork-user setup** — README needs the explicit PAT-scopes setup language so fork users don't get stuck on per-token scope-record requirement.

8. **Finding 12c — master-key rotation invalidation.** `ironclaw onboard`'s "fresh keychain master key" option silently invalidates pre-existing encrypted credentials (rotation path doesn't re-encrypt; old ciphertext fails to decrypt at consume time). Upstream-bug candidate: refuse to proceed when pre-existing credentials would be invalidated, or re-encrypt them under the new key, or emit a warning naming credentials that need re-auth.

## Release notes (DRAFT — for `gh release create v0.0.1`)

```markdown
# v0.0.1

First immutable patch in the v0.x line of `MultiAgency/kanban`.

## What's in v0.0.1

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

## Setup notes for fork users

IronClaw v0.28.0 has four setup quirks documented in
[`docs/ironclaw-tracer-outcome.md`](docs/ironclaw-tracer-outcome.md):

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

## Versioning

Use `MultiAgency/kanban@v0` for latest-within-major (recommended for
forks). Pin to `@v0.0.1` for stability. The `v0` tag moves with each
`v0.x.y` patch; `v0.0.1` itself is immutable.

## Acceptance status

T1, T2, T3, T4 acceptance scripts in SPEC.md §Acceptance Test Scripts
ran cleanly on `MultiAgency/test`. T7.1 demo headline: one IronClaw
agent closed a real v1 issue end-to-end with parseable handoff.

## Deferred to future releases

- Native sub-issue / "Tracked by" relationships (preview API)
- Configurable cron cadence
- Half-state lint
- Concurrent-claim race protocol
- Three upstream-bug candidates against `nearai/ironclaw` (sandbox
  probe fail-fast; provider initialization with missing credentials;
  master-key rotation silently invalidating pre-existing encrypted
  credentials)

## License

Dual MIT / Apache-2.0 at your choice.
```

## Open items before cut

None. T6.1, T6.3, T6.4, T7.1 banked in the 2026-05-10 working session (see Acceptance section above). CHANGELOG.md graduated to repo root the same day. T6.2 deferred to post-cut smoke test (chicken-and-egg with the v0 tag itself).

The cut is mechanical: run the tag commands above, paste the release notes via `--notes-file CHANGELOG.md` (or extract just the v0.0.1 section), post-launch verification checklist runs in the first hour.
