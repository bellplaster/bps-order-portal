import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../public/compound-range-update-20260807.js", import.meta.url), "utf8");
const loader = await readFile(new URL("../public/draft-restore-fix.js", import.meta.url), "utf8");

test("approved BaseCote and cornice adhesive products are registered in order", () => {
  const expected = [
    ["BaseCote 50", "20 kg", "BC5020"],
    ["BaseCote 75", "20 kg", "BC7520"],
    ["Cornice Adhesive 50", "20 kg", "CAN5020"],
    ["Cornice Adhesive 90", "20 kg", "CAN9020"],
  ];

  expected.forEach(([label, detail, sku]) => {
    assert.match(source, new RegExp(`\\["${label}", "${detail}", "${sku}"\\]`));
  });

  assert.ok(source.indexOf('"BaseCote 50"') < source.indexOf('"BaseCote 75"'));
  assert.ok(source.indexOf('"Cornice Adhesive 50"') < source.indexOf('"Cornice Adhesive 90"'));
});

test("retired BaseCote and cornice adhesive SKUs are removed from the catalogue", () => {
  ["BC4520", "BC6020", "BC9020", "CAN4520", "CAN6020"].forEach((sku) => {
    assert.match(source, new RegExp(`"${sku}"`));
  });
  assert.match(source, /if \(RETIRED_SKUS\.has\(sku\)\) delete state\.catalog\[key\]/);
  assert.doesNotMatch(source, /\["BaseCote (?:45|60|90)",/);
  assert.doesNotMatch(source, /\["Cornice Adhesive (?:45|60)",/);
});

test("the update uses the existing compounds table and quantity control", () => {
  assert.match(source, /\.compounds-category \.compounds-table tbody/);
  assert.match(source, /createQuantityCell\(floor, keyFor\(sku\)\)/);
  assert.match(source, /\.\.\.COMPOUND_RANGE\.map/);
  assert.match(source, /\.\.\.accessoryRows/);
});

test("the compound range controller is loaded once", () => {
  assert.match(loader, /\["compound-range-update", "\/compound-range-update-20260807\.js\?v=20260807-1"\]/);
  assert.equal((loader.match(/compound-range-update-20260807\.js/g) || []).length, 1);
});
