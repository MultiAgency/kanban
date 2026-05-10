# kanban-worker

> An IronClaw skill for working on MultiAgency/kanban-conventional GitHub repositories.

## What it does

Teaches an IronClaw agent to claim a `ready` issue on a kanban-conventional repo, work it, post a structured handoff comment, and close the issue. Encodes the six convention rules verbatim, the atomic claim ritual (Rule 2), the eligibility check (Rule 6 with `human-only` veto), the handoff comment format, and two soft inputs for cross-issue context.

The full skill content — frontmatter and prompt — lives in [`SKILL.md`](SKILL.md). The frontmatter declares the activation keywords/patterns IronClaw uses to load the skill into agent context.

## Install

Place this directory in your IronClaw deployment's skills path. The skill resolver loads it automatically when its `activation` keywords or patterns appear in agent context. See [`docs/routines/cron-setup.md`](../../docs/routines/cron-setup.md) and [`docs/routines/reactive-setup.md`](../../docs/routines/reactive-setup.md) at the repo root for deployment recipes.

## Dependencies

- **IronClaw runtime** with valid LLM provider credentials. See [SPEC.md §Tech Stack](../../SPEC.md#tech-stack) for runtime-version constraints, and [`docs/ironclaw-tracer-outcome.md`](../../docs/ironclaw-tracer-outcome.md) for v0.28.0-specific setup requirements (sandbox config, GitHub auth, master-key handling). Setup steps are documented per-finding with mitigations.
- **IronClaw GitHub extension** with issue read/write OAuth scope. The skill uses GitHub's API for label transitions, assignment, comment posting, and issue close.

## Authoritative references

- [`SKILL.md`](SKILL.md) — the agent contract.
- [`SPEC.md` §Convention](../../SPEC.md#convention) — the six rules the skill teaches.
- [`SPEC.md` §Handoff comment format](../../SPEC.md#handoff-comment-format) — byte-level format the skill produces.

## License

Dual-licensed under MIT or Apache-2.0 at your choice — matches the parent `MultiAgency/kanban` repo. See [`LICENSE-MIT`](../../LICENSE-MIT) and [`LICENSE-APACHE`](../../LICENSE-APACHE) at the repo root.
