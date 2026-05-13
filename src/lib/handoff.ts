/**
 * One structured follow-up surfaced in a handoff. The dependency-promotion
 * Action materializes each entry as a new GitHub issue at parent-close time,
 * body-linked to the parent via `- [ ] #parent`.
 */
export interface FollowUp {
  title: string;
  body: string;
  skills?: string[];
  agent_eligible?: boolean;
}

/**
 * Structured metadata posted in handoff comments at task completion.
 * All fields are optional; agents include only those that apply.
 */
export interface Handoff {
  changed_files?: string[];
  verification?: string[];
  residual_risk?: string[];
  follow_ups?: FollowUp[];
  links?: string[];
}

const HANDOFF_FENCE_RE = /```handoff\n([\s\S]*?)\n```/;

/**
 * Extract handoff metadata from an issue comment body.
 * Returns null if no handoff fence is present or its content is malformed.
 * When multiple handoff fences exist, the first one wins.
 *
 * Schema-additive fields (currently `follow_ups`) get per-item shape
 * validation here — malformed entries are dropped, well-formed ones kept.
 * The convention's pre-existing string-array fields stay permissive
 * (whatever JSON.parse yields, no validation), preserving the format's
 * "permissive by design" property documented in handoff-format.md.
 */
export function parseHandoff(commentBody: string): Handoff | null {
  const match = HANDOFF_FENCE_RE.exec(commentBody);
  if (!match) return null;

  let parsed: Handoff;
  try {
    parsed = JSON.parse(match[1]) as Handoff;
  } catch {
    return null;
  }

  if (parsed.follow_ups !== undefined) {
    if (!Array.isArray(parsed.follow_ups)) {
      delete parsed.follow_ups;
    } else {
      const valid = parsed.follow_ups.filter(isValidFollowUp);
      if (valid.length === 0) {
        delete parsed.follow_ups;
      } else {
        parsed.follow_ups = valid;
      }
    }
  }

  return parsed;
}

/**
 * Runtime guard for the FollowUp shape. Each materialized issue's body and
 * labels derive from these fields, so a malformed entry would produce a
 * broken issue — drop instead.
 */
function isValidFollowUp(x: unknown): x is FollowUp {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  if (typeof o.title !== "string" || o.title.length === 0) return false;
  if (typeof o.body !== "string") return false;
  if (o.skills !== undefined) {
    if (!Array.isArray(o.skills)) return false;
    if (!o.skills.every((s) => typeof s === "string")) return false;
  }
  if (o.agent_eligible !== undefined && typeof o.agent_eligible !== "boolean") return false;
  return true;
}
