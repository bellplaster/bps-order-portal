import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const experience = await readFile(new URL("../public/account-experience-v2.js", import.meta.url), "utf8");
const roleUx = await readFile(new URL("../public/account-role-ux.js", import.meta.url), "utf8");
const adminDefaults = await readFile(new URL("../public/admin-defaults.js", import.meta.url), "utf8");

test("account experience does not observe and re-append its own sections", () => {
  assert.doesNotMatch(experience, /new MutationObserver/);
  assert.doesNotMatch(experience, /observer\.observe\(/);
  assert.match(experience, /const alreadyOrdered = desired\.length === current\.length/);
  assert.match(experience, /if \(!alreadyOrdered\) desired\.forEach\(\(element\) => main\.append\(element\)\);/);
});

test("dynamic Account sections use bounded synchronization", () => {
  assert.match(experience, /installDynamicSectionSync/);
  assert.match(experience, /attempts >= 100 \|\| unchangedChecks >= 30/);
  assert.match(experience, /bps:account-addresses-ready/);
  assert.match(experience, /dynamicSignature/);
});

test("Account scripts use the second hotfix cache keys and duplicate-load guards", () => {
  assert.match(roleUx, /__bpsAccountRoleUxStarted/);
  assert.match(roleUx, /account-experience-v2\.js\?v=20260804-3/);
  assert.match(adminDefaults, /account-role-ux\.js\?v=20260804-3/);
});
