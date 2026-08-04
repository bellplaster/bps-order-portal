import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const orderDetailFields = await readFile(new URL("../public/order-detail-fields.js", import.meta.url), "utf8");
const validationStyles = await readFile(new URL("../public/account-field-validation.css", import.meta.url), "utf8");
const accountPage = await readFile(new URL("../public/account/index.html", import.meta.url), "utf8");

test("Account defaults preserve user-entered casing", () => {
  const uppercaseIds = orderDetailFields.match(/const UPPERCASE_IDS = new Set\(\[(.*?)\]\);/s)?.[1] || "";
  assert.doesNotMatch(uppercaseIds, /defaultContactName/);
  assert.doesNotMatch(uppercaseIds, /defaultStreet/);
  assert.doesNotMatch(uppercaseIds, /defaultSuburb/);
  assert.doesNotMatch(uppercaseIds, /defaultInstructions/);
  assert.match(orderDetailFields, /group\?\.name === "account" \? text : uppercase\(text\)/);
});

test("validation messages do not vertically centre adjacent Account fields", () => {
  assert.match(validationStyles, /\.account-experience-v2 \.account-field,[\s\S]*align-content: start;[\s\S]*align-self: start;/);
  assert.match(accountPage, /account-field-validation\.css\?v=20260804-2/);
  assert.match(accountPage, /order-detail-fields\.js\?v=20260804-3/);
});
