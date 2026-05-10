# Reactive (webhook) routine setup

How to deploy an IronClaw agent that fires when a GitHub webhook delivers an event — picks up a newly-`ready`-labeled issue and runs it through the convention, without waiting for the next cron tick.

> Supersedes `reactive.yaml.example`. IronClaw doesn't consume YAML routine definitions; reactive routines are created by the agent (no direct CLI form exists for webhook triggers as of IronClaw v0.28.0).

## Status: v0.1 path

**v0.0.1 does not ship a working reactive setup against GitHub-native webhooks.** Two pieces are missing:

1. **GitHub webhooks sign with `X-Hub-Signature-256`** (HMAC over the payload). **IronClaw webhook routines authenticate with `Authorization: Bearer <secret>`.** No native bridge. An adapter is required (small HTTP shim that verifies the GitHub signature and re-emits the event to IronClaw with a Bearer header).
2. **The cron path is the canonical v0 substrate.** Reactive is an optimization, not a requirement. The cron tick at `*/5` picks up label changes within ~5 min — sufficient for v0 fleet sizes.

Per SPEC.md §Deferred to v0.1 #6, reactive lands when the adapter is in place. This doc describes the target setup so the work is well-defined.

## Setup (target state, post-v0.1)

### 1. Create the routine

No direct CLI form exists for webhook routines — they're created via the agent's `routine_create` tool. Talk to the agent inside `ironclaw run`:

```
ironclaw run
> Create a webhook routine named kanban-on-issue-labeled. Trigger: webhook
> at path /hooks/kanban-issue-labeled with secret from env var
> IRONCLAW_KANBAN_WEBHOOK_SECRET. Prompt: when an issues.labeled event
> arrives, if the issue gained the `ready` label and passes kanban-worker
> eligibility, claim it via the atomic claim ritual, do the work, post
> a handoff, close. Otherwise exit cleanly without action. Rate limit
> 30 runs per hour to prevent label-thrashing loops.
```

The agent calls `routine_create` with a structure equivalent to:

```json
{
  "name": "kanban-on-issue-labeled",
  "trigger": {
    "type": "webhook",
    "path": "/hooks/kanban-issue-labeled",
    "secret": "${IRONCLAW_KANBAN_WEBHOOK_SECRET}"
  },
  "prompt": "...",
  "guardrails": {
    "max_tokens": 16000,
    "max_tool_calls": 50,
    "timeout_secs": 1800,
    "rate_limit": { "max_runs": 30, "window_secs": 3600 }
  }
}
```

The guardrails section is the full IronClaw reactive-routine schema:

| Field | Purpose |
| --- | --- |
| `max_tokens` | Stop the job if cumulative LLM token usage exceeds this value |
| `max_tool_calls` | Stop after this many tool calls |
| `allowed_tools` | Whitelist (omit or empty = all tools allowed) |
| `timeout_secs` | Hard kill after this many seconds |
| `rate_limit.max_runs` / `.window_secs` | Cap fires per time window |

IronClaw auto-registers the endpoint at `POST https://<host>/hooks/<path>`; no separate channel config required.

### 2. Set the shared secret

In the IronClaw deployment environment (the `ironclaw service` launch env on the daemon's host):

```
export IRONCLAW_KANBAN_WEBHOOK_SECRET='<long-random-string>'
ironclaw service restart   # if needed; service install picks up env
```

### 3. Configure the adapter

GitHub webhooks sign payloads with `X-Hub-Signature-256: sha256=<hmac>`. IronClaw expects `Authorization: Bearer <secret>`. Bridge between them:

- Minimum adapter responsibilities:
  1. Verify GitHub's HMAC signature against the shared secret
  2. On valid signature, POST the payload to `https://<ironclaw-host>/hooks/kanban-issue-labeled` with `Authorization: Bearer ${IRONCLAW_KANBAN_WEBHOOK_SECRET}`
  3. Drop invalid signatures silently
- Deploy targets: a tiny Cloudflare Worker, a serverless function, or an `ironclaw service`-adjacent process

This adapter is v0.1 work; pattern likely lands as a `scripts/webhook-adapter.{mjs,ts}` reference implementation in the kanban repo when the v0.1 reactive issue closes.

### 4. Configure the GitHub webhook

`Settings → Webhooks → Add webhook` on the target repo:

- **Payload URL:** the adapter's public endpoint (NOT IronClaw's directly)
- **Content type:** `application/json`
- **Secret:** the same `IRONCLAW_KANBAN_WEBHOOK_SECRET`
- **Events:** `Issues` (or finer-grained if the adapter pre-filters)
- **Active:** checked

GitHub delivers a `ping` event on first activation; verify the adapter forwards it without error.

### 5. Verify end-to-end

- Manually label an issue `ready` on the target repo
- Watch the adapter logs for signature verification
- Watch `ironclaw logs --follow` for the routine fire
- Confirm the agent claims (or, if ineligible, exits cleanly without commenting on the issue)
- Check `ironclaw routines history kanban-on-issue-labeled` for the run record

## Why rate limiting matters

A misconfigured label-thrashing scenario (e.g., an automation that toggles `ready` and `blocked` rapidly) can fire the webhook many times per minute. Without `rate_limit`, each fire spawns an agent job; cost spikes fast. `30/hour` is a sane starting ceiling — adjust to your fleet's cron equivalent.

## When to use reactive vs cron

- **Cron** is sufficient for v0 fleet sizes. Latency: 0–5 minutes from label change to claim. No infrastructure beyond IronClaw's own daemon.
- **Reactive** drops claim latency to seconds. Costs: the adapter, GitHub webhook config, an extra moving piece in the operational surface. Worth it for high-velocity projects; overkill for the kanban convention's typical workload.

Skill behavior, claim ritual, handoff format, and eligibility check are **identical between cron and reactive** — the substrate doesn't change the convention.

## Related

- `docs/routines/cron-setup.md` — the canonical v0 substrate, runnable today
- `skills/kanban-worker/SKILL.md` — the convention the routine activates
- SPEC.md §Deferred to v0.1 #6 — disposition for the reactive substrate
