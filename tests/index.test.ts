import { createHmac } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

import { handleRequest } from "../src/index";

const env = {
  GITHUB_APP_ID: "1",
  GITHUB_APP_PRIVATE_KEY: "unused",
  GITHUB_WEBHOOK_SECRET: "webhook-secret",
};

function webhook(body: string, event: string, signature?: string): Request {
  return new Request("https://automerge.example/webhook", {
    method: "POST",
    headers: {
      "X-GitHub-Event": event,
      "X-Hub-Signature-256":
        signature || `sha256=${createHmac("sha256", env.GITHUB_WEBHOOK_SECRET).update(body).digest("hex")}`,
    },
    body,
  });
}

describe("worker", () => {
  test("reports health", async () => {
    const response = await handleRequest(new Request("https://automerge.example/healthz"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("answers GitHub pings", async () => {
    const response = await handleRequest(webhook("{}", "ping"), env);
    expect(response.status).toBe(200);
  });

  test("rejects invalid signatures", async () => {
    const response = await handleRequest(webhook("{}", "ping", "sha256=invalid"), env);
    expect(response.status).toBe(401);
  });

  test("ignores unsupported signed events", async () => {
    const response = await handleRequest(webhook("{}", "issues"), env);
    expect(response.status).toBe(202);
  });

  test("continues processing after acknowledging a webhook", async () => {
    const context = { waitUntil: vi.fn() };
    const response = await handleRequest(webhook("{}", "issues"), env, context);

    expect(response.status).toBe(202);
    expect(context.waitUntil).toHaveBeenCalledOnce();
    await context.waitUntil.mock.calls[0][0];
  });

  test("reports webhook processing errors", async () => {
    const body = JSON.stringify({
      action: "synchronize",
      installation: { id: 1 },
      repository: { id: 1, full_name: "owner/repository" },
      pull_request: { number: 1, labels: [{ name: "automerge" }] },
    });
    const response = await handleRequest(webhook(body, "pull_request"), env);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("GitHub App private key must be an RSA PEM private key");
  });
});
