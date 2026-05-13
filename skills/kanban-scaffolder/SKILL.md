---
name: kanban-scaffolder
version: 0.0.1
description: Scaffold a kanban-conventional roadmap.yaml from a v1.yaml product vision. Produces letter-prefix-ID YAML compatible with scripts/push-roadmap.mjs, with detail decaying with release distance (v0.0.1 full bodies, v0.1.0 sketches, beyond = skeletons).
activation:
  keywords:
    - scaffold roadmap
    - bootstrap roadmap
    - v1.yaml
    - roadmap scaffolding
    - kanban-scaffolder
    - "MultiAgency/kanban"
    - new fork
    - bootstrap fork
  patterns:
    - "scaffold.*v1"
    - "bootstrap.*kanban"
    - "generate.*roadmap"
    - "fork.*roadmap"
    - "v1\\.yaml"
  tags:
    - kanban
    - scaffolding
    - roadmap
  max_context_tokens: 3500
---

# kanban-scaffolder

Generate a kanban-conventional `roadmap.yaml` from a fork user's `v1.yaml` (product vision). Produces YAML consumable by `scripts/push-roadmap.mjs` with letter-prefix IDs and detail that decays with release distance.

## Canonical prompt text

The full scaffolding prompt lives at [`docs/scaffolding/v1-to-roadmap.md`](../../docs/scaffolding/v1-to-roadmap.md) in this repo. Treat that document as the source of truth; this skill is just the IronClaw-activation surface that points at it.

## When this skill activates

Use when:

- A fork user provides a `v1.yaml` and asks to scaffold an initial roadmap
- The keyword/pattern triggers match incoming messages about bootstrapping a kanban-conventional repo
- A new project needs an issue set to seed `roadmap/v1-issues.yaml`

Do NOT use for:

- Ongoing claim/work/close cycles on an existing roadmap — that's the [`kanban-worker`](../kanban-worker/SKILL.md) skill's job
- Validating or fixing an existing `roadmap/v1-issues.yaml` — that's `scripts/validate-roadmap.sh`
- Pushing issues to GitHub — that's `scripts/push-roadmap.mjs`

## Workflow

1. Read the user's `v1.yaml`. It must have these fields (validate before proceeding):
   - `vision` — 1–2 sentence v1.0.0 product statement
   - `primary_user` — who uses it, what job they're hiring it for
   - `must_have_capabilities` — 3–7 bullets
   - `deployment_target` — `hosted` | `self-hosted` | `both`
   - `cadence_preference` — `small-frequent` | `larger-monthly`

2. Apply the procedure in [`docs/scaffolding/v1-to-roadmap.md`](../../docs/scaffolding/v1-to-roadmap.md). Key rules:
   - Letter-prefix IDs by track (A=architecture, D=data-model, API, INT=integration, UI, RD=research-docs)
   - State + eligibility + skill labels per `.github/labels.yml`
   - Decay-with-distance: v0.0.1 full bodies, v0.1.0 sketches, beyond = title-only skeletons
   - Output validation mirrors `scripts/validate-roadmap.sh` invariants

3. Write the output to `roadmap/v1-issues.yaml` in the user's fork (or wherever they direct).

4. Surface the post-output checklist:
   - Run `bash scripts/validate-roadmap.sh` (note: hardcoded `EXPECTED_COUNT=45` may need adjustment per fork)
   - Run `npm run push-roadmap -- --repo <their-org>/<their-repo> --dry-run` to preview
   - Drop `--dry-run` to push for real
   - Set GitHub Milestones via separate `gh api` step (pipeline-integrated milestone assignment is a v0.0.2 follow-up)

## Worked example

See [`docs/scaffolding/worked-example.yaml`](../../docs/scaffolding/worked-example.yaml) — the output this skill produces when fed `roadmap/v1.yaml` (this repo's actual v1 vision). Illustrative; the actual roadmap for `MultiAgency/kanban` lives at [`roadmap/v1-issues.yaml`](../../roadmap/v1-issues.yaml).

## Boundary against kanban-worker

`kanban-worker` operates on a roadmap that already exists. `kanban-scaffolder` produces the roadmap that `kanban-worker` then operates on. The two skills compose:

```
v1.yaml ──→ [kanban-scaffolder] ──→ roadmap.yaml ──→ npm run push-roadmap ──→ GitHub issues ──→ [kanban-worker] ──→ closed issues + handoffs
```

A fork user invokes `kanban-scaffolder` once at project start, then `kanban-worker` repeatedly as work flows.
