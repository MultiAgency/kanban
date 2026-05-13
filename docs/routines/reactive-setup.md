# Reactive (webhook) substrate setup

How to deploy the IronClaw-driven kanban worker as a reactive substrate — an agent that fires when a GitHub webhook delivers an event, picks up newly-`ready`-labeled issues, and runs them through the convention without waiting for a cron tick.

This page is the conceptual overview. Step-by-step setup lives in [`worker/README.md`](../../worker/README.md). Read this first, follow the README next.

## Status

Shipped in v0.1. Reference implementation lives at [`worker/`](../../worker) in this repo — a Cloudflare Worker that adapts GitHub's `X-Hub-Signature-256` HMAC payloads into IronClaw's HTTP webhook channel (which also uses HMAC re-signing, mirroring GitHub's outbound convention). Closes SPEC.md §Deferred to v0.1 #6.

> The earlier `reactive.yaml.example` template is superseded — IronClaw doesn't consume YAML routine definitions. The reactive substrate uses IronClaw's chat HTTP channel (`POST /webhook` with `{user_id, content, metadata}`) plus skill activation, **not** a webhook-triggered routine. The chat-channel path was chosen over the routine path because the routine path expects `Authorization: Bearer <secret>` and GitHub signs with `X-Hub-Signature-256` — the Worker bridges the two by re-signing the forwarded body with HMAC so IronClaw's HTTP channel can verify it natively.

## Architecture

```
GitHub  ──signed: GITHUB_WEBHOOK_SECRET───→  Worker  ──re-signed: IRONCLAW_WEBHOOK_SECRET───→  IronClaw daemon
                                              │                                                 │
                                              │ (only for actionable                            │ (chat channel
                                              │  events — see worker/README.md)                 │  routes to
                                              │                                                 │  kanban-worker
                                              │                                                 │  skill via
                                              │                                                 │  keyword match)
```

Two independent HMAC chains; the Worker verifies the inbound one and re-signs the outbound one so no shared key crosses the network boundary. The daemon-side secret is exposed via the `HTTP_WEBHOOK_SECRET` env var (in `~/.ironclaw/.env`) and must equal the value the Worker has stored under `IRONCLAW_WEBHOOK_SECRET`.

## Setup

Setup steps for fork users — Worker deploy, GitHub webhook configuration, daemon env — are documented in [`worker/README.md`](../../worker/README.md). The README covers:

1. `wrangler login`, set the two secrets, `wrangler deploy`
2. Configure the GitHub webhook on the target repo (start with `MultiAgency/test`, not your canonical repo)
3. Set `HTTP_WEBHOOK_SECRET` in the daemon env so it matches the Worker's `IRONCLAW_WEBHOOK_SECRET`
4. Ensure the `kanban-worker` skill is installed so its keyword/pattern match activates on the Worker's prompt
5. Smoke test by labeling an issue `ready` on the test repo and watching `ironclaw logs --follow`

Skill behavior, claim ritual, handoff format, and eligibility check are **identical to the cron substrate** — the trigger differs, the convention doesn't.

## Why rate limiting matters

A misconfigured label-thrashing scenario (e.g., an automation that toggles `ready` and `blocked` rapidly) can fire the webhook many times per minute. Each fire spawns an agent job; cost spikes fast. The Worker currently relies on GitHub-side event filtering (`Issues` event only, plus its own actionable-event filter) — fork users running high-traffic repos should consider adding application-level rate limiting at the Worker layer if label churn is plausible.

## When to use reactive vs cron

- **Cron** (`docs/routines/cron-setup.md`) needs no external infrastructure beyond the IronClaw daemon. Latency: 0–5 minutes from label change to claim. Under the default routine model (`gpt-oss-120b`), reliability is bounded by Findings 26/28/29 in the tracer doc — the work-execution phase is brittle.
- **Reactive** (this doc) drops claim latency to seconds and sidesteps the cron path's candidate-discovery loop because the webhook payload names the specific issue up-front. Costs: the Worker, GitHub webhook config, two HMAC secrets to manage. Worth it for the canonical roadmap and any project where claim latency matters.

The current `MultiAgency/kanban` repo runs the reactive substrate; the cron path is benched until model substitution closes the work-execution gap.

## Verifying the substrate is working

GitHub's webhook delivery dashboard (`Settings → Webhooks → click the webhook → Recent Deliveries`) is the authoritative view: each delivery shows the request/response with the Worker. A green check means the Worker accepted the event. From there:

- Watch `ironclaw logs --follow` on the daemon host for the matching prompt arrival
- Confirm the kanban-worker skill activated (look for the skill's signature output in the agent's response)
- Confirm the agent reached the claim ritual (assignee + label swap on the issue) — this is the proven floor under the current model per Finding 28

If GitHub shows green but no prompt arrives at the daemon, the HMAC re-signing or the `HTTP_WEBHOOK_SECRET` env var is the place to look. If the prompt arrives but no agent activation follows, the skill isn't installed or the prompt isn't matching its activation keywords.

## Related

- [`worker/README.md`](../../worker/README.md) — step-by-step setup for fork users
- [`worker/src/index.ts`](../../worker/src/index.ts) — reference adapter implementation
- [`cron-setup.md`](cron-setup.md) — the alternative substrate, currently benched pending model substitution
- [`../ironclaw-tracer-outcome.md`](../ironclaw-tracer-outcome.md) — Findings 27 (HMAC scheme empirical), 28/29 (model limits) referenced above
- [`../../skills/kanban-worker/SKILL.md`](../../skills/kanban-worker/SKILL.md) — the convention the substrate activates
- SPEC.md §Deferred to v0.1 #6 — original disposition statement; this doc closes that item
