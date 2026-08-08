import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const timeoutSource = await readFile(new URL("../public/session-timeout.js", import.meta.url), "utf8");
const middlewareSource = await readFile(new URL("../functions/_middleware.js", import.meta.url), "utf8");
const authSource = await readFile(new URL("../functions/_shared/auth.js", import.meta.url), "utf8");
const loginSource = await readFile(new URL("../public/login.js", import.meta.url), "utf8");

test("portal signs out after 60 minutes of inactivity with a five minute warning", () => {
  assert.match(timeoutSource, /IDLE_LIMIT_MS = 60 \* 60 \* 1000/);
  assert.match(timeoutSource, /WARNING_WINDOW_MS = 5 \* 60 \* 1000/);
  assert.match(timeoutSource, /Your session is about to expire/);
  assert.match(timeoutSource, /Stay signed in/);
  assert.match(timeoutSource, /signOut\("timeout"\)/);
});

test("activity is shared across portal tabs and the warning requires an explicit stay signed in action", () => {
  assert.match(timeoutSource, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(timeoutSource, /window\.addEventListener\("storage", syncFromStorage\)/);
  assert.match(timeoutSource, /if \(warningVisible \|\| signingOut\) return/);
  assert.match(timeoutSource, /sessionTimeoutStaySignedIn/);
});

test("all protected HTML responses receive the shared inactivity controller", () => {
  assert.match(middlewareSource, /SESSION_TIMEOUT_SCRIPT/);
  assert.match(middlewareSource, /contentType\.toLowerCase\(\)\.includes\("text\/html"\)/);
  assert.match(middlewareSource, /injectSessionTimeout\(response\)/);
});

test("server session ceiling remains longer than a workday inactivity window", () => {
  assert.match(authSource, /SESSION_MAX_AGE_SECONDS = 12 \* 60 \* 60/);
});

test("sign in page explains inactivity sign outs", () => {
  assert.match(loginSource, /reason === "timeout"/);
  assert.match(loginSource, /signed out after 60 minutes of inactivity/);
});
