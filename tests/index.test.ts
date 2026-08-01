import { createHmac } from "node:crypto";

import { describe, expect, test } from "vitest";

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
});
