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
    `   Confirms the issue is still open and ready+agent-eligible. Extract the output path from the issue body (typically "**Output:** \`docs/adr/NNNN-name.md\`" or similar). You will substitute this concrete value for the \`[FILL: output_path]\` marker in step 5.`,
    ``,
    `2. ELIGIBILITY CHECK (Rule 6 four conditions):`,
    `   (a) ready label present, (b) agent-eligible present, (c) human-only NOT present,`,
    `   (d) every skill:* label on the issue maps to an installed skill — name normalization`,
    `   replaces the colon with a hyphen (skill:writing → skill-writing, skill:research →`,
    `   skill-research, skill:review → skill-review, skill:code → skill-code).`,
    `   If any condition fails, write a one-line comment naming the failing condition and exit.`,
    ``,
    `3. CLAIM RITUAL via http (three calls, in this order — add labels BEFORE removing ready):`,
    `   a. http(method=POST, url=https://api.github.com/repos/${owner}/${repo}/issues/${issue.number}/assignees, json={"assignees":["jlwaugh"]})`,
    `   b. http(method=POST, url=https://api.github.com/repos/${owner}/${repo}/issues/${issue.number}/labels, json=["in-progress"])`,
    `   c. http(method=DELETE, url=https://api.github.com/repos/${owner}/${repo}/issues/${issue.number}/labels/ready)`,
    `   If any of (a) (b) (c) fail, write a one-line comment naming the failing step and exit; do not proceed.`,
    ``,
    `4. DO THE WORK substantively per the issue body. For ADR-style issues, draft Status / Context / Decision / Rationale / Comparison Table / Rejected Alternatives / Consequences / References. For research issues, produce structured findings with citations. Target 600-1500 words of concrete prose with named alternatives where appropriate. This drafted markdown is what you'll substitute for the \`[FILL: drafted_content]\` marker in step 5.`,
    ``,
    `5. COMMIT FILE via github WASM:`,
    `   github(action=create_or_update_file, owner=${owner}, repo=${repo}, path=[FILL: output_path], message="docs: add [FILL: output_path] per #${issue.number}", content=[FILL: drafted_content], branch=main)`,
    `   The markers \`[FILL: ...]\` are documentation placeholders. **Substitute concrete values before emitting the tool call** — \`path\` becomes the file path you extracted from the issue body in step 1, \`message\` becomes the rendered commit message with that path interpolated, \`content\` becomes the literal markdown body you drafted in step 4. **Never emit \`[FILL:\` as a literal value in tool args** — any tool call whose arg starts with \`[FILL:\` is a leak (Finding 26 in docs/ironclaw-tracer-outcome.md).`,
    `   If the issue body doesn't specify an output path, skip this step and proceed to step 6.`,
    ``,
    `6. POST HANDOFF COMMENT via github WASM:`,
    `   github(action=create_issue_comment, owner=${owner}, repo=${repo}, issue_number=${issue.number}, body=[FILL: handoff_body])`,
    `   Substitute \`[FILL: handoff_body]\` with the handoff text you construct. The body MUST start with \`**Handoff:**\` on one line, followed by a one-paragraph summary, followed by a fenced \`\`\`handoff block containing a JSON object with fields: changed_files (array), verification (array), residual_risk (array), links (array of urls).`,
    ``,
    `7. CLOSE ISSUE via http:`,
    `   http(method=PATCH, url=https://api.github.com/repos/${owner}/${repo}/issues/${issue.number}, json={"state":"closed","state_reason":"completed"})`,
    ``,
    `If any github or http call fails, write a one-line summary identifying which step failed and stop. Do not retry indefinitely; do not search for alternative tools. Do NOT call create_job — do all work inline within this single turn.`,
  ].join("\n");
}

async function verifyGitHubSignature(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature || !signature.startsWith("sha256=")) return false;
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
