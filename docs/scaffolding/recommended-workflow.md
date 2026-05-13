# Recommended workflow after scaffolding

The scaffold prompt at [`v1-to-roadmap.md`](v1-to-roadmap.md) produces a `roadmap.yaml`. Operating that roadmap — picking up issues, doing the work, shipping releases — is its own discipline. This doc maps the kanban convention's surface to the agentic-development skills lifecycle, so fork users get a workflow alongside the YAML.

> **Opt-in by design.** Fork users who just want a roadmap can ignore this doc and use the convention directly. The skill chain below is a recommended practice for fork users who want their agents (and themselves) to follow senior-engineering process. None of this is enforced by the substrate.

## Skill index reference

The skill set documented at [`.claude/skills/using-agent-skills/SKILL.md`](../../.claude/skills/using-agent-skills/SKILL.md). Each skill encodes a process; the meta-skill is the entry point that helps an agent identify which skill applies to the current development phase.

## Convention → skill mappings

The kanban convention's `skill:*` labels are about who can claim an issue, not about which process to apply. Once an agent has claimed (or a human is working an issue), the skill below describes the process to follow.

| Convention `skill:*` label | Recommended skill chain |
| -- | -- |
| `skill:research` | [`spec-driven-development`](../../.claude/skills/spec-driven-development/SKILL.md) → [`documentation-and-adrs`](../../.claude/skills/documentation-and-adrs/SKILL.md) |
| `skill:writing` | [`documentation-and-adrs`](../../.claude/skills/documentation-and-adrs/SKILL.md) (ADRs, specs) or [`spec-driven-development`](../../.claude/skills/spec-driven-development/SKILL.md) (requirements docs) |
| `skill:code` | [`spec-driven-development`](../../.claude/skills/spec-driven-development/SKILL.md) → [`planning-and-task-breakdown`](../../.claude/skills/planning-and-task-breakdown/SKILL.md) → [`incremental-implementation`](../../.claude/skills/incremental-implementation/SKILL.md) → [`test-driven-development`](../../.claude/skills/test-driven-development/SKILL.md) |
| `skill:review` | [`code-review-and-quality`](../../.claude/skills/code-review-and-quality/SKILL.md) — five-axis review with quality gates |
| `skill:translation` | No specific chain — apply [`incremental-implementation`](../../.claude/skills/incremental-implementation/SKILL.md) per locale, verify with native speakers |

## Release-level skill mappings

The decay-with-distance scaffold output produces issues at different release distances. The recommended skill chain shifts by distance:

| Release distance | Dominant skills | Why |
| -- | -- | -- |
| v0.0.1 (immediate) | [`spec-driven-development`](../../.claude/skills/spec-driven-development/SKILL.md), [`planning-and-task-breakdown`](../../.claude/skills/planning-and-task-breakdown/SKILL.md), [`incremental-implementation`](../../.claude/skills/incremental-implementation/SKILL.md) | v0.0.1 issues have full bodies. Spec is concrete. Plan-and-implement is the operating mode. |
| v0.1.0 (next) | [`spec-driven-development`](../../.claude/skills/spec-driven-development/SKILL.md) most prominent — the sketches need fleshing out before they're implementation-ready | Body sketches need to be turned into concrete acceptance criteria before agents can implement. |
| v0.2.0..v0.N.0 | [`spec-driven-development`](../../.claude/skills/spec-driven-development/SKILL.md) — start with idea refinement, then spec | Title-only skeletons. Refine the title into a substantive idea, then spec it. |
| v1.0.0 | Re-run the scaffold prompt with updated `v1.yaml` and current-state input | The v1.0.0 capability tags are anchors, not blueprints. Re-derive intermediate releases as work approaches. |

## The graph that accumulates

The convention's structured handoff format isn't just for human review — it's the schema for a context graph your fork accumulates as work closes. Treating it that way (rather than as paperwork) is where compounding value comes from.

Each handoff produces a node in your repo's growing graph. The structured fields are graph-edge schemas:

| Convention field | Graph contribution |
| -- | -- |
| `depends_on:` body checklists | Backward edges to parent issues |
| Handoff `links:` array | Forward/sibling edges to related work |
| Handoff `changed_files:` | Edges to files (touchpoints) |
| Handoff `verification:` | Annotation on how the node was validated |
| Handoff `residual_risk:` | Forward edges to "what could break next" |
| `skill:*` + track labels | Categorical clusters for retrieval |

You don't query this graph manually — the substrate does, when an agent claims new work and needs relevant past context surfaced. But the more deliberately you (or the agent claiming) fill in handoff fields, the more useful the graph becomes for the *next* agent. A handoff that just says "done" produces a node with no outgoing edges; one with concrete `verification` steps + named `residual_risk` items adds queryable structure.

A practical heuristic: when posting a handoff, write the `links` and `residual_risk` arrays for whoever claims next, not for the human reading right now. That's where the compounding lives.

## Cross-cutting practices

Apply these regardless of skill label or release distance:

- **[`context-engineering`](../../.claude/skills/context-engineering/SKILL.md)** at the start of each agent session — load the right files into context before claiming.
- **[`doubt-driven-development`](../../.claude/skills/doubt-driven-development/SKILL.md)** for any non-trivial decision in-flight — fresh-context adversarial review of the commit you're about to make.
- **[`git-workflow-and-versioning`](../../.claude/skills/git-workflow-and-versioning/SKILL.md)** for every commit — atomic, scope-disciplined, clean history.
- **[`debugging-and-error-recovery`](../../.claude/skills/debugging-and-error-recovery/SKILL.md)** whenever something doesn't work as expected — reproduce, localize, fix, guard.

## Release-ship practices

When a release is ready to ship (`v0.0.1` → `v0.1.0`, etc.):

1. **[`code-review-and-quality`](../../.claude/skills/code-review-and-quality/SKILL.md)** — five-axis review across all v0.X.0 issues in the release.
2. Confirm CI passes (no dist-drift, no broken cross-refs, lint + typecheck green).
3. **[`documentation-and-adrs`](../../.claude/skills/documentation-and-adrs/SKILL.md)** — write the CHANGELOG entry; create or update ADRs for load-bearing decisions made during the release.
4. **[`shipping-and-launch`](../../.claude/skills/shipping-and-launch/SKILL.md)** — pre-launch checklist, monitoring, rollback plan.
5. Tag the release, update the floating `v0` tag, publish release notes via `gh release create`.

## Failure modes to watch for

These come from the meta-skill's [Failure Modes to Avoid](../../.claude/skills/using-agent-skills/SKILL.md#failure-modes-to-avoid). The kanban convention's specific manifestations:

| General failure mode | Kanban-specific manifestation |
| -- | -- |
| Making wrong assumptions without checking | Claiming an issue without reading its dependencies' handoffs — you act on what you assume parents shipped, not what they actually shipped |
| Skipping verification because "it looks right" | Closing an issue without running the acceptance verify steps — the handoff comment says "done" but `parseHandoff` doesn't even apply because the work artifact doesn't exist |
| Modifying code orthogonal to the task | Bundling other roadmap issues' work into one claim — the convention is one-issue-per-claim, not "do everything in this area while I'm here" |
| Overcomplicating code and APIs | Letting a v0.0.1 issue scope-creep into v0.1.0 work because "we'd just have to do it anyway" — defeats the decay-with-distance reason for separating releases |

## Boundary against the convention itself

The convention defines **what** ([`SPEC.md`](../../SPEC.md) §Convention) — labels are status, claims are atomic, dependencies are body-text, handoffs are structured comments.

The skill set defines **how** — the process for deriving a spec, planning the work, implementing incrementally, reviewing, shipping.

Both are needed. The convention without the skill set is "free-form chaos with a status board." The skill set without the convention is "process applied to nothing in particular." Together they're a coherent agentic-development practice.
