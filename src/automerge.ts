import type { CheckRun, CommitStatus, IssueEvent, MergeMethod, PullRequest, RepositorySettings } from "./github";

export const AUTOMERGE_LABELS = new Set(["automerge", "tag: automerge"]);
export const AUTOMERGE_GRACE_PERIOD_MS = 10_000;

export interface AutomergeGitHub {
  pullRequest(number: number): Promise<PullRequest>;
  issueEvents(number: number): Promise<IssueEvent[]>;
  checkRuns(sha: string): Promise<CheckRun[]>;
  statuses(sha: string): Promise<CommitStatus[]>;
  repositorySettings(): Promise<RepositorySettings>;
  merge(number: number, sha: string, mergeMethod: MergeMethod): Promise<boolean>;
}

export interface EvaluateOptions {
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
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

export function gracePeriodRemaining(
  pullRequest: PullRequest,
  events: IssueEvent[],
  now: number,
  missingEventAddedAt = now,
): number {
  const activeLabels = new Set(
    pullRequest.labels.map(({ name }) => name.trim().toLowerCase()).filter((name) => AUTOMERGE_LABELS.has(name)),
  );
  const latestAdditions = new Map<string, number>();
  for (const event of events) {
    const label = event.label?.name.trim().toLowerCase();
    const createdAt = Date.parse(event.created_at);
    if (event.event === "labeled" && label && activeLabels.has(label) && !Number.isNaN(createdAt)) {
      latestAdditions.set(label, Math.max(latestAdditions.get(label) || 0, createdAt));
    }
  }
  const eventAddedAt = Math.min(...latestAdditions.values());
  const addedAt = Number.isFinite(eventAddedAt) ? eventAddedAt : missingEventAddedAt;
  return Math.min(AUTOMERGE_GRACE_PERIOD_MS, Math.max(0, AUTOMERGE_GRACE_PERIOD_MS - (now - addedAt)));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function evaluatePullRequest(
  github: AutomergeGitHub,
  number: number,
  repository: string,
  options: EvaluateOptions = {},
): Promise<boolean> {
  const now = options.now || Date.now;
  const waitFor = options.wait || wait;
  let pullRequest = await github.pullRequest(number);
  const labelObservedAt = now();
  if (pullRequest.state !== "open" || pullRequest.draft || !hasAutomergeLabel(pullRequest)) return false;

  for (;;) {
    const [checks, statuses] = await Promise.all([
      github.checkRuns(pullRequest.head.sha),
      github.statuses(pullRequest.head.sha),
    ]);
    if (checks.some((check) => check.status !== "completed") || statuses.some((status) => status.state === "pending")) {
      console.log(`Waiting for checks on ${repository}#${number}`);
      return false;
    }

    const remaining = gracePeriodRemaining(pullRequest, await github.issueEvents(number), now(), labelObservedAt);
    if (remaining > 0) {
      console.log(`Waiting for automerge grace period on ${repository}#${number}`);
      await waitFor(remaining);
      pullRequest = await github.pullRequest(number);
      if (pullRequest.state !== "open" || pullRequest.draft || !hasAutomergeLabel(pullRequest)) return false;
      continue;
    }

    const method = mergeMethod(await github.repositorySettings());
    if (!method) {
      console.log(`No direct merge method is enabled for ${repository}#${number}`);
      return false;
    }
    const merged = await github.merge(number, pullRequest.head.sha, method);
    console.log(merged ? `Merged ${repository}#${number}` : `GitHub blocked merge of ${repository}#${number}`);
    return merged;
  }
}
