import * as core from "@actions/core";
import * as github from "@actions/github";
import { parseDependencies } from "../lib/dependencies";

/**
 * Minimal injectable Octokit shape — the full type returned by
 * `github.getOctokit()`. Tests pass structurally-compatible stubs.
 */
export type GhClient = ReturnType<typeof github.getOctokit>;

/**
 * Repository coordinates passed through every API call.
 */
export interface IssueRef {
  owner: string;
  repo: string;
}

/**
 * A child issue surfaced by the body-text search and normalized for
 * downstream confirmParents / allParentsClosed / promote calls.
 */
export interface CandidateChild {
  number: number;
  body: string;
  labels: string[];
}

/**
 * Subset of fields we use from a GitHub issue search result. Defined
 * locally rather than imported from @octokit/types because (a) the field
 * shape we depend on is stable across @actions/github majors, and (b)
 * pinning to the upstream type couples us to upstream version churn.
 */
interface SearchResultItem {
  number: number;
  body: string | null;
  labels: Array<string | { name?: string | null }>;
}

/**
 * Runtime guard for the SearchResultItem shape. Validates `number`,
 * `labels` array, and that every label element is a string or non-null
 * object — fails closed so a malformed item is dropped rather than
 * crashing the action mid-map. Without this, a single null/wrong-type
 * field in the GitHub search response would abort the entire promotion
 * pass with an unhandled TypeError.
 */
function isSearchResultItem(item: unknown): item is SearchResultItem {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  if (typeof obj.number !== "number") return false;
  if (!Array.isArray(obj.labels)) return false;
  return obj.labels.every((l) => typeof l === "string" || (typeof l === "object" && l !== null));
}

const SEARCH_PER_PAGE = 100;
const READY = "ready";
const BLOCKED = "blocked";

/**
 * Search for open issues whose body mentions the closed issue's number.
 * Returns candidates that may include false positives (prose mentions);
 * downstream `confirmParents` filters them out.
 */
export async function discoverChildren(
  octokit: GhClient,
  ref: IssueRef,
  closedNumber: number,
): Promise<CandidateChild[]> {
  const q = `is:issue is:open repo:${ref.owner}/${ref.repo} "#${closedNumber}" in:body`;
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q,
    per_page: SEARCH_PER_PAGE,
  });

  if (data.total_count > SEARCH_PER_PAGE) {
    core.warning(
      `search returned ${data.total_count} results; v0 processes only the first ${SEARCH_PER_PAGE} (no pagination)`,
    );
  }

  const items = data.items as unknown[];
  const valid = items.filter(isSearchResultItem);
  if (valid.length < items.length) {
    core.warning(`dropped ${items.length - valid.length} malformed search item(s)`);
  }
  return valid.map((item) => ({
    number: item.number,
    body: item.body ?? "",
    labels: item.labels.map((l) => (typeof l === "string" ? l : (l.name ?? ""))),
  }));
}

/**
 * Filter candidates down to children that actually declare the closed issue
 * as a parent via `parseDependencies` — not just prose mentions of `#N`.
 */
export function confirmParents(
  candidates: CandidateChild[],
  closedNumber: number,
): CandidateChild[] {
  return candidates.filter((c) => parseDependencies(c.body).includes(closedNumber));
}

/**
 * Check whether every parent declared in the child's body is closed.
 * A 404 on a parent is treated as not-closed (do not promote).
 */
export async function allParentsClosed(
  octokit: GhClient,
  ref: IssueRef,
  child: CandidateChild,
): Promise<boolean> {
  const parents = parseDependencies(child.body);
  for (const issue_number of parents) {
    try {
      const { data } = await octokit.rest.issues.get({
        owner: ref.owner,
        repo: ref.repo,
        issue_number,
      });
      if (data.state !== "closed") return false;
    } catch (err) {
      if (isStatus(err, 404)) return false;
      throw err;
    }
  }
  return true;
}

/**
 * Promote a child from `blocked` to `ready`. Idempotent — no-op when
 * the child does not carry `blocked`.
 *
 * Write order is add-then-remove (not the intuitive remove-then-add):
 * if the second call fails, the issue ends up carrying both labels —
 * visible to humans and recoverable on the next promotion pass — rather
 * than carrying neither, which would orphan the work invisibly.
 *
 * The guard intentionally checks only `blocked` (not `ready`): a child
 * left in the both-labels state from a prior crash MUST be reachable on
 * a subsequent pass to finish the swap, so we cannot short-circuit on
 * `ready` alone. GitHub's addLabels is a no-op for an already-present
 * label, so re-running on a both-labels child only removes `blocked`.
 */
export async function promote(
  octokit: GhClient,
  ref: IssueRef,
  child: CandidateChild,
): Promise<void> {
  if (!child.labels.includes(BLOCKED)) return;

  await octokit.rest.issues.addLabels({
    owner: ref.owner,
    repo: ref.repo,
    issue_number: child.number,
    labels: [READY],
  });
  await octokit.rest.issues.removeLabel({
    owner: ref.owner,
    repo: ref.repo,
    issue_number: child.number,
    name: BLOCKED,
  });
}

/**
 * Top-level orchestration: discover candidates, confirm parent membership,
 * and promote each child whose full parent set is now closed.
 */
export async function run(octokit: GhClient, ref: IssueRef, closedNumber: number): Promise<void> {
  const candidates = await discoverChildren(octokit, ref, closedNumber);
  const children = confirmParents(candidates, closedNumber);

  for (const child of children) {
    if (await allParentsClosed(octokit, ref, child)) {
      await promote(octokit, ref, child);
    }
  }
}

function isStatus(err: unknown, status: number): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status: number }).status === status
  );
}

function isRateLimit(err: unknown): boolean {
  return isStatus(err, 429) || (err instanceof Error && /rate limit/i.test(err.message));
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function main(): Promise<void> {
  const token = core.getInput("github-token", { required: true });
  const octokit = github.getOctokit(token);
  const ctx = github.context;

  if (ctx.eventName !== "issues" || ctx.payload.action !== "closed") {
    core.info(`skipping: event=${ctx.eventName} action=${ctx.payload.action ?? "?"}`);
    return;
  }

  const issue = ctx.payload.issue;
  if (!issue) {
    core.warning("issues.closed event without issue payload");
    return;
  }

  await run(octokit, { owner: ctx.repo.owner, repo: ctx.repo.repo }, issue.number);
}

if (require.main === module) {
  main().catch((err) => {
    if (isStatus(err, 403)) {
      core.setFailed(`permission error: ${msg(err)}`);
      return;
    }
    if (isRateLimit(err)) {
      core.warning(`rate limit hit: ${msg(err)}`);
      return;
    }
    core.setFailed(msg(err));
  });
}
