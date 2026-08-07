import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("stud rows are sorted from smallest to largest", async () => {
  const source = await read("public/studs-bmt-row-order-20260807.js");
  assert.match(source, /function studWidth\(row\)/);
  assert.match(source, /rows\.sort\(\(rowA, rowB\) => studWidth\(rowA\) - studWidth\(rowB\)\)/);
  assert.match(source, /studs-bmt-table tbody/);
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

test("row order controller loads with catalogue refinements", async () => {
  const loader = await read("public/draft-restore-fix.js");
  assert.match(loader, /studs-bmt-row-order-20260807\.js\?v=20260807-1/);
});
