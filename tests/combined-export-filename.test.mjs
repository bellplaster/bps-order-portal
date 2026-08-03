import test from "node:test";
import assert from "node:assert/strict";

import { buildCombinedExportFilename } from "../functions/_shared/combined-accrivia-export.js";

test("combined export filename uses uppercase company and customer reference", () => {
  assert.equal(buildCombinedExportFilename("BPS", "1234"), "BPS-1234.xlsx");
  assert.equal(buildCombinedExportFilename("Double Time", "1234"), "DOUBLE-TIME-1234.xlsx");
});

test("combined export filename normalises punctuation to hyphens only", () => {
  const filename = buildCombinedExportFilename("Bell Plaster & Building Supplies", "PO 45/7");
  assert.equal(filename, "BELL-PLASTER-BUILDING-SUPPLIES-PO-45-7.xlsx");
  assert.doesNotMatch(filename, /_/);
  assert.doesNotMatch(filename, /--/);
});

test("combined export filename identifies later revisions without changing the base name", () => {
  assert.equal(buildCombinedExportFilename("BPS", "1234", 2), "BPS-1234-R2.xlsx");
});

test("combined export filename preserves the reference within the length limit", () => {
  const filename = buildCombinedExportFilename(
    "A very long customer company name that would otherwise create an excessively long attachment filename for Outlook",
    "REFERENCE-987654321",
  );

  assert.ok(filename.length <= 100);
  assert.match(filename, /-REFERENCE-987654321\.xlsx$/);
});
