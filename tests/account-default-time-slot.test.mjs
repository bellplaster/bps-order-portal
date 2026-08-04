import test from "node:test";
import assert from "node:assert/strict";

import { cleanOrderDefaults } from "../functions/api/account.js";

test("customer account defaults accept the Any time slot", () => {
  const defaults = cleanOrderDefaults({ timeSlot: "ANY" });
  assert.equal(defaults.timeSlot, "ANY");
});

test("customer account defaults normalise time slot casing and whitespace", () => {
  const defaults = cleanOrderDefaults({ timeSlot: "  any  " });
  assert.equal(defaults.timeSlot, "ANY");
});

test("customer account defaults continue to reject unknown time slots", () => {
  assert.throws(
    () => cleanOrderDefaults({ timeSlot: "EVENING" }),
    /Choose a valid default time slot/,
  );
});
