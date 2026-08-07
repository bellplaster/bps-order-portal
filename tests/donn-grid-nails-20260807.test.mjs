import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../public/rondo-hebel-catalogue.js", import.meta.url), "utf8");

test("Rondo ceiling grids use the requested trade headings", () => {
  assert.match(source, /title: "DUO® Grid"/);
  assert.match(source, /title: "DONN® Grid"/);
  assert.doesNotMatch(source, /title: "DUO Grid"/);
});

test("DONN grid exposes the five requested products and SKUs", () => {
  const expected = [
    ["DX3 Cross Tee 1200mm", "DX301200"],
    ["DX4 Cross Tee 600mm", "DX400600"],
    ["DX1 Main Tee 3600mm", "DX103600"],
    ["WADX Wall Angle 3600mm", "WADX3600"],
    ["DXCL Suspension Clip", "DXCL"],
  ];

  for (const [label, sku] of expected) {
    assert.ok(source.includes(label), `missing DONN label: ${label}`);
    assert.ok(source.includes(sku), `missing DONN SKU: ${sku}`);
  }

  assert.match(source, /registerDefinition\(RONDO\.donn, "rondo-donn"\)/);
  assert.match(source, /renderRondoGridTable\(floor, RONDO\.donn, "rondo-grid-table donn-grid-table", "rondo-donn"\)/);

  const duoRender = source.indexOf('renderRondoGridTable(floor, RONDO.duo');
  const donnRender = source.indexOf('renderRondoGridTable(floor, RONDO.donn');
  assert.ok(duoRender >= 0 && donnRender > duoRender, "DONN grid must render immediately after DUO grid");
});

test("40 mm nail column is retired from the shared catalogue state", () => {
  assert.match(source, /retireNail40mm\(\);/);
  assert.match(source, /\^40\\s\*mm\$/i);
  assert.match(source, /nails\.columns = keepIndexes\.map/);
  assert.match(source, /delete state\.catalog\?\.\[key\]/);
  assert.match(source, /quantities\?\.delete\?\.\(key\)/);
});
