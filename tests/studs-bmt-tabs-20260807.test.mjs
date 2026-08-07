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

test("stud tabs preserve original quantity cells and unavailable cells", async () => {
  const source = await read("public/studs-bmt-tabs-20260807.js");

  assert.match(source, /cloneNode\(true\)/);
  assert.match(source, /cellMap\.get\(length\)/);
  assert.match(source, /row\.append\(cloneCell/);
  assert.doesNotMatch(source, /createQuantityCell\(/);
  assert.doesNotMatch(source, /delete state\.catalog/);
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

test("stud tabs observe the catalogue lifecycle because Rondo extensions render later", async () => {
  const source = await read("public/studs-bmt-tabs-20260807.js");

  assert.match(source, /function observeCatalogueLifecycle\(\)/);
  assert.match(source, /new MutationObserver/);
  assert.match(source, /\.floor-panels/);
  assert.match(source, /queueMicrotask/);
  assert.match(source, /node\.matches\?\.\("\.rondo-expanded-group, \.lower-catalogue-section"\)/);
  assert.match(source, /return true/);
});

test("index loads the stud tab assets and disables caching", async () => {
  const [index, headers] = await Promise.all([
    read("public/index.html"),
    read("public/_headers"),
  ]);

  assert.match(index, /studs-bmt-tabs-20260807\.css\?v=20260807-1/);
  assert.match(index, /studs-bmt-tabs-20260807\.js\?v=20260807-1/);
  assert.match(headers, /Cache-Control: no-store/);
});
