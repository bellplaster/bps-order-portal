const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SESSION_COOKIE = "bps_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";

  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");

    if (rawName === name) {
      return rawValue.join("=");
    }
  }

  return "";
}

export async function createSessionToken(secret) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    nonce: crypto.randomUUID(),
  };

  const encodedPayload = toBase64Url(
    encoder.encode(JSON.stringify(payload)),
  );

  const signature = await sign(secret, encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(secret, token) {
  if (!secret || !token || !token.includes(".")) {
    return false;
  }

  const [encodedPayload, suppliedSignature] = token.split(".");

  if (!encodedPayload || !suppliedSignature) {
    return false;
  }

  const expectedSignature = await sign(secret, encodedPayload);

  if (!constantTimeEqual(expectedSignature, suppliedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      decoder.decode(fromBase64Url(encodedPayload)),
    );

    return Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch (_error) {
    return false;
  }
}

export async function passwordsMatch(expected, supplied) {
  if (!expected || !supplied) {
    return false;
  }

  const [expectedHash, suppliedHash] = await Promise.all([
    sha256(expected),
    sha256(supplied),
  ]);

  return constantTimeEqual(expectedHash, suppliedHash);
}

export function sessionCookie(token) {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

export function expiredSessionCookie() {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

async function sign(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );

  return toBase64Url(new Uint8Array(signature));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(value),
  );

  return toBase64Url(new Uint8Array(digest));
}

function constantTimeEqual(left, right) {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    const leftCode = left.charCodeAt(index % Math.max(left.length, 1)) || 0;
    const rightCode = right.charCodeAt(index % Math.max(right.length, 1)) || 0;
    difference |= leftCode ^ rightCode;
  }

  return difference === 0;
}

function toBase64Url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
