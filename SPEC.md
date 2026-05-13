# SPEC: MultiAgency/kanban

> A coordination convention for IronClaw agents working alongside human contributors on GitHub Issues. Ships as a SKILL.md, a template repository, and a GitHub Action.

## Objective

Build the v0 deliverables for `MultiAgency/kanban`: an IronClaw skill teaching the convention, a GitHub-template repository that humans and agents fork to start a project, and a GitHub Action that promotes issues from `blocked` to `ready` when their parents close. The Action is required for the dependency rule of the convention to function automatically — without it, every project owner has to walk dependents and update labels by hand on every issue close.

The repository at `github.com/MultiAgency/kanban` serves three roles simultaneously: source code for the Action and shared parsing utilities, container for the skill content, and the template repository itself (marked as "Template repository" in GitHub settings — users fork directly).

Success looks like: an IronClaw agent owner installs the GitHub extension, installs the `kanban-worker` skill, configures a 5-minute cron routine, forks the kanban repo, and within minutes their agent claims a `ready` issue, posts a structured handoff comment, and closes it — with everything observable on the public repo.

The convention-first shape of v0 is a deliberate sequencing decision, not a permanent architectural stance. v0 is a convention because it's the cheapest path to validating that AI agents and humans can usefully share a backlog at all — a lost weekend if it doesn't work, a foundation if it does. v1 is plausibly an application — a hosted platform with its own data model, real-time agent presence, dependency-graph visualization, integration story, and business model — built on top of the validated convention rather than instead of it. The convention's installed base becomes the platform's launch audience. The convention itself is durable: it persists alongside the app indefinitely as the lightweight integration path for self-hosters, GitHub-only shops, and ecosystem partners who don't want a hosted service. Maintenance on the convention happens continuously rather than as a distinct version. This SPEC.md describes v0 only; v1, when it happens, gets its own spec.

## Constraints

These are architectural constraints, not preferences — v0 commits to them and the rest of the system shape depends on them.

- **GitHub-native substrate.** Issues are the source of truth. No alternative substrate in v0 (no Linear, no Notion, no custom backend).
- **IronClaw-compatible agents.** Agent-side integration assumes the IronClaw runtime with the GitHub extension installed. IronClaw is an Agent OS focused on privacy, security, and extensibility — see [nearai/ironclaw](https://github.com/nearai/ironclaw) and [docs.ironclaw.com/llms.txt](https://docs.ironclaw.com/llms.txt). Non-IronClaw agents (LangChain, raw Python services, etc.) can drive GitHub directly via the standard API but aren't a v0 deliverable.
- **GitHub-hosted Actions runner only.** The dependency-promotion Action runs on `ubuntu-latest`, Node 24 (`runs.using: node24`). Self-hosted runner support is out of scope for v0.
- **Dual MIT / Apache-2.0 license.** Matches IronClaw and IronHub. No other licensing options.
- **Bundled artifact discipline.** `dist/index.js` must stay in sync with `src/action/`. CI fails if they drift. Contributors must run `npm run build` before committing source changes to `src/action/`.
- **Canonical labels are hardcoded.** The Action and SKILL.md depend on exact label names (`ready`, `in-progress`, `blocked`, plus `skill:*` tags). Renaming or removing a canonical label is an "Ask first" action, not a free contribution.
- **Public repos in v0.** The bootstrap project and template are public. Private-repo support is not blocked but isn't a v0 acceptance criterion.
- **GitHub auth is the only auth.** GitHub OAuth (already required for any GitHub user) plus IronClaw's own auth cover both human and agent identity. Nothing additional to build.

## Convention

The kanban convention is six rules. The `kanban-worker` SKILL.md teaches these to agents; the README.md teaches them to humans. The spec lists them here so this document is self-contained for implementation.

1. **Labels are status.** `ready` = open for claim. `in-progress` = actively being worked. `blocked` = waiting on input. Closing the issue means done; there is no `done` label.
2. **Assignment is claim.** To claim an issue, self-assign and swap `ready` → `in-progress` together. Both transitions happen as one logical step — a self-assign without the label swap, or vice versa, is broken state and should be repaired.
3. **Dependencies are GitHub issue links.** Use `- [ ] #N` checklists in the issue body to declare a dependency. An issue stays `blocked` until all referenced parents close. Native GitHub "Tracked by" / sub-issue relationships are deferred to v0.1 once the underlying API exits preview.
4. **Handoffs are structured comments.** Posted at completion. Format defined below.
5. **Block by commenting.** If you can't proceed, post a comment explaining why and switch the label to `blocked`. The blocking contributor stays assigned — the assignee + `blocked` label is the visible accountability signal. Unblocking — by the original assignee, a peer, or a human — restores the label to `in-progress` if the assignee resumes, or to `ready` (with assignee cleared) if the assignee is handing it off. Don't silently re-assign someone else's blocked issue.
6. **Skills are project-declared via labels.** Issues declare required skills via `skill:*` labels. Agents check before claiming. Agent eligibility is opt-in: agents claim only issues explicitly labeled `agent-eligible`. Issues without `agent-eligible` are human-only by default, regardless of skill labels. The `human-only` label is a hard veto — even on an `agent-eligible` issue, the presence of `human-only` means agents must skip.

### Canonical labels

The Action and the SKILL.md depend on these exact label names. Defined authoritatively in `.github/labels.yml`:

```
ready              — open for claim
in-progress        — actively being worked
blocked            — waiting on input or upstream
human-only         — hard veto; agents skip even if agent-eligible is also present
agent-eligible     — agents may pick up
skill:research     — needs research skill
skill:writing      — needs writing skill
skill:translation  — needs translation skill
skill:code         — needs code skill
skill:review       — needs review skill
```

Renaming or removing a canonical label is an "Ask first" action — they're hard-coded in the Action and the SKILL.md.

### Handoff comment format

A handoff comment has three parts: a bold one-line summary, a fenced JSON metadata block, and optional trailing prose. The `handoff` fence is the parser's anchor — the first ` ```handoff ` block in the comment is the handoff metadata.

````markdown
**Handoff:** one-line summary

```handoff
{
  "changed_files": ["path/to/file"],
  "verification": ["command or check"],
  "residual_risk": ["what wasn't covered"],
  "follow_ups": [
    {
      "title": "short title",
      "body": "issue body; Action appends `- [ ] #parent` automatically",
      "skills": ["skill:research"],
      "agent_eligible": true
    }
  ],
  "links": ["url"]
}
```

Optional prose context follows here.
````

All JSON fields are optional; agents include only those that apply. The parser is permissive on string-array fields — it returns `null` on a missing fence or malformed JSON rather than throwing, and downstream agents proceed without the metadata.

The `follow_ups` field is optional and structured: each entry, if well-formed, materializes as a new GitHub issue at parent-close time via the dependency-promotion Action. Each follow-up issue is created with the listed `skills` as `skill:*` labels, plus `ready` and (conditionally) `agent-eligible`; the Action appends `- [ ] #parent` to the body so the convention's dependency parser sees the link. Malformed `follow_up` entries are dropped silently at parse time; the field itself is non-mandatory — agents include it only when residuals are concrete enough to file as discrete work.

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Node 24 LTS (action runtime via `runs.using: node24`; CI build environment also Node 24; `package.json` `engines` requires `>=24.0.0` so the bundled `dist/` stays byte-stable across local and CI)
- **Action bundler:** `esbuild` (single-file CJS dist targeting `node24`, configured in `package.json` `build` script)
- **Test framework:** Vitest
- **Lint + Format:** Biome (single toolchain replacing ESLint + Prettier; covers JavaScript, TypeScript, and JSON. Markdown and YAML are not formatter-tracked.)
- **Reactive adapter:** Cloudflare Worker at `worker/` (v0.1+; bridges GitHub's `X-Hub-Signature-256` HMAC to IronClaw's chat HTTP channel via re-signing). Has its own `worker/package.json` and `worker/wrangler.toml` — independent of the Action's TypeScript build. Optional for forks: required only when the reactive substrate is enabled; the cron substrate doesn't need it. Deployed via `wrangler deploy` from inside `worker/`. See [`docs/routines/reactive-setup.md`](docs/routines/reactive-setup.md) and [`worker/README.md`](worker/README.md).
- **Package manager:** npm (Action ecosystem default; avoids adding pnpm-only complexity for contributors forking the repo)
- **License:** Dual MIT / Apache-2.0 (matching IronClaw and IronHub)
- **IronClaw runtime version dependence.** Acceptance tests T1 and T4 require a working IronClaw runtime configured with valid LLM provider credentials. Release notes pin the validated runtime version; operational quirks and fork-user setup mitigations are recorded in `docs/ironclaw-tracer-outcome.md`. For v0.28.0 specifically, four one-time mitigations on first setup: (1) keychain wrapper for the NEAR AI session-token gap (Finding 11b); (2) `iclaw config set sandbox.enabled false` to skip the Docker probe and avoid a ~4-minute startup timeout when Docker isn't running (Finding 11a); (3) `GITHUB_TOKEN=<pat> iclaw tool auth github` with a PAT scoped `repo`/`workflow`/`read:org` (and `Configure SSO → Authorize` for SAML-SSO orgs like `MultiAgency`) to seed a per-token scope record via the env-var path — OAuth-app flow is the legacy alternative (Finding 12); (4) re-auth every tool whose credentials predate the current master key, since `ironclaw onboard`'s "fresh keychain master key" option silently invalidates pre-existing encrypted blobs (Finding 12c).

No runtime dependencies beyond `@actions/core` and `@actions/github` for the Action. Canonical dev-dependency set lives in `package.json`; current devDeps include `typescript`, `vitest`, `@biomejs/biome`, `esbuild`, `yaml` (used by `scripts/push-roadmap.mjs`).

## Commands

```
Build:        npm run build         # esbuild bundles src/action/index.ts → dist/index.js
Test:         npm test              # vitest run
Test (dev):   npm run test:watch    # vitest in watch mode
Lint:         npm run lint          # biome lint .
Format:       npm run format        # biome format --write .
Format-check: npm run format:check  # biome format .
Typecheck:    npm run typecheck     # tsc --noEmit
Push roadmap: npm run push-roadmap  # node scripts/push-roadmap.mjs (see Implementation Notes)
Worker deploy: cd worker && wrangler deploy  # reactive substrate adapter; see worker/README.md
```

`npm run build` must be run before committing changes to `src/action/`, since `dist/index.js` is the file GitHub Actions executes. CI verifies that `dist/` is up to date with source.

The `worker/` subtree has its own `package.json` and Cloudflare Workers toolchain (`wrangler`); deps there don't affect the Action bundle and the worker only matters when the reactive substrate is in use.

## Project Structure

```
kanban/
├── README.md                        # convention explanation for human contributors
├── CLAUDE.md                        # per-repo Claude Code context
├── SPEC.md                          # this file
├── PLAN.md                          # implementation plan (durable planning artifact)
├── TASKS.md                         # task breakdown (durable planning artifact)
├── LICENSE-MIT
├── LICENSE-APACHE
├── package.json
├── tsconfig.json
├── biome.json
├── .gitignore
├── action.yml                      # publishes the Action for `uses: MultiAgency/kanban@v0`
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── task.yml
│   │   ├── meta.yml
│   │   └── blocker.yml
│   ├── workflows/
│   │   ├── ci.yml                   # full pipeline on PR (see Testing Strategy)
│   │   └── promote-dependencies.yml # the Action's workflow
│   └── labels.yml                   # canonical label set
├── src/
│   ├── action/
│   │   └── index.ts                 # Action entrypoint
│   └── lib/
│       ├── handoff.ts               # parse/format handoff comments
│       └── dependencies.ts          # parse issue body for parent links
├── dist/
│   └── index.js                     # esbuild-bundled Action (committed)
├── tests/
│   ├── handoff.test.ts
│   └── dependencies.test.ts
├── skills/
│   └── kanban-worker/
│       ├── SKILL.md                 # the skill content
│       └── README.md
├── scripts/
│   ├── check-spec-refs.sh           # validates SPEC cross-refs in PLAN.md/TASKS.md
│   ├── validate-roadmap.sh          # validates roadmap/v1-issues.yaml invariants
│   └── push-roadmap.mjs             # bulk-pushes the roadmap to a target repo
├── worker/                          # Cloudflare Worker (reactive substrate adapter, v0.1+)
│   ├── README.md                    # step-by-step setup for fork users
│   ├── src/
│   │   └── index.ts                 # GitHub-webhook → IronClaw HMAC bridge
│   ├── package.json                 # independent of Action's package.json
│   └── wrangler.toml
├── roadmap/
│   └── v1-issues.yaml               # v1 application roadmap; source of truth
│                                    # materialized as live GitHub issues via push-roadmap.mjs
└── docs/
    ├── handoff-format.md            # literal spec for the comment shape
    ├── ironclaw-tracer-outcome.md   # T0.4 findings; pins runtime-version dependencies
    └── routines/
        ├── cron-setup.md
        ├── cron-tick-prompt.md
        └── reactive-setup.md
```

The repo doubles as both source code for the Action and the template content humans see when they fork. The README.md explains the convention; CLAUDE.md gives Claude Code per-repo context; SPEC.md is this document. PLAN.md and TASKS.md are durable planning artifacts retained for historical context — they record the implementation sequencing decisions but aren't load-bearing for runtime behavior.

## Code Style

TypeScript with named exports preferred. JSDoc on every exported function and type. No external runtime dependencies for parsing utilities — keep `src/lib/` pure TypeScript with regex-based parsing. The Action handler in `src/action/index.ts` is the only place `@actions/*` packages appear. The Cloudflare Worker at `worker/src/index.ts` uses `export default { fetch }` per the module-worker runtime contract; named exports cannot be universally enforced while that constraint holds.

Example from `src/lib/handoff.ts`:

````ts
/**
 * Structured metadata posted in handoff comments at task completion.
 * All fields are optional; agents include only those that apply.
 */
export interface Handoff {
  changed_files?: string[];
  verification?: string[];
  residual_risk?: string[];
  links?: string[];
}

const HANDOFF_FENCE_RE = /```handoff\n([\s\S]*?)\n```/;

/**
 * Extract handoff metadata from an issue comment body.
 * Returns null if no handoff fence is present or its content is malformed.
 */
export function parseHandoff(commentBody: string): Handoff | null {
  const match = HANDOFF_FENCE_RE.exec(commentBody);
  if (!match) return null;

  try {
    return JSON.parse(match[1]) as Handoff;
  } catch {
    return null;
  }
}
````

Conventions visible in the example: kebab-case-free file names (`handoff.ts` not `handoff-utils.ts`), exported types alongside their parsers, regex declared as module constant, terse error handling with no logging in pure utilities (the Action handles errors at the boundary).

Biome formatter settings (in `biome.json`): 2-space indent, double quotes, trailing commas, 100-char line width, semicolons always.

## Implementation Notes

### Dependencies parser

`src/lib/dependencies.ts` parses an issue body string and returns an array of parent issue numbers. It handles two formats:

1. **Checklist references:** `- [ ] #123` and `- [x] #456` (matched whether ticked or not).
2. **Closing-keyword references:** `closes #123`, `fixes #456`, `resolves #789`, `blocked by #N`, `blocks #N` (case-insensitive, on word boundaries).

The parser does not query the GitHub API; it operates purely on the body string. Native GitHub sub-issue / "Tracked by" / "Blocks" relationships are out of scope for v0; the parser's output is the Action's complete parent set for promotion decisions. v1 may extend this to consume the sub-issues API once it exits preview. Returns `[]` when no references are found and deduplicates results.

### Action error semantics

The Action runs on `issues.closed`. For each issue that links to the closed issue, it checks whether all parents are now closed and promotes the child from `blocked` to `ready` if so. With native sub-issue API out of scope (Deferred to v0.1 #4), the Action discovers candidate children via GitHub's issue search API (`is:issue is:open in:body "#N"`) and confirms parent membership by re-running `parseDependencies` on each candidate's body. Error handling rules:

- **Malformed parent reference** (e.g., `#abc` not parseable as an integer): skip that reference, continue with others.
- **Parent issue not found** (404 from API): treat as not-closed, do not promote.
- **Cross-repository parent reference** (e.g., `org/repo#123`): out of scope for v0, skip.
- **GitHub API rate limit hit:** log warning, exit 0. The next `issues.closed` event retries naturally.
- **Permission error on label write:** log error, exit 1. This is a misconfiguration — the workflow needs `permissions: issues: write`.

The Action logs to GitHub Actions output but never posts issue comments on errors. Project owners discover problems by inspecting workflow runs.

The workflow YAML must declare:

```yaml
permissions:
  issues: write
  contents: read
```

### Tooling

Beyond the Action handler and the parsing utilities, v0 ships three scripts under `scripts/`. Each is bash or plain Node ESM, exits non-zero on failure, and is invocable from CI as well as by hand.

- **`scripts/check-spec-refs.sh`** — Verifies every "Deferred to v0.1 #N" cross-reference in PLAN.md and TASKS.md resolves to a literal anchor in SPEC.md. Catches broken cross-document references before they ship.
- **`scripts/validate-roadmap.sh`** — Validates `roadmap/v1-issues.yaml` against schema invariants (entry count, canonical track set, blocked-iff-`depends_on`, eligibility XOR, skill-label presence, `depends_on` reference resolution). Invoked as a precondition by `push-roadmap.mjs` and runnable on its own.
- **`scripts/push-roadmap.mjs`** — Bulk-pushes the v1 roadmap from `roadmap/v1-issues.yaml` as live GitHub issues against a target repo. Two-pass design: Pass 1 creates issues (or reuses existing by title-as-uniqueness-key for idempotent re-runs) and captures letter-prefix → `#N` mapping; Pass 2 substitutes prefix references in body text and appends a machine-readable `## Parents` checklist matching the dependencies parser's `- [ ] #N` format. Run via `npm run push-roadmap -- --repo owner/repo [--dry-run]`.

The `roadmap/v1-issues.yaml` file is the source of truth for the v1 application roadmap. The live GitHub issues are its materialization; if the YAML and the live repo drift, the YAML wins and a re-push reconciles.

## Testing Strategy

**Unit tests (Vitest)** cover pure logic in `src/lib/` and the Action handler's pure orchestration functions. Tests live in `tests/` mirroring the source structure. Coverage target: 80% on `src/lib/`.

```
src/lib/handoff.ts        →  tests/handoff.test.ts        (parsing edge cases)
src/lib/dependencies.ts   →  tests/dependencies.test.ts   (issue body parsing)
src/action/index.ts       →  tests/action.test.ts         (covers confirmParents,
                                                            allParentsClosed, promote,
                                                            discoverChildren, run via
                                                            stub injection. main()
                                                            entry-point wrapper is
                                                            intentionally not tested
                                                            per CLAUDE.md.)
```

**Acceptance tests (manual)** are specified in the [Acceptance Test Scripts](#acceptance-test-scripts) section below:

- T1 — Agent claim and complete (cron routine, single agent, single repo)
- T2 — Human claim and complete (no IronClaw required)
- T3 — Dependency promotion (verifies the Action)
- T4 — Multi-agent handoff (two agent owners, one project)

Each test uses Given / When / Then format and is run by hand before tagging a release. v0 ships when all four pass on the bootstrap project (the kanban repo itself, populated with seed issues). Reviewers tick the four boxes in the release PR description.

CI runs the full pipeline on every PR — install, lint, format-check, typecheck, unit tests, spec-refs (`scripts/check-spec-refs.sh`), roadmap schema invariants (`scripts/validate-roadmap.sh`), build, and a dist-drift check that verifies the committed `dist/index.js` matches a fresh `npm run build`. See `.github/workflows/ci.yml` for the canonical step list. CI does not run acceptance tests — those require live IronClaw deployment and human review.

## Acceptance Test Scripts

The canonical scripts for the four manual acceptance tests. Reviewers copy the four checkbox lines into the release PR description and tick them as they pass.

```
- [ ] T1 — Agent claim and complete
- [ ] T2 — Human claim and complete
- [ ] T3 — Dependency promotion
- [ ] T4 — Multi-agent handoff
```

### Demo repo hygiene

Acceptance tests run against a throwaway test repo (e.g. `MultiAgency/test`), not the bootstrap project (`MultiAgency/kanban`) itself. The bootstrap project carries the production v1 roadmap as live issues and must stay clean — synthetic test issues, half-states, and demo iteration belong on a disposable target. The test repo is forked from the kanban template (or initialized from scratch with the canonical labels and the `promote-dependencies` workflow installed) and wiped or recreated between test cycles. T1–T4's "Given" clauses below assume this throwaway target.

### T1 — Agent claim and complete

**Given**

- A public repo forked from the `MultiAgency/kanban` template, with canonical labels and the `promote-dependencies` workflow installed.
- An IronClaw agent owner with the GitHub extension authorized for the repo, the `kanban-worker` skill installed, and a `0 */5 * * * *` cron routine configured (6-field cron per IronClaw v0.28.0; see `docs/routines/cron-setup.md`).
- One open issue with labels `ready`, `agent-eligible`, `skill:research`, no assignee, parseable task description.

**When**

- The cron routine fires on its next tick.

**Then**

- Within five minutes of the routine firing, the agent has self-assigned the issue, replaced the `ready` label with `in-progress`, performed the work, posted a comment whose first ` ```handoff ` block parses cleanly via `parseHandoff`, and closed the issue.
- No human intervention occurred between routine fire and issue close.

### T2 — Human claim and complete

**Given**

- The same forked repo as T1, no IronClaw deployment required.
- One open issue with labels `ready`, `human-only`, no assignee.

**When**

- A human contributor opens the issue in the GitHub UI, self-assigns, and starts work.

**Then**

- The contributor swaps `ready` → `in-progress`, completes the work, posts a comment containing a handoff block matching the spec format, and closes the issue.
- The handoff comment passes `parseHandoff` when copied into the unit-test fixture.

### T3 — Dependency promotion

**Given**

- A child issue C labeled `blocked`, body containing `- [ ] #A` and `- [ ] #B`.
- Parent issues A and B both open.
- The `promote-dependencies.yml` workflow installed and `dist/index.js` committed.

**When**

- A is closed; then, separately, B is closed. (Order does not matter.)

**Then**

- After the second parent closes, the workflow run for that `issues.closed` event succeeds within one minute.
- Issue C transitions from `blocked` to `ready` automatically; no human label edit occurred.
- A workflow log line records the promotion of C with both parent IDs.

### T4 — Multi-agent handoff

**Given**

- Three open issues in the same repo:
  - A — `ready`, `agent-eligible`, `skill:research`, owned by agent owner X.
  - B — `ready`, `agent-eligible`, `skill:writing`, owned by agent owner Y.
  - C — `blocked`, `agent-eligible`, `skill:review`, body links A and B as parents, owned by agent owner Z.
- All three agent owners have the `kanban-worker` skill and a `*/5` cron routine.

**When**

- X's and Y's routines fire and each agent claims, completes, and closes its parent issue with a handoff comment.
- The Action promotes C from `blocked` to `ready`.
- Z's routine fires on its next tick.

**Then**

- Agent Z reads the latest comments on A and B, parses both ` ```handoff ` blocks, and produces a synthesis result that references both parents.
- Z self-assigns C, swaps `ready` → `in-progress`, posts a handoff comment whose `links` array includes the URLs of both parent handoffs, and closes C.
- The full A → B → C chain happened without human intervention beyond the initial issue authoring.

## Boundaries

**Always do:**

- Run `npm run lint && npm run typecheck && npm test` before commits
- Run `npm run build` after any change to `src/action/` so `dist/` stays in sync
- Preserve the handoff comment format exactly as specified in `docs/handoff-format.md`
- Reference the relevant spec section in PR descriptions

**Ask first:**

- Changing the canonical label set in `.github/labels.yml`
- Modifying the handoff fence syntax (currently ` ```handoff `)
- Changing SKILL.md prompt language in ways that affect agent behavior
- Adding any runtime dependency
- Changing the directory structure in this spec

**Never:**

- Commit secrets, tokens, or `.env` files
- Edit `node_modules/`, `dist/` (except via `npm run build`), or any vendored code
- Remove a failing acceptance test scenario without explicit approval
- Ship a SKILL.md change without re-running T1–T4 against current models

## Success Criteria

The v0 release ships when all of the following are true and observable on the public repo:

1. **Lint, typecheck, and unit tests pass.** `npm run lint && npm run typecheck && npm test` exits 0; CI green on `main`.
2. **The Action builds cleanly.** `npm run build` produces a `dist/index.js` committed to the repo; `.github/workflows/promote-dependencies.yml` references it correctly.
3. **T1 passes:** an IronClaw agent with the `kanban-worker` skill installed and a `*/5` cron routine claims a `ready` issue, posts a parseable handoff comment, and closes the issue within 5 minutes of issue eligibility.
4. **T2 passes:** a human contributor claims and completes a `ready` issue using only the GitHub UI, with handoff format matching the spec.
5. **T3 passes:** closing all parents of a `blocked` issue triggers the Action, which promotes the issue to `ready` without manual intervention.
6. **T4 passes:** two agents owned by different accounts complete separate parent issues; a third agent reads both handoffs from a child issue and produces a synthesis handoff.
7. **The repo is marked "Template repository"** in GitHub settings, and a clean fork produces a working starter project on first commit.

### Demo session end state

The seven criteria above test the mechanism in isolation. v0 also ships only when the bootstrap project (this repo) has crossed the convention-to-application transition:

- **The v1 application roadmap exists as GitHub issues.** Open issues decompose v1 work across all major tracks (architecture decisions, data model, API surface, integrations, UI scaffolding, research/docs), with skill labels, dependency links where applicable, and acceptance criteria. The seed issues are this roadmap, not synthetic demonstration data. Source of truth is `roadmap/v1-issues.yaml`; the live issues are its materialization (see Implementation Notes → Tooling).
- **At least one IronClaw agent has completed a real v1 issue end-to-end.** Not a synthetic test — a substantive v1 contribution (architecture decision, schema draft, research note, design sketch) claimed and closed with a parseable handoff comment. Subject to the runtime-version dependence noted in Tech Stack.

These make explicit that v0 isn't done when the mechanism works in isolation; it's done when the mechanism is being consumed by the project's own next phase.

## Open Questions

### Open

These have genuine ambiguity that affects v0 implementation choices.

1. **SKILL.md final location.** Lives at `skills/kanban-worker/SKILL.md` in this repo. Open question: do we also publish a copy via PR into `nearai/ironhub` for ecosystem discoverability, or rely on cross-linking? Default: this repo is canonical; IronHub gets a thin pointer once v0 ships.

### Resolved during v0 execution

These had ambiguity at spec-authoring time but were settled during v0 execution. Recorded for historical context; the spec body and live repo state are now the canonical source.

1. **v1 roadmap shape.** Resolved as a 44-entry roadmap stored at `roadmap/v1-issues.yaml` and materialized as GitHub issues `#1`–`#44` on `MultiAgency/kanban`. Sized one cron-tick per issue, distributed across all six tracks (architecture 4, data model 8, API 8, integration 7, UI 8, research/docs 9). 19 ready+`agent-eligible` at materialization, 24 `blocked` with cross-track dependencies, 1 `human-only` (`RD1b`). Layered dependency graph exercises the Action's promotion mechanism end-to-end. Bulk-pushed via `scripts/push-roadmap.mjs` against the live repo on 2026-05-10.

### Deferred to v0.1

These are decided-and-parked: v0 ships without them, the disposition is recorded so v0.1 planning can pick them up directly.

1. **Deferred to v0.1 #1 — Cron cadence configurability.** _Addressed in v0._ `docs/routines/cron-setup.md` §Operational notes teaches how to tune the default cadence via IronClaw's routine config (faster picks up new issues sooner; slower reduces compute spend). No in-product configurability mechanism in the Action itself; v0.1 may revisit if fork users want a single per-repo knob rather than per-routine tuning.

2. **Deferred to v0.1 #2 — Claim-state lint.** Periodically scan the project's open issues for half-states — `assignee-set + ready-label` or `unassigned + in-progress-label` — and surface them. Recommended implementation: a second GitHub Action on `schedule` (e.g., daily) that posts a single rolled-up comment on a tracking issue if any half-states exist. Default: defer to v0.1; the convention permits self-repair, so v0 can ship without enforcement.

3. **Deferred to v0.1 #3 — Concurrent-claim race.** Two agents claiming the same issue within seconds is possible. Expected rate at v0 fleet sizes (<10 active agents on any given project) and `*/5` cron cadence is well under 1%, since GitHub serializes assignment writes at the API level — the second agent sees the post-first-call assignee state in its response. Cost is one wasted work unit per occurrence. Default: don't solve in v0 protocol; observe in real use. If the race rate exceeds 1% in production v0 deployments, v0.1 adds either an Action-side claim-arbitration check or a SKILL.md back-off ritual — choice deferred until empirical data justifies one approach over the other.

4. **Deferred to v0.1 #4 — Native sub-issue / "Tracked by" relationships.** v0 honors only body-text dependency declarations. Native GitHub sub-issue links (currently in preview) are not part of the parent set the Action evaluates. v1 may extend the Convention and the Action to consume these once the underlying API exits preview and projects can rely on it being stable.

5. **Deferred to v0.1 #5 — Batch parent-status lookup in `allParentsClosed`.** The current implementation makes N API calls when checking N parents (worst case in the v1 roadmap: `INT6` with 6 parents = 6 `issues.get` calls per child evaluation). Not blocking for v0 (44-issue scale, well under rate limits) but worth optimizing as the convention scales to larger fork-user repos. Note: REST issue search has no qualifier for "issues with these specific numbers" — the only viable batching path is GraphQL `nodes(ids: [...])` with pre-resolved node IDs (one extra round-trip per child to map number→id, unless cached). v0.1 should either accept the GraphQL refactor or keep the loop and add concurrency.

6. **Deferred to v0.1 #6 — Reactive substrate end-to-end.** _Addressed in v0.1._ The convention is substrate-agnostic — the six rules don't care whether an agent's claim ritual was triggered by a cron tick or a webhook event. v0.0.1 verified the cron substrate end-to-end (T7.1, T6.4 MVP). v0.1 ships the reactive substrate via path 3 of three candidates considered: IronClaw's HTTP webhook channel (`POST /webhook` with `{user_id, content}` body, HMAC-signed via `X-Hub-Signature-256` — same scheme GitHub uses outbound) plus a Cloudflare Worker adapter (`worker/`) that validates GitHub's signature, translates `{action, issue, ...}` events into natural-language prompts the kanban-worker skill recognizes, and re-signs for IronClaw. Path 1 (github tool's `handle_webhook` action) requires the agent already have the payload in context, so it collapses into "what underpins it." Path 2 (reactive routine with `trigger_type: webhook` and per-routine `/hooks/<path>` endpoint) is empirically closed: `routine_create(trigger_type=webhook)` accepts the call but the daemon registers no HTTP route — IronClaw's runtime registration is not implemented in v0.28.0. Setup: `wrangler deploy` from `worker/`, two secrets (`GITHUB_WEBHOOK_SECRET`, `IRONCLAW_WEBHOOK_SECRET`), GitHub webhook on the target repo pointing at the Worker URL with `Issues` event selected. Demo: a `ready`-label event on `MultiAgency/test` fired the kanban-worker convention end-to-end in ~1m 25s (label → webhook → Worker → IronClaw → claim ritual → file commit → handoff → close), all autonomous.

7. **Deferred to v0.1 #7 — github WASM tool missing claim-ritual write actions.** IronClaw's bundled `github` WASM tool (v0.2.3, wit_version 0.3.0) exposes 32 actions covering reads, comments, file commits, PRs, branches, releases, and workflows — but **lacks the four write actions Rule 2's atomic claim ritual requires**: `add_assignees`, `add_labels`, `remove_label`, and `update_issue` (state changes). The capabilities.json `discovery_summary.notes` documents the gap explicitly: _"Not supported yet: labels, milestones, projects, org/team admin, GraphQL, release asset uploads, and repository deletion."_ Empirically observed during v0.0.1 cron testing (see `docs/ironclaw-tracer-outcome.md` Finding 23): agent successfully reasoned through the ritual and posted handoff comments via `create_issue_comment`, but could not self-assign, transition labels (`ready`→`in-progress`), or close issues. Manual cleanup was required to complete the ritual on the agent's behalf. **v0 mitigation:** agents use IronClaw's built-in `http` tool against `api.github.com` for the missing four operations — `POST /issues/{n}/assignees`, `POST /issues/{n}/labels`, `DELETE /issues/{n}/labels/{label}`, `PATCH /issues/{n}` with `{state: "closed", state_reason: "completed"}`. The built-in http tool has a `CredentialMapping::bearer("github_token", "api.github.com")` (verified in `src/tools/builtin/http.rs`); the PAT injects at the network proxy layer, so credentials never enter conversation context. Tool-selection guidance for autonomous routines lives in `AGENTS.md` (workspace identity file), not SKILL.md — the convention spec stays substrate-agnostic. **v0.1 path:** file an upstream PR against `nearai/ironclaw` adding the four missing action variants to `GitHubAction` in `tools-src/github/src/lib.rs` (mechanical: each maps to a single REST endpoint with stable shape). Once merged, the AGENTS.md workaround section becomes redundant and can be retired.
