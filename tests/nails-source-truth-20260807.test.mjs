import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("SKU source truth owns Nails as a single 30 mm variant", async () => {
  const source = await read("public/sku-source-truth.js");

  assert.match(source, /nails\.columns = \["30 mm"\]/);
  assert.doesNotMatch(source, /nails\.columns = \["30 mm", "40 mm"\]/);
  assert.match(source, /assignKey\(found\?\.cells\?\.\[0\], "nail-zinc-30", "PLAD3028Y"/);
  assert.doesNotMatch(source, /"nail-zinc-40"/);
});

test("Nails renderer and SKU source truth agree on one quantity column", async () => {
  const source = await read("public/sku-source-truth.js");
  const lower = await read("public/lower-products-refinement.js");

  assert.match(source, /nails\.columns = \["30 mm"\]/);
  assert.match(lower, /appendSingleSizeHeader\(tbody, "Nails", nails\?\.columns\?\.\[0\] \|\| "30 mm"\)/);
  assert.match(lower, /appendSingleSizeRow\(tbody, floor, row\.label \|\| "", row\.cells\?\.\[0\] \|\| null\)/);
});

test("final source-truth renderer cannot reintroduce the retired 40 mm Nails column", async () => {
  const source = await read("public/source-truth-payload.js");

  assert.doesNotMatch(source, /createMatrixHeader\("Nails", \["30 mm", "40 mm"\]\)/);
  assert.match(source, /createSingleSizeHeader\("Nails", "30 mm"\)/);
  assert.match(source, /labelCell\.colSpan = 2/);
  assert.match(source, /while \(row\.children\.length > 2\) row\.lastElementChild\?\.remove\(\)/);
});

test("final renderer ignores delivery areas that are not mounted", async () => {
  const source = await read("public/source-truth-payload.js");

  assert.match(source, /const root = document\.getElementById\(`\$\{floor\}OrderSheet`\);/);
  assert.match(source, /if \(!root\) return undefined;/);
  assert.ok(
    source.indexOf("if (!root) return undefined;") < source.indexOf("previousRenderer.call(this, floor, ...args)"),
    "mount guard must run before the renderer chain",
  );
});

test("deployed page requests the current SKU source-truth asset", async () => {
  const index = await read("public/index.html");

  assert.match(index, /sku-source-truth\.js\?v=20260807-3/);
  assert.equal((index.match(/src="\/sku-source-truth\.js/g) || []).length, 1);
});
