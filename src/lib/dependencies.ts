const CHECKLIST_RE = /^- \[[xX ]\] #(\d+)/gm;
const CLOSING_KEYWORDS_RE = /\b(?:closes|fixes|resolves|blocked\s+by|blocks)\s+#(\d+)\b/gi;

/**
 * Extract parent issue numbers declared in an issue body.
 *
 * Recognized formats:
 *   - Checklist references: `- [ ] #N` and `- [x] #N`
 *   - Closing-keyword references: `closes #N`, `fixes #N`, `resolves #N`,
 *     `blocked by #N`, `blocks #N` (case-insensitive, on word boundaries)
 *
 * Cross-repository references (`owner/repo#N`) are skipped — out of scope for
 * v0 (Deferred to v0.1 #4: native sub-issue / "Tracked by" relationships).
 *
 * Returns a deduplicated array preserving first-occurrence order. Empty array
 * when no references are found.
 */
export function parseDependencies(issueBody: string): number[] {
  const seen = new Set<number>();
  const result: number[] = [];

  for (const match of issueBody.matchAll(CHECKLIST_RE)) {
    const n = Number(match[1]);
    if (!seen.has(n)) {
      seen.add(n);
      result.push(n);
    }
  }

  for (const match of issueBody.matchAll(CLOSING_KEYWORDS_RE)) {
    const n = Number(match[1]);
    if (!seen.has(n)) {
      seen.add(n);
      result.push(n);
    }
  }

  return result;
}
