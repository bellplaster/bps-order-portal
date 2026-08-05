import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const redirects = await readFile(new URL("../public/_redirects", import.meta.url), "utf8");
const orders = await readFile(new URL("../public/orders/index.html", import.meta.url), "utf8");

test("root favicon fallback points to the round SVG asset", () => {
  assert.match(
    redirects,
    /^\/favicon\.ico https:\/\/assets\.bellplaster\.com\.au\/favicon-round\.svg\?v=20260805-1 302$/m,
  );
  assert.doesNotMatch(redirects, /favicon\.png/);
});

test("Orders page uses the same round SVG favicon", () => {
  assert.match(
    orders,
    /<link rel="icon" type="image\/svg\+xml" href="https:\/\/assets\.bellplaster\.com\.au\/favicon-round\.svg">/,
  );
});
