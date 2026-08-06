import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const gate = await readFile(new URL("../public/review-validation-gate.js", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("field warnings remain hidden until the customer attempts review", () => {
  assert.match(gate, /order-validation-attempted/);
  assert.match(gate, /continueToReviewButton/);
  assert.match(gate, /data-step-target='review'/);
  assert.match(gate, /not\(\.\$\{attemptedClass\}\) \.is-order-field-invalid/);
  assert.match(gate, /not\(\.\$\{attemptedClass\}\) \.order-field-validation-message/);
  assert.match(gate, /markReviewAttempted/);
  assert.match(gate, /resetValidationGate/);
});

test("reference is presented as optional and does not block shared validation", () => {
  assert.match(index, /id="reference"[^>]*placeholder="Reference \(optional\)"/);
  assert.doesNotMatch(index, /id="reference"[^>]*\srequired(?:\s|>)/);
  assert.match(index, /review-validation-gate\.js\?v=\d{8}-\d+/);
  assert.match(gate, /reference\.required = false/);
  assert.match(gate, /field\?\.id === "reference"/);
  assert.match(gate, /return true/);
});

test("blank customer references receive a unique internal web reference only at submission", () => {
  assert.match(gate, /form\?\.addEventListener\("submit"/);
  assert.match(gate, /crypto\.randomUUID\(\)/);
  assert.match(gate, /return `WEB-\$\{stamp\}`/);
  assert.match(gate, /queueMicrotask/);
});
