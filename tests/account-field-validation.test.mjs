import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  cleanAddressLabel,
  cleanAustralianPostcode,
  cleanInstructions,
  cleanPersonName,
  cleanReference,
  cleanStreetAddress,
  cleanSuburb,
} from "../functions/_shared/account-field-validation.js";

const client = await readFile(new URL("../public/account-field-validation.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/account-field-validation.css", import.meta.url), "utf8");
const accountRoleUx = await readFile(new URL("../public/account-role-ux.js", import.meta.url), "utf8");

test("references accept number groups separated by single hyphens", () => {
  assert.equal(cleanReference(" 99990999-9 "), "99990999-9");
  assert.equal(cleanReference(""), "");
  assert.throws(() => cleanReference("123--1"), /numbers and single hyphens/);
  assert.throws(() => cleanReference("ABC123"), /numbers and single hyphens/);
});

test("contact names preserve casing while rejecting numbers and symbols", () => {
  assert.equal(cleanPersonName("  Douglas   Phung  "), "Douglas Phung");
  assert.equal(cleanPersonName("O’Connor"), "O’Connor");
  assert.equal(cleanPersonName("van der Meer"), "van der Meer");
  assert.throws(() => cleanPersonName("Douglas 123"), /letters, spaces/);
  assert.throws(() => cleanPersonName("Douglas @ Phung"), /letters, spaces/);
});

test("address labels, streets and suburbs use practical safe character sets", () => {
  assert.equal(cleanAddressLabel("Site 24 - West"), "Site 24 - West");
  assert.equal(cleanStreetAddress("Unit 4/18 O'Connor Road"), "Unit 4/18 O'Connor Road");
  assert.equal(cleanSuburb("St Kilda"), "St Kilda");
  assert.throws(() => cleanAddressLabel("Site 🚧"), /may use letters/);
  assert.throws(() => cleanStreetAddress("125 Sussex Street 🚧"), /unsupported characters/);
  assert.throws(() => cleanSuburb("Melbourne 3000"), /may use letters/);
});

test("postcodes are four digits and can retain the existing Victorian business rule", () => {
  assert.equal(cleanAustralianPostcode("0800"), "0800");
  assert.equal(cleanAustralianPostcode("3044", { victorian: true }), "3044");
  assert.throws(() => cleanAustralianPostcode("300"), /four-digit Australian postcode/);
  assert.throws(() => cleanAustralianPostcode("2000", { victorian: true }), /four-digit Victorian postcode/);
});

test("instructions preserve punctuation and line breaks while removing invisible controls", () => {
  assert.equal(
    cleanInstructions(" Call Douglas 30 minutes before arrival.\n\n\nUse Gate 2.\u200b "),
    "Call Douglas 30 minutes before arrival.\n\nUse Gate 2.",
  );
});

test("Account bootstrap loads delegated inline validation without mutation observers", () => {
  assert.match(client, /document\.addEventListener\("submit", onSubmit, true\)/);
  assert.match(client, /document\.addEventListener\("focusin"/);
  assert.doesNotMatch(client, /MutationObserver/);
  assert.match(client, /savedAddressLabel/);
  assert.match(client, /savedContactName/);
  assert.match(client, /defaultReference/);
  assert.match(styles, /account-field-validation-message/);
  assert.match(styles, /is-account-field-invalid/);
  assert.match(accountRoleUx, /loadAccountFieldValidation/);
  assert.match(accountRoleUx, /account-field-validation\.css\?v=20260804-1/);
  assert.match(accountRoleUx, /account-field-validation\.js\?v=20260804-1/);
});
