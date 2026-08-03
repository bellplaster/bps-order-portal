import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const legacyAccountController = await readFile(new URL("../public/account.js", import.meta.url), "utf8");
const userManagementController = await readFile(new URL("../public/admin-user-management.js", import.meta.url), "utf8");

test("only customer portal users require a customer account", () => {
  assert.match(legacyAccountController, /const customer = role\.value === "customer";/);
  assert.match(legacyAccountController, /account\.disabled = !customer;/);
  assert.match(legacyAccountController, /account\.required = customer;/);
  assert.doesNotMatch(legacyAccountController, /const admin = role\.value === "admin";\s*account\.disabled = admin;\s*account\.required = !admin;/);
});

test("both active account controllers use the same customer-only rule", () => {
  assert.match(userManagementController, /const customer = role === ROLE_CUSTOMER;/);
  assert.match(userManagementController, /account\.disabled = !customer;/);
  assert.match(userManagementController, /account\.required = customer;/);
});
