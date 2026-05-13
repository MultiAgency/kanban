# Handoff comment format

Reference for the structured-comment format that `parseHandoff` consumes. Authoritative source: [`SPEC.md` §Handoff comment format](../SPEC.md#handoff-comment-format). When this doc and SPEC diverge, SPEC wins — file the divergence as a bug.

This doc exists so fork authors and downstream tool builders can find the format without reading the entire SPEC. It cites SPEC rather than restating it; the worked example below is the same one used in [`skills/kanban-worker/SKILL.md`](../skills/kanban-worker/SKILL.md).

## Shape

A handoff comment has three parts:

1. A bold one-line summary (human-readable).
2. A fenced JSON metadata block — the only machine-readable part. The fence language identifier is literally `handoff`.
3. Optional trailing prose for downstream readers.

The first ` ```handoff ` block in the comment is parsed; everything outside it is ignored by the parser.

## Worked example

````markdown
**Handoff:** Implemented `parseDependencies` parser with 16 test cases covering checklist + closing-keyword refs and cross-repo skip behavior.

```handoff
{
  "changed_files": ["src/lib/dependencies.ts", "tests/dependencies.test.ts"],
  "verification": ["npm test tests/dependencies.test.ts"],
  "residual_risk": ["Native sub-issue API path not implemented (Deferred to v0.1 #4)"],
  "follow_ups": [
    {
      "title": "Native sub-issue API integration",
      "body": "When the GitHub sub-issue API exits preview, extend parseDependencies to read native sub-issue links in addition to body-text declarations.",
      "skills": ["skill:research"],
      "agent_eligible": true
    }
  ],
  "links": ["https://github.com/MultiAgency/kanban/blob/main/SPEC.md#implementation-notes"]
}
```

Notes for downstream readers go below the fence as free-form prose. The parser ignores everything outside the first `handoff` fence.
````

## Fields

All five fields are optional. Include only those that apply.

| Field           | Type         | Purpose                                                                                                                                                                                                                                          |
| --------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `changed_files` | `string[]`   | Paths touched by this work, relative to the repository root. Omit if work was conceptual (e.g., a research note).                                                                                                                                |
| `verification`  | `string[]`   | Commands or manual checks downstream readers can run to confirm the work behaves as claimed.                                                                                                                                                     |
| `residual_risk` | `string[]`   | Prose acknowledgment of things this work did not cover. Free-form — use for notes that don't warrant their own issue.                                                                                                                            |
| `follow_ups`    | `FollowUp[]` | Structured request for new issues to be filed. The dependency-promotion Action materializes each entry as a new issue at parent-close time, body-linked to the parent. Each entry: `{title, body, skills?, agent_eligible?}` — see Action below. |
| `links`         | `string[]`   | URLs to related documents, prior handoffs, external references.                                                                                                                                                                                  |

The format is additive: existing fields cannot change shape, but new optional fields may be added (`follow_ups` was added in this manner). The v0 Action's `parseHandoff` and the v1 application's parser stay in sync via byte-identical schema.

### Follow-up issue authoring

When an agent's handoff includes `follow_ups`, the dependency-promotion Action (running on `issues.closed` for the parent) creates one new GitHub issue per well-formed entry:

- **Title:** the entry's `title`.
- **Body:** the entry's `body`, with `\n\n- [ ] #parent` appended so the convention's dependency parser sees the parent reference. The Action treats the parent as already-closed (it just closed!) when evaluating the new issue's eligibility.
- **Labels:** `ready` always; each string in `skills` (e.g., `skill:research`); `agent-eligible` when `agent_eligible: true`.
- **Malformed entries** (missing `title` or `body`, wrong types) are dropped silently at parse time. Well-formed entries in the same handoff are still processed.
- **Per-entry create failures** (rate limit, transient API error) are warned and skipped; subsequent entries continue.

Use `follow_ups` when the residual is concrete and ready to be discrete work. Use `residual_risk` (string prose) when the residual is acknowledgment without an actionable shape.

## Parser rules

`parseHandoff(commentBody: string)` returns `Handoff | null` per these rules. Tests covering each row live at [`tests/handoff.test.ts`](../tests/handoff.test.ts).

| Input                       | Output                               |
| --------------------------- | ------------------------------------ |
| Missing `handoff` fence     | `null`                               |
| Empty comment body          | `null`                               |
| Malformed JSON inside fence | `null` (no throw)                    |
| Multiple `handoff` fences   | first fence wins; subsequent ignored |
| Trailing prose after fence  | tolerated; ignored                   |
| Valid JSON, partial fields  | object with only the present fields  |
| Valid JSON, all four fields | full `Handoff` object                |

The parser is permissive by design — a downstream agent that fails to parse a handoff should proceed without the metadata, not crash.

## Implementation pointer

Canonical implementation: [`src/lib/handoff.ts`](../src/lib/handoff.ts). It is pure (no I/O, no API calls) and shipped intact into the v0 Action's bundled `dist/index.js`. Reuse by direct import is the supported integration path; the regex `/```handoff\n([\s\S]*?)\n```/` is the parser anchor.
