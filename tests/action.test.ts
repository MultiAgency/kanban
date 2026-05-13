import { describe, it, expect, vi } from "vitest";
import {
  confirmParents,
  promote,
  allParentsClosed,
  discoverChildren,
  createFollowUps,
  fetchHandoffComment,
  run,
  type CandidateChild,
  type GhClient,
} from "../src/action/index";

const stub = (overrides: Record<string, unknown>): GhClient => overrides as unknown as GhClient;
const ref = { owner: "MultiAgency", repo: "kanban" };

const handoffComment = (json: string): string =>
  ["**Handoff:** test", "", "```handoff", json, "```"].join("\n");

describe("confirmParents", () => {
  it("keeps candidates whose body declares the parent via checklist", () => {
    const c: CandidateChild = { number: 10, body: "- [ ] #5", labels: ["blocked"] };
    expect(confirmParents([c], 5)).toEqual([c]);
  });

  it("filters out candidates that mention the parent only in prose (false positive)", () => {
    const c: CandidateChild = {
      number: 10,
      body: "this looks like #5 but isn't a child",
      labels: ["blocked"],
    };
    expect(confirmParents([c], 5)).toEqual([]);
  });

  it("filters out candidates whose body declares a different parent", () => {
    const c: CandidateChild = { number: 10, body: "- [ ] #999", labels: ["blocked"] };
    expect(confirmParents([c], 5)).toEqual([]);
  });

  it("keeps candidates that declare the parent via a closing keyword", () => {
    const c: CandidateChild = { number: 10, body: "closes #5", labels: ["blocked"] };
    expect(confirmParents([c], 5)).toEqual([c]);
  });
});

describe("allParentsClosed", () => {
  it("returns true when all parents are closed", async () => {
    const octokit = stub({
      rest: {
        issues: { get: vi.fn().mockResolvedValue({ data: { state: "closed" } }) },
      },
    });
    const child: CandidateChild = { number: 10, body: "- [ ] #1\n- [ ] #2", labels: [] };
    expect(await allParentsClosed(octokit, ref, child)).toBe(true);
  });

  it("returns false when any parent is open", async () => {
    const octokit = stub({
      rest: {
        issues: {
          get: vi
            .fn()
            .mockResolvedValueOnce({ data: { state: "closed" } })
            .mockResolvedValueOnce({ data: { state: "open" } }),
        },
      },
    });
    const child: CandidateChild = { number: 10, body: "- [ ] #1\n- [ ] #2", labels: [] };
    expect(await allParentsClosed(octokit, ref, child)).toBe(false);
  });

  it("treats 404 as not-closed", async () => {
    const octokit = stub({
      rest: {
        issues: { get: vi.fn().mockRejectedValue({ status: 404, message: "Not Found" }) },
      },
    });
    const child: CandidateChild = { number: 10, body: "- [ ] #1", labels: [] };
    expect(await allParentsClosed(octokit, ref, child)).toBe(false);
  });

  it("rethrows non-404 errors", async () => {
    const octokit = stub({
      rest: {
        issues: { get: vi.fn().mockRejectedValue({ status: 500, message: "Server Error" }) },
      },
    });
    const child: CandidateChild = { number: 10, body: "- [ ] #1", labels: [] };
    await expect(allParentsClosed(octokit, ref, child)).rejects.toMatchObject({ status: 500 });
  });

  it("returns true vacuously when child has no parent refs", async () => {
    const octokit = stub({ rest: { issues: { get: vi.fn() } } });
    const child: CandidateChild = { number: 10, body: "no refs", labels: [] };
    expect(await allParentsClosed(octokit, ref, child)).toBe(true);
  });
});

describe("promote", () => {
  it("flips blocked → ready when child is blocked, preserving other labels", async () => {
    const removeLabel = vi.fn().mockResolvedValue({});
    const addLabels = vi.fn().mockResolvedValue({});
    const octokit = stub({ rest: { issues: { removeLabel, addLabels } } });
    const child: CandidateChild = {
      number: 10,
      body: "",
      labels: ["blocked", "skill:research", "agent-eligible"],
    };
    await promote(octokit, ref, child);
    expect(removeLabel).toHaveBeenCalledWith({
      owner: "MultiAgency",
      repo: "kanban",
      issue_number: 10,
      name: "blocked",
    });
    expect(addLabels).toHaveBeenCalledWith({
      owner: "MultiAgency",
      repo: "kanban",
      issue_number: 10,
      labels: ["ready"],
    });
  });

  it("is idempotent: no-op when child is already ready", async () => {
    const removeLabel = vi.fn();
    const addLabels = vi.fn();
    const octokit = stub({ rest: { issues: { removeLabel, addLabels } } });
    const child: CandidateChild = { number: 10, body: "", labels: ["ready"] };
    await promote(octokit, ref, child);
    expect(removeLabel).not.toHaveBeenCalled();
    expect(addLabels).not.toHaveBeenCalled();
  });

  it("is idempotent: no-op when child has neither blocked nor ready", async () => {
    const removeLabel = vi.fn();
    const addLabels = vi.fn();
    const octokit = stub({ rest: { issues: { removeLabel, addLabels } } });
    const child: CandidateChild = { number: 10, body: "", labels: ["agent-eligible"] };
    await promote(octokit, ref, child);
    expect(removeLabel).not.toHaveBeenCalled();
    expect(addLabels).not.toHaveBeenCalled();
  });

  it("calls addLabels before removeLabel so a mid-flight failure leaves the issue recoverable", async () => {
    const calls: string[] = [];
    const addLabels = vi.fn().mockImplementation(async () => {
      calls.push("add");
    });
    const removeLabel = vi.fn().mockImplementation(async () => {
      calls.push("remove");
      throw Object.assign(new Error("Server Error"), { status: 500 });
    });
    const octokit = stub({ rest: { issues: { removeLabel, addLabels } } });
    const child: CandidateChild = { number: 10, body: "", labels: ["blocked"] };

    await expect(promote(octokit, ref, child)).rejects.toMatchObject({ status: 500 });

    expect(calls).toEqual(["add", "remove"]);
    expect(addLabels).toHaveBeenCalledOnce();
    expect(removeLabel).toHaveBeenCalledOnce();
  });

  it("finishes the swap on a subsequent pass when a prior crash left both labels", async () => {
    const removeLabel = vi.fn().mockResolvedValue({});
    const addLabels = vi.fn().mockResolvedValue({});
    const octokit = stub({ rest: { issues: { removeLabel, addLabels } } });
    const child: CandidateChild = { number: 10, body: "", labels: ["ready", "blocked"] };

    await promote(octokit, ref, child);

    expect(addLabels).toHaveBeenCalledWith({
      owner: "MultiAgency",
      repo: "kanban",
      issue_number: 10,
      labels: ["ready"],
    });
    expect(removeLabel).toHaveBeenCalledWith({
      owner: "MultiAgency",
      repo: "kanban",
      issue_number: 10,
      name: "blocked",
    });
  });
});

describe("discoverChildren", () => {
  it("maps search results to CandidateChild shape (string + object labels, null body)", async () => {
    const octokit = stub({
      rest: {
        search: {
          issuesAndPullRequests: vi.fn().mockResolvedValue({
            data: {
              total_count: 2,
              items: [
                {
                  number: 10,
                  body: "- [ ] #5",
                  labels: ["blocked", { name: "skill:research" }],
                },
                { number: 11, body: null, labels: [] },
              ],
            },
          }),
        },
      },
    });
    expect(await discoverChildren(octokit, ref, 5)).toEqual([
      { number: 10, body: "- [ ] #5", labels: ["blocked", "skill:research"] },
      { number: 11, body: "", labels: [] },
    ]);
  });

  it("queries with the documented search syntax", async () => {
    const search = vi.fn().mockResolvedValue({ data: { total_count: 0, items: [] } });
    const octokit = stub({ rest: { search: { issuesAndPullRequests: search } } });
    await discoverChildren(octokit, ref, 42);
    expect(search).toHaveBeenCalledWith({
      q: 'is:issue is:open repo:MultiAgency/kanban "#42" in:body',
      per_page: 100,
    });
  });

  it("drops malformed search items and warns instead of crashing", async () => {
    const search = vi.fn().mockResolvedValue({
      data: {
        total_count: 4,
        items: [
          { number: 1, body: "valid", labels: [] }, // valid
          { number: "not-a-number", body: "bad", labels: [] }, // bad: number wrong type
          { number: 2, body: "bad", labels: null }, // bad: labels not array
          { number: 3, body: "bad", labels: [null, "ok"] }, // bad: null in labels
        ],
      },
    });
    const octokit = stub({ rest: { search: { issuesAndPullRequests: search } } });
    const writes: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
        return true;
      });

    const children = await discoverChildren(octokit, ref, 99);

    expect(children).toHaveLength(1);
    expect(children[0].number).toBe(1);
    expect(writes.some((w) => /::warning::.*dropped 3/.test(w))).toBe(true);

    writeSpy.mockRestore();
  });
});

describe("run", () => {
  it("promotes confirmed children with all parents closed", async () => {
    const search = vi.fn().mockResolvedValue({
      data: {
        total_count: 1,
        items: [{ number: 10, body: "- [ ] #5", labels: ["blocked"] }],
      },
    });
    const get = vi.fn().mockResolvedValue({ data: { state: "closed" } });
    const removeLabel = vi.fn().mockResolvedValue({});
    const addLabels = vi.fn().mockResolvedValue({});
    const octokit = stub({
      rest: {
        search: { issuesAndPullRequests: search },
        issues: {
          get,
          removeLabel,
          addLabels,
          listComments: vi.fn().mockResolvedValue({ data: [] }),
          create: vi.fn(),
        },
      },
    });
    await run(octokit, ref, 5);
    expect(removeLabel).toHaveBeenCalledOnce();
    expect(addLabels).toHaveBeenCalledOnce();
  });

  it("skips false-positive candidates (prose mention only)", async () => {
    const search = vi.fn().mockResolvedValue({
      data: {
        total_count: 1,
        items: [{ number: 10, body: "this is like #5 but not a child", labels: ["blocked"] }],
      },
    });
    const removeLabel = vi.fn();
    const addLabels = vi.fn();
    const octokit = stub({
      rest: {
        search: { issuesAndPullRequests: search },
        issues: {
          get: vi.fn(),
          removeLabel,
          addLabels,
          listComments: vi.fn().mockResolvedValue({ data: [] }),
          create: vi.fn(),
        },
      },
    });
    await run(octokit, ref, 5);
    expect(removeLabel).not.toHaveBeenCalled();
    expect(addLabels).not.toHaveBeenCalled();
  });

  it("does not promote when a parent is still open", async () => {
    const search = vi.fn().mockResolvedValue({
      data: {
        total_count: 1,
        items: [{ number: 10, body: "- [ ] #5\n- [ ] #6", labels: ["blocked"] }],
      },
    });
    const get = vi
      .fn()
      .mockResolvedValueOnce({ data: { state: "closed" } })
      .mockResolvedValueOnce({ data: { state: "open" } });
    const removeLabel = vi.fn();
    const addLabels = vi.fn();
    const octokit = stub({
      rest: {
        search: { issuesAndPullRequests: search },
        issues: {
          get,
          removeLabel,
          addLabels,
          listComments: vi.fn().mockResolvedValue({ data: [] }),
          create: vi.fn(),
        },
      },
    });
    await run(octokit, ref, 5);
    expect(removeLabel).not.toHaveBeenCalled();
  });

  it("files follow_ups from the closed issue's handoff before promotion", async () => {
    const search = vi.fn().mockResolvedValue({ data: { total_count: 0, items: [] } });
    const listComments = vi.fn().mockResolvedValue({
      data: [
        {
          body: handoffComment(
            '{"follow_ups":[{"title":"FollowUp","body":"context","skills":["skill:research"],"agent_eligible":true}]}',
          ),
        },
      ],
    });
    const create = vi.fn().mockResolvedValue({ data: { number: 99 } });
    const order: string[] = [];
    listComments.mockImplementation(async () => {
      order.push("listComments");
      return {
        data: [
          {
            body: handoffComment('{"follow_ups":[{"title":"FollowUp","body":"context"}]}'),
          },
        ],
      };
    });
    create.mockImplementation(async () => {
      order.push("create");
      return { data: { number: 99 } };
    });
    search.mockImplementation(async () => {
      order.push("search");
      return { data: { total_count: 0, items: [] } };
    });
    const octokit = stub({
      rest: {
        search: { issuesAndPullRequests: search },
        issues: { listComments, create, get: vi.fn(), removeLabel: vi.fn(), addLabels: vi.fn() },
      },
    });
    await run(octokit, ref, 5);
    expect(create).toHaveBeenCalledOnce();
    expect(order.indexOf("create")).toBeLessThan(order.indexOf("search"));
  });
});

describe("fetchHandoffComment", () => {
  it("returns the body of the last comment carrying a handoff fence", async () => {
    const listComments = vi.fn().mockResolvedValue({
      data: [
        { body: "first comment" },
        { body: handoffComment('{"changed_files":["older.ts"]}') },
        { body: "interleaved prose" },
        { body: handoffComment('{"changed_files":["newer.ts"]}') },
        { body: "trailing thought" },
      ],
    });
    const octokit = stub({ rest: { issues: { listComments } } });
    const body = await fetchHandoffComment(octokit, ref, 42);
    expect(body).toContain('"newer.ts"');
    expect(body).not.toContain('"older.ts"');
  });

  it("returns empty string when no comment carries a fence", async () => {
    const listComments = vi
      .fn()
      .mockResolvedValue({ data: [{ body: "no handoff" }, { body: null }] });
    const octokit = stub({ rest: { issues: { listComments } } });
    expect(await fetchHandoffComment(octokit, ref, 1)).toBe("");
  });

  it("returns empty string and warns when listComments errors", async () => {
    const listComments = vi.fn().mockRejectedValue({ status: 403, message: "forbidden" });
    const octokit = stub({ rest: { issues: { listComments } } });
    const writes: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
        return true;
      });

    expect(await fetchHandoffComment(octokit, ref, 1)).toBe("");
    expect(writes.some((w) => /::warning::.*unable to fetch comments/.test(w))).toBe(true);

    writeSpy.mockRestore();
  });
});

describe("createFollowUps", () => {
  it("creates one issue per valid follow_up with body-link and labels", async () => {
    const create = vi.fn().mockResolvedValueOnce({ data: { number: 101 } });
    const octokit = stub({ rest: { issues: { create } } });
    const body = handoffComment(
      '{"follow_ups":[{"title":"T","body":"B","skills":["skill:research","skill:writing"],"agent_eligible":true}]}',
    );

    const created = await createFollowUps(octokit, ref, 42, body);

    expect(created).toEqual([101]);
    expect(create).toHaveBeenCalledWith({
      owner: "MultiAgency",
      repo: "kanban",
      title: "T",
      body: "B\n\n- [ ] #42",
      labels: ["ready", "skill:research", "skill:writing", "agent-eligible"],
    });
  });

  it("omits agent-eligible label when follow_up.agent_eligible is false or absent", async () => {
    const create = vi.fn().mockResolvedValue({ data: { number: 200 } });
    const octokit = stub({ rest: { issues: { create } } });
    const body = handoffComment('{"follow_ups":[{"title":"T","body":"B"}]}');

    await createFollowUps(octokit, ref, 7, body);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ labels: ["ready"] }));
  });

  it("returns empty array when no follow_ups field present", async () => {
    const create = vi.fn();
    const octokit = stub({ rest: { issues: { create } } });
    const body = handoffComment('{"changed_files":["x.ts"]}');

    expect(await createFollowUps(octokit, ref, 1, body)).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns empty array when handoff fence is absent", async () => {
    const create = vi.fn();
    const octokit = stub({ rest: { issues: { create } } });

    expect(await createFollowUps(octokit, ref, 1, "no fence here")).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it("continues past per-entry failures and warns instead of aborting", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ data: { number: 301 } })
      .mockRejectedValueOnce({ status: 422, message: "validation failed" })
      .mockResolvedValueOnce({ data: { number: 303 } });
    const octokit = stub({ rest: { issues: { create } } });
    const body = handoffComment(
      `{"follow_ups":[
        {"title":"A","body":"a"},
        {"title":"B","body":"b"},
        {"title":"C","body":"c"}
      ]}`,
    );
    const writes: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
        return true;
      });

    const created = await createFollowUps(octokit, ref, 42, body);

    expect(created).toEqual([301, 303]);
    expect(create).toHaveBeenCalledTimes(3);
    expect(writes.some((w) => /::warning::.*follow_up.*failed to create/.test(w))).toBe(true);

    writeSpy.mockRestore();
  });
});
