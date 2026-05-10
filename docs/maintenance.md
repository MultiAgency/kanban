# Maintenance notes

Operational patterns for maintaining MultiAgency/kanban — discipline that emerged during v0 implementation and would otherwise be rediscovered by future contributors. `SPEC.md` remains authoritative for what the convention is; this is the operational complement for what to do when something needs upkeep.

## Audit-driven rollups

When CI flags a deprecation warning, security advisory, or audit finding, prefer **batched rollup commits** over single-issue fix commits.

A deprecation warning is rarely an isolated event — it's usually the visible tip of broader staleness in the dep tree. Splitting into one-fix-per-commit produces multiple CI cycles, multiple review rounds, and multiple passphrase entries for what converges on a single endpoint anyway.

When CI flags a version-related warning:

1. Run `npm audit && npm outdated` to surface the broader picture before committing the immediate fix.
2. Categorize each finding:
   - **Necessary** — deprecated, vulnerable, or broken
   - **Necessary-coupled** — forced by another bump's peer-dep
   - **Nice-to-have** — newer but no immediate driver
   - **Skip** — current branch / pre-release / not the LTS we target
3. Bundle "necessary" + "necessary-coupled" into one rollup commit. Defer "nice-to-have" unless explicitly authorized.
4. Run the full CI pipeline once on the rollup. Cascade issues (e.g., bundler swap because a new dep is ESM-only) surface on the same iteration rather than across multiple PRs.

**Counter-cases — don't roll up:**

- The failure is a single broken thing with a clear minimal fix and no related staleness elsewhere — ship the minimal fix.
- The change needs review-team scrutiny in isolation (e.g., a security-sensitive single-dep bump).

The pattern was demonstrated during the v0 init: a single deprecation warning surfaced eight transitive vulnerabilities, an eslint deprecation, vitest/typescript staleness, and a bundler swap forced by ESM-only packages. All landed in one commit (`ea59a3c`) and one CI cycle.

## YAML mnemonics get substituted in `roadmap/v1-issues.yaml`

`scripts/push-roadmap.mjs` rewrites every track-letter mnemonic (`INT7`, `D2`, `API3`, …) in issue bodies to the corresponding GitHub issue number (`#27`, `#8`, `#16`, …) using a `\b<token>\b` regex during the second-pass body edit. The substitution is intentional — it's how `## Parents` references resolve into clickable issue links.

**Side effect:** prose mnemonics get substituted too. A callout written as `**(INT7 marker)**` in the YAML becomes `**(#27 marker)**` after push. The link is correct and clickable on GitHub, but the human-readable track-letter cue (which signals "this references the conflict-rules track item") is lost.

Inline code spans don't help — the regex is bare-token-based and doesn't care about backticks.

**For future YAML edits:** when authoring a callout that should preserve a track-letter cue for the human reader, use a form that doesn't match `\b[A-Z]+[0-9]+\b`:

- Avoid: `the INT7 marker bullet`
- Prefer: `the conflict-rules ADR`, `the seventh integration item`, or `INT-seven` (hyphen breaks the regex)

Inside `## Parents` sections, leave mnemonics as-is — that's where the substitution does exactly what you want.

The cosmetic anomaly was observed during Phase 4 (the bulk push of 44 v1 roadmap issues). D2's INT7-marker callout shipped as `**(#27 marker)**` — link works, marker prose lost. Not fixed retroactively (44 live issues, not worth the regression risk), but flagged here for next-edit discipline.
