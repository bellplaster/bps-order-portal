import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../public/product-additions-20260806.js", import.meta.url), "utf8");

const expectedTitles = [
  "RONDO WALL FRAMING",
  "RONDO FURRING CHANNELS",
  "RONDO MEDIUM GAUGE STUDS — 0.75 BMT",
  "RONDO TRACKS & DH TRACK",
  "RONDO NOGGIN TRACK 0.70 BMT / 3.6m",
  "RONDO HEAVY-DUTY WALL FRAMING",
  "RONDO FINISHING BEADS & ANGLES",
  "TRIM-TEX TEAR AWAY BEADS",
];

const expectedSkus = [
  "11202400", "11202700", "11203000", "11203600", "11204200", "40302400", "40302700", "40303000",
  "40303300", "40303600", "40304200", "25102400", "25102700", "25103000", "25103600", "25104200",
  "40102400", "40102700", "40103000", "40103300", "40103600", "11204800", "11206000", "40304800",
  "25104800", "25106000", "40003000", "11103000", "11103600", "40203000", "25003000", "25003600",
  "48003000", "48203000", "48303000", "30803000", "30803600", "30804800", "30806000", "12902700",
  "12903000", "12903600", "12904800", "12906000", "49102400", "49102700", "49103000", "49103600",
  "49302400", "49302700", "49303000", "49303600", "49502400", "49502700", "49503000", "49503600",
  "51103000", "51103600", "48903000", "48903600", "49104200", "49104800", "49106000", "49304200",
  "49304800", "49306000", "49504200", "49504800", "49506000", "51104200", "51104800", "51106000",
  "51107200", "49003000", "49203000", "49403000", "49603000", "48803000", "49703000", "49803000",
  "49903000", "51003000", "87203000", "87303000", "503036000450", "503036000600", "504036000300", "504036000400",
  "504036000450", "504036000600", "505036000300", "505036000450", "505036000600", "506036000300", "506036000400", "506036000450",
  "506036000600", "507036000300", "507036000450", "507036000600", "66102700", "66103000", "66103600", "66104200",
  "66104800", "67102400", "67102700", "67103000", "67103600", "67104800", "68102700", "68103000",
  "68103600", "68104200", "68104800", "69103000", "69103600", "69104200", "69104800", "67106000",
  "68106000", "68107200", "69106000", "69107200", "66003000", "67003000", "68003000", "66303000",
  "67303000", "68303000", "69003000", "76603000", "P0102550", "P0303000", "P0702400", "P0702700",
  "P0703000", "P0703600", "P0803000", "P1103000", "P1202400", "P1202700", "P1203000", "P1203600",
  "P1302400", "P1302700", "P1303000", "P1303600", "P1403000", "P2503000", "P2603000", "P2703000",
  "P2803000", "P0903000", "P1003000", "P35W3000", "P5003000", "P5103000", "P5203000", "P6003000",
  "EP173000", "72-9000", "72-9002", "72-9004", "72-9010", "72-9110",
];

function expandedCatalogue() {
  const match = source.match(/const RONDO_EXPANDED = Object\.freeze\((\[[\s\S]*?\])\);/);
  assert.ok(match, "expanded Rondo catalogue definition is missing");
  return JSON.parse(match[1]);
}

test("expanded Rondo catalogue preserves every supplied group and SKU", () => {
  const catalogue = expandedCatalogue();
  assert.deepEqual(catalogue.map((group) => group.title), expectedTitles);
  assert.equal(catalogue.length, 8);
  assert.equal(catalogue.reduce((total, group) => total + group.tables.length, 0), 13);
  assert.equal(catalogue.reduce((total, group) => total + group.tables.reduce((rows, table) => rows + table.rows.length, 0), 0), 77);

  const actualSkus = catalogue.flatMap((group) => group.tables.flatMap((table) =>
    table.rows.flatMap((row) => table.columns.map((column) => row.skus[column]).filter(Boolean)),
  ));
  assert.deepEqual(actualSkus, expectedSkus);
  assert.equal(new Set(actualSkus).size, 166);
});

test("expanded Rondo catalogue renders immediately below the DUO table", () => {
  assert.match(source, /const duoTable = section\.querySelector\("\.duo-grid-table"\)/);
  assert.match(source, /duoTable\.insertAdjacentElement\("afterend", catalogue\)/);
  assert.match(source, /section\.querySelector\("\.rondo-expanded-catalogue"\)/);
});

test("expanded Rondo catalogue reuses the existing table design and quantity controls", () => {
  assert.match(source, /lower-catalogue-section rondo-expanded-group/);
  assert.match(source, /heading\.className = "lower-category-title"/);
  assert.match(source, /lower-catalogue-table rondo-grid-table rondo-expanded-table/);
  assert.match(source, /lower-subheader lower-matrix-header/);
  assert.match(source, /lower-subheader lower-group-heading rondo-expanded-subheading/);
  assert.match(source, /createQuantityCell\(floor, sku \? keyFor\(sku, identity\) : null\)/);
});

test("each expanded matrix cell has an independent payload identity", () => {
  assert.match(source, /function keyFor\(sku, identity = ""\)/);
  assert.match(source, /function expandedIdentity\(groupIndex, tableIndex, rowIndex, columnIndex\)/);
  assert.match(source, /lineIdentity: identity \|\| key/);
  assert.match(source, /registerExpandedRondoProducts\(\)/);
});
