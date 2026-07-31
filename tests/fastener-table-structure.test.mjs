import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/source-truth-payload.js", import.meta.url), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  let opened = false;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") { depth += 1; opened = true; }
    if (source[index] === "}") {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unable to extract ${name}`);
}

const context = vm.createContext({});
vm.runInContext(`${extractFunction("fastenerMatrixLabel")}; globalThis.label = fastenerMatrixLabel;`, context);

const label = context.label;

test("fastener item rows contain only the item type", () => {
  assert.equal(label("Loose - Needle Point (S)"), "Needle Point (S)");
  assert.equal(label("Loose ScrewsNeedle Point (S)"), "Needle Point (S)");
  assert.equal(label("Collated - Coarse (W)"), "Coarse (W)");
  assert.equal(label("Collated ScrewsCoarse (W)25 mm"), "Coarse (W)");
});

test("fastener headers are rebuilt as independent rows", () => {
  assert.match(source, /function createMatrixHeader\(/);
  assert.match(source, /tbody\.replaceChildren\(\.\.\.output\)/);
  assert.match(source, /createMatrixHeader\("Loose Screws", \["25 mm", "32 mm"\]\)/);
  assert.match(source, /createMatrixHeader\("Collated Screws", \["25 mm", "32 mm"\]\)/);
});

test("legacy group rows are not mutated into headers in place", () => {
  assert.doesNotMatch(source, /function setMatrixHeader\(/);
  assert.doesNotMatch(source, /row\.replaceChildren\(\)/);
});
