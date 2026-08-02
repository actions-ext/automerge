import { createAppJwt } from "./crypto";

const API_VERSION = "2026-03-10";

export interface PullRequest {
  number: number;
  state: "open" | "closed";
  draft: boolean;
  labels: Array<{ name: string }>;
  head: { sha: string };
}

export interface CheckRun {
  status: string;
}

export interface CommitStatus {
  context: string;
  state: "error" | "failure" | "pending" | "success";
}

export interface RepositorySettings {
  allow_merge_commit: boolean;
  allow_rebase_merge: boolean;
  allow_squash_merge: boolean;
}

export type MergeMethod = "merge" | "rebase" | "squash";

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function responseError(response: Response): Promise<GitHubError> {
  let message = response.statusText;
  try {
    const body = (await response.json()) as { message?: string };
    message = body.message || message;
  } catch {
    // GitHub may return an empty response body.
  }
  return new GitHubError(`GitHub returned ${response.status}: ${message}`, response.status);
}

async function githubRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "actions-ext-automerge",
      "X-GitHub-Api-Version": API_VERSION,
      ...init.headers,
    },
  });
  if (!response.ok) throw await responseError(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export class GitHubClient {
  constructor(
    private readonly token: string,
    private readonly repository: string,
  ) {}

  async pullRequest(number: number): Promise<PullRequest> {
    return githubRequest(`/repos/${this.repository}/pulls/${number}`, this.token);
  }

  async pullRequestsForCommit(sha: string): Promise<PullRequest[]> {
    return githubRequest(`/repos/${this.repository}/commits/${sha}/pulls`, this.token);
  }

  async checkRuns(sha: string): Promise<CheckRun[]> {
    const checks: CheckRun[] = [];
    for (let page = 1; ; page += 1) {
      const result = await githubRequest<{ check_runs: CheckRun[] }>(
        `/repos/${this.repository}/commits/${sha}/check-runs?filter=latest&per_page=100&page=${page}`,
        this.token,
      );
      checks.push(...result.check_runs);
      if (result.check_runs.length < 100) return checks;
    }
  }

  async statuses(sha: string): Promise<CommitStatus[]> {
    const statuses: CommitStatus[] = [];
    for (let page = 1; ; page += 1) {
      const result = await githubRequest<CommitStatus[]>(
        `/repos/${this.repository}/commits/${sha}/statuses?per_page=100&page=${page}`,
        this.token,
      );
      statuses.push(...result);
      if (result.length < 100) break;
    }
    const latest = new Map<string, CommitStatus>();
    for (const status of statuses) {
      if (!latest.has(status.context)) latest.set(status.context, status);
    }
    return [...latest.values()];
  }

  async repositorySettings(): Promise<RepositorySettings> {
    return githubRequest(`/repos/${this.repository}`, this.token);
  }

  async removeLabel(number: number, label: string): Promise<void> {
    await githubRequest(`/repos/${this.repository}/issues/${number}/labels/${encodeURIComponent(label)}`, this.token, {
      method: "DELETE",
    });
  }

  async merge(number: number, sha: string, mergeMethod: MergeMethod): Promise<boolean> {
    try {
      const result = await githubRequest<{ merged: boolean }>(
        `/repos/${this.repository}/pulls/${number}/merge`,
        this.token,
        {
          method: "PUT",
          body: JSON.stringify({ sha, merge_method: mergeMethod }),
        },
      );
      return result.merged;
    } catch (error) {
      if (error instanceof GitHubError && (error.status === 405 || error.status === 409)) return false;
      throw error;
    }
  }
}

export async function installationClient(
  appId: string,
  privateKey: string,
  installationId: number,
  repositoryId: number,
  repository: string,
): Promise<GitHubClient> {
  const appJwt = await createAppJwt(appId, privateKey);
  const response = await githubRequest<{ token: string }>(
    `/app/installations/${installationId}/access_tokens`,
    appJwt,
    {
      method: "POST",
      body: JSON.stringify({ repository_ids: [repositoryId] }),
    },
  );
  return new GitHubClient(response.token, repository);
}
