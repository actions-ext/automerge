import type { CheckRun, CommitStatus, MergeMethod, PullRequest, RepositorySettings } from "./github";

export const AUTOMERGE_LABELS = new Set(["automerge", "tag: automerge"]);

export interface AutomergeGitHub {
  pullRequest(number: number): Promise<PullRequest>;
  checkRuns(sha: string): Promise<CheckRun[]>;
  statuses(sha: string): Promise<CommitStatus[]>;
  repositorySettings(): Promise<RepositorySettings>;
  merge(number: number, sha: string, mergeMethod: MergeMethod): Promise<boolean>;
}

export function hasAutomergeLabel(pullRequest: PullRequest): boolean {
  return pullRequest.labels.some((label) => AUTOMERGE_LABELS.has(label.name.trim().toLowerCase()));
}

export function mergeMethod(settings: RepositorySettings): MergeMethod | null {
  if (settings.allow_squash_merge) return "squash";
  if (settings.allow_merge_commit) return "merge";
  if (settings.allow_rebase_merge) return "rebase";
  return null;
}

export async function evaluatePullRequest(
  github: AutomergeGitHub,
  number: number,
  repository: string,
): Promise<boolean> {
  const pullRequest = await github.pullRequest(number);
  if (pullRequest.state !== "open" || pullRequest.draft || !hasAutomergeLabel(pullRequest)) return false;

  const [checks, statuses, settings] = await Promise.all([
    github.checkRuns(pullRequest.head.sha),
    github.statuses(pullRequest.head.sha),
    github.repositorySettings(),
  ]);
  if (checks.some((check) => check.status !== "completed") || statuses.some((status) => status.state === "pending")) {
    console.log(`Waiting for checks on ${repository}#${number}`);
    return false;
  }

  const method = mergeMethod(settings);
  if (!method) {
    console.log(`No direct merge method is enabled for ${repository}#${number}`);
    return false;
  }
  const merged = await github.merge(number, pullRequest.head.sha, method);
  console.log(merged ? `Merged ${repository}#${number}` : `GitHub blocked merge of ${repository}#${number}`);
  return merged;
}
