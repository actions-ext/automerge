const encoder = new TextEncoder();

function encodeBase64Url(value: Uint8Array | string): string {
  const binary = typeof value === "string" ? value : String.fromCharCode(...value);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodePem(pem: string): { bytes: Uint8Array; pkcs1: boolean } {
  const normalized = pem.replaceAll("\\n", "\n");
  const pkcs1 = normalized.includes("BEGIN RSA PRIVATE KEY");
  const base64 = normalized.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, "");
  if (!base64 || (!pkcs1 && !normalized.includes("BEGIN PRIVATE KEY"))) {
    throw new Error("GitHub App private key must be an RSA PEM private key");
  }
  return { bytes: Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)), pkcs1 };
}

function derLength(length: number): Uint8Array {
  if (length < 128) return Uint8Array.of(length);
  const bytes: number[] = [];
  for (let remaining = length; remaining > 0; remaining >>= 8) bytes.unshift(remaining & 0xff);
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function der(tag: number, value: Uint8Array): Uint8Array {
  return Uint8Array.of(tag, ...derLength(value.length), ...value);
}

function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const rsaAlgorithm = Uint8Array.of(
    0x30,
    0x0d,
    0x06,
    0x09,
    0x2a,
    0x86,
    0x48,
    0x86,
    0xf7,
    0x0d,
    0x01,
    0x01,
    0x01,
    0x05,
    0x00,
  );
  return der(0x30, Uint8Array.of(...version, ...rsaAlgorithm, ...der(0x04, pkcs1)));
}

export async function createAppJwt(
  appId: string,
  privateKey: string,
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  const decoded = decodePem(privateKey);
  const keyData = new Uint8Array(decoded.pkcs1 ? pkcs1ToPkcs8(decoded.bytes) : decoded.bytes).buffer;
  const key = await crypto.subtle.importKey("pkcs8", keyData, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: appId }));
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned));
  return `${unsigned}.${encodeBase64Url(new Uint8Array(signature))}`;
}

function hex(value: ArrayBuffer): string {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export async function verifyWebhook(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return constantTimeEqual(signature, `sha256=${hex(digest)}`);
}
