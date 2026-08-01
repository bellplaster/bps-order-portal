import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../public/rondo-hebel-catalogue.js", import.meta.url), "utf8");
const lower = await readFile(new URL("../public/lower-products-refinement.js", import.meta.url), "utf8");
const loader = await readFile(new URL("../public/draft-restore-fix.js", import.meta.url), "utf8");
const payload = await readFile(new URL("../public/order-product-payload.js", import.meta.url), "utf8");
const exporter = await readFile(new URL("../functions/_shared/combined-accrivia-export.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/lower-products-refinement.css", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

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

test("manager catalogue order uses three equal desktop columns", () => {
  assert.match(lower, /renderListCategory\(floor, "COMPOUNDS"[\s\S]*renderListCategory\(floor, "ACCESSORIES"[\s\S]*renderFastenersCategory[\s\S]*renderCornicesCategory[\s\S]*renderThermalCategory/);
  assert.match(lower, /makeColumn\(\s*renderRondoCategory/);
  assert.match(lower, /makeColumn\(\s*renderPartiwallCategory/);
  assert.match(styles, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(styles, /@media\(max-width:1180px\)/);
});

test("catalogue renderers load once in deterministic document order", () => {
  const lowerIndex = index.indexOf('/lower-products-refinement.js?v=20260801-2');
  const catalogueIndex = index.indexOf('/rondo-hebel-catalogue.js?v=20260801-5');
  const additionalIndex = index.indexOf('/additional-products-refinement.js?v=20260729-2');
  assert.ok(lowerIndex >= 0, "lower catalogue renderer is missing");
  assert.ok(catalogueIndex > lowerIndex, "Rondo/Hebel must wrap the lower renderer");
  assert.ok(additionalIndex > catalogueIndex, "Additional Products must wrap the completed catalogue renderer");
  assert.equal((index.match(/rondo-hebel-catalogue\.js/g) || []).length, 1);
  assert.doesNotMatch(loader, /rondo-hebel-catalogue\.js/);
});

test("the deployed page refreshes both three-column assets", () => {
  assert.match(index, /lower-products-refinement\.css\?v=20260801-3/);
  assert.match(index, /lower-products-refinement\.js\?v=20260801-2/);
  assert.match(index, /rondo-hebel-catalogue\.js\?v=20260801-5/);
  assert.match(index, /draft-restore-fix\.js\?v=20260801-2/);
});

test("Additional Products is a separate full-width region below the catalogue", () => {
  assert.match(styles, /\.lower-catalogue-grid\+\.additional-products-panel/);
  assert.match(styles, /\.additional-products-panel\.additional-products-separated/);
  assert.match(styles, /margin-top:14px!important/);
});

test("acoustics are retired before any catalogue renderer runs", () => {
  assert.match(lower, /retireAcousticProducts\(\);\s*const result = originalRenderer/);
  assert.match(lower, /delete state\.catalog\?\.\[key\]/);
  assert.match(lower, /state\.layout\.sections\.insulation\.acousticRows = \[\]/);
  assert.doesNotMatch(lower, /function renderAcousticCategory/);
  assert.doesNotMatch(lower, /makeCategory\("ACOUSTICS"/);
  assert.doesNotMatch(styles, /acoustics-table/);
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

test("Hebel is inserted into the same third column directly above Partiwalls", () => {
  assert.match(source, /const partiwall = document\.querySelector/);
  assert.match(source, /const column = partiwall\?\.parentElement/);
  assert.match(source, /column\.insertBefore\(section, partiwall\)/);
  assert.match(source, /hebel-panel-table", \[38,/);
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

test("catalogue styles retain Rondo and Hebel rules", () => {
  assert.match(styles, /\.rondo-grid-table/);
  assert.match(styles, /\.hebel-panel-table/);
  assert.match(styles, /\.hebel-category/);
});
