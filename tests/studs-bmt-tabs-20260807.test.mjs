import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("stud sections consolidate into four BMT tabs", async () => {
  const source = await read("public/studs-bmt-tabs-20260807.js");
  for (const label of ["0.50 BMT", "0.55 BMT", "0.75 BMT", "1.15 BMT"]) {
    assert.match(source, new RegExp(label.replace(".", "\\.")));
  }
  assert.match(source, /heading\.textContent = "STUDS"/);
  assert.match(source, /RONDO WALL FRAMING/);
  assert.match(source, /RONDO MEDIUM GAUGE STUDS — 0\.75 BMT/);
  assert.match(source, /RONDO HEAVY-DUTY WALL FRAMING/);
  assert.match(source, /LENGTHS = \["3000", "3600", "4200", "4800", "6000"\]/);
});

test("stud availability comes from the approved SKU matrix", async () => {
  const source = await read("public/studs-bmt-tabs-20260807.js");
  for (const sku of [
    "11204800", "11206000", "40304800", "25104800", "25106000",
    "48903000", "49106000", "51106000", "66104800", "67106000", "68106000", "69106000",
  ]) assert.match(source, new RegExp(sku));
  assert.match(source, /const STUD_VARIANTS = Object\.freeze/);
  assert.match(source, /findCatalogKey\(sku\)/);
  assert.match(source, /createQuantityCell\(floor, key\)/);
  assert.match(source, /if \(!sku\) return createQuantityCell\(floor, null\)/);
});

test("missing active SKU mappings fail before old stud sections are removed", async () => {
  const source = await read("public/studs-bmt-tabs-20260807.js");
  assert.match(source, /throw new Error\(`STUDS: catalogue key missing for SKU \$\{sku\}`\)/);
  assert.ok(
    source.indexOf("const newSection = buildSection(floor)") < source.indexOf("root.querySelectorAll(\".studs-bmt-section\")"),
    "the replacement must build successfully before existing sections are removed",
  );
});

test("stud tab interaction matches the AAC selector pattern", async () => {
  const [script, styles, aacStyles] = await Promise.all([
    read("public/studs-bmt-tabs-20260807.js"),
    read("public/studs-bmt-tabs-20260807.css"),
    read("public/aac-selector-pill.css"),
  ]);
  assert.match(script, /role", "tablist"/);
  assert.match(script, /aria-selected/);
  assert.match(script, /ArrowLeft/);
  assert.match(script, /ArrowRight/);
  assert.match(script, /Home/);
  assert.match(script, /End/);
  assert.match(styles, /transition:transform \.28s cubic-bezier\(\.22,\.8,\.28,1\)/);
  assert.match(styles, /background:#a62b45/);
  assert.match(styles, /background:#fff/);
  assert.match(aacStyles, /transition:transform \.28s cubic-bezier\(\.22,\.8,\.28,1\)/);
});

test("STUDS title and tab controls use the same fixed header height", async () => {
  const styles = await read("public/studs-bmt-tabs-20260807.css");
  assert.match(styles, /grid-template-rows:34px auto/);
  assert.match(styles, /lower-category-title[^\n]*height:34px/);
  assert.match(styles, /lower-category-title[^\n]*align-items:center/);
  assert.match(styles, /studs-bmt-tabs[^\n]*height:34px/);
});

test("stud consolidation is owned by the floor render lifecycle", async () => {
  const source = await read("public/studs-bmt-tabs-20260807.js");
  assert.match(source, /function apply\(floor\)/);
  assert.match(source, /document\.getElementById\(`\$\{floor\}OrderSheet`\)/);
  assert.match(source, /collectStudSources\(root\)/);
  assert.match(source, /apply\(floor\)/);
  assert.doesNotMatch(source, /MutationObserver/);
  assert.doesNotMatch(source, /queueMicrotask/);
  assert.doesNotMatch(source, /DOMContentLoaded/);
});

test("index loads the stud tab assets before delivery-area rendering", async () => {
  const [index, headers] = await Promise.all([read("public/index.html"), read("public/_headers")]);
  const studsIndex = index.indexOf("/studs-bmt-tabs-20260807.js?v=20260807-2");
  const deliveryIndex = index.indexOf("/delivery-areas.js?v=20260724-1");
  assert.ok(studsIndex >= 0, "stud tab controller is missing");
  assert.ok(deliveryIndex > studsIndex, "stud tab controller must be installed before floor rendering");
  assert.match(headers, /Cache-Control: no-store/);
});
