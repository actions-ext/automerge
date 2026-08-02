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

  test("lists pull request issue events", async () => {
    const events = [{ event: "labeled", created_at: "2026-08-02T16:00:00Z", label: { name: "automerge" } }];
    const fetchMock = vi.fn().mockResolvedValue(Response.json(events));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GitHubClient("token", "owner/repository");

    expect(await client.issueEvents(12)).toEqual(events);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.github.com/repos/owner/repository/issues/12/events?per_page=100&page=1",
    );
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

  test("removes a pull request label", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GitHubClient("token", "owner/repository");

    await client.removeLabel(12, "tag: automerge");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repository/issues/12/labels/tag%3A%20automerge",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  test("reports the failing GitHub request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ message: "Resource not accessible by integration" }, { status: 403 })),
    );
    const client = new GitHubClient("token", "owner/repository");

    await expect(client.removeLabel(12, "automerge")).rejects.toThrow(
      "DELETE /repos/owner/repository/issues/12/labels/automerge: GitHub returned 403: Resource not accessible by integration",
    );
  });
});
