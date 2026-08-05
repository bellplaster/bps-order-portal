import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("primary portal pages load the shared 1440px layout stylesheet", async () => {
  const [orderForm, orders, orderView, accountTail] = await Promise.all([
    read("public/index.html"),
    read("public/orders/index.html"),
    read("public/orders/view/index.html"),
    read("public/account-small-layout-fix.css"),
  ]);

  assert.match(orderForm, /portal-layout-width\.css\?v=20260805-1/);
  assert.match(orders, /portal-layout-width\.css\?v=20260805-1/);
  assert.match(orderView, /portal-layout-width\.css\?v=20260805-1/);
  assert.match(accountTail, /@import url\("\/portal-layout-width\.css\?v=20260805-1"\)/);
});

test("shared layout defines one 1440px desktop maximum and responsive gutters", async () => {
  const styles = await read("public/portal-layout-width.css");

  assert.match(styles, /--portal-content-max:\s*1440px/);
  assert.match(styles, /\.order-form-page \.order-shell/);
  assert.match(styles, /\.orders-page \.orders-shell/);
  assert.match(styles, /\.order-view-page \.order-view-shell/);
  assert.match(styles, /\.account-page \.account-shell/);
  assert.match(styles, /@media \(max-width:\s*768px\)/);
  assert.match(styles, /@media \(max-width:\s*375px\)/);
  assert.match(styles, /@media print/);
});

test("shared width layer preserves overflow safety for wide grids and tables", async () => {
  const styles = await read("public/portal-layout-width.css");

  assert.match(styles, /\.account-page \.account-main-v2/);
  assert.match(styles, /\.order-view-page \.order-detail-layout/);
  assert.match(styles, /\.orders-page \.orders-index-card/);
  assert.match(styles, /min-width:\s*0/);
});
