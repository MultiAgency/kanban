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

  return [
    `Issue #${issue.number} in ${payload.repository.full_name} just became ready and is agent-eligible.`,
    `Title: ${issue.title}`,
    `Required skills: ${skills}`,
    ``,
    `Follow the kanban-worker convention. Run Rule 6 four-condition eligibility against your installed skills.`,
    `If green, perform the atomic claim ritual using the http tool (POST .../assignees, POST .../labels, DELETE .../labels/ready),`,
    `do the work substantively per the issue body, post a handoff comment matching docs/handoff-format.md via github.create_issue_comment,`,
    `then close via http (PATCH /issues/${issue.number} with state=closed, state_reason=completed).`,
    `If your installed skills don't match, exit cleanly without claiming.`,
    ``,
    `Issue URL: ${issue.html_url}`,
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
