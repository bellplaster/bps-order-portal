import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const assistance = await readFile(new URL("../public/order-entry-assistance.js", import.meta.url), "utf8");
const dateInput = await readFile(new URL("../public/required-date-input.js", import.meta.url), "utf8");
const dateStyles = await readFile(new URL("../public/required-date-input.css", import.meta.url), "utf8");

test("reference is visibly optional in source and boot-time configuration", () => {
  assert.match(index, /id="reference"[^>]*placeholder="Reference \(optional\)"/);
  assert.doesNotMatch(index, /id="reference"[^>]*\srequired(?:\s|>)/);
  assert.match(assistance, /reference\.placeholder = "Reference \(optional\)"/);
});

test("keyboard capitalisation assists new words but stops after manual deletion", () => {
  assert.match(assistance, /event\.key === "Backspace" \|\| event\.key === "Delete"/);
  assert.match(assistance, /disableAssistance\(field\)/);
  assert.match(assistance, /field\.setRangeText\(upper/);
  assert.match(assistance, /disabled\.has\(field\)/);
  assert.match(assistance, /disabled\.clear\(\)/);
});

test("required date uses Australian keyboard entry and stores ISO for existing order logic", () => {
  assert.match(index, /id="requiredDate"[^>]*type="text"[^>]*placeholder="dd-mm-yyyy"/);
  assert.match(index, /required-date-input\.js\?v=20260806-1/);
  assert.match(dateInput, /Number\(firstMonthDigit\) > 1/);
  assert.match(dateInput, /month = `0\$\{firstMonthDigit\}`/);
  assert.match(dateInput, /input\.dataset\.iso/);
  assert.match(dateInput, /if \(id === "requiredDate"\) return input\.dataset\.iso/);
  assert.match(dateInput, /Object\.defineProperty\(input, "value"/);
});

test("typed date text is dark while the placeholder stays grey", () => {
  assert.match(dateStyles, /#requiredDate \{[\s\S]*color: #17211f/);
  assert.match(dateStyles, /#requiredDate::placeholder \{[\s\S]*color: #9aa3a0/);
});
