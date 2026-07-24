const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SESSION_COOKIE = "bps_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const PASSWORD_ITERATIONS = 100000;

export function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return rawValue.join("=");
  }
  return "";
}

export async function createSessionToken(secret, claims = {}) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    nonce: crypto.randomUUID(),
    userId: Number(claims.userId || 0) || null,
    accountId: Number(claims.accountId || 0) || null,
    username: String(claims.username || ""),
    role: claims.role === "admin" ? "admin" : "customer",
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(secret, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(secret, token) {
  if (!secret || !token || !token.includes(".")) return null;
  const [encodedPayload, suppliedSignature] = token.split(".");
  if (!encodedPayload || !suppliedSignature) return null;
  const expectedSignature = await sign(secret, encodedPayload);
  if (!constantTimeEqual(expectedSignature, suppliedSignature)) return null;
  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(encodedPayload)));
    if (Number(payload.exp) <= Math.floor(Date.now() / 1000)) return null;
    if (!payload.userId || !payload.username || !["admin", "customer"].includes(payload.role)) return null;
    return payload;
  } catch (_error) {
    return null;
  }
}

export async function passwordsMatch(expected, supplied) {
  if (!expected || !supplied) return false;
  const [expectedHash, suppliedHash] = await Promise.all([sha256(expected), sha256(supplied)]);
  return constantTimeEqual(expectedHash, suppliedHash);
}

export async function hashPassword(password, salt = randomSalt(), iterations = PASSWORD_ITERATIONS) {
  const clean = String(password || "");
  if (clean.length < 8) throw new Error("Password must contain at least 8 characters.");
  const safeIterations = normaliseIterations(iterations);
  const derived = await derivePassword(clean, salt, safeIterations);
  return { hash: toBase64Url(derived), salt, iterations: safeIterations };
}

export async function verifyPassword(password, salt, expectedHash, iterations = PASSWORD_ITERATIONS) {
  if (!password || !salt || !expectedHash) return false;
  const safeIterations = normaliseIterations(iterations);
  const derived = await derivePassword(String(password), String(salt), safeIterations);
  return constantTimeEqual(toBase64Url(derived), String(expectedHash));
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

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

function normaliseIterations(iterations) {
  const value = Number(iterations) || PASSWORD_ITERATIONS;
  if (!Number.isInteger(value) || value < 10000) return PASSWORD_ITERATIONS;
  return Math.min(value, PASSWORD_ITERATIONS);
}

async function derivePassword(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

async function sign(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toBase64Url(new Uint8Array(digest));
}

function constantTimeEqual(left, right) {
  left = String(left || "");
  right = String(right || "");
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index % Math.max(left.length, 1)) || 0) ^
      (right.charCodeAt(index % Math.max(right.length, 1)) || 0);
  }
  return difference === 0;
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}