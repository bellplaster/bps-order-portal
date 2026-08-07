import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../public/rondo-hebel-catalogue.js", import.meta.url), "utf8");

test("selected Nasahi accessory labels omit pack quantities", () => {
  assert.match(source, /\["75mm Nasahi Panels Flooring SQ", "1800 x 600 mm", "1P751800SQ"\]/);
  assert.match(source, /\["Party Wall Angle Bracket", "", "APW01"\]/);
  assert.match(source, /\["C Batten 16mm", "2\.85 m", "BC162850"\]/);
  assert.match(source, /\["C Batten 24mm", "2\.85 m", "BC242850"\]/);

  assert.doesNotMatch(source, /75mm Nasahi Panels Flooring SQ \(10 Pack\)/);
  assert.doesNotMatch(source, /Party Wall Angle Bracket \(500 Pack\)/);
  assert.doesNotMatch(source, /C Batten 16mm \(20 Pack\)/);
  assert.doesNotMatch(source, /C Batten 24mm \(12 Pack\)/);
});

test("unselected Nasahi accessory pack labels remain unchanged", () => {
  assert.match(source, /Concrete Screw M8 x 100mm \(50 Pack\)/);
});
