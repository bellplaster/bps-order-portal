import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Account validation clears field errors through the native form reset lifecycle", async () => {
  const validation = await read("public/account-field-validation.js");

  assert.match(validation, /function clearFieldValidation\(field\)/);
  assert.match(validation, /field\.setCustomValidity\(""\)/);
  assert.match(validation, /field\.classList\.remove\("is-account-field-invalid"\)/);
  assert.match(validation, /error\.textContent = ""/);
  assert.match(validation, /document\.addEventListener\("reset", onReset, true\)/);
});

test("Saved contact dialogs reset the form before population and after closing", async () => {
  const contacts = await read("public/account-contacts-management.js");

  assert.match(contacts, /function resetContactForm\(\)/);
  assert.match(contacts, /form\.reset\(\)/);
  assert.match(contacts, /function openDialog[\s\S]*?resetContactForm\(\);[\s\S]*?editingId/);
  assert.match(contacts, /function closeDialog[\s\S]*?resetContactForm\(\);[\s\S]*?editingId = null/);
});

test("Saved contact fields remain a two-column pair and row actions share the card edge", async () => {
  const styles = await read("public/account-shopify-compact.css");

  assert.match(styles, /saved-contact-fields\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important\}/);
  assert.match(styles, /saved-contact-fields>label\{grid-column:auto!important/);
  assert.match(styles, /saved-contact-row\{[^}]*grid-template-columns:minmax\(0,1fr\) auto!important/);
  assert.match(styles, /saved-contact-row\{[^}]*padding:12px 18px!important/);
  assert.match(styles, /saved-contact-actions\{[^}]*position:static!important/);
  assert.match(styles, /saved-contact-actions\{[^}]*justify-self:end!important/);
  assert.doesNotMatch(styles, /padding:12px 170px/);
  assert.doesNotMatch(styles, /saved-contact-actions\{[^}]*position:absolute/);
});
