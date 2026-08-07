import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../public/compound-range-update-20260807.js", import.meta.url),
  "utf8",
);

test("compound range update preserves accessory rows in the shared compounds source", () => {
  assert.match(source, /ACCESSORY_PATTERN/);
  assert.match(source, /Stud Adhesive\|Paper Tape\|Fibreglass Tape/);
  assert.match(source, /const accessoryRows = \(section\.rows \|\| \[\]\)\.filter/);
  assert.match(source, /\.\.\.accessoryRows/);
});

test("layout source is corrected before the lower catalogue renderer reads it", () => {
  const updateIndex = source.indexOf("updateLayoutSource();\n    const result = previousRenderer");
  assert.ok(updateIndex >= 0, "layout source must be updated before previousRenderer runs");
});

test("approved compound range remains unchanged", () => {
  for (const value of ["BC5020", "BC7520", "CAN5020", "CAN9020"]) {
    assert.match(source, new RegExp(value));
  }
  for (const retired of ["BC4520", "BC6020", "BC9020", "CAN4520", "CAN6020"]) {
    assert.match(source, new RegExp(retired));
  }
});
