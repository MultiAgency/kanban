---
name: kanban-worker
version: 0.1.0
description: Claim, work, and complete issues on a MultiAgency/kanban-conventional GitHub repository. Posts structured handoff comments at completion.
activation:
  keywords:
    - kanban
    - kanban-worker
    - handoff
    - agent-eligible
    - "skill:research"
    - "skill:writing"
    - "skill:code"
    - "skill:review"
    - "skill:translation"
  patterns:
    - "claim.*issue"
    - "promote.*blocked"
    - "post.*handoff"
    - "MultiAgency/kanban"
    - "ready.*for.*claim"
  tags:
    - github
    - kanban
    - workflow
  max_context_tokens: 3500
---

# kanban-worker

Operate on a MultiAgency/kanban-conventional GitHub repository — claim a `ready` issue, work it, post a handoff comment, close it. Six rules of the convention, one eligibility check, one claim ritual, one handoff format, two soft inputs.

The convention is fully specified in `SPEC.md` of the canonical repository (`MultiAgency/kanban@v0`); this skill is the agent-facing instruction surface. Citations below resolve against that document.

The skill is substrate-agnostic — the six rules apply identically whether you were triggered by a cron tick (the canonical v0 path, see `docs/routines/cron-setup.md`) or by a webhook event (the v0.1 reactive path, see `docs/routines/reactive-setup.md` and SPEC.md §Deferred to v0.1 #6). The eligibility check, atomic claim ritual, and handoff format don't depend on how you arrived at the issue.

## The convention (six rules)

Verbatim from SPEC §Convention. These are load-bearing — paraphrasing introduces drift.

1. **Labels are status.** `ready` = open for claim. `in-progress` = actively being worked. `blocked` = waiting on input. Closing the issue means done; there is no `done` label.

2. **Assignment is claim.** To claim an issue, self-assign and swap `ready` → `in-progress` together. Both transitions happen as one logical step — a self-assign without the label swap, or vice versa, is broken state and should be repaired.

3. **Dependencies are GitHub issue links.** Use `- [ ] #N` checklists in the issue body to declare a dependency. An issue stays `blocked` until all referenced parents close. Native GitHub "Tracked by" / sub-issue relationships are deferred to v0.1 once the underlying API exits preview.

4. **Handoffs are structured comments.** Posted at completion. Format defined below.

5. **Block by commenting.** If you can't proceed, post a comment explaining why and switch the label to `blocked`. The blocking contributor stays assigned — the assignee + `blocked` label is the visible accountability signal. Unblocking — by the original assignee, a peer, or a human — restores the label to `in-progress` if the assignee resumes, or to `ready` (with assignee cleared) if the assignee is handing it off. Don't silently re-assign someone else's blocked issue.

6. **Skills are project-declared via labels.** Issues declare required skills via `skill:*` labels. Agents check before claiming. Agent eligibility is opt-in: agents claim only issues explicitly labeled `agent-eligible`. Issues without `agent-eligible` are human-only by default, regardless of skill labels. The `human-only` label is a hard veto — even on an `agent-eligible` issue, the presence of `human-only` means agents must skip.

## Eligibility check (Rule 6)

Before claiming any issue, verify all four conditions are true. If any fails, skip the issue.

1. The issue has the `ready` label.
2. The issue has the `agent-eligible` label.
3. The issue does NOT have the `human-only` label (hard veto, dominates `agent-eligible`).
4. Your installed `skill:*` set covers every `skill:*` label on the issue.

`agent-eligible` means a human has explicitly certified this task is appropriate for agent claim. It is not a side-effect of being `ready`. Do not infer eligibility from the absence of `human-only` alone.

## Atomic claim ritual (Rule 2)

When claiming, perform self-assign and label swap as one logical step, before doing the work.

1. Self-assign the issue.
2. Remove `ready`; add `in-progress`.
3. Verify the API response shows you as the assignee. If somebody else is assigned, undo the assignment and skip — another agent claimed it in the same tick.
4. Do the work.
5. Post the handoff comment.
6. Close the issue.

If you crash between steps 2 and 6, your next tick should detect the half-state (assignee set + `ready` label, or unassigned + `in-progress` label) and repair it before claiming new work.

## Body-text dependencies (Rule 3)

Declare parent issues using `- [ ] #N` checklist syntax in the issue body. The dependency-promotion Action reads only body-text declarations.

```
- [ ] #42
- [ ] #43
```

Do **not** use GitHub's "Add sub-issue" panel in the issue UI. Native sub-issue links are invisible to the v0 Action — an issue declared as a sub-issue via the UI but not in the body will never be promoted. Native sub-issue support is deferred to v0.1 (Deferred to v0.1 #4).

Closing-keyword references (`closes #N`, `fixes #N`, `resolves #N`, `blocked by #N`, `blocks #N`) also count as parent declarations.

## Handoff format

Post a handoff comment when closing an issue. The first ` ```handoff ` block in the comment is parsed; everything outside it is human-readable prose.

Worked example:

````markdown
**Handoff:** Implemented `parseDependencies` parser with 16 test cases covering checklist + closing-keyword refs and cross-repo skip behavior.

```handoff
{
  "changed_files": ["src/lib/dependencies.ts", "tests/dependencies.test.ts"],
  "verification": ["npm test tests/dependencies.test.ts"],
  "residual_risk": ["Native sub-issue API path not implemented (Deferred to v0.1 #4)"],
  "links": ["https://github.com/MultiAgency/kanban/blob/main/SPEC.md#implementation-notes"]
}
```

Notes for downstream readers go below the fence as free-form prose. The parser ignores everything outside the first `handoff` fence.
````

All four JSON fields are optional — include only those that apply. New top-level fields are not allowed in v0; the format is byte-identical to the spec and shared by the v0 Action and (in v1) the hosted application.

## Soft inputs

Two agent-side conventions for handling cross-issue context. Not convention rules themselves — guidance for navigating issue graphs.

1. **Read research-issue handoffs before claiming a downstream task.** When the issue body links a closed upstream issue carrying `skill:research`, read that issue's handoff comment first. The research handoff is the authoritative finding for the downstream task; treat its `residual_risk` and `links` as required reading.

2. **Fetch external doc URLs as authoritative.** When the issue body references an external URL (a docs page, a spec, a published API reference), fetch it and treat its contents as authoritative for that issue's scope. Do not rely on training data for documentation that the issue explicitly links.

## Where to find things

- Convention text: `SPEC.md` §Convention
- Handoff format: `SPEC.md` §Handoff comment format
- Canonical labels: `SPEC.md` §Canonical labels
- Action source: `src/action/index.ts`
- Parser source: `src/lib/dependencies.ts`, `src/lib/handoff.ts`
