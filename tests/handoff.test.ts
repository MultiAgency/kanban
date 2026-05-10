import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHandoff } from "../src/lib/handoff";

const handoffBlock = (json: string): string =>
  ["**Handoff:** test", "", "```handoff", json, "```"].join("\n");

describe("parseHandoff", () => {
  it("parses a well-formed handoff with all fields", () => {
    const body = handoffBlock(
      '{"changed_files":["a.ts"],"verification":["npm test"],"residual_risk":["unspecified"],"links":["https://example.com"]}',
    );
    expect(parseHandoff(body)).toEqual({
      changed_files: ["a.ts"],
      verification: ["npm test"],
      residual_risk: ["unspecified"],
      links: ["https://example.com"],
    });
  });

  it("parses a handoff with a subset of fields", () => {
    const body = handoffBlock('{"changed_files":["only-this.ts"]}');
    expect(parseHandoff(body)).toEqual({ changed_files: ["only-this.ts"] });
  });

  it("returns null on missing fence", () => {
    expect(parseHandoff("just some prose, no handoff here")).toBeNull();
  });

  it("returns null on empty body", () => {
    expect(parseHandoff("")).toBeNull();
  });

  it("returns null on malformed JSON inside fence (no throw)", () => {
    const body = handoffBlock("{not valid json}");
    expect(parseHandoff(body)).toBeNull();
  });

  it("returns the first fence when multiple are present", () => {
    const body = [
      "First handoff:",
      "```handoff",
      '{"changed_files":["first.ts"]}',
      "```",
      "Second handoff:",
      "```handoff",
      '{"changed_files":["second.ts"]}',
      "```",
    ].join("\n");
    expect(parseHandoff(body)).toEqual({ changed_files: ["first.ts"] });
  });

  it("tolerates trailing prose after the fence", () => {
    const body =
      handoffBlock('{"links":["https://x"]}') + "\n\nSome reflection paragraph after the handoff.";
    expect(parseHandoff(body)).toEqual({ links: ["https://x"] });
  });

  it("parses the T6.1 acceptance fixture (real handoff from MultiAgency/test#3)", () => {
    const body = readFileSync(join(__dirname, "fixtures", "t2-handoff.md"), "utf8");
    expect(parseHandoff(body)).toEqual({
      changed_files: ["README.md"],
      verification: [
        "git log shows the commit landed on main",
        "https://github.com/MultiAgency/test/blob/main/README.md renders the line",
      ],
      residual_risk: [],
      links: [
        "https://github.com/MultiAgency/kanban/blob/main/SPEC.md",
        "https://github.com/MultiAgency/kanban/blob/main/docs/handoff-format.md",
      ],
    });
  });

  it("parses the T6.4 multi-party fixture and confirms the upstream cross-reference (MultiAgency/test#5 → #4)", () => {
    const body = readFileSync(join(__dirname, "fixtures", "t6.4-b-handoff.md"), "utf8");
    const parsed = parseHandoff(body);
    expect(parsed).not.toBeNull();
    expect(parsed?.links).toBeDefined();
    expect(parsed?.links?.some((u) => /MultiAgency\/test\/issues\/4/.test(u))).toBe(true);
  });
});
