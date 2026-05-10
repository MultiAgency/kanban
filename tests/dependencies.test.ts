import { describe, it, expect } from "vitest";
import { parseDependencies } from "../src/lib/dependencies";

describe("parseDependencies", () => {
  it("returns [] for an empty body", () => {
    expect(parseDependencies("")).toEqual([]);
  });

  it("returns [] for a body with no references", () => {
    expect(parseDependencies("Just some text without issue links.")).toEqual([]);
  });

  it("parses an unticked checklist reference", () => {
    expect(parseDependencies("- [ ] #42")).toEqual([42]);
  });

  it("parses a ticked checklist reference (lowercase x)", () => {
    expect(parseDependencies("- [x] #42")).toEqual([42]);
  });

  it("parses a ticked checklist reference (uppercase X)", () => {
    expect(parseDependencies("- [X] #42")).toEqual([42]);
  });

  it("parses multiple distinct checklist references in order", () => {
    const body = ["- [ ] #1", "- [x] #2", "- [ ] #3"].join("\n");
    expect(parseDependencies(body)).toEqual([1, 2, 3]);
  });

  it("parses closing-keyword references (lowercase)", () => {
    const body = "closes #10. fixes #20. resolves #30.";
    expect(parseDependencies(body)).toEqual([10, 20, 30]);
  });

  it("parses closing keywords case-insensitively", () => {
    const body = "CLOSES #10 and Fixes #20 and BLOCKED BY #30";
    expect(parseDependencies(body)).toEqual([10, 20, 30]);
  });

  it("parses 'blocked by' as a multi-word keyword", () => {
    expect(parseDependencies("blocked by #99")).toEqual([99]);
  });

  it("parses 'blocks' as a closing keyword", () => {
    expect(parseDependencies("This blocks #88.")).toEqual([88]);
  });

  it("deduplicates references across formats", () => {
    const body = ["- [ ] #5", "closes #5", "- [x] #5"].join("\n");
    expect(parseDependencies(body)).toEqual([5]);
  });

  it("preserves first-occurrence order across formats", () => {
    const body = ["- [ ] #2", "- [ ] #1", "closes #3"].join("\n");
    expect(parseDependencies(body)).toEqual([2, 1, 3]);
  });

  it("skips cross-repo checklist references", () => {
    expect(parseDependencies("- [ ] owner/repo#42")).toEqual([]);
  });

  it("skips cross-repo closing-keyword references", () => {
    expect(parseDependencies("closes owner/repo#42")).toEqual([]);
  });

  it("does not match keywords mid-word", () => {
    expect(parseDependencies("uncloses #99")).toEqual([]);
  });

  it("does not match malformed #abc references", () => {
    expect(parseDependencies("- [ ] #abc")).toEqual([]);
  });
});
