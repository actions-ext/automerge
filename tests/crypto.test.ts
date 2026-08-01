import { createHmac } from "node:crypto";

import { describe, expect, test } from "vitest";

import { verifyWebhook } from "../src/crypto";

describe("webhook signatures", () => {
  const body = JSON.stringify({ action: "labeled" });
  const secret = "webhook-secret";
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  test("accepts a valid signature", async () => {
    expect(await verifyWebhook(body, signature, secret)).toBe(true);
  });

  test("rejects missing and invalid signatures", async () => {
    expect(await verifyWebhook(body, null, secret)).toBe(false);
    expect(await verifyWebhook(body, "sha256=invalid", secret)).toBe(false);
  });
});
