import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const index = await readFile(new URL("../public/account/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../public/account-admin-shopify-polish.css", import.meta.url), "utf8");
const script = await readFile(new URL("../public/account-admin-shopify-polish.js", import.meta.url), "utf8");
const shopifyScript = await readFile(new URL("../public/account-shopify-fields.js", import.meta.url), "utf8");
const icon = await readFile(new URL("../public/admin-tools.svg", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("final Account polish loads after the existing Shopify layers", () => {
  const fields = index.indexOf("account-shopify-fields.css?v=20260804-2");
  const compact = index.indexOf("account-shopify-compact.css?v=20260804-1");
  const polish = index.indexOf("account-admin-shopify-polish.css?v=20260804-1");
  const fieldScript = index.indexOf("account-shopify-fields.js?v=20260804-2");
  const polishScript = index.indexOf("account-admin-shopify-polish.js?v=20260804-1");
  assert.ok(fields >= 0 && compact > fields && polish > compact);
  assert.ok(fieldScript >= 0 && polishScript > fieldScript);
});

test("processing changes only the button text without a spinner or faded state", () => {
  assert.match(shopifyScript, /button\.textContent = "Processing\.\.\."/);
  assert.match(css, /button\[aria-busy="true"\][\s\S]*opacity:1!important/);
  assert.match(css, /button\[aria-busy="true"\]::after[\s\S]*content:none!important[\s\S]*display:none!important/);
});

test("empty Time slot and Delivery type controls retain clear prompts", () => {
  assert.match(script, /\["defaultTimeSlot", "Select time slot"\]/);
  assert.match(script, /\["defaultDeliveryType", "Select delivery type"\]/);
  assert.match(script, /emptyOption\.textContent = emptyOption\.dataset\.originalText \|\| prompt/);
  assert.match(script, /field\.classList\.toggle\("is-select-empty"/);
  assert.match(css, /is-select-empty>span[\s\S]*visibility:hidden!important/);
  assert.match(css, /is-select-empty>select[\s\S]*color:var\(--account-shopify-label/);
});

test("an empty Instructions field places its prompt at the top left", () => {
  assert.match(css, /is-textarea:not\(\.is-floating\)>span[\s\S]*top:14px!important[\s\S]*transform:none!important/);
});

test("Administration uses the Account page typography, cards and button system", () => {
  assert.match(css, /#adminSection[\s\S]*border-radius:18px!important/);
  assert.match(css, /#adminSection \.admin-tab[\s\S]*font-size:14px!important/);
  assert.match(css, /#adminSection \.admin-panel-title h3[\s\S]*font-size:16px!important/);
  assert.match(css, /#adminSection \.admin-search input[\s\S]*height:44px!important[\s\S]*border-radius:12px!important/);
  assert.match(css, /#adminSection \.admin-table-row[\s\S]*min-height:68px!important/);
  assert.match(css, /#adminSection \.portal-user-group-toggle[\s\S]*min-height:68px!important/);
  assert.match(css, /#adminSection \.admin-management-row[\s\S]*min-height:78px!important/);
  assert.match(css, /admin-dialog::backdrop[\s\S]*backdrop-filter:blur\(7px\)!important/);
});

test("Administration navigation uses the supplied tools icon", () => {
  assert.match(script, /account-nav-admin-tools/);
  assert.match(css, /mask:url\('\/admin-tools\.svg'\)/);
  assert.match(icon, /viewBox="0 0 1920 1920"/);
  assert.match(icon, /<path d=/);
});

test("the final interaction script is syntax checked", () => {
  assert.match(packageJson.scripts.check, /node --check public\/account-admin-shopify-polish\.js/);
});
