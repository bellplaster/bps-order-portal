import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../public/sku-source-truth.js", import.meta.url), "utf8");

test("permanently unavailable Sheetrock One 13 mm 1200 x 4200 is not orderable", () => {
  assert.doesNotMatch(source, /13HD1242/);
  assert.doesNotMatch(source, /SHEETROCK ONE\|13 mm\|1200\|4200/);
});
