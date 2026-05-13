#!/usr/bin/env node
// scripts/push-roadmap.mjs
//
// Bulk-pushes roadmap/v1-issues.yaml as GitHub issues to a target repo.
// Two-pass design:
//   Pass 1 — for each entry, resolve to a GitHub issue number via this
//            lookup order:
//              (1) `roadmap/.id-to-number.json` — the stable cached map
//                  from previous runs. Letter-prefix id is the primary
//                  key; renames don't break this lookup.
//              (2) title-match search — only when the cache has no
//                  entry for this id (first push for that id).
//              (3) create a new issue — only when both above fail.
//            Captures every entry's letter-prefix → #N mapping into the
//            run's working map.
//   Pass 2 — for every entry, substitute letter-prefix references in the
//            body with their mapped #N values, append a machine-readable
//            "## Parents" checklist matching the v0 dependencies parser,
//            and edit the issue's title and body to match the YAML.
//
// Idempotent on re-run: existing issues are reused via the cached id-to-
// number map (stable across YAML title renames), and any pre-existing
// "## Parents" section is stripped before re-appending so re-runs produce
// the same body. Title-match is only the first-push fallback, never the
// primary lookup once the cache is populated.
//
// Substitution semantics:
//   - Word-boundary regex so "D1" doesn't match inside "RD1" and "API2a"
//     doesn't match inside any longer string.
//   - Ids substituted in length-descending order as belt-and-suspenders
//     (word boundaries already handle ordering, but explicit is cheaper
//     than debugging a partial substitution later).
//
// Preconditions:
//   - scripts/validate-roadmap.sh passes
//   - `gh` authenticated; the underlying token must have `issues: write`
//     scope on the target repo (PAT or fine-grained token both work)
//   - target repo already has the canonical labels (run `gh label sync`
//     against .github/labels.yml separately)
//
// Caveats:
//   - Rate-limit handling relies on `gh`'s built-in backoff; not exercised
//     by the dry-run path. Verify against the target repo on first live run
//     before relying on it for high-volume re-runs.
//
// Usage:
//   scripts/push-roadmap.mjs --repo owner/repo [--dry-run]

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parse as parseYaml } from "yaml";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// ---- Args ----
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const repoIdx = args.indexOf("--repo");
if (repoIdx < 0 || !args[repoIdx + 1]) {
  console.error("Usage: scripts/push-roadmap.mjs --repo owner/repo [--dry-run]");
  process.exit(2);
}
const repo = args[repoIdx + 1];

// ---- Precondition: validate-roadmap.sh ----
console.error("==> Running validate-roadmap.sh...");
try {
  execFileSync(`${repoRoot}/scripts/validate-roadmap.sh`, [], { stdio: "inherit" });
} catch {
  console.error("Validation failed; aborting.");
  process.exit(1);
}

// ---- Load YAML ----
const yamlPath = `${repoRoot}/roadmap/v1-issues.yaml`;
const entries = parseYaml(readFileSync(yamlPath, "utf8"));
console.error(`==> Loaded ${entries.length} entries from roadmap/v1-issues.yaml`);

// ---- gh helpers ----
function ghJson(ghArgs) {
  const out = execFileSync("gh", ghArgs, { encoding: "utf8" });
  return JSON.parse(out);
}

function ghCreateIssue(repo, title, body, labels) {
  const out = execFileSync(
    "gh",
    [
      "issue",
      "create",
      "--repo",
      repo,
      "--title",
      title,
      "--body",
      body,
      "--label",
      labels.join(","),
    ],
    { encoding: "utf8" },
  );
  const match = out.trim().match(/\/issues\/(\d+)\s*$/);
  if (!match) throw new Error(`Could not parse issue number from gh output: ${out}`);
  return parseInt(match[1], 10);
}

function ghEditIssue(repo, number, title, body) {
  execFileSync(
    "gh",
    ["issue", "edit", String(number), "--repo", repo, "--title", title, "--body", body],
    {
      stdio: ["pipe", "pipe", "inherit"],
    },
  );
}

function ghIssueExists(repo, number) {
  try {
    execFileSync("gh", ["issue", "view", String(number), "--repo", repo, "--json", "number"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

function findExistingIssueByTitle(repo, title) {
  const results = ghJson([
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "all",
    "--search",
    `"${title}" in:title`,
    "--json",
    "number,title",
    "--limit",
    "50",
  ]);
  const match = results.find((i) => i.title === title);
  return match ? match.number : null;
}

// ---- Load cached id→number mapping (primary lookup key, stable across renames) ----
const mappingPathLive = `${repoRoot}/roadmap/.id-to-number.json`;
const cachedMap = new Map();
if (existsSync(mappingPathLive)) {
  const cached = JSON.parse(readFileSync(mappingPathLive, "utf8"));
  for (const [id, number] of Object.entries(cached)) {
    cachedMap.set(id, number);
  }
  console.error(`==> Loaded ${cachedMap.size} cached id→number mappings`);
} else {
  console.error("==> No cached id→number mapping (first push for this repo)");
}

// ---- Pass 1: resolve each entry to an issue number ----
// Lookup order: (1) cached id-to-number map, (2) title-match search,
// (3) create new. Cache lookup is the primary key — stable across YAML
// title renames. Title-match is the first-push fallback only.
console.error(`==> Pass 1: ${dryRun ? "[dry-run] " : ""}resolve against ${repo}`);

const idToNumber = new Map();
let dryRunCounter = 1000;

for (const entry of entries) {
  if (dryRun) {
    const cached = cachedMap.get(entry.id);
    const fake = cached ?? dryRunCounter++;
    idToNumber.set(entry.id, fake);
    const tag = cached ? "[dry-run cached]" : "[dry-run create]";
    console.error(`  ${tag} ${entry.id} → #${fake} (${entry.title})`);
    continue;
  }
  // (1) Cached lookup — stable across renames
  const cached = cachedMap.get(entry.id);
  if (cached && ghIssueExists(repo, cached)) {
    idToNumber.set(entry.id, cached);
    console.error(`  [cached]  ${entry.id} → #${cached}`);
    continue;
  }
  // (2) Title-match fallback (first push, or cached entry's issue was deleted)
  const existing = findExistingIssueByTitle(repo, entry.title);
  if (existing) {
    idToNumber.set(entry.id, existing);
    console.error(`  [reuse]   ${entry.id} → #${existing}`);
    continue;
  }
  // (3) Create
  const number = ghCreateIssue(repo, entry.title, entry.body, entry.labels);
  idToNumber.set(entry.id, number);
  console.error(`  [create]  ${entry.id} → #${number}`);
}

// ---- Pass 2: substitute refs and append Parents checklist ----
console.error(`==> Pass 2: ${dryRun ? "[dry-run] " : ""}substitute refs + append Parents`);

const sortedIds = [...idToNumber.keys()].sort((a, b) => b.length - a.length);

function substituteRefs(body) {
  let result = body;
  for (const id of sortedIds) {
    const number = idToNumber.get(id);
    const re = new RegExp(`\\b${id}\\b`, "g");
    result = result.replace(re, `#${number}`);
  }
  return result;
}

function buildBody(entry) {
  let body = substituteRefs(entry.body);
  // Strip any existing Parents section so re-runs are idempotent.
  body = body.replace(/\n*## Parents\n[\s\S]*$/, "");
  if (entry.depends_on && entry.depends_on.length > 0) {
    const parents = entry.depends_on.map((id) => `- [ ] #${idToNumber.get(id)}`).join("\n");
    body = `${body.replace(/\s+$/, "")}\n\n## Parents\n\n${parents}\n`;
  }
  return body;
}

for (const entry of entries) {
  const number = idToNumber.get(entry.id);
  const newBody = buildBody(entry);
  if (dryRun) {
    const parentsSummary =
      entry.depends_on && entry.depends_on.length > 0
        ? entry.depends_on.map((id) => `${id}=#${idToNumber.get(id)}`).join(", ")
        : "(none)";
    console.error(`  [dry-run] would edit #${number} (${entry.id}); parents: ${parentsSummary}`);
    continue;
  }
  ghEditIssue(repo, number, entry.title, newBody);
  console.error(`  [edit]    #${number} (${entry.id})`);
}

// ---- Write mapping file for inspection ----
const mappingPath = dryRun ? `${repoRoot}/roadmap/.id-to-number.dry-run.json` : mappingPathLive;
const mapping = Object.fromEntries(idToNumber);
writeFileSync(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`);
console.error(`==> Wrote mapping to ${mappingPath}`);

console.error(`\n==> Done. ${entries.length} entries processed against ${repo}.`);
if (dryRun) console.error("Dry-run mode: no GitHub API writes occurred.");
