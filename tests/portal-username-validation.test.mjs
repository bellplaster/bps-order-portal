import assert from "node:assert/strict";
import test from "node:test";

import {
  PORTAL_USERNAME_ERROR,
  PORTAL_USERNAME_MAX_LENGTH,
  PORTAL_USERNAME_MIN_LENGTH,
  normalisePortalUsername,
} from "../functions/_shared/user-username.js";

test("customer service may use the two-character username cs", () => {
  assert.equal(PORTAL_USERNAME_MIN_LENGTH, 2);
  assert.equal(normalisePortalUsername(" cs "), "cs");
  assert.equal(normalisePortalUsername("CS"), "cs");
});

test("portal username validation retains safe character and length limits", () => {
  assert.equal(PORTAL_USERNAME_MAX_LENGTH, 80);
  assert.throws(() => normalisePortalUsername("c"), { message: PORTAL_USERNAME_ERROR });
  assert.throws(() => normalisePortalUsername("customer service"), { message: PORTAL_USERNAME_ERROR });
  assert.throws(() => normalisePortalUsername("a".repeat(81)), { message: PORTAL_USERNAME_ERROR });
  assert.equal(normalisePortalUsername("customer.service-1"), "customer.service-1");
});
