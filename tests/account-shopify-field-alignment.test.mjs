import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../public/account-shopify-fields.css", import.meta.url), "utf8");
const script = await readFile(new URL("../public/account-shopify-fields.js", import.meta.url), "utf8");

test("floating labels move only after a value exists", () => {
  assert.match(script, /const active = controlHasValue\(control\) \|\| shouldAlwaysFloat\(control\)/);
  assert.doesNotMatch(script, /document\.activeElement === control \|\| controlHasValue/);
});

test("Shopify fields use the larger centred input treatment", () => {
  assert.match(css, /height:56px!important/);
  assert.match(css, /min-height:56px!important/);
  assert.match(css, /line-height:20px!important/);
  assert.match(css, /border-radius:12px!important/);
});

test("Account action labels are concise and row edges align", () => {
  assert.match(script, /"Save changes":\s*"Save"/);
  assert.match(script, /"Add contact":\s*"Add"/);
  assert.match(script, /"Add address":\s*"Add"/);
  assert.match(css, /saved-contact-row,[\s\S]*saved-address-row[\s\S]*padding-right:22px!important/);
});
