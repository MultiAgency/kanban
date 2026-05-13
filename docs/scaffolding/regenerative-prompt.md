# Self-extending scaffold routine

A cron-fired IronClaw routine that detects gaps in the issue queue and scaffolds 1–3 new draft issues toward the most-pressing gap. Closes the loop on the *"queue runs dry → loop idles"* limitation: the substrate now self-extends.

> **Risk acknowledged:** scaffolding is a strategic decision (*what's the next release?*) — automating it produces some noise. Mitigated by: (1) draft issues land as `blocked` + `human-only` (require explicit human label-flip before kanban-tick can claim them), (2) low cadence (every 6 hours), (3) per-fire cap of 3 new issues, (4) gap detection requires the capability to have <2 existing representations on the board. See [Recommended workflow](recommended-workflow.md) for the broader skill-chain context.

## How it composes with kanban-tick

```
┌──────────────────────────────────────────────────────────────────────┐
│  kanban-tick (every 5 min)                                           │
│    claims lowest-numbered ready+agent-eligible issue, works it,      │
│    closes with handoff. Exits cleanly if no eligible issues.         │
└──────────────────────────────────────────────────────────────────────┘
                              ▼
         (when nothing eligible: substrate idles — pre-v0.0.2)
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  kanban-scaffold (every 6 hr)  ← THIS DOC                            │
│    reads roadmap/v1.yaml + lists existing issues,                    │
│    identifies must_have_capabilities with <2 representations,        │
│    drafts 1–3 issues toward the gap,                                 │
│    creates them as blocked + human-only (review required).           │
│    Exits cleanly if no gap or daily-cap reached.                     │
└──────────────────────────────────────────────────────────────────────┘
                              ▼
        (human reviews drafts, flips human-only → agent-eligible)
                              ▼
                  kanban-tick claims them next cycle
```

The human-review gate is load-bearing. Without it, the loop could generate noise indefinitely.

## The prompt (canonical text — sync to DB via `ironclaw routines edit`)

```
Procedure to detect roadmap-coverage gaps and scaffold draft issues for human
review. Execute using TWO tools: `github` (WASM, for read + issue creation)
and `http` (built-in, for label management if needed). Do NOT call
`create_job` — do all work inline.

1. READ ROADMAP VISION via github WASM:
   github(action=get_file_content, owner=MultiAgency, repo=kanban,
          path=roadmap/v1.yaml)
   Extract the `must_have_capabilities` array from the YAML.

2. LIST EXISTING ISSUES via github WASM:
   github(action=list_issues, owner=MultiAgency, repo=kanban, state=all,
          per_page=100)
   Build a coverage map: for each `must_have_capability`, count how many
   existing issues (open or closed) mention key terms from that capability
   in their title or body.

3. IDENTIFY GAP:
   Find the capability with the FEWEST representations (open + closed).
   If the minimum is >= 2, the roadmap is well-covered — write
   "all capabilities have >=2 representations" and exit cleanly.
   Otherwise, pick the capability with the smallest count as the gap.

4. CAP CHECK:
   Count issues created TODAY by this routine (look for issues with the
   `auto-scaffolded` label opened in the last 24h). If >= 3, daily cap
   reached — write "daily cap (3) reached" and exit cleanly.

5. DRAFT 1-3 ISSUES toward the identified gap.
   For each issue:
   - Title: short imperative naming the work
   - Body: 200-400 words with Acceptance / Verify / Output sections
   - Labels: blocked, human-only, auto-scaffolded, and ONE skill:* label
     matching the dominant work type (skill:writing for prose/docs,
     skill:research for investigation, skill:code for implementation,
     skill:review for audit, skill:translation for localization)
   - Body must NOT contain literal `[FILL:`, `<X>`, `{{X}}`, or
     `OUTPUT_PATH` patterns — substitute every placeholder with concrete
     values BEFORE emitting the tool call (Finding 26)

6. CREATE EACH ISSUE via github WASM:
   github(action=create_issue, owner=MultiAgency, repo=kanban,
          title=<concrete title>, body=<concrete body>,
          labels=["blocked","human-only","auto-scaffolded","skill:<type>"])
   Track which gap each issue addresses.

7. WRITE SUMMARY (one line):
   "Scaffolded N issues toward gap: <capability snippet>. Human review
   required: flip human-only → agent-eligible to admit to the queue."

If any tool fails, write a one-line failure summary identifying the
failing step and exit. Do not retry. Do not search for alternative tools.
Do NOT emit literal placeholder strings as argument values — substitute
concrete content before every tool call.
```

## Routine creation

```sh
PROMPT=$(cat docs/scaffolding/regenerative-prompt.md | awk '/^```$/{f=!f; next} f && /^Procedure/{p=1} p')

ironclaw routines create \
  --name kanban-scaffold \
  --schedule '0 0 */6 * * *' \
  --cooldown 21600 \
  --prompt "$PROMPT"
```

The schedule `0 0 */6 * * *` fires at the top of every 6th hour (00:00, 06:00, 12:00, 18:00 local). Cooldown matches the cadence to prevent overlapping fires if a previous run is long-running.

## New label requirement

This routine assumes an `auto-scaffolded` label exists in `.github/labels.yml`. Add it before activating:

```yaml
- name: auto-scaffolded
  color: "fef2c0"
  description: "Created by the kanban-scaffold routine; human review required before agent-eligible."
```

Sync via the same labeler workflow that propagated the canonical 10 labels.

## Monitoring this routine

- `gh issue list -R MultiAgency/kanban --label auto-scaffolded --state all` — every issue this routine has ever produced
- `gh issue list -R MultiAgency/kanban --label auto-scaffolded --state open` — current scaffold backlog awaiting human review
- `sqlite3 ~/.ironclaw/ironclaw.db "SELECT started_at, completed_at, status FROM routine_runs r JOIN routines rt ON rt.id=r.routine_id WHERE rt.name='kanban-scaffold' ORDER BY started_at DESC LIMIT 10"` — recent fires and outcomes

## Disabling temporarily

```sh
ironclaw routines disable kanban-scaffold
```

Reasons you might disable:
- Roadmap is in a deliberate freeze (preparing a release)
- The scaffold output has drifted from your intent (review + decide)
- Cost monitoring shows the routine is producing junk under the current model

## Known limits

- **Gap detection is heuristic.** The agent uses term-matching to count capability representations; under model weakness, it may miscount or pick a non-pressing gap. The human-review gate catches this.
- **Same F26 / F28 risks apply.** Until structural Worker-side validation lands (v0.0.2 work item), this routine is subject to the same placeholder-leak and delegation-preference failure modes documented in `docs/ironclaw-tracer-outcome.md`.
- **Routine-dispatch via cron only.** No webhook trigger needed — this fires on schedule, not on event.

## Relationship to the on-demand scaffolder

The `kanban-scaffolder` skill at [`skills/kanban-scaffolder/SKILL.md`](../../skills/kanban-scaffolder/SKILL.md) is the **on-demand** entry point — fork users invoke it manually with a v1.yaml input. `kanban-scaffold` (this routine) is the **autonomous** entry point that fires on a cron schedule against the existing v1.yaml. Same underlying prompt logic; different invocation surface.
