import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(new URL("../public/order-control-refinement.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

test("delivery placeholders remain visibly editable", () => {
  assert.match(css, /\.delivery-select\.is-placeholder\s*\{[^}]*color:\s*#8f9996\s*!important;[^}]*background-color:\s*#fff\s*!important;[^}]*opacity:\s*1\s*!important;/s);
  assert.match(css, /\.delivery-instruction-controls \.delivery-select\s*\{[^}]*background-color:\s*#fff\s*!important;[^}]*opacity:\s*1\s*!important;[^}]*cursor:\s*pointer\s*!important;/s);
});

test("Gate Code focus uses the same thin active treatment as the other order controls", () => {
  assert.match(css, /box-shadow:\s*inset 0 0 0 1px var\(--bell-green\)\s*!important;/);
  assert.match(css, /gate-code-control\.is-invalid input\[type="text"\][^{]*\{[^}]*box-shadow:\s*inset 0 0 0 1px var\(--bell-maroon\)\s*!important;/s);
  assert.doesNotMatch(css, /gate-code-control\.is-invalid[^}]*0 0 0 2px/s);
});

test("N\/A uses Order Details typography without extra focus artefacts", () => {
  assert.match(css, /\.gate-code-na\s*\{[^}]*font:\s*400 11px\/39px Inter, system-ui, sans-serif\s*!important;[^}]*box-shadow:\s*none\s*!important;/s);
  assert.match(css, /\.gate-code-na > input\[type="checkbox"\][^{]*\{[^}]*width:\s*14px\s*!important;[^}]*height:\s*14px\s*!important;[^}]*box-shadow:\s*none\s*!important;/s);
  assert.match(css, /\.gate-code-na:focus-within\s*\{[^}]*box-shadow:\s*none\s*!important;/s);
});

test("disabled Gate Code remains visually part of the same table row", () => {
  assert.match(css, /input\[type="text"\]:disabled\s*\{[^}]*background:\s*#fff\s*!important;[^}]*opacity:\s*1\s*!important;/s);
});

test("Order Details stylesheet cache key is refreshed", () => {
  assert.match(html, /order-control-refinement\.css\?v=20260807-2/);
});
