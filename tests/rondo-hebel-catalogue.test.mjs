import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const source = await read("public/rondo-hebel-catalogue.js");
const lower = await read("public/lower-products-refinement.js");
const styles = await read("public/lower-products-refinement.css");
const index = await read("public/index.html");
const additions = await read("public/product-additions-20260806.js");
const payload = await read("public/payload-sku-bridge.js");
const exportSource = await read("functions/_shared/combined-accrivia-export.js");

const suppliedSkus = [
  "12103600", "12703600", "12906000", "14003000", "2534", "274", "139", "247",
  "DUO13600TW10", "DUO21200TW00", "DUO53600TW00", "700",
  "99939", "162758", "162756", "162760", "118014", "118015", "118016", "118019", "118020", "126504",
  "21969", "81462", "118283", "118284", "118891", "21965", "21987", "21933", "21935", "21949", "111161", "25594",
  "21909", "105536", "168890", "141233", "24092", "126323",
  "1P502200", "1P502400", "1P502550", "1P502700", "1P502850", "1P503000",
  "1P752200LD", "1P752400LD", "1P752550LD", "1P752700LD", "1P752850LD", "1P753000LD", "1P753300LD",
  "1P751800SQ", "AACBS", "ACP250", "ADH20", "APW01", "BC162850", "BC242850", "BC353000", "BH503000", "FRIC600",
  "SCON100", "SSHX20", "SSHX90", "STBB100", "STHX150", "STHX25", "STHX35", "STHX45",
  "BPS/2200-50MM", "BPS/99939", "BPS/162758", "BPS/162756", "BPS/162760",
  "BPS/118014", "BPS/118016", "BPS/118019", "BPS/118020", "BPS/126504", "BPS/UNITEXAD", "BPS/21909", "BPS/105536",
];

test("every supplied Rondo and AAC SKU is registered", () => {
  suppliedSkus.forEach((sku) => assert.match(source, new RegExp(sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
});

test("manager catalogue order uses three equal desktop columns", () => {
  assert.match(lower, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(lower, /columnOne\.append\(compounds, accessories, fasteners, cornices, insulation\)/);
  assert.match(lower, /columnTwo\.append\(rondo\)/);
  assert.match(lower, /columnThree\.append\(partiwall\)/);
});

test("lower-products stylesheet is the sole catalogue column-layout owner", () => {
  assert.match(styles, /\.lower-catalogue-layout\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(index, /catalogue-column-width-guard/);
});

test("catalogue renderers load once in deterministic document order", () => {
  assert.equal((index.match(/src="\/lower-products-refinement\.js/g) || []).length, 1);
  assert.equal((index.match(/src="\/rondo-hebel-catalogue\.js/g) || []).length, 1);
  assert.equal((index.match(/src="\/product-additions-20260806\.js/g) || []).length, 1);
  assert.ok(index.indexOf("/lower-products-refinement.js") < index.indexOf("/rondo-hebel-catalogue.js"));
  assert.ok(index.indexOf("/rondo-hebel-catalogue.js") < index.indexOf("/product-additions-20260806.js"));
});

test("the deployed page requests the current catalogue assets", () => {
  assert.match(index, /rondo-hebel-catalogue\.js\?v=/);
  assert.match(index, /lower-products-refinement\.css\?v=/);
});

test("Additional Products is a separate full-width region below the catalogue", () => {
  assert.match(lower, /sheet\.append\(layout, additional\)/);
  assert.match(lower, /additional\.className = "additional-products-section"/);
  assert.doesNotMatch(lower, /columnThree\.append\([^)]*additional/);
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
  assert.match(source, /DUO® Grid/);
  assert.doesNotMatch(source, /makeCategory\(["'](?:Suspended Ceiling Grid|DUO®? Grid)/);
});

test("Rondo accessories connect directly to their grid tables", () => {
  assert.doesNotMatch(source, /Clips & Brackets/);
  assert.doesNotMatch(source, /appendAccessoryHeading/);
  assert.match(source, /appendMatrixRows\(tbody, floor, definition, scope\);\s*appendAccessoryRows\(tbody, floor, definition\.accessories, totalColumns, scope\);/);
});

test("Rondo accessories are visually separated without another heading", () => {
  assert.match(styles, /tr:not\(\.rondo-accessory-row\)\+tr\.rondo-accessory-row/);
  assert.match(styles, /border-top:4px solid #c3c9c7!important/);
});

test("AAC tabs are inserted into the same third column directly above Partiwalls", () => {
  assert.match(source, /const partiwall = document\.querySelector\(`#\$\{CSS\.escape\(floor\)\}OrderSheet \.partiwall-category`\)/);
  assert.match(source, /const column = partiwall\?\.parentElement/);
  assert.match(source, /column\.insertBefore\(section, partiwall\)/);
});

test("AAC tabs use the same maroon catalogue heading treatment", () => {
  assert.match(styles, /\.aac-brand-tabs/);
  assert.match(styles, /background:#ac2947/);
  assert.match(styles, /\.aac-brand-tab\.is-active/);
});

test("new tables use the existing lower catalogue and quantity controls", () => {
  assert.match(source, /table\.className = `lower-catalogue-table \$\{className\}`/);
  assert.match(source, /return createQuantityCell\(floor, entry \? keyFor/);
  assert.match(source, /createQuantityCell\(floor, keyFor\(sku, accessoryLineIdentity/);
});

test("duplicate SKU product lines retain independent form keys", () => {
  assert.match(source, /function keyFor\(sku, lineIdentity = ""\)/);
  assert.match(source, /const suffix = slug\(lineIdentity\)/);
  assert.match(source, /return suffix \? `\$\{base\}--\$\{suffix\}` : base/);
  assert.match(source, /matrixLineIdentity\(scope, rowIndex, cellIndex\)/);
  assert.match(source, /accessoryLineIdentity\(scope, index\)/);
});

test("line identity survives payload reconciliation and Accrivia export", () => {
  assert.match(payload, /lineIdentity/);
  assert.match(exportSource, /lineIdentity/);
});

test("catalogue styles retain Rondo, Hebel and AAC rules", () => {
  assert.match(styles, /rondo-grid-table/);
  assert.match(styles, /hebel-panel-table/);
  assert.match(styles, /aac-brand-tabs/);
});

test("lower catalogue nails render only the supported 30 mm size", () => {
  assert.match(lower, /appendSingleSizeHeader\(tbody, "Nails", nails\?\.columns\?\.\[0\] \|\| "30 mm"\)/);
  assert.match(lower, /appendSingleSizeRow\(tbody, floor, row\.label \|\| "", row\.cells\?\.\[0\] \|\| null\)/);
  assert.match(lower, /titleCell\.colSpan = 2/);
  assert.match(lower, /th\.colSpan = 2/);
  assert.doesNotMatch(lower, /nails\?\.columns \|\| \["30 mm", "40 mm"\]/);
});