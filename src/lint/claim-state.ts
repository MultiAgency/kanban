/**
 * Claim State Lint - Detects kanban half-states that break convention invariants
 * 
 * Two illegal combinations checked:
 * 1. assigned + `ready` (claim ritual missing the label swap)
 * 2. `in-progress` + no assignee (label set without self-assign)
 * 
 * Exit codes:
 *  0 - No violations found
 *  1 - Violation found (sets env vars for workflow to post comment)
 */

import { Octokit } from '@octokit/rest';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ISSUE_NUMBER = parseInt(process.env.ISSUE_NUMBER || '0', 10);

if (!GITHUB_TOKEN) {
  console.error('GITHUB_TOKEN not set');
  process.exit(2);
}

if (!ISSUE_NUMBER) {
  console.error('ISSUE_NUMBER not set or invalid');
  process.exit(2);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

interface IssueState {
  assignee: { login: string } | null;
  assignees: Array<{ login: string }>;
  labels: Array<{ name: string }>;
}

async function fetchIssueState(): Promise<IssueState> {
  const { data } = await octokit.issues.get({
    owner: 'MultiAgency',
    repo: 'kanban',
    issue_number: ISSUE_NUMBER,
  });

  return {
    assignee: data.assignee,
    assignees: data.assignees,
    labels: data.labels.map((l: any) => ({ name: l.name })),
  };
}

function hasLabel(state: IssueState, labelName: string): boolean {
  return state.labels.some((l) => l.name === labelName);
}

function isAssigned(state: IssueState): boolean {
  return state.assignee !== null;
}

function checkViolations(state: IssueState): {
  violation: boolean;
  type: string | null;
  fix: string | null;
} {
  const hasReady = hasLabel(state, 'ready');
  const hasInProgress = hasLabel(state, 'in-progress');
  const assigned = isAssigned(state);

  // Violation 1: assigned + ready (claim ritual incomplete)
  if (assigned && hasReady) {
    return {
      violation: true,
      type: 'assigned-plus-ready',
      fix: 'Remove the `ready` label to complete the claim ritual.',
    };
  }

  // Violation 2: in-progress + no assignee (label without self-assign)
  if (hasInProgress && !assigned) {
    return {
      violation: true,
      type: 'in-progress-plus-no-assignee',
      fix: 'Assign the issue to yourself to claim it properly.',
    };
  }

  return { violation: false, type: null, fix: null };
}

async function main(): Promise<void> {
  console.log(`Checking issue #${ISSUE_NUMBER} for claim-state violations...`);

  const state = await fetchIssueState();
  const result = checkViolations(state);

  if (result.violation) {
    console.log(`VIOLATION DETECTED: ${result.type}`);
    console.log(`SUGGESTED FIX: ${result.fix}`);
    
    // Set environment variables for the workflow to use
    console.log(`::set-output name=violation::true`);
    console.log(`::set-output name=type::${result.type}`);
    console.log(`::set-output name=fix::${result.fix}`);
    
    // Also set env vars for the workflow step
    process.env.VIOLATION_TYPE = result.type;
    process.env.SUGGESTED_FIX = result.fix;
    
    process.exit(1);
  }

  console.log('No violations found.');
  console.log(`::set-output name=violation::false`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(2);
});