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
3. Point an IronClaw substrate at your fork. Two ways, both verified end-to-end — see [`docs/routines/`](docs/routines/) for the comparison and pick one (or run both):
   - [`docs/routines/reactive-setup.md`](docs/routines/reactive-setup.md) — webhook-driven; agent claims within a minute of the `ready` label being added.
   - [`docs/routines/cron-setup.md`](docs/routines/cron-setup.md) — cron-driven; agent ticks every five minutes through eligible issues. Useful for backlog processing and for environments where the GitHub webhook can't reach your IronClaw instance.

The dependency-promotion Action runs automatically on `issues.closed` events; no separate setup is needed for it once the fork exists.

Setup notes for IronClaw v0.28.0 quirks live in [`CHANGELOG.md`](CHANGELOG.md) under the v0.0.1 entry.

## Scaffolding a roadmap

Forking the convention's infrastructure gives you the substrate; the next question is what issues to seed your board with. The scaffold prompt at [`docs/scaffolding/v1-to-roadmap.md`](docs/scaffolding/v1-to-roadmap.md) takes a fork-user's [`v1.yaml`](roadmap/v1.yaml.example) (product vision, primary user, must-have capabilities, deployment target, cadence preference) and produces a `roadmap.yaml` ready for `npm run push-roadmap`. Detail decays with release distance — v0.0.1 issues get full bodies, v0.1.0 issues get 1–2 sentence sketches, later releases are title-only skeletons until the work approaches.

See [`docs/scaffolding/worked-example.yaml`](docs/scaffolding/worked-example.yaml) for an illustrative output. The IronClaw skill wrapper is at [`skills/kanban-scaffolder/SKILL.md`](skills/kanban-scaffolder/SKILL.md). For operating the scaffolded roadmap with senior-engineering process — and for why the convention's structured fields compound into a queryable context graph as work closes — see [`docs/scaffolding/recommended-workflow.md`](docs/scaffolding/recommended-workflow.md).

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
| [`docs/scaffolding/v1-to-roadmap.md`](docs/scaffolding/v1-to-roadmap.md) | Scaffold prompt for fork users — `v1.yaml` → `roadmap.yaml`.  |

## Watching the agent work

When IronClaw is running locally (whether driven by a cron routine or directly), it exposes a web gateway you can connect to from any browser on the same machine. The gateway URL is printed when `iclaw` starts and looks like:

```
http://127.0.0.1:3000/?token=<auto-generated-token>
```

The token rotates each restart unless you set `GATEWAY_AUTH_TOKEN` explicitly. The gateway is the simplest way to:

- See routines firing in real time and their last result
- Read agent job history without `sqlite3` against the local DB
- Chat ad-hoc with the same agent that's running your kanban (without killing the daemon)

If `iclaw` is already running and a second `iclaw` invocation fails with `Another IronClaw instance is already running`, that's by design — both modes want port 8080. The web gateway lets you interact with the existing instance instead of starting another. See [`docs/maintenance.md`](docs/maintenance.md) for the daemon-vs-interactive operational pattern.

## Releases

Use `MultiAgency/kanban@v0` in workflow `uses:` references for latest-within-major (recommended for forks). Pin to a specific tag (e.g. `@v0.0.1` once released) for stability. The `v0` tag is moved with each `v0.0.x` release.

## License

Dual-licensed under [MIT](LICENSE-MIT) **OR** [Apache-2.0](LICENSE-APACHE) at your choice. Pick whichever fits your downstream project; you don't need both.
