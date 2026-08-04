import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const index = await readFile(new URL("../public/account/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../public/account-shopify-compact.css", import.meta.url), "utf8");

test("compact Account corrections load after the Shopify field layer", () => {
  const fields = index.indexOf("account-shopify-fields.css?v=20260804-2");
  const compact = index.indexOf("account-shopify-compact.css?v=20260804-1");
  assert.ok(fields >= 0 && compact > fields);
});

test("order defaults use compact row spacing and a real 52px control height", () => {
  assert.match(css, /order-default-grid\{[\s\S]*gap:10px 14px!important/);
  assert.match(css, /account-field\.account-shopify-field>input,[\s\S]*height:52px!important/);
  assert.match(css, /is-floating>input,[\s\S]*padding-top:20px!important/);
  assert.match(css, /is-floating>span,[\s\S]*top:7px!important/);
});

test("saved contact actions are pinned to the same right edge as addresses", () => {
  assert.match(css, /saved-contact-row\{[\s\S]*padding:12px 170px 12px 18px!important/);
  assert.match(css, /saved-contact-actions\{[\s\S]*position:absolute!important[\s\S]*right:18px!important/);
  assert.match(css, /saved-address-row\{[\s\S]*padding:12px 18px!important/);
});

test("modal and card spacing is reduced without shrinking action buttons", () => {
  assert.match(css, /account-section-bar\{[\s\S]*min-height:64px!important/);
  assert.match(css, /saved-contact-fields,[\s\S]*gap:10px!important[\s\S]*padding:16px 20px!important/);
  assert.match(css, /account-form-actions\{[\s\S]*min-height:56px!important/);
});
