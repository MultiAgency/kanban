# Running the substrate

Two ways to run kanban-worker agents against your fork. Same convention, same artifacts; only the trigger differs.

## Reactive (webhook)

GitHub fires a webhook on `labeled` events. A Cloudflare Worker validates the HMAC, translates the payload into a procedural prompt, and forwards to IronClaw's HTTP channel. The agent claims, works, hands off, and closes — typically within a minute of the label being added.

Setup: [`reactive-setup.md`](reactive-setup.md). Requires a Cloudflare Worker (free tier OK) and a webhook configured on your fork.

## Cron (scheduled)

IronClaw fires a `kanban-tick` routine every five minutes. The tick lists `ready+agent-eligible` issues, picks the lowest-numbered eligible one (skipping anything already `in-progress`), and runs the same convention ritual.

Setup: [`cron-setup.md`](cron-setup.md). Prompt source: [`cron-tick-prompt.md`](cron-tick-prompt.md). Requires only the IronClaw daemon — no webhook, no Worker, no inbound network reachability.

## Running both

The cron tick's eligibility check excludes `in-progress` (condition (e) in `cron-tick-prompt.md` step 2), so it cannot race the webhook on an issue that's already mid-claim. The two substrates produce identical commits and handoffs; the webhook gets there sooner, the cron picks up any issue that became eligible while the webhook substrate was down or that GitHub failed to deliver a webhook for. Enabling both is the recommended posture.

A consequence of condition (e): half-states left by a stalled fire (assignee + `in-progress` set, no handoff, issue still open) are NOT automatically repaired by the next cron tick — the in-progress label that marks the stall also disqualifies the issue from re-claim. Manually toggle the `ready` label off-then-on to fire the webhook substrate on the stuck issue, or wait for a dedicated repair routine (v0.1.x work item).

|          | Latency       | Inbound network                        | Hosting                       |
| -------- | ------------- | -------------------------------------- | ----------------------------- |
| Reactive | seconds       | required (GitHub → Worker → daemon)    | Cloudflare Worker + IronClaw  |
| Cron     | up to 5 min   | not required                           | IronClaw only                 |

## Failure modes

Both substrates use `openai/gpt-oss-120b` via NEAR AI in the current v0. Roughly one in four fires stalls mid-cycle — committing the work file but not posting the handoff or closing the issue, or leaving a placeholder-named artifact on disk. The convention's Rule 2 repair clause and the cron tick's natural re-fire cadence absorb most stalls without human intervention. Stronger models are a v0.1 evaluation track. Tracer details: [`../ironclaw-tracer-outcome.md`](../ironclaw-tracer-outcome.md) Findings 26–30.
