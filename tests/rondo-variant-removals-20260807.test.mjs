import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("approved Rondo columns and SKUs are removed", async () => {
  const source = await read("public/rondo-variant-removals-20260807.js");

  for (const sku of [
    "11202400", "11202700", "40302400", "40302700", "40303300",
    "25102400", "25102700", "40102400", "40102700", "40103300",
    "11103600", "25003600", "12902700",
    "49102400", "49102700", "49302400", "49302700",
    "49502400", "49502700", "51107200",
    "66102700", "67102400", "67102700", "68102700",
    "68107200", "69107200",
    "504036000300", "504036000400", "505036000300",
    "506036000300", "506036000400", "507036000300",
  ]) {
    assert.match(source, new RegExp(`"${sku}"`));
  }

  assert.match(source, /"RONDO WALL FRAMING"/);
  assert.match(source, /\["2400", "2700", "3300"\]/);
  assert.match(source, /"RONDO FURRING CHANNELS"/);
  assert.match(source, /\["2700"\]/);
  assert.match(source, /"RONDO MEDIUM GAUGE STUDS — 0\.75 BMT"/);
  assert.match(source, /\["2400", "2700", "2820", "3900"\]/);
  assert.match(source, /\["7200"\]/);
  assert.match(source, /"RONDO TRACKS & DH TRACK"/);
  assert.match(source, /\["6000"\]/);
  assert.match(source, /"RONDO NOGGIN TRACK 0\.70 BMT \/ 3\.6M"/);
  assert.match(source, /\["300 cts", "400 cts"\]/);
  assert.match(source, /"RONDO HEAVY-DUTY WALL FRAMING"/);
  assert.match(source, /\["2400", "2700"\]/);
});

test("embedded standard and heavy-duty track columns are removed from their own row groups", async () => {
  const source = await read("public/rondo-variant-removals-20260807.js");

  assert.match(source, /function removeEmbeddedSubgroupColumn\(section, subgroupTitle, heading\)/);
  assert.match(source, /TRACKS & DH TRACKS — STANDARD", "3600"/);
  assert.match(source, /TRACKS & DH TRACKS HEAVY DUTY", "6000"/);
  assert.match(source, /header\.children\[columnIndex\]\?\.remove\(\)/);
  assert.match(source, /row\.children\[columnIndex\]\?\.remove\(\)/);
  assert.match(source, /expandLeadingCell\(header\)/);
  assert.match(source, /expandLeadingCell\(row\)/);
  assert.doesNotMatch(source, /findTableByRowLabel/);
});

test("wall framing 4800 and 6000 lengths join the primary stud matrix", async () => {
  const source = await read("public/rondo-variant-removals-20260807.js");

  assert.match(source, /function consolidateWallFramingStudTables\(section\)/);
  assert.match(source, /\["4800", "6000"\]\.includes\(column\)/);
  assert.match(source, /primaryHeader\.append\(cell\)/);
  assert.match(source, /longRowsByLabel/);
  assert.match(source, /row\.append\(cell\)/);
  assert.match(source, /longLengths\.remove\(\)/);
});

test("consolidated wall framing length columns have equal widths", async () => {
  const source = await read("public/rondo-variant-removals-20260807.js");

  assert.match(source, /function equaliseWallFramingColumnWidths\(table\)/);
  assert.match(source, /productColumn\.style\.width = "36%"/);
  assert.match(source, /const lengthWidth = 64 \/ \(columnCount - 1\)/);
  assert.match(source, /column\.style\.width = `\$\{lengthWidth\}%`/);
  assert.match(source, /equaliseWallFramingColumnWidths\(primary\)/);
});

test("wall framing rows without long lengths receive unavailable cells", async () => {
  const source = await read("public/rondo-variant-removals-20260807.js");

  assert.match(source, /unavailableCellTemplate/);
  assert.match(source, /longColumns\.forEach/);
  assert.match(source, /row\.append\(unavailableTemplate\.cloneNode\(false\)\)/);
});

test("nails render as a true single-size row with no 40 mm column", async () => {
  const source = await read("public/rondo-variant-removals-20260807.js");

  assert.match(source, /function collapseNailsToSingleSize\(\)/);
  assert.match(source, /textContent \|\| ""\)\.trim\(\) === "30 mm"/);
  assert.match(source, /textContent \|\| ""\)\.trim\(\) === "40 mm"/);
  assert.match(source, /if \(forty\) forty\.remove\(\)/);
  assert.match(source, /if \(thirty\) thirty\.colSpan = 2/);
  assert.match(source, /quantity\.colSpan = 2/);
  assert.match(source, /collapseNailsToSingleSize\(\)/);
});

test("DONN grid is kept directly under DUO grid before expanded Rondo sections", async () => {
  const source = await read("public/rondo-variant-removals-20260807.js");

  assert.match(source, /function placeDonnGridImmediatelyAfterDuo\(\)/);
  assert.match(source, /section\.querySelector\("\.duo-grid-table"\)/);
  assert.match(source, /section\.querySelector\("\.donn-grid-table"\)/);
  assert.match(source, /duo\.insertAdjacentElement\("afterend", donn\)/);
  assert.match(source, /placeDonnGridImmediatelyAfterDuo\(\)/);
});

test("removed Rondo variants are purged and controller is installed before floor rendering", async () => {
  const [source, index, loader] = await Promise.all([
    read("public/rondo-variant-removals-20260807.js"),
    read("public/index.html"),
    read("public/draft-restore-fix.js"),
  ]);

  assert.match(source, /delete catalog\[key\]/);
  assert.match(source, /window\.renderUnifiedFloorSheet = renderer/);
  assert.match(source, /removeTableColumns/);
  const variantIndex = index.indexOf("/rondo-variant-removals-20260807.js?v=20260807-5");
  const deliveryIndex = index.indexOf("/delivery-areas.js?v=20260724-1");
  assert.ok(variantIndex >= 0, "Rondo variant controller is missing");
  assert.ok(deliveryIndex > variantIndex, "Rondo variant controller must be installed before floor rendering");
  assert.doesNotMatch(loader, /rondo-variant-removals-20260807\.js/);
});
