# kanban-webhook

Cloudflare Worker that translates GitHub `issues` webhook events into natural-language prompts for an IronClaw agent. Delivers the reactive substrate from `SPEC.md` §Deferred to v0.1 #6 — agents respond to issue events within seconds, no cron polling.

## What it does

Inbound flow:

1. GitHub `issues` webhook → Worker (validated via `X-Hub-Signature-256` HMAC against `GITHUB_WEBHOOK_SECRET`)
2. Worker filters for actionable events: an issue that just became `ready` + `agent-eligible` (via `opened` with both labels, or `labeled` with `ready` while `agent-eligible` is already present)
3. Worker formats a natural-language prompt naming the specific issue + skills + URL
4. Worker forwards the prompt to IronClaw's HTTP webhook channel — signs the forwarded body with HMAC-SHA256 using `IRONCLAW_WEBHOOK_SECRET` and sends as `X-Hub-Signature-256: sha256=<hex>` (the scheme IronClaw's HTTP channel verifies, mirroring GitHub's outbound webhook convention)

Non-actionable events (pings, label changes that don't make an issue claimable, closed/reopened, etc.) return `200 OK` without forwarding so GitHub's webhook delivery dashboard stays clean.

The webhook payload identifies the work up-front — the agent doesn't have to discover candidate issues. This sidesteps the template-substitution and discovery-loop failure modes documented in `docs/ironclaw-tracer-outcome.md` Findings 21, 24, 26.

## Setup (one-time)

Prereqs: `wrangler` installed (`npm install -g wrangler`), Cloudflare account with `multiagency.services` zone configured (or comment out the custom domain in `wrangler.toml` and use a default `*.workers.dev` URL).

```sh
# 1. From this directory, log in to Cloudflare (browser opens)
wrangler login

# 2. Set the two secrets (you'll be prompted for the values)
wrangler secret put GITHUB_WEBHOOK_SECRET
wrangler secret put IRONCLAW_WEBHOOK_SECRET

# 3. Deploy
wrangler deploy
```

Make a note of the deployment URL. With the custom domain enabled it'll be `https://kanban-webhook.multiagency.services/`; otherwise `https://kanban-webhook.<your-subdomain>.workers.dev/`.

## Configure the GitHub webhook

On the target repo (start with `MultiAgency/test`, not `MultiAgency/kanban`):

1. Settings → Webhooks → Add webhook
2. **Payload URL:** the Worker's deployment URL
3. **Content type:** `application/json`
4. **Secret:** the same value you used for `GITHUB_WEBHOOK_SECRET` above
5. **Which events?** → "Let me select individual events" → tick only `Issues`
6. Save

GitHub sends a `ping` event immediately; the Worker returns `pong`. Confirm it shows green in the GitHub webhook dashboard.

## Configure IronClaw to receive

The Worker forwards to `IRONCLAW_WEBHOOK_URL` (default: `https://ironclaw.multiagency.services/webhook`). IronClaw's HTTP channel authenticates inbound webhooks via **HMAC-SHA256 over the body**, sent as `X-Hub-Signature-256: sha256=<hex>` — the same scheme GitHub uses outbound. The shared secret is IronClaw's `HTTP_WEBHOOK_SECRET`.

The two values that must match across the boundary:

| Where | Value | Notes |
|-------|-------|-------|
| Worker secret (`IRONCLAW_WEBHOOK_SECRET`) | the HMAC key the Worker signs with | set via `wrangler secret put` |
| IronClaw env (`HTTP_WEBHOOK_SECRET`) | the HMAC key IronClaw verifies against | env var on the iclaw process |

If iclaw is already running with `HTTP_WEBHOOK_SECRET` set (verify with `curl -i -X POST http://127.0.0.1:8080/webhook ...` → 401 with auth message = secret is configured), you can reuse that value as `IRONCLAW_WEBHOOK_SECRET` without restarting iclaw. If not set yet, you'll need to set the env var and restart.

### Smoke-test the IronClaw HTTP channel locally

Before deploying the Worker, confirm the channel accepts your secret with an HMAC-signed curl:

```sh
SECRET="<your-HTTP_WEBHOOK_SECRET-value>"
BODY='{"user_id":"default","content":"webhook channel smoke test — respond with the word alive"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $NF}')
curl -i -X POST http://127.0.0.1:8080/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -d "$BODY"
# Expect: HTTP/1.1 200 OK + JSON with status="queued" and a non-zero message_id
```

If you get a 200 with a real `message_id`, the secret is correct and the channel is wired. If you get 401 with a zero-UUID `message_id`, the secret doesn't match — either the iclaw side has a different value than `SECRET`, or the HMAC computation got off (check `openssl dgst` output formatting).

## Smoke test (end-to-end)

On `MultiAgency/test`, create a throwaway issue with labels `ready`, `agent-eligible`, `skill:writing`. Body can be any short task ("Write a one-sentence README for hello.txt").

Within ~5 seconds:

1. GitHub delivers the webhook to the Worker
2. Worker translates and forwards to IronClaw
3. IronClaw creates an agent job
4. `ironclaw routines history` (or the web gateway) shows a new run
5. Agent walks the claim ritual on the test issue, does the work, posts handoff, closes

## Decommissioning the cron route

Once the reactive substrate is shipped and verified, decide the cron tick's disposition. Three options documented in the parent project's `docs/ironclaw-tracer-outcome.md` and SPEC §Deferred to v0.1 #6. For tonight: cron is disabled (`ironclaw routines disable kanban-tick`), webhook is the canonical path. Re-enable cron only if the cron-as-batch-fallback option is intentionally adopted.

## File layout

```
worker/
├── package.json
├── tsconfig.json
├── wrangler.toml         # deployment config; uncomment custom_domain block when zone is ready
├── README.md             # this file
└── src/
    └── index.ts          # the Worker — ~120 lines, no dependencies beyond Workers runtime
```
