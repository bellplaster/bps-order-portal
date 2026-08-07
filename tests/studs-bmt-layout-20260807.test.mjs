import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("stud matrices declare rows from smallest to largest", async () => {
  const source = await read("public/studs-bmt-tabs-20260807.js");
  for (const block of [
    ["51 mm Stud", "64 mm Stud"],
    ["76 mm Stud", "92 mm Stud"],
    ["51 mm Stud", "64 mm Stud", "76 mm Stud", "92 mm Stud", "150 mm Stud"],
    ["64 mm Stud", "76 mm Stud", "92 mm Stud", "150 mm Stud"],
  ]) {
    let previous = -1;
    for (const label of block) {
      const current = source.indexOf(`"${label}"`, previous + 1);
      assert.ok(current > previous, `${label} must follow the previous stud width`);
      previous = current;
    }
  }
});

test("stud title and BMT tabs share one compact aligned header row", async () => {
  const styles = await read("public/studs-bmt-tabs-20260807.css");
  assert.match(styles, /\.studs-bmt-section\{display:grid;grid-template-columns:minmax\(74px,\.72fr\) minmax\(0,3\.28fr\);grid-template-rows:34px auto/);
  assert.match(styles, /\.studs-bmt-section>\.lower-category-title\{grid-column:1;grid-row:1;display:flex;align-items:center;justify-content:flex-start;align-self:stretch/);
  assert.match(styles, /\.studs-bmt-tabs\{grid-column:2;grid-row:1/);
  assert.match(styles, /\.studs-bmt-content\{grid-column:1\/-1;grid-row:2/);
  assert.match(styles, /font:700 11px\/24px/);
  assert.match(styles, /padding:4px 8px/);
});

test("redundant row-order controller is not part of the runtime lifecycle", async () => {
  const [index, loader] = await Promise.all([
    read("public/index.html"),
    read("public/draft-restore-fix.js"),
  ]);
  assert.doesNotMatch(index, /studs-bmt-row-order-20260807\.js/);
  assert.doesNotMatch(loader, /studs-bmt-row-order-20260807\.js/);
});
