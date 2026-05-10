# MultiAgency Kanban

> A coordination convention for IronClaw agents working alongside human contributors on GitHub Issues. Six rules, one structured handoff format, one GitHub Action.

## What is this

The MultiAgency kanban convention is a coordination protocol layered on GitHub Issues that lets humans and AI agents work together as peers on a shared project. The substrate is GitHub. The product is the convention itself: six rules for status, claim, dependencies, handoffs, blocking, and skill-eligibility. Agents and humans both operate the board with the same labels and the same closure semantics — there is no parallel agent-only system.

The convention is durable. A hosted application built on the same convention is on the v1 roadmap, but the convention persists alongside it indefinitely as the lightweight integration path for self-hosters and ecosystem partners. v0 (this release) is the convention plus the minimal infrastructure to run it: a [`kanban-worker`](skills/kanban-worker/SKILL.md) IronClaw skill, a [GitHub Action](src/action/index.ts) that promotes blocked issues to ready when their parents close, and a [template repository](https://github.com/MultiAgency/kanban) you fork to start a project.

## Why would I want it

- **Works on existing GitHub workflows.** No new daemon to host, no new dashboard to learn, no separate database to back up. If your team uses GitHub Issues, you have the substrate already.
- **Agent-native from day one.** AI agents are first-class team members — they claim, work, post handoffs, and close issues using the same labels humans do. No bolted-on automation; no shadow board.
- **Audit-trail native.** Every claim, every handoff, every promotion is a permanent event in GitHub's history. Ownership and reasoning are visible at the issue header without a separate observability stack.
- **Dual MIT / Apache-2.0.** No vendor lock-in. Your data stays in your repo. Forks can adapt freely.

## How to install

1. On GitHub, click **Use this template** (top-right of the repo page) and name your fork.
2. Apply the canonical labels in [`.github/labels.yml`](.github/labels.yml) to your fork — run `gh label create` from the YAML once at fork time.
3. Configure an IronClaw cron routine pointed at your fork — follow [`docs/routines/cron-setup.md`](docs/routines/cron-setup.md). Your first agent tick fires within five minutes.

The dependency-promotion Action runs automatically on `issues.closed` events; no separate setup is needed for it once the fork exists.

The cron substrate is the canonical, verified v0 path. The reactive webhook substrate is documented in [`docs/routines/reactive-setup.md`](docs/routines/reactive-setup.md) but its end-to-end runtime support is deferred to v0.1 — see [SPEC.md §Deferred to v0.1 #6](SPEC.md). Setup notes for IronClaw v0.28.0 quirks live in [`CHANGELOG.md`](CHANGELOG.md) under the v0.0.1 entry.

## Where to go next

| Document                                                         | Purpose                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| [`SPEC.md`](SPEC.md)                                             | Full convention specification — authoritative source.         |
| [`docs/handoff-format.md`](docs/handoff-format.md)               | Byte-level handoff comment format reference.                  |
| [`skills/kanban-worker/SKILL.md`](skills/kanban-worker/SKILL.md) | Agent contract — what `kanban-worker` agents are taught.      |
| [`docs/routines/`](docs/routines/)                               | IronClaw routine setup recipes (cron and reactive).           |
| [`PLAN.md`](PLAN.md), [`TASKS.md`](TASKS.md)                     | v0 implementation plan and discrete task breakdown.           |
| [`CLAUDE.md`](CLAUDE.md)                                         | Context for Claude Code sessions.                             |
| [`roadmap/v1-issues.yaml`](roadmap/v1-issues.yaml)               | v1 application roadmap — source of truth for the live issues. |

## Releases

Use `MultiAgency/kanban@v0` in workflow `uses:` references for latest-within-major (recommended for forks). Pin to a specific tag (e.g. `@v0.0.1` once released) for stability. The `v0` tag is moved with each `v0.0.x` release.

## License

Dual-licensed under [MIT](LICENSE-MIT) **OR** [Apache-2.0](LICENSE-APACHE) at your choice. Pick whichever fits your downstream project; you don't need both.
