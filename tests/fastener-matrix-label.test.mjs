import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../public/source-truth-payload.js", import.meta.url), "utf8");
const functionMatch = source.match(/function fastenerRowLabel\(value\) \{([\s\S]*?)\n  \}/);
assert.ok(functionMatch, "fastenerRowLabel must remain defined in source-truth-payload.js");
const fastenerRowLabel = new Function("value", functionMatch[1]);

test("fastener matrix rows remove loose and collated group prefixes", () => {
  assert.equal(fastenerRowLabel("Loose - Needle Point (S)"), "Needle Point (S)");
  assert.equal(fastenerRowLabel("Loose Screws - Coarse (W)"), "Coarse (W)");
  assert.equal(fastenerRowLabel("Collated - Needle Point (S)"), "Needle Point (S)");
  assert.equal(fastenerRowLabel("Collated ScrewsCoarse (W)"), "Coarse (W)");
});

test("already-normalised fastener labels remain unchanged", () => {
  assert.equal(fastenerRowLabel("Needle Point (S)"), "Needle Point (S)");
  assert.equal(fastenerRowLabel("Coarse (W)"), "Coarse (W)");
});
