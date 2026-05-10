/**
 * Structured metadata posted in handoff comments at task completion.
 * All fields are optional; agents include only those that apply.
 */
export interface Handoff {
  changed_files?: string[];
  verification?: string[];
  residual_risk?: string[];
  links?: string[];
}

const HANDOFF_FENCE_RE = /```handoff\n([\s\S]*?)\n```/;

/**
 * Extract handoff metadata from an issue comment body.
 * Returns null if no handoff fence is present or its content is malformed.
 * When multiple handoff fences exist, the first one wins.
 */
export function parseHandoff(commentBody: string): Handoff | null {
  const match = HANDOFF_FENCE_RE.exec(commentBody);
  if (!match) return null;

  try {
    return JSON.parse(match[1]) as Handoff;
  } catch {
    return null;
  }
}
