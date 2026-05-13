# v1.yaml → roadmap.yaml: Scaffold Prompt

A reusable prompt that takes a fork user's `v1.yaml` (product vision) and produces a kanban-conventional `roadmap.yaml` ready for `npm run push-roadmap`.

> **Scope of v0.0.1**: this prompt produces YAML compatible with the existing `scripts/push-roadmap.mjs` pipeline. Milestone organization is set after push via a separate `gh api` step — see [Backfill notes](#backfill-notes) below. Pipeline integration (a `milestone:` field consumed during push) is a v0.0.2 follow-up.

## The prompt

Feed this verbatim to an LLM (Claude Sonnet 4.5/4.6 or equivalent) along with the user's `v1.yaml` as input.

````text
You are scaffolding a kanban-conventional roadmap for a project that follows
the MultiAgency/kanban convention (https://github.com/MultiAgency/kanban).
The user has filled in a `v1.yaml` describing their v1.0.0 vision. Produce
a single `roadmap.yaml` file that lays out versioned issues from v0.0.1
toward v1.0.0, with detail that decays with release distance.

## Input

User provides `v1.yaml`:

```yaml
vision: |
  1–2 sentence statement of what the product does at v1.0.0.
primary_user: |
  Who uses it, what job they're hiring it for.
must_have_capabilities:
  - capability 1
  - capability 2
  - capability 3..7
deployment_target: hosted | self-hosted | both
cadence_preference: small-frequent | larger-monthly
```

## Output

`roadmap.yaml`, consumable by `scripts/push-roadmap.mjs`. Top-level is an
array of issue entries; no milestone field (set post-push). Schema per
entry:

```yaml
- id: <letter-prefix>          # e.g. A1, D6, API2, INT3, UI4, RD2
- track: <one of six>          # architecture | data-model | api |
                               # integration | ui | research-docs
- title: <imperative title>
- labels: [ready | blocked, agent-eligible | human-only, skill:<one>]
- depends_on: [<other ids>]    # letter-prefix references, empty if none
- body: |
    <Markdown body. Format depends on release distance — see below.>
```

## Convention (do not invent new labels or tracks)

State (exactly one): `ready` | `blocked`
- `ready` entries: `depends_on: []`
- `blocked` entries: non-empty `depends_on`

Eligibility (exactly one): `agent-eligible` (default) | `human-only`
- `human-only` for: design taste decisions, security review, external
  relationships, anything where human judgment is the deliverable.

Skill (exactly one): `skill:writing` | `skill:research` | `skill:code` |
`skill:review` | `skill:translation`

Tracks (exactly one): `api` | `architecture` | `data-model` |
`integration` | `ui` | `research-docs`

Dependencies: rendered as `- [ ] #<id>` checklists in body via `depends_on:`
field. `push-roadmap.mjs` substitutes letter-prefix IDs with `#N` GitHub
issue numbers after first push.

## Decay-with-distance rule

Detail level by release distance from v0.0.1:

| Distance       | Body content                                          |
| -------------- | ----------------------------------------------------- |
| v0.0.1         | Full body: Context / Acceptance / Verify / Output     |
| v0.1.0         | Title + 1–2 sentence direction sketch                 |
| v0.2.0..v0.N.0 | Title-only skeleton                                   |
| v1.0.0         | Title-only skeleton + which `must_have_capability` it satisfies |

Closer-in releases are concrete because we know what they ship. Far-out
releases are placeholders because predicting v0.5.0 features from a v1
vision is unreliable; fork user re-runs this prompt (or fills in manually)
as work approaches each later release.

## Process

1. Read `v1.yaml`.
2. Decompose `must_have_capabilities` into release-sized chunks using
   `cadence_preference`:
   - `small-frequent`: 3–5 issues per release, 1–2 weeks apart
   - `larger-monthly`: 8–12 issues per release, 4–6 weeks apart
3. Identify v0.0.1: the **smallest deployable thing** on the path to v1.
   Usually the most foundational capability in its simplest form.
4. Identify v0.1.0: the next shippable increment, building on v0.0.1.
5. Identify v0.2.0 through v0.N.0: subsequent shippable increments.
6. v1.0.0: when all `must_have_capabilities` are satisfied.
7. Assign each issue to one of the six tracks.
8. Choose `skill:*` per the work the issue requires:
   - prose / docs → `skill:writing`
   - investigation / comparison → `skill:research`
   - implementation / refactor → `skill:code`
   - audit / approval → `skill:review`
   - localization → `skill:translation`
9. Default `agent-eligible`. Mark `human-only` for human-judgment work.
10. Express dependencies in `depends_on:` — only across issues in this
    roadmap. v0.0.1 issues should ideally be `ready` (no dependencies).

## Constraints

- Every issue has exactly one state, one eligibility, exactly one
  `skill:*` label, and one `track`.
- v0.0.1 issues are **independently shippable as a set** — if all close,
  the product is deployable at v0.0.1.
- v1.0.0 issues are **aspirational and skeletal** — don't pretend to know
  the v1 feature list in detail.
- Letter-prefix IDs derive from track: `A` (architecture), `D` (data-model),
  `API`, `INT` (integration), `UI`, `RD` (research-docs). Numbered within
  track: A1, A2, ... D1, D2, ...

## Output validation (check before finalizing)

These mirror `scripts/validate-roadmap.sh`:

- Tracks are exactly: api, architecture, data-model, integration,
  research-docs, ui
- All `depends_on` references point to declared IDs in the same roadmap
- Every entry: exactly one of `ready` or `blocked` (not both, not neither)
- Every `blocked` entry has non-empty `depends_on`
- Every `ready` entry has empty `depends_on`
- Every entry: exactly one of `agent-eligible` or `human-only`
- Every entry has at least one `skill:*` label

## Examples

A `ready` v0.0.1 issue (full body):

```yaml
- id: A1
  track: architecture
  title: "ADR: backend framework choice"
  labels:
    - ready
    - agent-eligible
    - skill:writing
  depends_on: []
  body: |
    Pick the backend framework for v0.0.1's hosted deployment.

    **Acceptance:** ADR draft at `docs/adr/0001-backend-framework.md`
    with: chosen framework, three rejected alternatives each with a
    one-paragraph rationale, and a criteria-by-criteria comparison
    table.

    **Verify:** ADR renders cleanly on GitHub; comparison table
    covers TypeScript support, OpenAPI generation, dependency
    footprint, ecosystem maturity.

    **Output:** `docs/adr/0001-backend-framework.md`
```

A `blocked` v0.0.1 issue (full body, has dependencies):

```yaml
- id: D2
  track: data-model
  title: "User entity schema"
  labels:
    - blocked
    - agent-eligible
    - skill:writing
  depends_on: [A1, D1]
  body: |
    Define the User table. Schema decisions blocked on A1's framework
    choice (ORM compatibility) and D1's tenancy model.

    **Acceptance:** Drizzle schema at `db/schema/users.ts` with: id,
    email, github_login, created_at; index on github_login. Migration
    file generated.

    **Verify:** `pnpm db:generate` produces no diff after running this
    schema; integration test confirms unique-index on github_login.

    **Output:** `db/schema/users.ts`, `db/migrations/0001_users.sql`
```

A v0.1.0 issue (1–2 sentence sketch):

```yaml
- id: API1
  track: api
  title: "GET /tasks endpoint with pagination"
  labels:
    - blocked
    - agent-eligible
    - skill:code
  depends_on: [A1, D1, D2]
  body: |
    Wire the read-side list endpoint. Cursor-based pagination per the
    framework's conventions; OpenAPI schema generated automatically.
    Full body to be written when this release approaches.
```

A v1.0.0 issue (skeleton + capability tag):

```yaml
- id: INT4
  track: integration
  title: "Bidirectional GitHub sync"
  labels:
    - blocked
    - agent-eligible
    - skill:code
  depends_on: [API1, API2, A3]
  body: |
    Satisfies `must_have_capabilities[2]`: "bidirectional GitHub sync".
    Skeletal — full body to be written when this release approaches.
```
````

## Recommended file locations in your fork

Once the prompt produces `roadmap.yaml`:

1. Save as `roadmap/v1-issues.yaml` (the path `scripts/push-roadmap.mjs` reads from).
2. Run `bash scripts/validate-roadmap.sh` to confirm invariants hold. Note: that script's hardcoded `EXPECTED_COUNT=45` is canonical to this upstream repo; fork users should update it to their entry count or remove the check.
3. Run `npm run push-roadmap -- --repo <your-org>/<your-repo> --dry-run` to preview, then drop `--dry-run` to push.
4. Set GitHub Milestones (see [Backfill notes](#backfill-notes)).

## Backfill notes

`push-roadmap.mjs` in v0.0.1 of this scaffold framework does not consume a `milestone:` field. To associate issues with release versions:

```sh
# Create milestones
for v in v0.0.1 v0.1.0 v1.0.0; do
  gh api -X POST /repos/<your-org>/<your-repo>/milestones \
    --field title=$v --field state=open
done

# Assign issues (manual mapping from your roadmap.yaml)
gh issue edit <N> --milestone v0.0.1 -R <your-org>/<your-repo>
```

For pipeline-integrated milestone assignment (auto-set from a `milestone:` field in YAML), see the v0.0.2 follow-up plan.

## Worked example for this repo

See [`docs/scaffolding/worked-example.yaml`](worked-example.yaml) for what this prompt produces when fed `roadmap/v1.yaml` (this repo's actual v1 vision). The worked example is illustrative — the actual roadmap for `MultiAgency/kanban` lives at [`roadmap/v1-issues.yaml`](../../roadmap/v1-issues.yaml).

## Why the format is what it is (optional reading)

The convention's output schema isn't arbitrary. Each `depends_on:` reference, each handoff field (`changed_files`, `verification`, `residual_risk`, `links`), and each `skill:*` label is a graph-edge schema. As your fork accumulates closed issues, the structured fields encode a queryable context graph: every closed issue is a node, every reference is an edge, every handoff is data the substrate can traverse when a future agent claims related work.

You don't need to think about the graph when adopting the convention — the structure produces it automatically. But it's worth knowing that's what's happening. The prompt's output shape is designed so that the longer your fork runs, the more useful the accumulated context becomes for the next agent (or the next you). For practical implications of treating the convention as graph-producing rather than just status-tracking, see [`recommended-workflow.md`](recommended-workflow.md#the-graph-that-accumulates).
