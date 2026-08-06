import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const gate = await readFile(new URL("../public/review-validation-gate.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/order-field-behaviour.css", import.meta.url), "utf8");
const fields = await readFile(new URL("../public/order-field-behaviour.js", import.meta.url), "utf8");
const order = await readFile(new URL("../public/app-order.js", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("review gate owns only attempted and reset state", () => {
  assert.match(gate, /order-validation-attempted/);
  assert.match(gate, /continueToReviewButton/);
  assert.match(gate, /data-step-target='review'/);
  assert.match(gate, /markReviewAttempted/);
  assert.match(gate, /resetValidationGate/);
  assert.doesNotMatch(gate, /document\.createElement\("style"\)/);
  assert.doesNotMatch(gate, /validateField\s*=/);
  assert.doesNotMatch(gate, /addEventListener\("submit"/);
});

test("warning visibility is implemented by the shared field stylesheet", () => {
  assert.match(styles, /not\(\.order-validation-attempted\) \.is-order-field-invalid/);
  assert.match(styles, /not\(\.order-validation-attempted\) \.order-field-validation-message/);
});

test("reference optionality and internal references are implemented in core order flow", () => {
  assert.match(index, /id="reference"[^>]*placeholder="Reference \(optional\)"/);
  assert.doesNotMatch(index, /id="reference"[^>]*\srequired(?:\s|>)/);
  assert.match(fields, /reference: \{ type: "reference"[^\n]*required: false/);
  assert.match(order, /reference: customerReference \|\| generatedReference\(submissionId\)/);
  assert.match(order, /customerReferenceProvided: Boolean\(customerReference\)/);
});
