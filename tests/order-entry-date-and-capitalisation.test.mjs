import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const fields = await readFile(new URL("../public/order-field-behaviour.js", import.meta.url), "utf8");
const dateController = await readFile(new URL("../public/order-details-date-state.js", import.meta.url), "utf8");
const fieldStyles = await readFile(new URL("../public/order-field-behaviour.css", import.meta.url), "utf8");
const order = await readFile(new URL("../public/app-order.js", import.meta.url), "utf8");

test("reference optionality is owned by source, shared validation and core payload building", () => {
  assert.match(index, /id="reference"[^>]*placeholder="Reference \(optional\)"/);
  assert.doesNotMatch(index, /id="reference"[^>]*\srequired(?:\s|>)/);
  assert.match(fields, /reference: \{ type: "reference"[^\n]*required: false/);
  assert.match(order, /customerReferenceProvided: Boolean\(customerReference\)/);
  assert.match(order, /reference: customerReference \|\| generatedReference\(submissionId\)/);
});

test("one shared controller owns capitalisation and respects manual editing", () => {
  assert.match(fields, /function shouldCapitalise/);
  assert.match(fields, /event\.preventDefault\(\)/);
  assert.match(fields, /field\.setRangeText\(upper/);
  assert.match(fields, /inputType\.startsWith\("delete"\)[\s\S]*assistanceEnabled = false/);
  assert.doesNotMatch(index, /order-entry-assistance\.js/);
});

test("required date has a visible Australian field and a hidden ISO source of truth", () => {
  assert.match(index, /id="requiredDateDisplay"[^>]*placeholder="dd-mm-yyyy"/);
  assert.match(index, /id="requiredDate" type="hidden"/);
  assert.match(dateController, /function parseSmartDateDigits/);
  assert.match(dateController, /Number\(first\) > 1/);
  assert.match(dateController, /month = `0\$\{first\}`/);
  assert.match(dateController, /hidden\.value = iso/);
  assert.match(dateController, /fullYear = 2000 \+ Number\(parts\.year\)/);
  assert.match(order, /value\("requiredDate"\)/);
  assert.doesNotMatch(fields, /function parseSmartDateDigits/);
  assert.doesNotMatch(index, /required-date-input\.(?:js|css)/);
});

test("typed date text and review-gated validation are defined in the shared stylesheet", () => {
  assert.match(fieldStyles, /#requiredDateDisplay \{[\s\S]*color: #17211f/);
  assert.match(fieldStyles, /#requiredDateDisplay::placeholder \{[\s\S]*color: #9aa3a0/);
  assert.match(fieldStyles, /not\(\.order-validation-attempted\) \.order-field-validation-message/);
});
