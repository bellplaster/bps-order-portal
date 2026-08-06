import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("self-drilling bugles use the same thin divider as the Duo accessory transition", async () => {
  const [source, lowerCatalogueStyles] = await Promise.all([
    read("public/product-additions-20260806.js"),
    read("public/lower-products-refinement.css"),
  ]);

  assert.match(lowerCatalogueStyles, /border-top:4px solid #c3c9c7!important/);
  assert.match(source, /function applyGroupSeparator\(row\)/);
  assert.match(source, /"border-top", "4px solid #c3c9c7", "important"/);
  assert.match(source, /makeFastenerRow\(floor, label, sku, index === 0\)/);
  assert.doesNotMatch(source, /function makeSeparatorRow/);
  assert.doesNotMatch(source, /fragment\.append\(makeSeparatorRow\(\)\)/);
  assert.doesNotMatch(source, /colSpan\s*=\s*3/);
});

test("legacy spacer rows are removed during rerender", async () => {
  const source = await read("public/product-additions-20260806.js");
  assert.match(source, /\.self-drilling-bugle-row, \.self-drilling-bugle-separator/);
});
