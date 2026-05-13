# CLAUDE.md

> This file is loaded automatically when Claude Code opens this repo. It tells Claude what this project is, what conventions to follow, what gotchas to avoid, and where to find authoritative documentation. `SPEC.md` is the source of truth — when CLAUDE.md and SPEC diverge, SPEC wins; treat the divergence as a bug.

## What this is

The MultiAgency kanban convention plus its v0 infrastructure: a `kanban-worker` IronClaw skill, a GitHub Action that promotes blocked issues to ready when their parents close, and a template repository forks adopt to start a project. v0 ships the convention; v1 (a hosted application built on the same convention) is on the roadmap. See [`README.md`](README.md) for the user-facing intro and [`SPEC.md`](SPEC.md) for the full convention.

## Commands

```
npm install                                # install dependencies
npm test                                   # run all unit tests (vitest)
npm run typecheck                          # tsc --noEmit
npm run lint                               # biome lint . (lints src/, tests/, scripts/)
npm run format                             # biome format --write . (rewrites)
npm run format:check                       # biome format . (verifies, exits non-zero on diff)
npm run build                              # esbuild bundle src/action/index.ts → dist/index.js (target node24)
bash scripts/check-spec-refs.sh            # validate "Deferred to v0.1 #N" cross-refs in PLAN/TASKS → SPEC
bash scripts/validate-roadmap.sh           # validate roadmap/v1-issues.yaml schema invariants
npm run push-roadmap -- --repo owner/repo --dry-run  # bulk-push the v1 roadmap (drop --dry-run to push for real)
actionlint .github/workflows/*.yml         # validate workflow YAML
```

After any change to `src/action/`, re-run `npm run build` to keep `dist/index.js` in sync — the CI dist-drift check fails otherwise.

## Conventions

- **Named exports preferred** across the codebase, but not enforced by lint. The repo previously set Biome's `style/noDefaultExport` rule to `error`, but `worker/src/index.ts` (Cloudflare Workers module-format entry) requires `export default { fetch }` by the runtime contract — the rule was either universally suppressed via override or violated. The honest resolution: remove the rule from `biome.json`, document the preference here, enforce socially in code review. See SPEC §Code Style.
- **JSDoc on every exported function and type.** Required by SPEC §Code Style; not lint-enforced. Code review catches drift.
- **Pure utilities in `src/lib/`.** Regex-based parsing only; no `@actions/*` imports. Tests live alongside in `tests/<name>.test.ts`.
- **`@actions/*` boundary.** `src/action/index.ts` is the only file that imports `@actions/core` or `@actions/github`. Octokit is injected as a parameter to all testable functions; `main()` and the `require.main === module` entrypoint guard are intentionally not unit-tested (deferred to T6.2).
- **`dist/index.js` committed at repo root.** Output of `npm run build`. Forks consume the action via `uses: MultiAgency/kanban@v0`, which references `dist/index.js` through `action.yml`.
- **`action.yml` at repo root** publishes the Action as a JS action with `runs.using: node24` and `runs.main: dist/index.js`. Node 24 was chosen so the build target matches the runtime exactly: Node 24 build → Node 24 runtime is byte-stable. Build local Node version must be ≥24 (per `package.json` `engines`, matches the Action's `runs.using: node24` runtime). Older→newer bundles work for older targets but are unsafe for the Node 24 action runtime; newer→older introduces missing internalized modules — the bug we hit on first push.
- **Dual-purpose workflow file.** `.github/workflows/promote-dependencies.yml` declares both `on: workflow_call` (for downstream forks consuming via `uses: MultiAgency/kanban/.github/workflows/promote-dependencies.yml@v0`) and `on: issues: types: [closed]` (for upstream's own runs).

## Gotchas

Each bites once and never if documented.

### npm `--` arg-forwarding

`npm run <script> -- <arg>` appends the arg to the script's literal command. The footgun: passing a path to a script that already hardcodes `.` (e.g., `biome format --write .`) doesn't constrain it — npm produces `biome format --write . path/to/file`, and the tool processes everything plus the named path. Wrote to the whole repo when only one file was intended. (Historical sibling from the Prettier era: `npm run format -- --check` produced `prettier --write . --check`, two conflicting flags, and Prettier silently wrote — worst outcome for a verify gate.) Defense: use the script names exactly as defined; don't try to scope them with extra args.

### YAML scalar values containing `: ` need quoting

Strings like `` `issues: write` `` or `repo:owner/name` in `action.yml` descriptions or workflow step names break js-yaml parsing — the second colon is interpreted as introducing a nested mapping. Quote the value (single or double quotes both work). actionlint may pass without quoting because it validates GitHub-specific structure rather than YAML scalar parsing per se; fix at the parser level, not later.

### Run `npm run format` after creating any new file

`format:check` fails on any file authored without biome-on-save. Editor-integrated Biome is the durable fix; `npm run format` is the explicit fallback. Agents writing via Write tool calls don't get editor formatting, so they need an explicit `format` step before `format:check`.

## Dev dependencies

| Package                         | Purpose                                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `typescript`                    | Language.                                                                                                                        |
| `vitest`, `@vitest/coverage-v8` | Test runner with v8-backed coverage.                                                                                             |
| `esbuild`                       | Single-file bundler for the GitHub Action (CJS, target `node24`).                                                                |
| `@biomejs/biome`                | Linter and formatter (replaces ESLint + Prettier). Config in `biome.json`; covers JS/TS/JSON only — Markdown and YAML untouched. |
| `@types/node`                   | Node typings (needed for `require.main === module` guard in `src/action/index.ts`).                                              |
| `yaml`                          | Used by `scripts/push-roadmap.mjs` to parse `roadmap/v1-issues.yaml`. Canonical parser for any future YAML tooling in this repo. |

## Deferred to v0.1

Four items considered during v0 design and intentionally left for v0.1 — not bugs, not omissions to fix. Don't add code that contradicts the v0 disposition without an explicit decision to expand v0's scope.

- **Concurrent-claim race back-off ritual.** Deferred to v0.1 #3. v0 has basic claim correctness (verify-and-skip if lost — see `skills/kanban-worker/SKILL.md` atomic claim ritual step 3). No elaborated retry/back-off protocol. Race rate expected <1% at v0 fleet sizes; revisit if observed rate exceeds that threshold.
- **Cron cadence configurability.** SPEC §Open Questions, "Cron cadence configurability". v0 documents `*/5` as the default; routine examples teach how to tune via the IronClaw routine config. No in-product configurability mechanism in the Action itself.
- **Claim-state lint.** SPEC §Open Questions, "Claim-state lint". v0 permits self-repair via the convention (Rule 2's repair clause). No automated half-state enforcement workflow.
- **Native sub-issues / "Tracked by" relationships.** Deferred to v0.1 #4. v0 honors only body-text dependency declarations; the Action does not consume the native sub-issues API. Revisit when the API exits preview and downstream projects can rely on it being stable.

## Pointers

- [`SPEC.md`](SPEC.md) — authoritative convention specification.
- [`PLAN.md`](PLAN.md) — implementation plan: waves, dependency graph, gate policy.
- [`TASKS.md`](TASKS.md) — discrete tasks with acceptance criteria and verify steps.
- [`README.md`](README.md) — user-facing intro and quickstart.
- [`docs/handoff-format.md`](docs/handoff-format.md) — byte-level handoff comment format reference.
- [`skills/kanban-worker/SKILL.md`](skills/kanban-worker/SKILL.md) — agent contract — what `kanban-worker` agents are taught.
- [`docs/routines/`](docs/routines/) — example IronClaw routine configs (cron and reactive).
- [`docs/maintenance.md`](docs/maintenance.md) — operational patterns: audit-driven dep rollups, the YAML-substitution gotcha in `roadmap/v1-issues.yaml`. Read when CI flags a deprecation or before editing the roadmap.
