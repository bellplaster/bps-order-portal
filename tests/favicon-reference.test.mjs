import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const orders = await readFile(new URL("../public/orders/index.html", import.meta.url), "utf8");

test("Orders uses the current round SVG favicon", () => {
  assert.match(orders, /rel="icon" type="image\/svg\+xml" href="https:\/\/assets\.bellplaster\.com\.au\/favicon-round\.svg"/);
  assert.doesNotMatch(orders, /favicon\.png/);
});
