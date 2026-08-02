import { AUTOMERGE_LABELS, evaluatePullRequest } from "./automerge";
import { installationClient, type GitHubClient, type PullRequest } from "./github";

export interface Env {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
}

export interface WebhookPayload {
  action?: string;
  installation?: { id: number };
  repository?: { id: number; full_name: string };
  label?: { name: string };
  pull_request?: PullRequest;
  check_suite?: { head_sha: string; pull_requests: Array<{ number: number }> };
  sha?: string;
}

const PULL_REQUEST_ACTIONS = new Set(["labeled", "ready_for_review", "reopened"]);
const REVIEW_ACTIONS = new Set(["dismissed", "submitted"]);

function unique(numbers: number[]): number[] {
  return [...new Set(numbers)];
}

async function pullRequestsForCommit(github: GitHubClient, sha: string): Promise<number[]> {
  return (await github.pullRequestsForCommit(sha))
    .filter((pullRequest) => pullRequest.state === "open")
    .map(({ number }) => number);
}

export async function removeAutomergeLabels(github: GitHubClient, pullRequest: PullRequest): Promise<void> {
  const labels = pullRequest.labels.filter(({ name }) => AUTOMERGE_LABELS.has(name.trim().toLowerCase()));
  await Promise.all(labels.map(({ name }) => github.removeLabel(pullRequest.number, name)));
}

export async function pullRequestNumbers(
  event: string,
  payload: WebhookPayload,
  github: GitHubClient,
): Promise<number[]> {
  if (event === "pull_request" && PULL_REQUEST_ACTIONS.has(payload.action || "") && payload.pull_request) {
    return [payload.pull_request.number];
  }
  if (event === "pull_request_review" && REVIEW_ACTIONS.has(payload.action || "") && payload.pull_request) {
    return [payload.pull_request.number];
  }
  if (event === "check_suite" && payload.action === "completed" && payload.check_suite) {
    const numbers = payload.check_suite.pull_requests.map(({ number }) => number);
    return unique(numbers.length ? numbers : await pullRequestsForCommit(github, payload.check_suite.head_sha));
  }
  if (event === "status" && payload.sha) return unique(await pullRequestsForCommit(github, payload.sha));
  return [];
}

export async function processEvent(event: string, payload: WebhookPayload, env: Env): Promise<void> {
  if (
    event === "pull_request" &&
    payload.action === "labeled" &&
    !AUTOMERGE_LABELS.has(payload.label?.name.trim().toLowerCase() || "")
  ) {
    return;
  }
  if (!payload.installation || !payload.repository) return;

  const github = await installationClient(
    env.GITHUB_APP_ID,
    env.GITHUB_APP_PRIVATE_KEY,
    payload.installation.id,
    payload.repository.id,
    payload.repository.full_name,
  );
  if (event === "pull_request" && payload.action === "synchronize" && payload.pull_request) {
    await removeAutomergeLabels(github, payload.pull_request);
    return;
  }
  const numbers = await pullRequestNumbers(event, payload, github);
  await Promise.all(numbers.map((number) => evaluatePullRequest(github, number, payload.repository!.full_name)));
}
