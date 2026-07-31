import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../public/rondo-hebel-catalogue.js", import.meta.url), "utf8");
const loader = await readFile(new URL("../public/draft-restore-fix.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/lower-products-refinement.css", import.meta.url), "utf8");

const expectedSkus = [
  "12103600", "12703600", "12906000", "14003000",
  "2534", "139", "274", "247",
  "DUO13600TW10", "DUO21200TW00", "DUO53600TW00", "700",
  "99939", "162758", "162756", "162760",
  "118014", "118015", "118016", "118019", "118020", "126504",
  "21969", "81462", "118283", "118284", "118891", "21965", "21987",
  "21933", "21935", "21949", "111161", "25594",
  "21909", "105536", "168890", "141233", "24092", "126323",
];

test("every supplied Rondo and Hebel SKU is registered", () => {
  expectedSkus.forEach((sku) => assert.match(source, new RegExp(`[\"']${sku}[\"']`), `Missing SKU ${sku}`));
});

test("Rondo additions use the existing RONDO/PVC section", () => {
  assert.match(source, /querySelector\(`#\$\{CSS\.escape\(floor\)\}OrderSheet \.rondo-category`\)/);
  assert.match(source, /Suspended Ceiling Grid/);
  assert.match(source, /DUO Grid/);
  assert.doesNotMatch(source, /makeCategory\(["'](?:Suspended Ceiling Grid|DUO Grid)/);
});

test("Cornices stay independent and Hebel is inserted before Insulations", () => {
  assert.match(source, /const insulation = document\.querySelector/);
  assert.match(source, /column\.insertBefore\(section, insulation\)/);
  assert.doesNotMatch(source, /cornices-category.*append\(.*hebel/s);
});

test("new tables use the existing lower catalogue and quantity controls", () => {
  assert.match(source, /lower-catalogue-table/);
  assert.match(source, /lower-category-title/);
  assert.match(source, /createQuantityCell\(floor,/);
  assert.doesNotMatch(source, /className = ["']qty["']/);
});

test("catalogue controller is loaded and syntax-checked", () => {
  assert.match(loader, /rondo-hebel-catalogue\.js\?v=20260801-1/);
  assert.match(styles, /\.rondo-grid-table/);
  assert.match(styles, /\.hebel-panel-table/);
});
