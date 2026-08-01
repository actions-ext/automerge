import { describe, expect, test } from "vitest";

import { evaluatePullRequest, hasAutomergeLabel, mergeMethod, type AutomergeGitHub } from "../src/automerge";
import type { CheckRun, CommitStatus, MergeMethod, PullRequest, RepositorySettings } from "../src/github";

class FakeGitHub implements AutomergeGitHub {
  pull: PullRequest = {
    number: 12,
    state: "open",
    draft: false,
    labels: [{ name: "automerge" }],
    head: { sha: "abc123" },
  };
  checks: CheckRun[] = [{ status: "completed" }];
  commitStatuses: CommitStatus[] = [{ context: "legacy", state: "success" }];
  settings: RepositorySettings = {
    allow_merge_commit: true,
    allow_rebase_merge: true,
    allow_squash_merge: true,
  };
  mergeResult = true;
  merges: Array<{ number: number; sha: string; method: MergeMethod }> = [];

  async pullRequest(): Promise<PullRequest> {
    return this.pull;
  }

  async checkRuns(): Promise<CheckRun[]> {
    return this.checks;
  }

  async statuses(): Promise<CommitStatus[]> {
    return this.commitStatuses;
  }

  async repositorySettings(): Promise<RepositorySettings> {
    return this.settings;
  }

  async merge(number: number, sha: string, method: MergeMethod): Promise<boolean> {
    this.merges.push({ number, sha, method });
    return this.mergeResult;
  }
}

describe("automerge labels", () => {
  test.each(["automerge", "AUTOMERGE", "tag: automerge", " Tag: Automerge "])("accepts %s", (name) => {
    const github = new FakeGitHub();
    github.pull.labels = [{ name }];
    expect(hasAutomergeLabel(github.pull)).toBe(true);
  });

  test("rejects unrelated labels", () => {
    const github = new FakeGitHub();
    github.pull.labels = [{ name: "merge" }];
    expect(hasAutomergeLabel(github.pull)).toBe(false);
  });
});

test("waits until check runs and commit statuses finish", async () => {
  const github = new FakeGitHub();
  github.checks = [{ status: "completed" }, { status: "in_progress" }];
  github.commitStatuses = [{ context: "legacy", state: "pending" }];

  expect(await evaluatePullRequest(github, 12, "owner/repository")).toBe(false);
  expect(github.merges).toEqual([]);
});

test("asks GitHub to merge after all actions finish", async () => {
  const github = new FakeGitHub();
  github.checks = [{ status: "completed" }, { status: "completed" }];
  github.commitStatuses = [
    { context: "required", state: "success" },
    { context: "optional", state: "failure" },
  ];

  expect(await evaluatePullRequest(github, 12, "owner/repository")).toBe(true);
  expect(github.merges).toEqual([{ number: 12, sha: "abc123", method: "squash" }]);
});

test("leaves required-condition enforcement to GitHub", async () => {
  const github = new FakeGitHub();
  github.mergeResult = false;

  expect(await evaluatePullRequest(github, 12, "owner/repository")).toBe(false);
  expect(github.merges).toHaveLength(1);
});

test.each([
  { state: "closed", draft: false, labels: [{ name: "automerge" }] },
  { state: "open", draft: true, labels: [{ name: "automerge" }] },
  { state: "open", draft: false, labels: [{ name: "unrelated" }] },
] as const)("ignores ineligible pull requests", async ({ state, draft, labels }) => {
  const github = new FakeGitHub();
  github.pull = { ...github.pull, state, draft, labels: [...labels] };

  expect(await evaluatePullRequest(github, 12, "owner/repository")).toBe(false);
  expect(github.merges).toEqual([]);
});

test("selects the first enabled merge method", () => {
  expect(mergeMethod({ allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: true })).toBe("squash");
  expect(mergeMethod({ allow_squash_merge: false, allow_merge_commit: true, allow_rebase_merge: true })).toBe("merge");
  expect(mergeMethod({ allow_squash_merge: false, allow_merge_commit: false, allow_rebase_merge: true })).toBe(
    "rebase",
  );
  expect(mergeMethod({ allow_squash_merge: false, allow_merge_commit: false, allow_rebase_merge: false })).toBeNull();
});
