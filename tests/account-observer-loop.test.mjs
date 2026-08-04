import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const experience = await readFile(new URL("../public/account-experience-v2.js", import.meta.url), "utf8");
const roleUx = await readFile(new URL("../public/account-role-ux.js", import.meta.url), "utf8");
const accountPage = await readFile(new URL("../public/account/index.html", import.meta.url), "utf8");

test("account observer ignores its own navigation visibility mutations", () => {
  assert.match(experience, /mutation\.target instanceof Element && mutation\.target\.id === "adminSection"/);
  assert.doesNotMatch(experience, /if \(mutation\.type === "attributes"\) \{\s*visibilityChanged = true;/);
  assert.match(experience, /observer\.observe\(main,/);
  assert.match(experience, /if \(link && link\.hidden !== shouldHide\) link\.hidden = shouldHide;/);
});

test("account experience uses the fixed cache key and a duplicate-load guard", () => {
  assert.match(roleUx, /__bpsAccountRoleUxStarted/);
  assert.match(roleUx, /account-experience-v2\.js\?v=20260804-2/);
  assert.match(accountPage, /account-role-ux\.js\?v=20260804-2/);
});
