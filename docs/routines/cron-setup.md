# Cron routine setup

How to deploy an IronClaw agent that fires on a cron schedule, picks up `ready` issues on a MultiAgency/kanban-conventional repo, and runs them through the convention.

> Supersedes the earlier `cron.yaml.example` template. IronClaw doesn't consume YAML routine definitions — routines live in IronClaw's database and are created via CLI or by the agent at chat time.

## Prerequisites

- IronClaw runtime installed and onboarded (`ironclaw onboard` completed at least once, `DATABASE_URL` resolvable; see `docs/ironclaw-tracer-outcome.md` for first-time-setup gotchas)
- GitHub credential authorized: `GITHUB_TOKEN=<pat> ironclaw tool auth github` with a PAT scoped `repo, workflow, read:org` (plus SAML-SSO "Configure SSO → Authorize" for org-private repos like `MultiAgency`)
- `kanban-worker` skill installed (copy `skills/kanban-worker/` into `~/.ironclaw/skills/kanban-worker/`)
- Target repo carries the canonical labels (`gh label create` from `.github/labels.yml`)
- IronClaw service running so cron actually fires (see step 1)

## Setup

### 1. Start the IronClaw service (one-time per machine)

Routines fire from the IronClaw daemon, not the interactive `ironclaw run` REPL. The daemon must be installed and started:

```sh
ironclaw service install      # registers as launchd (macOS) / systemd (Linux)
ironclaw service start
ironclaw service status       # confirm running
```

To remove later: `ironclaw service stop && ironclaw service uninstall`.

### 2. Confirm routines are enabled

In the IronClaw daemon's environment:

```bash
ROUTINES_ENABLED=true              # required; routines silently no-op without this
ROUTINES_CRON_INTERVAL=60          # how often the engine checks for due jobs (seconds)
ROUTINES_MAX_CONCURRENT=3          # max routine jobs running in parallel
```

These default reasonably; set explicitly if your deployment env doesn't already.

### 3. Create the routine

**Canonical path (per IronClaw docs) — describe to the agent.** Inside `ironclaw run`:

```
Create a routine named kanban-tick that runs every 5 minutes on the
6-field schedule "0 */5 * * * *" with cooldown 300 seconds. Prompt:
Follow the kanban-worker convention on MultiAgency/kanban. Find one
ready+agent-eligible issue you are qualified for by skill match. Walk
Rule 6 four-condition eligibility. If green, perform Rule 2 atomic
claim (self-assign + add in-progress + remove ready), do the work
substantively, post a handoff comment per docs/handoff-format.md,
then close the issue. If no eligible issue is available, exit cleanly.
```

The agent calls `routine_create` and confirms.

**Alternative — direct CLI** (more reproducible for scripting fork-user setups):

```sh
ironclaw routines create \
  --name kanban-tick \
  --schedule '0 */5 * * * *' \
  --cooldown 300 \
  --prompt 'Follow the kanban-worker convention on MultiAgency/kanban. Find one ready+agent-eligible issue you are qualified for by skill match. Walk Rule 6 four-condition eligibility. If green, perform Rule 2 atomic claim (self-assign + add in-progress + remove ready), do the work substantively, post a handoff comment per docs/handoff-format.md, then close the issue. If no eligible issue is available, exit cleanly.'
```

Notes on the schedule:

- **6-field cron** — `sec min hour day month weekday`. The leading `0` is for seconds. The five-field form (`*/5 * * * *`) will error.
- `0 */5 * * * *` fires at the top of every 5th minute. `--cooldown 300` (5 minutes) matches that cadence so a long-running tick can't double-fire. If you change cadence, keep `cooldown >= schedule period`.

### 3. Verify registration

```sh
ironclaw routines list --trigger cron
ironclaw routines list --json | jq '.[] | select(.name=="kanban-tick")'
```

### 4. Wait for the first tick (or watch via logs)

```sh
ironclaw logs --follow                # streams the daemon's live output
```

Tick fires at the next aligned 5-minute mark. If you want to watch the first one sooner, briefly edit to `* * * * * *` (every second; cooldown still gates re-fires), watch it fire, then edit back:

```sh
ironclaw routines edit --name kanban-tick --schedule '* * * * * *'
# ... wait for fire, observe ...
ironclaw routines edit --name kanban-tick --schedule '0 */5 * * * *'
```

### 5. Inspect run history

```sh
ironclaw routines history kanban-tick -l 5 --json
```

Per-run status, duration, and any errors are recorded.

## Operational notes

- **Cron cadence configurability.** `0 */5 * * * *` is the example default; tune to taste. Faster cadence picks up new issues sooner; slower reduces compute spend. The kanban convention sets no hard requirement on cadence.
- **Cooldown vs schedule.** Cooldown is the floor; schedule is the ceiling. They independently throttle.
- **Skill activation.** No `--skill` parameter — the routine's prompt activates skills via the same keyword/pattern match as the REPL. Words like `kanban-worker`, `claim`, `ready`, `MultiAgency` in the prompt fire the `kanban-worker` skill.
- **Multiple repos.** Create one routine per target repo. They run independently.
- **Identity files** (`AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md` in the IronClaw workspace root) are injected into every LLM call. If yours constrain autonomous tool use ("ask before calling tools", etc.), the routine will hang waiting for approval. Verify they don't conflict with the kanban-worker's claim/work/close autonomy.

## Heartbeat as an alternative

For a single-machine, single-repo setup, IronClaw's heartbeat system can do the same job with less surface area. Write a `HEARTBEAT.md` in the workspace with a checklist that includes "check MultiAgency/kanban for ready+agent-eligible issues; if any, follow kanban-worker", set `HEARTBEAT_INTERVAL_SECS=300`, and skip routine creation entirely.

Cron routines are preferred when:

- You have multiple kanban-conventional repos (one routine per repo, independent schedules)
- You want per-routine cooldown / rate-limit independent of other workspace heartbeat tasks
- You want the routine's behavior to be inspectable independently (`ironclaw routines history NAME` vs unified heartbeat output)

Heartbeat is preferred when:

- The kanban workflow is one of many periodic checks in the workspace
- You'd rather edit one `HEARTBEAT.md` than manage multiple routine definitions

Both fire on the same daemon; same `ironclaw service start` requirement.

## Toggling, editing, deleting

```sh
ironclaw routines disable kanban-tick    # pause without removing
ironclaw routines enable kanban-tick
ironclaw routines edit --name kanban-tick --prompt '...'    # update prompt or schedule
ironclaw routines delete kanban-tick -y
```

## Troubleshooting

- **`Missing required configuration: DATABASE_URL`** — re-run `ironclaw onboard`. See `docs/ironclaw-tracer-outcome.md` Findings 3 and 14.
- **Routine fires but no GitHub action.** Check PAT scopes + SAML-SSO authorization. Re-auth if needed: `GITHUB_TOKEN=$(gh auth token) ironclaw tool auth github`. See Finding 12.
- **Sandbox-probe timeout (~4 min startup hang).** `ironclaw config set sandbox.enabled false`. See Finding 11a.
- **No eligible issue found.** Confirm your installed skill set matches the open issues' `skill:*` labels: `ironclaw skills list` vs `gh issue list -R <repo> --label "ready,agent-eligible" --json labels`.
- **Handoff doesn't parse.** Run the comment body through `parseHandoff` from the v0 shared library to confirm the fence shape. See `docs/handoff-format.md`.
