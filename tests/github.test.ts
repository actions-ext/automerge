import { afterEach, describe, expect, test, vi } from "vitest";

import { GitHubClient } from "../src/github";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitHub client", () => {
  test("keeps only the latest status for each context", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json([
          { context: "build", state: "success" },
          { context: "lint", state: "pending" },
          { context: "build", state: "failure" },
        ]),
      ),
    );
    const client = new GitHubClient("token", "owner/repository");

    expect(await client.statuses("abc123")).toEqual([
      { context: "build", state: "success" },
      { context: "lint", state: "pending" },
    ]);
  });

  test("returns false when GitHub blocks a merge", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message: "Merge blocked" }, { status: 405 })));
    const client = new GitHubClient("token", "owner/repository");

    expect(await client.merge(12, "abc123", "squash")).toBe(false);
  });

  test("pins a successful merge to the checked head commit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ merged: true }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GitHubClient("token", "owner/repository");

    expect(await client.merge(12, "abc123", "squash")).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ sha: "abc123", merge_method: "squash" });
  });
});
