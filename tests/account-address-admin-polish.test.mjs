import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("saved address rows keep default management inside the edit dialog", async () => {
  const [polishJs, polishCss, addressManager] = await Promise.all([
    read("public/account-small-layout-fix.js"),
    read("public/account-small-layout-fix.css"),
    read("public/account-addresses-management.js"),
  ]);

  assert.match(polishJs, /removeInlineDefaultActions/);
  assert.match(polishJs, /#savedAddressesList \[data-default\]/);
  assert.match(polishCss, /#savedAddressesList \[data-default\][\s\S]*display:none!important/);
  assert.match(addressManager, /id="savedAddressDefault" type="checkbox"/);
});

test("saved address modal state and floating placeholders are reset cleanly", async () => {
  const [polishJs, polishCss] = await Promise.all([
    read("public/account-small-layout-fix.js"),
    read("public/account-small-layout-fix.css"),
  ]);

  assert.doesNotThrow(() => new Function(polishJs));
  assert.match(polishJs, /setCustomValidity\(""\)/);
  assert.match(polishJs, /is-account-field-invalid/);
  assert.match(polishJs, /ValidationMessage/);
  assert.match(polishJs, /form\.reset\(\)/);
  assert.match(polishCss, /top:26px!important/);
  assert.match(polishCss, /saved-address-row:first-child[\s\S]*border-top:0!important/);
});

test("Account dynamic reconciliation is idempotent and cannot observe its own heading writes forever", async () => {
  const polishJs = await read("public/account-small-layout-fix.js");

  assert.match(polishJs, /heading\.textContent \|\| ""\)\.trim\(\) !== "Accounts"/);
  assert.match(polishJs, /brand\.dataset\.accountsHeading !== "true"/);
  assert.match(polishJs, /let reconcileScheduled = false/);
  assert.match(polishJs, /requestAnimationFrame/);
  assert.match(polishJs, /mutation\.addedNodes/);
  assert.match(polishJs, /nodeNeedsReconcile/);
  assert.doesNotMatch(polishJs, /new MutationObserver\(\(mutations\) => \{\s*removeInlineDefaultActions\(\);\s*applySidebarHeading\(\);/);
});

test("admin confirmation wiring and status alignment are repaired", async () => {
  const [polishJs, polishCss] = await Promise.all([
    read("public/account-small-layout-fix.js"),
    read("public/account-small-layout-fix.css"),
  ]);

  assert.match(polishJs, /adminConfirmSubmit/);
  assert.match(polishJs, /adminConfirmButton/);
  assert.match(polishJs, /adminConfirmFieldLabel/);
  assert.match(polishJs, /adminConfirmLabel/);
  assert.match(polishCss, /admin-account-columns>span:nth-child\(3\)/);
  assert.match(polishCss, /justify-content:center!important/);
});

test("customer deactivation is soft and blocks new logins without a global database lookup", async () => {
  const [accountApi, loginApi, middleware] = await Promise.all([
    read("functions/api/account.js"),
    read("functions/api/login.js"),
    read("functions/_middleware.js"),
  ]);

  const activeAction = accountApi.slice(
    accountApi.indexOf('action === "set_account_active"'),
    accountApi.indexOf('action === "delete_account"'),
  );
  assert.match(activeAction, /UPDATE customer_accounts SET active/);
  assert.doesNotMatch(activeAction, /DELETE FROM customer_accounts/);
  assert.match(loginApi, /user\.account_active !== 1/);
  assert.doesNotMatch(middleware, /getCurrentAccess/);
  assert.doesNotMatch(middleware, /access_role/);
  assert.match(middleware, /verifySessionToken/);
});
