import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const orderDetailFields = await readFile(new URL("../public/order-detail-fields.js", import.meta.url), "utf8");
const validationStyles = await readFile(new URL("../public/account-field-validation.css", import.meta.url), "utf8");
const accountPage = await readFile(new URL("../public/account/index.html", import.meta.url), "utf8");

test("Account defaults preserve user-entered casing", () => {
  assert.doesNotMatch(orderDetailFields, /UPPERCASE_IDS/);
  assert.doesNotMatch(orderDetailFields, /textTransform\s*=\s*["']uppercase/);
  assert.doesNotMatch(orderDetailFields, /text-transform:\s*uppercase/);
  assert.doesNotMatch(orderDetailFields, /toLocaleUpperCase/);
  assert.match(orderDetailFields, /window\.BPSOrderFields\?\.formatAddressDisplay/);
  assert.match(orderDetailFields, /text-transform:none/);
});

test("validation messages do not vertically centre adjacent Account fields", () => {
  assert.match(validationStyles, /\.account-experience-v2 \.account-field,[\s\S]*align-content: start;[\s\S]*align-self: start;/);
  assert.match(accountPage, /account-field-validation\.css\?v=20260804-2/);
  assert.match(accountPage, /order-detail-fields\.js\?v=20260804-3/);
});
