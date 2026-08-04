import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const index = await readFile(new URL("../public/account/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../public/account-prototype-refinement.css", import.meta.url), "utf8");
const interactions = await readFile(new URL("../public/account-prototype-interactions.js", import.meta.url), "utf8");
const contacts = await readFile(new URL("../public/account-contacts-management.js", import.meta.url), "utf8");
const addresses = await readFile(new URL("../public/account-addresses-management.js", import.meta.url), "utf8");

test("Account page loads the approved prototype refinement assets", () => {
  assert.match(index, /account-prototype-refinement\.css\?v=20260804-1/);
  assert.match(index, /account-prototype-interactions\.js\?v=20260804-1/);
});

test("Account row actions use visible button-sized controls", () => {
  assert.match(css, /saved-contact-actions button,[\s\S]*saved-address-actions button,[\s\S]*min-height:34px!important/);
  assert.match(css, /font-size:12px!important/);
  assert.match(css, /border-radius:9px!important/);
});

test("Account dialogs use the shared blurred modal design", () => {
  assert.match(css, /account-prototype-dialog::backdrop[\s\S]*backdrop-filter:blur\(7px\)!important/);
  assert.match(css, /max-width:560px!important/);
  assert.match(css, /account-prototype-cancel[\s\S]*text-decoration:underline!important/);
});

test("Password editing is moved into a modal", () => {
  assert.match(interactions, /passwordDialogV2/);
  assert.match(interactions, /Change password/);
  assert.match(interactions, /Use at least eight characters and avoid reusing an existing password/);
  assert.match(interactions, /window\.togglePasswordPanel = toggleDialog/);
});

test("Saved contacts render an avatar and use custom removal confirmation", () => {
  assert.match(contacts, /saved-contact-avatar/);
  assert.match(contacts, /window\.BPSAccountDialogs\?\.confirm/);
  assert.match(contacts, /Remove contact/);
});

test("Saved addresses use larger actions and custom confirmation", () => {
  assert.match(addresses, /Set as default/);
  assert.match(addresses, /window\.BPSAccountDialogs\?\.confirm/);
  assert.match(addresses, /Remove address/);
});
