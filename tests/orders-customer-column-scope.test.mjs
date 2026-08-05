import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = await readFile(new URL("../public/orders/orders.css", import.meta.url), "utf8");
const page = await readFile(new URL("../public/orders/index.html", import.meta.url), "utf8");
const controller = await readFile(new URL("../public/orders/orders.js", import.meta.url), "utf8");

test("Orders exposes the authenticated order scope on the page", () => {
  assert.match(controller, /document\.body\.dataset\.orderScope = scope/);
});

test("individual customer scopes hide the Customer column on desktop and mobile", () => {
  assert.match(styles, /data-order-scope="account"[^}]*\.orders-table th:nth-child\(3\)/s);
  assert.match(styles, /data-order-scope="own"[^}]*\.orders-customer-cell/s);
  assert.match(styles, /data-order-scope="account"[^}]*\.orders-mobile-meta>div:first-child/s);
  assert.match(styles, /data-order-scope="own"[^}]*\.orders-mobile-meta>div:first-child/s);
});

test("cross-account staff and administrator scopes are not hidden", () => {
  assert.doesNotMatch(styles, /data-order-scope="staff"[^}]*orders-customer-cell/s);
  assert.doesNotMatch(styles, /data-order-scope="all"[^}]*orders-customer-cell/s);
});

test("Orders page requests the scoped table stylesheet", () => {
  assert.match(page, /orders\/orders\.css\?v=20260805-2/);
});
