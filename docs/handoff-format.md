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
  "links": ["https://github.com/MultiAgency/kanban/blob/main/SPEC.md#implementation-notes"]
}
```

Notes for downstream readers go below the fence as free-form prose. The parser ignores everything outside the first `handoff` fence.
````

## Fields

All four fields are optional. Include only those that apply.

| Field           | Type       | Purpose                                                                                                           |
| --------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| `changed_files` | `string[]` | Paths touched by this work, relative to the repository root. Omit if work was conceptual (e.g., a research note). |
| `verification`  | `string[]` | Commands or manual checks downstream readers can run to confirm the work behaves as claimed.                      |
| `residual_risk` | `string[]` | Things this work did not cover, edge cases left open, follow-ups worth filing as new issues.                      |
| `links`         | `string[]` | URLs to related documents, prior handoffs, external references.                                                   |

New top-level fields are not allowed in v0 — the format is byte-identical to SPEC and shared between the v0 Action's `parseHandoff` and the v1 application's parser. Format evolution is additive only (v1 may add fields that v0 readers tolerate; existing fields cannot change shape).

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
