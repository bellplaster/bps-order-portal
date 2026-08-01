import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../public/rondo-hebel-catalogue.js", import.meta.url), "utf8");
const loader = await readFile(new URL("../public/draft-restore-fix.js", import.meta.url), "utf8");
const payload = await readFile(new URL("../public/order-product-payload.js", import.meta.url), "utf8");
const exporter = await readFile(new URL("../functions/_shared/combined-accrivia-export.js", import.meta.url), "utf8");
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

test("Rondo accessories connect directly to their grid tables", () => {
  assert.doesNotMatch(source, /Clips & Brackets/);
  assert.doesNotMatch(source, /appendAccessoryHeading/);
  assert.match(source, /appendMatrixRows\(tbody, floor, definition, scope\);\s*appendAccessoryRows\(tbody, floor, definition\.accessories, totalColumns, scope\);/);
});

test("Rondo accessories are visually separated without another heading", () => {
  assert.match(styles, /tr:not\(\.rondo-accessory-row\)\+tr\.rondo-accessory-row/);
  assert.match(styles, /border-top:4px solid #c3c9c7!important/);
  assert.doesNotMatch(source, /Clips & Brackets/);
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

test("duplicate SKU product lines retain independent form keys", () => {
  assert.match(source, /function keyFor\(sku, lineIdentity = ""\)/);
  assert.match(source, /rondo-suspended-accessory-/);
  assert.match(source, /rondo-duo-accessory-/);
  assert.match(source, /lineIdentity,/);
  assert.equal((source.match(/\["Flat Rod Bracket", "274"\]/g) || []).length, 2);
});

test("line identity survives payload reconciliation and Accrivia export", () => {
  assert.match(payload, /lineIdentity: String\(item\?\.lineIdentity \|\| product\?\.lineIdentity \|\| currentKey\)/);
  assert.match(exporter, /item\?\.lineIdentity \|\| item\?\.key/);
  assert.match(exporter, /lineIdentity: `standard:\$\{lineIdentity\}`/);
  assert.match(exporter, /const key = String\(item\.lineIdentity \|\| item\.sku\)/);
});

test("catalogue controller is loaded and syntax-checked", () => {
  assert.match(loader, /rondo-hebel-catalogue\.js\?v=20260801-3/);
  assert.match(loader, /order-product-payload\.js\?v=20260801-1/);
  assert.match(styles, /\.rondo-grid-table/);
  assert.match(styles, /\.hebel-panel-table/);
});
