import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const index = await readFile(new URL("../public/account/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../public/account-shopify-fields.css", import.meta.url), "utf8");
const script = await readFile(new URL("../public/account-shopify-fields.js", import.meta.url), "utf8");

test("Account page loads the Shopify-style field assets last", () => {
  const prototypeCss = index.indexOf("account-prototype-refinement.css?v=20260804-1");
  const shopifyCss = index.indexOf("account-shopify-fields.css?v=20260804-2");
  const prototypeJs = index.indexOf("account-prototype-interactions.js?v=20260804-1");
  const shopifyJs = index.indexOf("account-shopify-fields.js?v=20260804-2");
  assert.ok(prototypeCss >= 0 && shopifyCss > prototypeCss);
  assert.ok(prototypeJs >= 0 && shopifyJs > prototypeJs);
});

test("Account form controls use 14px text and animated floating labels", () => {
  assert.match(css, /account-shopify-field>span[\s\S]*font-size:14px!important/);
  assert.match(css, /account-shopify-field\.is-floating>span[\s\S]*font-size:11px!important/);
  assert.match(css, /account-shopify-field>input,[\s\S]*font-size:14px!important/);
  assert.match(css, /transition:top \.14s ease/);
  assert.match(script, /field\.classList\.toggle\("is-floating", active\)/);
});

test("Account section headings use the requested 16px scale", () => {
  assert.match(css, /account-section-bar h2[\s\S]*font-size:16px!important/);
});

test("Account address suggestions include a Shopify-style header and close control", () => {
  assert.match(script, /shopify-suggestion-header/);
  assert.match(script, />Suggestions</);
  assert.match(script, /closeOrderDetailSuggestions/);
  assert.match(css, /order-detail-suggestions\[data-group="account"\][\s\S]*border-radius:12px!important/);
  assert.match(css, /order-detail-suggestion\.is-active[\s\S]*background:var\(--account-shopify-highlight\)!important/);
});

test("Account save actions expose a Processing state", () => {
  assert.match(script, /button\.textContent = "Processing\.\.\."/);
  assert.match(script, /button\.setAttribute\("aria-busy", "true"\)/);
  assert.match(script, /PROCESSING_FORM_IDS/);
  assert.match(css, /button\[aria-busy="true"\]::after/);
});
