import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("submission export creates only the site-area workbook", async () => {
  const source = await read("functions/_shared/combined-accrivia-export.js");

  assert.match(source, /createAccriviaSiteAreaXlsx/);
  assert.doesNotMatch(source, /createAccriviaXlsx/);
  assert.doesNotMatch(source, /legacyWorkbook|legacyRows|combined-old|-OLD\.xlsx/);
  assert.match(source, /result\.generatedFiles = \[generatedFile\]/);
  assert.match(source, /floor:\s*"combined-new"/);
});

test("viewer and email policy never exposes old or versioned workbook names", async () => {
  const source = await read("functions/_shared/order-email-attachments.js");

  assert.match(source, /format === "combined-old"/);
  assert.match(source, /return false/);
  assert.doesNotMatch(source, /-V1\.xlsx|-V2\.xlsx|Accrivia format · V1|Site area format · V2/);
  assert.match(source, /floorLabel:\s*"Accrivia order file"/);
});
