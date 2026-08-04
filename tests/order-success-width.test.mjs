import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const guard = await readFile(new URL("../public/order-success-checkout-guard.css", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("confirmation page resets the order form to a full 1200px container", () => {
  assert.match(guard, /\.checkout-success-active \.order-shell\s*\{[\s\S]*width:\s*min\(1200px, calc\(100% - 40px\)\)\s*!important/);
  assert.match(guard, /max-width:\s*1200px\s*!important/);
  assert.match(guard, /\.checkout-success-active #orderForm,[\s\S]*\.checkout-success-active #successScreen\s*\{[\s\S]*width:\s*100%\s*!important/);
});

test("confirmation columns cannot collapse into a narrow form column", () => {
  assert.match(guard, /\.checkout-success-active \.checkout-confirmation-shell\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1\.65fr\) minmax\(380px, \.85fr\)\s*!important/);
  assert.match(guard, /\.checkout-success-active \.checkout-confirmation-main\s*\{[\s\S]*max-width:\s*none\s*!important/);
  assert.match(guard, /\.checkout-success-active \.checkout-summary-details\s*\{[\s\S]*width:\s*100%\s*!important/);
});

test("confirmation guard loads after the main confirmation stylesheet", () => {
  const checkout = index.indexOf("/order-success-checkout.css");
  const guardIndex = index.indexOf("/order-success-checkout-guard.css");
  assert.ok(checkout >= 0, "main confirmation stylesheet is missing");
  assert.ok(guardIndex > checkout, "confirmation guard must load after the main stylesheet");
});
