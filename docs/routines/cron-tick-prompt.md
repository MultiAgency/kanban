# Cron-tick prompt (procedural form)

The IronClaw routine prompt used by `kanban-tick` to claim and complete one issue per fire. Written as an explicit step-by-step procedure rather than a natural-language description because the routine model in current use (`openai/gpt-oss-120b`) is unreliable at picking the right tool / parameter / order from a higher-level instruction. Stronger models (Claude, GPT-4-class) tolerate a shorter natural-language prompt.

This prompt encodes three working assumptions about the github WASM tool:

1. **It is missing convention primitives.** `add_assignees`, `add_labels`, `remove_label`, and `update_issue` (for state changes) are not in its action enum. The `http` built-in tool is used as a fallback against GitHub's REST API. See `docs/ironclaw-tracer-outcome.md` Finding 23.
2. **`Authorization: Bearer ${GITHUB_TOKEN}` is auto-injected** by the IronClaw host on `api.github.com` requests; the prompt does not set it manually.
3. **`list_issues` accepts `sort=created, direction=asc`** so the lowest-numbered eligible issue surfaces first. Picking ascending makes dependency-bottom-up coverage emerge naturally without requiring the prompt to model the dependency graph.

## The prompt

```
Procedure to claim and complete one kanban issue on MultiAgency/kanban. Execute the steps in order using TWO tools: `github` (WASM tool, for read + file commit + comment) and `http` (built-in tool, for the convention primitives the github WASM tool is missing). Do not call tool_search; do not enumerate skill labels.

The github WASM tool is missing `add_assignees`, `add_labels`, `remove_label`, and `update_issue` (state changes). Use the `http` tool for those operations against GitHub's REST API. The `Authorization: Bearer ${GITHUB_TOKEN}` header is auto-injected by the host on api.github.com requests; you do not need to set it manually.

1. LIST CANDIDATES via github WASM:
   github(action=list_issues, owner=MultiAgency, repo=kanban, labels=ready,agent-eligible, state=open, per_page=20, sort=created, direction=asc)
   The ascending sort surfaces the lowest-numbered eligible issue first.
   If empty, write "no eligible issue" and exit.

2. PICK THE LOWEST-NUMBERED issue from the list satisfying all four conditions: (a) NOT human-only; (b) HAS agent-eligible; (c) HAS ready; (d) every skill:* label is in {skill:writing, skill:research, skill:code, skill:review, skill:translation}. Process oldest-numbered eligible issues first so dependency-bottom-up coverage emerges naturally. Call N the picked issue number. If none qualify, write "no qualifying issue" and exit.

3. READ ISSUE BODY via github WASM:
   github(action=get_issue, owner=MultiAgency, repo=kanban, issue_number=N)

4. CLAIM RITUAL via http (three calls in this order — add labels BEFORE removing ready, recoverable failure mode):
   a. http(method=PATCH, url=https://api.github.com/repos/MultiAgency/kanban/issues/N, body={"assignees":["jlwaugh"]}, headers={"Accept":"application/vnd.github+json","User-Agent":"ironclaw-kanban-worker"})
   b. http(method=POST, url=https://api.github.com/repos/MultiAgency/kanban/issues/N/labels, body=["in-progress"], headers={"Accept":"application/vnd.github+json","User-Agent":"ironclaw-kanban-worker"})
      The body MUST be a bare JSON array `["in-progress"]`, NOT a wrapped object `{"labels":["in-progress"]}`. The wrapped form fails GitHub's schema validation ("No subschema in anyOf matched") — see Findings 23/26/30.
   c. http(method=DELETE, url=https://api.github.com/repos/MultiAgency/kanban/issues/N/labels/ready, headers={"Accept":"application/vnd.github+json","User-Agent":"ironclaw-kanban-worker"})
   If any of (a) (b) (c) fail, write "claim ritual failed at step N" and exit; do not proceed.

5. DO THE WORK substantively per the issue body. For ADR-style issues, draft Status / Context / Decision / Rationale / Comparison Table / Rejected Alternatives / Consequences / References. For research issues, produce structured findings.

6. COMMIT FILE (when the issue body specifies an output path like docs/adr/NNNN-X.md or docs/research/NNNN-X.md) via github WASM:
   github(action=create_or_update_file, owner=MultiAgency, repo=kanban, path=[FILL: output_path_from_issue_body], message="docs: add [FILL: output_path] per #[FILL: issue_number_N]", content=[FILL: work_product_from_step_5], branch=main)
   The markers `[FILL: ...]` above are documentation placeholders. **Substitute concrete values before emitting the tool call** — `path` becomes the actual file path the issue body specifies (e.g., `docs/adr/0042-multi-tenancy.md`), `message` becomes the rendered commit message with concrete values, `content` becomes the literal markdown body you drafted in step 5. **Never emit `[FILL:` as a literal value in tool args** — any tool call containing `[FILL:` is a leak (Finding 26).
   If the issue body doesn't specify an output path, skip this step.

7. POST HANDOFF via github WASM:
   github(action=create_issue_comment, owner=MultiAgency, repo=kanban, issue_number=N, body=[FILL: handoff_comment_body])
   Substitute `[FILL: handoff_comment_body]` with the actual handoff text you construct. The handoff body MUST start with **Handoff:** on one line, followed by a one-paragraph summary, followed by a fenced ```handoff block with a JSON object containing at least one of: changed_files (array), verification (array), residual_risk (array), links (array of urls).

8. CLOSE via http:
   http(method=PATCH, url=https://api.github.com/repos/MultiAgency/kanban/issues/N, body={"state":"closed","state_reason":"completed"}, headers={"Accept":"application/vnd.github+json","User-Agent":"ironclaw-kanban-worker"})

If any github or http call fails, write a one-line summary identifying which step failed and stop. Do not retry. Do not search for alternative tools.
```

## Forking notes

If you adopt this prompt for a different kanban-conventional repo:

- Replace `MultiAgency/kanban` with your `owner/repo` in steps 1, 3, 4, 6, 7, 8.
- Replace `jlwaugh` in step 4(a) with the GitHub login the IronClaw daemon's PAT authenticates as.
- The skill enum in step 2(d) should match the labels you've defined on your repo (consult `.github/labels.yml`).
- The output-path convention in step 6 (`docs/adr/NNNN-X.md`, `docs/research/NNNN-X.md`) is upstream's choice; align with whatever path conventions your issue bodies use.

## Known limits under `openai/gpt-oss-120b`

Even with the procedural form, the routine model fails on roughly three-quarters of fires. The dominant failure modes (each described in `docs/ironclaw-tracer-outcome.md`):

- **Finding 26 — placeholder leak.** The model occasionally emits `<path-from-issue-body>` and similar bracket-template strings as literal tool arguments instead of substituting real values. A `.github/workflows/no-cruft.yml` CI check rejects any commit whose changed paths contain `<` or `>` to keep this from accumulating.
- **Finding 26 (continued) — `POST /issues/N/labels` schema validation.** The model sometimes formats the body wrong against the GitHub REST schema. Recoverable manually but un-fixable by prompt alone.
- **Finding 25 — `action_type=full_job` deserialization breakage.** Setting the routine to `full_job` via direct DB edit without `title`, `description`, and `max_iterations` set crashes the routines table parser globally. Use `ironclaw routines edit` with all required fields, or stay on lightweight mode.

The webhook substrate (`docs/routines/reactive-setup.md`) was built in part because these failure modes were already documented and the cron path's reliability is gated on either (a) a more capable model or (b) the upstream PR adding the missing primitives to the github WASM tool. The procedural prompt is the best-known cron-path prompt under current conditions, not a recommendation that cron is production-shape today.
