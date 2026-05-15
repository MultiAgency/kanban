/**
 * kanban-webhook — Cloudflare Worker that translates GitHub `issues` webhook
 * payloads into natural-language prompts for an IronClaw agent.
 *
 * Flow:
 *   GitHub → POST /<this-worker>/  (X-Hub-Signature-256, X-GitHub-Event)
 *          → validate HMAC with GITHUB_WEBHOOK_SECRET
 *          → translate actionable events to natural-language prompts
 *          → POST to IRONCLAW_WEBHOOK_URL with X-Hub-Signature-256 HMAC
 *            (signed with IRONCLAW_WEBHOOK_SECRET — IronClaw's HTTP channel
 *            uses the same scheme GitHub does for its outbound webhooks)
 *
 * Non-actionable events (ping, non-issues, unrelated actions) return 200 OK
 * without forwarding, so GitHub's webhook delivery dashboard stays clean.
 */

export interface Env {
  GITHUB_WEBHOOK_SECRET: string; // secret, HMAC key for validating inbound from GitHub
  IRONCLAW_WEBHOOK_SECRET: string; // secret, HMAC key for signing outbound to IronClaw
  IRONCLAW_WEBHOOK_URL: string; // e.g. https://ironclaw.multiagency.services/webhook
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  labels: { name: string }[];
  html_url: string;
}

interface GitHubPayload {
  action: string;
  issue?: GitHubIssue;
  label?: { name: string };
  repository: { full_name: string };
  sender: { login: string };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await request.text();
    const signature = request.headers.get("X-Hub-Signature-256");
    if (!(await verifyGitHubSignature(body, signature, env.GITHUB_WEBHOOK_SECRET))) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = request.headers.get("X-GitHub-Event") ?? "";
    if (event === "ping") return new Response("pong", { status: 200 });
    if (event !== "issues") return new Response("OK (ignored event)", { status: 200 });

    const payload = JSON.parse(body) as GitHubPayload;
    const prompt = translateToPrompt(payload);
    if (!prompt) return new Response("OK (no actionable change)", { status: 200 });

    // IronClaw's HTTP channel authenticates inbound webhooks via HMAC-SHA256
    // over the body, sent as `X-Hub-Signature-256: sha256=<hex>` — the same
    // scheme GitHub uses for its outbound webhooks. The shared secret is
    // IronClaw's HTTP_WEBHOOK_SECRET env var.
    const forwardBody = JSON.stringify({
      user_id: "default",
      content: prompt,
      metadata: {
        source: "github-webhook",
        event,
        action: payload.action,
        repo: payload.repository.full_name,
        issue: payload.issue?.number,
        sender: payload.sender.login,
      },
    });
    const ironclawSig = await hmacSha256Hex(forwardBody, env.IRONCLAW_WEBHOOK_SECRET);

    const res = await fetch(env.IRONCLAW_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": `sha256=${ironclawSig}`,
      },
      body: forwardBody,
    });

    return new Response(`Forwarded (ironclaw status=${res.status})`, { status: 200 });
  },
};

/**
 * Translate a GitHub `issues` event payload into a natural-language prompt for
 * the kanban-worker agent. Returns null for non-actionable changes.
 *
 * Actionable: an issue becomes claimable — either opened with ready+agent-eligible
 * already set, or labeled with `ready` while agent-eligible is present.
 */
function translateToPrompt(payload: GitHubPayload): string | null {
  const issue = payload.issue;
  if (!issue) return null;

  const labels = issue.labels.map((l) => l.name);
  const hasReady = labels.includes("ready");
  const agentEligible = labels.includes("agent-eligible");
  const humanOnly = labels.includes("human-only");

  if (humanOnly || !agentEligible || !hasReady) return null;

  const becameReady =
    (payload.action === "labeled" && payload.label?.name === "ready") ||
    payload.action === "opened";
  if (!becameReady) return null;

  const skillLabels = labels.filter((n) => n.startsWith("skill:"));
  const skills = skillLabels.length > 0 ? skillLabels.join(", ") : "(none declared)";

  const [owner, repo] = payload.repository.full_name.split("/");

  return [
    `Procedure to claim and complete kanban issue #${issue.number} on ${payload.repository.full_name}. Execute the steps below in order using TWO tools: \`github\` (WASM tool, for read + file commit + comment) and \`http\` (built-in tool, for the convention primitives the github WASM tool is missing). Use these tools directly — do NOT call \`create_job\`, \`skill_install\`, or any other delegation primitive.`,
    ``,
    `Issue context:`,
    `- Number: ${issue.number}`,
    `- Title: ${issue.title}`,
    `- Required skills: ${skills}`,
    `- URL: ${issue.html_url}`,
    `- Owner: ${owner}`,
    `- Repo: ${repo}`,
    ``,
    `1. READ ISSUE BODY via github WASM:`,
    `   github(action=get_issue, owner=${owner}, repo=${repo}, issue_number=${issue.number})`,
    `   Confirms the issue is still open and ready+agent-eligible. Extract the output path from the issue body (typically "**Output:** \`docs/adr/NNNN-name.md\`" or similar). The parsed path string is the value you will use as the path argument in step 5's create_or_update_file call.`,
    ``,
    `2. ELIGIBILITY CHECK (Rule 6 four conditions):`,
    `   (a) ready label present, (b) agent-eligible present, (c) human-only NOT present,`,
    `   (d) every skill:* label on the issue maps to an installed skill — name normalization`,
    `   replaces the colon with a hyphen (skill:writing → skill-writing, skill:research →`,
    `   skill-research, skill:review → skill-review, skill:code → skill-code).`,
    `   If any condition fails, write a one-line comment naming the failing condition and exit.`,
    ``,
    `3. CLAIM RITUAL via http (three calls, in this order — add labels BEFORE removing ready):`,
    `   a. http(method=POST, url=https://api.github.com/repos/${owner}/${repo}/issues/${issue.number}/assignees, body={"assignees":["jlwaugh"]})`,
    `   b. http(method=POST, url=https://api.github.com/repos/${owner}/${repo}/issues/${issue.number}/labels, body=["in-progress"])`,
    `   c. http(method=DELETE, url=https://api.github.com/repos/${owner}/${repo}/issues/${issue.number}/labels/ready)`,
    `   If any of (a) (b) (c) fail, write a one-line comment naming the failing step and exit; do not proceed.`,
    ``,
    `4. DO THE WORK substantively per the issue body. For ADR-style issues, draft Status / Context / Decision / Rationale / Comparison Table / Rejected Alternatives / Consequences / References. For research issues, produce structured findings with citations. Target 600-1500 words of concrete prose with named alternatives where appropriate. This drafted markdown is the value you will use as the content argument in step 5's create_or_update_file call.`,
    ``,
    `5. COMMIT FILE via github WASM.`,
    `   Construct the tool call with these arguments:`,
    `   - action: the literal string "create_or_update_file"`,
    `   - owner: the literal "${owner}"`,
    `   - repo: the literal "${repo}"`,
    `   - path: the path string you parsed from the issue body in step 1`,
    `   - message: the literal string "docs: add " concatenated with the parsed path concatenated with " per #${issue.number}". For an imaginary parsed path docs/adr/0042-multi-tenancy.md the message is exactly: docs: add docs/adr/0042-multi-tenancy.md per #${issue.number}.`,
    `   - branch: the literal "main"`,
    `   - content: the markdown body you drafted in step 4. Pass it directly as the value of this argument, character-for-character — not a description of it, not a reference to it, not a placeholder.`,
    ``,
    `   For an imaginary parsed path docs/adr/0042-multi-tenancy.md, the scalar arguments of the call look like:`,
    `       action=create_or_update_file, owner=${owner}, repo=${repo}, path=docs/adr/0042-multi-tenancy.md, message="docs: add docs/adr/0042-multi-tenancy.md per #${issue.number}", branch=main`,
    `   Your actual call passes those scalar arguments substituted for your parsed path, plus the content argument carrying the markdown body from step 4.`,
    `   If the issue body doesn't specify an output path, skip this step and proceed to step 6.`,
    ``,
    `6. POST HANDOFF COMMENT via github WASM.`,
    `   Compose the body of the comment as a markdown string. Its structure: the literal text \`**Handoff:**\` followed by a one-paragraph summary of what was done, a blank line, a fenced block opened with three backticks plus the word \`handoff\` (no space), a JSON object with at least one of changed_files (array of path strings), verification (array of step strings), residual_risk (array of risk strings), or links (array of URL strings), then the closing three-backtick fence.`,
    ``,
    `   Then construct the tool call with these arguments:`,
    `   - action: the literal string "create_issue_comment"`,
    `   - owner: the literal "${owner}"`,
    `   - repo: the literal "${repo}"`,
    `   - issue_number: the literal ${issue.number}`,
    `   - body: the markdown body you composed. Pass it directly as the value of this argument, character-for-character — not a description of it, not a reference to it, not a placeholder.`,
    ``,
    `   The scalar arguments of the call are:`,
    `       action=create_issue_comment, owner=${owner}, repo=${repo}, issue_number=${issue.number}`,
    `   Your actual call passes those scalar arguments plus the body argument carrying the markdown you composed.`,
    ``,
    `   For reference, a body composed for an imaginary multi-tenancy ADR fire on issue 42 has the shape below — your body has its own one-paragraph summary, its own changed-file paths, its own verification steps, and its own issue URL:`,
    `       **Handoff:** Drafted ADR at docs/adr/0042-multi-tenancy.md. Comparison covers per-tenant-DB, row-level-tenancy, and schema-level isolation. Status: Proposed.`,
    ``,
    `       \`\`\`handoff`,
    `       {"changed_files": ["docs/adr/0042-multi-tenancy.md"], "verification": ["markdown render check", "ADR section order verified"], "links": ["${issue.html_url}"]}`,
    `       \`\`\``,
    ``,
    `7. CLOSE ISSUE via http:`,
    `   http(method=PATCH, url=https://api.github.com/repos/${owner}/${repo}/issues/${issue.number}, body={"state":"closed","state_reason":"completed"})`,
    ``,
    `If any github or http call fails, write a one-line summary identifying which step failed and stop. Do not retry indefinitely; do not search for alternative tools. Do NOT call create_job — do all work inline within this single turn.`,
  ].join("\n");
}

async function verifyGitHubSignature(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = await hmacSha256Hex(body, secret);
  return timingSafeEqual(signature.slice(7), expected);
}

async function hmacSha256Hex(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
