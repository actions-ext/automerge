import { describe, expect, test, vi } from "vitest";

import { pullRequestNumbers, removeAutomergeLabels, type WebhookPayload } from "../src/events";
import type { GitHubClient, PullRequest } from "../src/github";

function payload(values: Partial<WebhookPayload>): WebhookPayload {
  return values;
}

function pullRequest(number: number, state: "open" | "closed" = "open"): PullRequest {
  return { number, state, draft: false, labels: [], head: { sha: "abc123" } };
}

describe("webhook event routing", () => {
  test("evaluates supported pull request and review events", async () => {
    const github = { pullRequestsForCommit: vi.fn() } as unknown as GitHubClient;
    const pull = pullRequest(12);

    expect(
      await pullRequestNumbers("pull_request", payload({ action: "labeled", pull_request: pull }), github),
    ).toEqual([12]);
    expect(
      await pullRequestNumbers("pull_request_review", payload({ action: "submitted", pull_request: pull }), github),
    ).toEqual([12]);
  });

  test("uses pull requests supplied by completed check suites", async () => {
    const github = { pullRequestsForCommit: vi.fn() } as unknown as GitHubClient;
    const result = await pullRequestNumbers(
      "check_suite",
      payload({ action: "completed", check_suite: { head_sha: "abc123", pull_requests: [{ number: 12 }] } }),
      github,
    );

    expect(result).toEqual([12]);
    expect(github.pullRequestsForCommit).not.toHaveBeenCalled();
  });

  test("finds open pull requests for fork checks and commit statuses", async () => {
    const github = {
      pullRequestsForCommit: vi.fn().mockResolvedValue([pullRequest(12), pullRequest(13, "closed")]),
    } as unknown as GitHubClient;

    expect(
      await pullRequestNumbers(
        "check_suite",
        payload({ action: "completed", check_suite: { head_sha: "abc123", pull_requests: [] } }),
        github,
      ),
    ).toEqual([12]);
    expect(await pullRequestNumbers("status", payload({ sha: "abc123" }), github)).toEqual([12]);
  });

  test("ignores unsupported event actions", async () => {
    const github = { pullRequestsForCommit: vi.fn() } as unknown as GitHubClient;
    expect(
      await pullRequestNumbers("pull_request", payload({ action: "closed", pull_request: pullRequest(12) }), github),
    ).toEqual([]);
    expect(
      await pullRequestNumbers(
        "pull_request",
        payload({ action: "synchronize", pull_request: pullRequest(12) }),
        github,
      ),
    ).toEqual([]);
  });

  test("removes automerge labels after commits are pushed", async () => {
    const github = { removeLabel: vi.fn() } as unknown as GitHubClient;
    const pull = pullRequest(12);
    pull.labels = [{ name: "automerge" }, { name: "Tag: Automerge" }, { name: "documentation" }];

    await removeAutomergeLabels(github, pull);

    expect(github.removeLabel).toHaveBeenCalledTimes(2);
    expect(github.removeLabel).toHaveBeenCalledWith(12, "automerge");
    expect(github.removeLabel).toHaveBeenCalledWith(12, "Tag: Automerge");
  });
});
