# Cron routine setup

How to deploy an IronClaw agent that fires on a cron schedule, picks up `ready` issues on a MultiAgency/kanban-conventional repo, and runs them through the convention.

> Supersedes the earlier `cron.yaml.example` template. IronClaw doesn't consume YAML routine definitions — routines live in IronClaw's database and are created via CLI or by the agent at chat time.

## Status

The cron substrate is the v0 path and remains runnable. The reactive substrate in `reactive-setup.md` is the canonical v0.1 path: it removes 0–5 minutes of polling latency and side-steps the failure modes described under "Known limits" below. Pick cron when:

- You don't want to operate the Cloudflare Worker adapter that the reactive substrate needs
- You're on a closed network where the GitHub webhook can't reach your IronClaw instance
- Latency in the minutes-not-seconds range is fine for your workload

Otherwise, prefer reactive. Skill behavior, claim ritual, handoff format, and eligibility check are identical between the two substrates — only the trigger differs.

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

The routine prompt is checked in at [`docs/routines/cron-tick-prompt.md`](cron-tick-prompt.md). It is an explicit step-by-step procedure — list, pick, read, claim, work, commit, handoff, close — written that way because the routine model in current use needs tool calls and parameters spelled out. That doc also covers forking notes (substituting `MultiAgency/kanban` and the assignee login for your repo) and the known-failure-mode list under the current model. Read it before creating the routine, since it'll surface decisions you'd otherwise hit at first-tick time.

**Direct CLI form** (reproducible, scriptable for fork-user setups):

```sh
PROMPT=$(cat docs/routines/cron-tick-prompt.md | awk '/^```$/{f=!f; next} f && /^Procedure/{p=1} p')
ironclaw routines create \
  --name kanban-tick \
  --schedule '0 */5 * * * *' \
  --cooldown 300 \
  --prompt "$PROMPT"
```

(The `awk` extracts the prompt-block body from the markdown; if you'd rather copy-paste it once, the fenced block in `cron-tick-prompt.md` is the canonical source.)

**Agent-mediated form** — inside `ironclaw run`, paste the prompt block and ask the agent to call `routine_create` with name `kanban-tick`, schedule `0 */5 * * * *`, cooldown `300`, and the pasted prompt body.

Notes on the schedule:

- **6-field cron** — `sec min hour day month weekday`. The leading `0` is for seconds. The five-field form (`*/5 * * * *`) will error.
- `0 */5 * * * *` fires at the top of every 5th minute. `--cooldown 300` (5 minutes) matches that cadence so a long-running tick can't double-fire. If you change cadence, keep `cooldown >= schedule period`.

### 4. Verify registration

```sh
ironclaw routines list --trigger cron
ironclaw routines list --json | jq '.[] | select(.name=="kanban-tick")'
```

### 5. Wait for the first tick (or watch via logs)

```sh
ironclaw logs --follow                # streams the daemon's live output
```

Tick fires at the next aligned 5-minute mark. If you want to watch the first one sooner, briefly edit to `* * * * * *` (every second; cooldown still gates re-fires), watch it fire, then edit back:

```sh
ironclaw routines edit --name kanban-tick --schedule '* * * * * *'
# ... wait for fire, observe ...
ironclaw routines edit --name kanban-tick --schedule '0 */5 * * * *'
```

### 6. Inspect run history

```sh
ironclaw routines history kanban-tick -l 5 --json
```

Per-run status, duration, and any errors are recorded.

## Operational notes

- **Cron cadence configurability.** `0 */5 * * * *` is the example default; tune to taste. Faster cadence picks up new issues sooner; slower reduces compute spend. The kanban convention sets no hard requirement on cadence.
- **Cooldown vs schedule.** Cooldown is the floor; schedule is the ceiling. They independently throttle.
- **Action type — stay on lightweight.** Routines default to `action_type=lightweight`. Setting `full_job` via direct DB edit without also setting `title`, `description`, and `max_iterations` breaks the routines table parser globally (Finding 25 in the tracer doc). If you need `full_job` behavior, use `ironclaw routines edit` and supply all required fields in the same call.
- **Skill activation.** No `--skill` parameter — the routine's prompt activates skills via the same keyword/pattern match as the REPL. Words like `kanban-worker`, `claim`, `ready`, `MultiAgency` in the prompt fire the `kanban-worker` skill.
- **Multiple repos.** Create one routine per target repo. They run independently.
- **Identity files** (`AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md` in the IronClaw workspace root) are injected into every LLM call. If yours constrain autonomous tool use ("ask before calling tools", etc.), the routine will hang waiting for approval. Verify they don't conflict with the kanban-worker's claim/work/close autonomy.

## Known limits under the current routine model

The cron path under `openai/gpt-oss-120b` (IronClaw v0.28.0's default routine model) fails on roughly three-quarters of fires. The dominant patterns, all documented in `docs/ironclaw-tracer-outcome.md`:

- **Finding 23 — github WASM missing convention primitives.** `add_assignees`, `add_labels`, `remove_label`, and state-changing `update_issue` are not in the action enum. The prompt at `cron-tick-prompt.md` works around this with the built-in `http` tool, but model adherence to the workaround is imperfect.
- **Finding 25 — `full_job` deserialization breakage.** Covered under Operational notes above.
- **Finding 26 — placeholder-leak cruft.** The model occasionally emits `<path-from-issue-body>` and similar bracket-template strings as literal tool arguments. The `.github/workflows/no-cruft.yml` CI check rejects any commit whose changed paths contain `<` or `>`. The same finding also covers the variant where `POST /issues/N/labels` body shape diverges from the GitHub REST schema.

The reactive substrate avoids the `*/5 * * * *` blast pattern and lets you scope each fire to a specific labeled issue (lower model load, higher signal-to-noise). For the cron path to become routine-shape, either (a) swap the routine model to a more capable one, or (b) wait for the upstream PR adding the missing primitives to the github WASM tool (F23 path B), which removes the http-tool dependency entirely.

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
- **`routines list` returns empty after a previously-good config.** Suspect Finding 25 — an `action_type=full_job` edit without required companion fields broke the table parser. Re-set the row back to `lightweight` or supply all required fields in an `edit` call.
- **Sandbox-probe timeout (~4 min startup hang).** `ironclaw config set sandbox.enabled false`. See Finding 11a.
- **No eligible issue found.** Confirm your installed skill set matches the open issues' `skill:*` labels: `ironclaw skills list` vs `gh issue list -R <repo> --label "ready,agent-eligible" --json labels`.
- **Routine completes but the issue is half-claimed (assignee set, label unchanged).** Finding 26 — the http-tool label-add call body diverged from GitHub's schema. Manual cleanup: either complete the label swap by hand and let the agent finish, or revert the assignee and re-queue.
- **A new commit landed under a path like `<output_path>` or `<extracted-output-path>`.** Finding 26 again — placeholder leak. Delete the file, audit nearby commits for sibling cruft, confirm `.github/workflows/no-cruft.yml` is on `main`.
- **Handoff doesn't parse.** Run the comment body through `parseHandoff` from the v0 shared library to confirm the fence shape. See `docs/handoff-format.md`.

## Related

- [`cron-tick-prompt.md`](cron-tick-prompt.md) — the procedural prompt this routine runs, with forking notes
- [`reactive-setup.md`](reactive-setup.md) — the canonical v0.1 webhook-driven substrate
- [`../ironclaw-tracer-outcome.md`](../ironclaw-tracer-outcome.md) — empirical findings (F23, F25, F26) referenced throughout this doc
- [`../../skills/kanban-worker/SKILL.md`](../../skills/kanban-worker/SKILL.md) — the convention the routine activates
