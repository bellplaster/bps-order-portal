import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const managementSource = await readFile(new URL("../public/account-contacts-management.js", import.meta.url), "utf8");
const roleSource = await readFile(new URL("../public/account-role-ux.js", import.meta.url), "utf8");
const stylesheet = await readFile(new URL("../public/account-contacts-management.css", import.meta.url), "utf8");

test("saved contacts header contains only the title and add action", () => {
  assert.doesNotMatch(managementSource, /Shared with every order user under this customer account\./);
  assert.match(managementSource, /<h2>Saved contacts<\/h2>\s*<button id="addSavedContact"/);
});

test("saved contacts styling is maintained in the component stylesheet", () => {
  assert.doesNotMatch(managementSource, /installStyles|createElement\("style"\)/);
  assert.match(roleSource, /account-contacts-management\.css\?v=/);
  assert.match(roleSource, /account-contacts-management\.js\?v=/);
});

test("header and rows use one shared column definition", () => {
  assert.match(stylesheet, /--saved-contact-columns:/);
  assert.match(stylesheet, /\.saved-contacts-header,\s*\.saved-contact-row\s*\{[^}]*grid-template-columns:\s*var\(--saved-contact-columns\)/s);
});

test("actions heading and row controls share right alignment", () => {
  assert.match(stylesheet, /\.saved-contacts-header\s*>\s*span:last-child\s*\{[^}]*text-align:\s*right/s);
  assert.match(stylesheet, /\.saved-contact-actions\s*\{[^}]*justify-content:\s*flex-end/s);
});

test("add contact control has a usable vertical hit area", () => {
  const buttonRule = stylesheet.match(/\.saved-contacts-bar button\s*\{([^}]*)\}/s)?.[1] || "";
  assert.match(buttonRule, /min-height:\s*30px/);
  assert.match(buttonRule, /padding:\s*6px 13px/);
  assert.match(buttonRule, /align-items:\s*center/);
});
