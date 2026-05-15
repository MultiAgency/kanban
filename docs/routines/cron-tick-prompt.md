# Cron-tick prompt (procedural form)

The IronClaw routine prompt used by `kanban-tick` to claim and complete one issue per fire. Written as an explicit step-by-step procedure rather than a natural-language description because the current default routine model (`openai/gpt-oss-120b`) needs tool calls and parameters spelled out — vague-prompt forms produce noticeably more stalls. Stronger models (Claude, GPT-4-class) tolerate a shorter natural-language prompt.

This prompt encodes three working assumptions about the github WASM tool:

1. **It is missing convention primitives.** `add_assignees`, `add_labels`, `remove_label`, and `update_issue` (for state changes) are not in its action enum. The `http` built-in tool is used as a fallback against GitHub's REST API. See `docs/ironclaw-tracer-outcome.md` Finding 23.
2. **`Authorization: Bearer ${GITHUB_TOKEN}` is auto-injected** by the IronClaw host on `api.github.com` requests; the prompt does not set it manually.
3. **`list_issues` accepts `sort=created, direction=asc`** so the lowest-numbered eligible issue surfaces first. Picking ascending makes dependency-bottom-up coverage emerge naturally without requiring the prompt to model the dependency graph.

## The prompt

```
Procedure to claim and complete one kanban issue on MultiAgency/kanban. Execute the steps in order using two tools: the github WASM tool (for read, file commit, and issue comment) and the http built-in tool (for assignee changes, label changes, and issue-state PATCH that the github WASM tool lacks). Do not call tool_search; do not enumerate skill labels.

The `Authorization: Bearer ${GITHUB_TOKEN}` header is auto-injected by the host on api.github.com requests; you do not need to set it manually.

A note on substitution. Every tool-call argument below must be a concrete value, not a description of a value. Where this prompt describes an argument by what it should be (rather than giving the literal value), construct that value in plain prose first, then emit the tool call with the concrete value embedded. Worked examples in each step use an imaginary issue 42 with output path docs/adr/0042-multi-tenancy.md; those literal numbers and paths apply only to the imaginary example and must not be reused. For your actual fire, substitute the values that correspond to the issue you pick.

1. LIST CANDIDATES via github WASM:
   github(action=list_issues, owner=MultiAgency, repo=kanban, labels=ready,agent-eligible, state=open, per_page=20, sort=created, direction=asc)
   The ascending sort surfaces the lowest-numbered eligible issue first.
   If the list is empty, write "no eligible issue" and exit.

2. PICK ONE ISSUE from the list satisfying all five conditions: (a) NOT human-only; (b) HAS agent-eligible; (c) HAS ready; (d) every skill:* label is in {skill:writing, skill:research, skill:code, skill:review, skill:translation}; (e) does NOT have in-progress (prevents racing the webhook substrate on an issue mid-claim). Pick the lowest-numbered eligible issue so dependency-bottom-up coverage emerges naturally. If no issue qualifies, write "no qualifying issue" and exit.

   Before proceeding to step 3, write a single declarative line in this exact shape:
       Selected issue: 42
   substituting 42 with the integer of the issue you actually picked. Write it as a plain integer literal, not as a variable name or placeholder. Every subsequent step references "the issue number you stated in step 2" — this is the integer in that line.

3. READ ISSUE BODY via github WASM. The issue_number argument is the integer you stated in step 2.
   Worked example for the imaginary issue 42:
       github(action=get_issue, owner=MultiAgency, repo=kanban, issue_number=42)

4. CLAIM RITUAL via http (three calls in this order — add labels BEFORE removing ready). In every URL below, the path segment that holds the issue number is the integer you stated in step 2; substitute it directly into the URL string before emitting the tool call.

   Worked example body for the imaginary issue 42 — your actual calls use the integer from step 2 in place of 42:
   a. http(method=POST, url=https://api.github.com/repos/MultiAgency/kanban/issues/42/assignees, body={"assignees":["jlwaugh"]}, headers={"Accept":"application/vnd.github+json","User-Agent":"ironclaw-kanban-worker"})
   b. http(method=POST, url=https://api.github.com/repos/MultiAgency/kanban/issues/42/labels, body=["in-progress"], headers={"Accept":"application/vnd.github+json","User-Agent":"ironclaw-kanban-worker"})
      The argument name MUST be body=, not json= — IronClaw's http tool schema declares `body` and silently drops unrecognized argument keys, so `json=[...]` sends an empty body to GitHub (Finding 30).
   c. http(method=DELETE, url=https://api.github.com/repos/MultiAgency/kanban/issues/42/labels/ready, headers={"Accept":"application/vnd.github+json","User-Agent":"ironclaw-kanban-worker"})

   If any of (a) (b) (c) returns non-2xx, write "claim ritual failed at step a/b/c" (naming which) and exit; do not proceed.

5. DO THE WORK substantively per the issue body. For ADR-style issues, draft Status / Context / Decision / Rationale / Comparison Table / Rejected Alternatives / Consequences / References. For research issues, produce structured findings with citations. Target 600-1500 words of concrete prose.

6. COMMIT FILE.

   Issue bodies in this repo typically include an Output anchor that names the deliverable's path. For example, the imaginary issue 42 might have:
       **Output:** `docs/adr/0042-multi-tenancy.md`
   Parse the path string from step 3's response. If the issue body has no output-path anchor and no other path indication, skip this step entirely and proceed to step 7.

   Before proceeding, write a single line in this exact shape, with the actual path written out:
       Committing path: docs/adr/0042-multi-tenancy.md
   substituting the imaginary path with the one you parsed.

   Then call the github WASM tool. Worked example for the imaginary issue 42 with the path above — your actual call substitutes the integer from step 2 and the path you parsed:
       github(action=create_or_update_file, owner=MultiAgency, repo=kanban, path=docs/adr/0042-multi-tenancy.md, message="docs: add docs/adr/0042-multi-tenancy.md per #42", content=(the markdown text you drafted in step 5, written verbatim), branch=main)

   For your fire: path is the actual path string you parsed. The message is exactly "docs: add " followed by that same path string, followed by " per #" and the integer from step 2; for the imaginary 42/multi-tenancy example the message is the literal "docs: add docs/adr/0042-multi-tenancy.md per #42". Construct yours analogously by writing the actual path and integer directly into the string.

7. POST HANDOFF COMMENT via github WASM.

   The issue_number argument is the integer from step 2. The body argument is a markdown string you compose now. Its structure: the literal text `**Handoff:**` followed by a one-paragraph summary of what was done, a blank line, a fenced block opened with three backticks plus the word `handoff` (no space), a JSON object containing at least one of changed_files (array of path strings), verification (array of step strings), residual_risk (array of risk strings), or links (array of URL strings), then the closing three-backtick fence.

   Worked example for the imaginary issue 42 — your actual body is composed for the actual issue:
       github(action=create_issue_comment, owner=MultiAgency, repo=kanban, issue_number=42, body=(
       **Handoff:** Drafted ADR at docs/adr/0042-multi-tenancy.md. Comparison covers per-tenant-DB, row-level-tenancy, and schema-level isolation. Status: Proposed.

       ```handoff
       {"changed_files": ["docs/adr/0042-multi-tenancy.md"], "verification": ["markdown render check", "ADR section order verified"], "links": ["https://github.com/MultiAgency/kanban/issues/42"]}
       ```
       ))

   For your fire: write the body argument as concrete markdown text, with the actual one-paragraph summary, the actual changed file paths, the actual verification steps, and the actual issue URL. Do not include any parenthesized prose like `(the markdown text drafted in step 5)` in the body — that prose belongs only in this prompt as a description; your body must be the literal markdown you authored.

8. CLOSE ISSUE via http. The URL's issue-number path segment is the integer from step 2.
   Worked example for the imaginary issue 42:
       http(method=PATCH, url=https://api.github.com/repos/MultiAgency/kanban/issues/42, body={"state":"closed","state_reason":"completed"}, headers={"Accept":"application/vnd.github+json","User-Agent":"ironclaw-kanban-worker"})

If any github or http call fails, write a one-line summary identifying which step failed and stop. Do not retry. Do not search for alternative tools.
```

## Forking notes

If you adopt this prompt for a different kanban-conventional repo:

- Replace `MultiAgency/kanban` with your `owner/repo` in steps 1, 3, 4, 6, 7, 8.
- Replace `jlwaugh` in step 4(a) with the GitHub login the IronClaw daemon's PAT authenticates as.
- The skill enum in step 2(d) should match the labels you've defined on your repo (consult `.github/labels.yml`).
- The output-path convention in step 6 (`docs/adr/NNNN-X.md`, `docs/research/NNNN-X.md`) is upstream's choice; align with whatever path conventions your issue bodies use.

## Known limits under `openai/gpt-oss-120b`

The procedural form produces successful end-to-end fires; the residual failure modes (each described in `docs/ironclaw-tracer-outcome.md`) are:

- **Finding 26 — placeholder leak.** Earlier prompt revisions embedded a literal template string like `path=[FILL: output_path_from_issue_body]` inside the step-6 tool-call shape and asked the agent to substitute concrete values into it. The agent often echoed the marker instead of substituting — sometimes as `<output_path>`, sometimes as `OUTPUT_PATH_FROM_ISSUE_BODY`, sometimes as paraphrased prose like `<output_path from step 6, if any>`. The current prompt eliminates the literal template-with-markers shape: each parameter is described by what its value should be, and every tool call ships with a fully concrete worked example (the imaginary issue 42 + docs/adr/0042-multi-tenancy.md). The `.github/workflows/no-cruft.yml` gate remains as a backstop for commits whose paths contain bracket characters.
- **Mid-cycle stalls.** A fire may complete the claim ritual + commit the work file but then skip the handoff comment or close step, leaving an `in-progress` half-state on the issue. Step 2's condition (e) excludes `in-progress` from new claims, so the next cron tick will skip the half-state issue rather than repair it. Manual repair (toggle `ready` off-then-on to re-fire the webhook substrate, or just close + handoff by hand) is currently required. A dedicated repair routine is a v0.1.x work item.
- **Finding 25 — `action_type=full_job` deserialization breakage.** Setting the routine to `full_job` via direct DB edit without `title`, `description`, and `max_iterations` set crashes the routines table parser globally. Use `ironclaw routines edit` with all required fields, or stay on lightweight mode.

The webhook substrate (`docs/routines/reactive-setup.md`) complements the cron path by responding within seconds of a `ready` label being added. Run both together: the webhook absorbs new work as events arrive, the cron tick picks up the backlog and any issue whose webhook delivery missed.
