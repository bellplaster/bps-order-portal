import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const index = await readFile(new URL("../public/account/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../public/account-small-layout-fix.css", import.meta.url), "utf8");
const script = await readFile(new URL("../public/account-small-layout-fix.js", import.meta.url), "utf8");
const addressClient = await readFile(new URL("../public/account-addresses-management.js", import.meta.url), "utf8");
const addressApi = await readFile(new URL("../functions/api/account-addresses.js", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("the small Account correction loads after all existing refinement layers", () => {
  const adminCss = index.indexOf("account-admin-shopify-polish.css?v=20260804-1");
  const fixCss = index.indexOf("account-small-layout-fix.css?v=20260804-1");
  const adminJs = index.indexOf("account-admin-shopify-polish.js?v=20260804-1");
  const fixJs = index.indexOf("account-small-layout-fix.js?v=20260804-1");
  assert.ok(adminCss >= 0 && fixCss > adminCss);
  assert.ok(adminJs >= 0 && fixJs > adminJs);
});

test("the sidebar heading is Accounts only at 20px", () => {
  assert.match(script, /heading\.textContent = "Accounts"/);
  assert.match(script, /brand\.querySelector\("span"\)\?\.remove\(\)/);
  assert.match(css, /account-sidebar-brand-v2 strong[\s\S]*font-size:20px!important/);
  assert.match(css, /account-sidebar-brand-v2 span[\s\S]*display:none!important/);
});

test("Order defaults receives the same 14px separation used by Administration", () => {
  assert.match(css, /#orderDefaultsSection[\s\S]*margin-top:14px!important/);
});

test("administrators with a linked account can manage saved addresses", () => {
  assert.match(addressApi, /if \(!auth\?\.userId \|\| !auth\?\.accountId\) return false/);
  assert.match(addressApi, /if \(auth\.role === "admin"\) return true/);
  assert.match(addressApi, /account supervisor or an administrator can manage saved addresses/);
  assert.match(addressClient, /class="saved-address-actions"/);
  assert.match(addressClient, /data-edit=/);
  assert.match(addressClient, /data-remove=/);
  assert.match(addressClient, /id="addSavedAddress"/);
});

test("the new browser script and saved-address API are syntax checked", () => {
  assert.match(packageJson.scripts.check, /node --check public\/account-small-layout-fix\.js/);
  assert.match(packageJson.scripts.check, /node --check functions\/api\/account-addresses\.js/);
});
