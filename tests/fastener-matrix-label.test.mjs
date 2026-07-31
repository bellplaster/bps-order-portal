import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/source-truth-payload.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/lower-products-refinement.css", import.meta.url), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must remain defined in source-truth-payload.js`);
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
const fastenerMatrixLabel = context.label;

test("fastener matrix rows remove loose and collated group prefixes", () => {
  assert.equal(fastenerMatrixLabel("Loose - Needle Point (S)"), "Needle Point (S)");
  assert.equal(fastenerMatrixLabel("Loose Screws - Coarse (W)"), "Coarse (W)");
  assert.equal(fastenerMatrixLabel("Collated - Needle Point (S)"), "Needle Point (S)");
  assert.equal(fastenerMatrixLabel("Collated ScrewsCoarse (W)"), "Coarse (W)");
});

test("already-normalised fastener labels remain unchanged", () => {
  assert.equal(fastenerMatrixLabel("Needle Point (S)"), "Needle Point (S)");
  assert.equal(fastenerMatrixLabel("Coarse (W)"), "Coarse (W)");
});

test("desktop fastener rows do not inject legacy headings through pseudo-elements", () => {
  assert.doesNotMatch(css, /\.fasteners-table tbody>tr:nth-child\([^)]*\) th::before/);
  assert.doesNotMatch(css, /\.fasteners-table tbody>tr:nth-child\([^)]*\) th::after/);
  assert.doesNotMatch(css, /content:\s*"Loose Screws"/);
  assert.doesNotMatch(css, /content:\s*"Collated Screws"/);
  assert.doesNotMatch(css, /content:\s*"25 mm 32 mm"/);
});
