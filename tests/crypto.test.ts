import { createHmac, generateKeyPairSync, verify } from "node:crypto";

import { describe, expect, test } from "vitest";

import { createAppJwt, verifyWebhook } from "../src/crypto";

describe("GitHub App JWTs", () => {
  test.each(["pkcs1", "pkcs8"] as const)("creates a verifiable JWT from a %s private key", async (type) => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ format: "pem", type }).toString();
    const jwt = await createAppJwt("4464893", pem, 1_800_000_000);
    const [header, payload, signature] = jwt.split(".");

    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
      iat: 1_799_999_940,
      exp: 1_800_000_540,
      iss: "4464893",
    });
    expect(
      verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url")),
    ).toBe(true);
  });
});

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
