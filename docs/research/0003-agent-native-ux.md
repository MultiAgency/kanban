# ADR: Agent-Native UX Patterns

## Status

Accepted — v1 design specification

## Context

v1 is positioning as agent-native, which means the UI inherits design challenges that existing AI-coding tools have already faced. This document surveys how current tools handle AI-agent-as-user interactions and provides concrete recommendations for v1.

## Decision

v1 will adopt a hybrid approach: **explicit agent identity surfacing** (separate avatar + "AI" badge), **full action attribution** with undo affordances matching human actions, and **proactive disorientation mitigation** through presence indicators and activity logs.

## Rationale

### Identity Surfacing

**GitHub Copilot in PRs:**
- Uses a distinctive Copilot avatar with "Copilot" label
- Comments clearly attributed to "Copilot" with system badge
- Separate from human reviewer identity
- ✅ v1 should adopt: Distinct agent avatar + explicit "AI Agent" badge

**Cursor in IDEs:**
- Inline edits don't always show agent identity during composition
- Final changes attributed generically to "Cursor AI"
- Can be disorienting when reviewing diffs
- ⚠️ v1 should avoid: Ambiguous identity during action composition

**Devin:**
- Full agent identity with unique avatar per session
- All actions (file edits, terminal commands, commits) attributed to Devin
- Activity timeline shows agent actions in real-time
- ✅ v1 should adopt: Per-agent identity + real-time activity stream

**Claude Code:**
- "Claude" as explicit user identity in chat interface
- File modifications show Claude as author in git history
- Clear separation between user prompts and Claude actions
- ✅ v1 should adopt: Explicit agent username + git attribution

**Aider:**
- Edits attributed to "aider" in commit messages
- Chat interface shows aider responses distinctly
- Less visible in the actual code diff context
- ⚠️ v1 should improve: More prominent in-line attribution

### Action Attribution

**Audit Trail Requirements:**
1. Every agent action must be logged with timestamp and agent ID
2. Undo operations should work identically for agent and human actions
3. Git blame/authorship must reflect actual agent identity, not proxy human account

**GitHub Copilot:**
- PR comments are immutable once posted (like human comments)
- Suggested code appears in diff with "Copilot" attribution
- No separate undo affordance — standard git revert applies
- ⚠️ v1 should improve: Explicit undo button for recent agent actions

**Cursor:**
- Local undo stack tracks agent vs human edits separately
- Can revert agent changes without affecting human work
- ✅ v1 should adopt: Per-agent undo history

**Devin:**
- Full action replay capability
- Can pause/stop agent mid-task
- All terminal commands logged with output
- ✅ v1 should adopt: Action-level replay and interruption

**Claude Code / Aider:**
- Standard git attribution
- No special undo mechanisms
- ⚠️ v1 should improve: Agent-specific undo affordances

### Disorientation Handling

**Common Pain Points:**
1. **Auto-modifications unseen**: Agent changes files while user is away
2. **Loops/repetition**: Agent stuck in same action pattern
3. **Attribution confusion**: Can't tell what agent did vs human

**GitHub Copilot:**
- Real-time suggestions appear inline as user types
- User must explicitly accept/reject — no auto-commits
- ✅ Good pattern: Requires human confirmation for changes

**Cursor:**
- Can auto-apply edits based on confidence threshold
- User reported disorientation from "magic" changes
- ⚠️ v1 should avoid: Auto-apply without explicit consent

**Devin:**
- Activity feed shows what Devin is doing in real-time
- User can intervene at any time
- Progress indicators for long-running tasks
- ✅ v1 should adopt: Real-time activity feed + intervention capability

**Claude Code:**
- Chat-first interface makes agent state explicit
- User always knows what Claude is responding to
- ✅ v1 should adopt: Chat context panel showing agent's "thought process"

**Aider:**
- Less visible disorientation handling
- Primarily relies on user monitoring
- ⚠️ v1 should improve: Proactive state visibility

### v1 Adoption Recommendations

**Must-Have (from this analysis):**

1. **Distinct agent avatars** — Each agent gets a unique, recognizable avatar with an "AI" badge overlay
2. **Real-time presence indicators** — Show which agents are active on which tasks (addresses disorientation)
3. **Activity stream** — Chronological log of all agent actions with timestamps
4. **Undo parity** — Agent actions have the same undo affordances as human actions
5. **Git attribution** — Agent identity preserved in git history, not proxied through human account

**Nice-to-Have:**

1. **Agent activity preview** — Show pending changes before commit (like Copilot suggestions)
2. **Interruption controls** — Pause/stop agent mid-task (like Devin)
3. **Per-agent undo history** — Separate undo stack for agent vs human edits (like Cursor)
4. **Chat context panel** — Display agent's reasoning/next steps (like Claude Code)

**Avoid:**

1. **Ambiguous identity** — Never allow agent actions to appear as human actions
2. **Auto-apply without consent** — Require explicit approval for file modifications
3. **Hidden state** — Agent must always be visible when active

## Comparison Table

| Tool | Identity | Attribution | Disorientation Handling | v1 Recommendation |
|------|----------|-------------|------------------------|-------------------|
| GitHub Copilot | ✅ Distinct avatar | ✅ Clear in diffs | ⚠️ Inline-only (no auto) | Adopt identity/attribution |
| Cursor | ⚠️ Generic "AI" | ⚠️ Local-only undo | ⚠️ Auto-apply disorients | Avoid auto-apply pattern |
| Devin | ✅ Per-session avatar | ✅ Full audit trail | ✅ Activity feed + interrupt | Adopt activity stream |
| Claude Code | ✅ Explicit "Claude" | ✅ Git attribution | ✅ Chat context visible | Adopt chat context panel |
| Aider | ⚠️ "aider" in commits | ⚠️ Standard git only | ⚠️ Minimal visibility | Improve in-line attribution |

## Rejected Alternatives

**Option A: Agent actions appear as human actions**
- Rationale rejection: Creates attribution confusion, violates audit trail requirements, breaks git history integrity

**Option B: No undo for agent actions**
- Rationale rejection: Puts users at disadvantage, creates friction in agent workflows, inconsistent UX

**Option C: Hidden agent presence**
- Rationale rejection: Major source of disorientation reported across all surveyed tools, undermines trust

## Consequences

**Positive:**
- Clear audit trail satisfies compliance requirements
- Reduced disorientation improves user experience
- Git attribution preserves historical accuracy

**Negative:**
- More UI complexity (avatars, badges, activity streams)
- Potential performance overhead for real-time presence
- Learning curve for users new to agent workflows

**Neutral:**
- Standard undo mechanisms — no special handling needed
- Existing git infrastructure supports agent attribution

## References

- Issue #30 (Board view — agent presence on cards)
- Issue #31 (Task detail — agent action attribution in comments and handoffs)
- Issue #33 (Presence indicator — disorientation handling)
- Issue #44 (This research issue)