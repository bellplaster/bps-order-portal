import test from "node:test";
import assert from "node:assert/strict";

import {
  normalisePortalUsername,
  PORTAL_USERNAME_ERROR,
} from "../functions/_shared/user-username.js";

test("accepts the two-character Customer Service username", () => {
  assert.equal(normalisePortalUsername("cs"), "cs");
});

test("normalises usernames before authentication", () => {
  assert.equal(normalisePortalUsername("  CS  "), "cs");
  assert.equal(normalisePortalUsername("Abby.Smith"), "abby.smith");
});

test("preserves supported existing usernames", () => {
  assert.equal(normalisePortalUsername("admin"), "admin");
  assert.equal(normalisePortalUsername("bps"), "bps");
  assert.equal(normalisePortalUsername("double-time_01"), "double-time_01");
});

test("rejects invalid usernames", () => {
  for (const value of ["c", "customer service", "customer@email.com", "a".repeat(81)]) {
    assert.throws(
      () => normalisePortalUsername(value),
      (error) => error instanceof Error && error.message === PORTAL_USERNAME_ERROR,
    );
  }
});
