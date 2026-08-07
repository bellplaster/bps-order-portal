import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../public/partiwall-wall-track-label.js", import.meta.url), "utf8");
const loader = await readFile(new URL("../public/draft-restore-fix.js", import.meta.url), "utf8");

test("14003000 uses the approved customer-facing trade label", () => {
  assert.match(source, /const SKU = "14003000"/);
  assert.match(source, /const LABEL = "28 mm Wall Track \(C Channel\)"/);
  assert.match(source, /product\.label = LABEL/);
  assert.match(source, /product\.description = LABEL/);
  assert.match(source, /row\.label = LABEL/);
  assert.match(source, /heading\.textContent = LABEL/);
});

test("the label update preserves the existing SKU and quantity control", () => {
  assert.doesNotMatch(source, /SKU\s*=\s*"(?!14003000)/);
  assert.match(source, /previousRenderer\.call\(this, floor, \.\.\.args\)/);
  assert.doesNotMatch(source, /createQuantityCell/);
});

test("the label controller loads once", () => {
  assert.match(loader, /\["partiwall-wall-track-label", "\/partiwall-wall-track-label\.js\?v=20260807-1"\]/);
  assert.equal((loader.match(/partiwall-wall-track-label\.js/g) || []).length, 1);
});
