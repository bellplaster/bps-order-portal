import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../public/remove-rondo-finishing-beads-20260807.js", import.meta.url), "utf8");
const loader = await readFile(new URL("../public/draft-restore-fix.js", import.meta.url), "utf8");

test("the Rondo finishing beads group is removed from every rendered delivery area", () => {
  assert.match(source, /RONDO FINISHING BEADS & ANGLES/);
  assert.match(source, /\.rondo-expanded-catalogue/);
  assert.match(source, /if \(title === REMOVED_TITLE\) section\.remove\(\)/);
  assert.match(source, /previousRenderer\.call\(this, floor, \.\.\.args\)/);
  assert.match(source, /removeRenderedSection\(floor\)/);
});

test("removed finishing bead SKUs cannot remain in review or payload data", () => {
  ["P0102550", "P0703000", "P1203000", "P2803000", "EP173000"].forEach((sku) => {
    assert.match(source, new RegExp(`"${sku}"`));
  });
  assert.match(source, /if \(REMOVED_SKUS\.has\(sku\)\) delete state\.catalog\[key\]/);
});

test("the removal controller loads once", () => {
  assert.match(loader, /\["remove-rondo-finishing-beads", "\/remove-rondo-finishing-beads-20260807\.js\?v=20260807-1"\]/);
  assert.equal((loader.match(/remove-rondo-finishing-beads-20260807\.js/g) || []).length, 1);
});
