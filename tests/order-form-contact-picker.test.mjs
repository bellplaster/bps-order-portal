import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the order-form saved address picker remains unpublished", async () => {
  const bridge = await read("public/portal-state-bridge.js");

  assert.doesNotMatch(bridge, /script\.src = "\/saved-address-picker\.js/);
  assert.doesNotMatch(bridge, /stylesheet\.href = "\/saved-address-picker\.css/);
  assert.match(bridge, /savedAddressPickerButton/);
  assert.match(bridge, /savedAddressPickerMenu/);
  assert.match(bridge, /has-saved-address-picker/);
});

test("the order-form contact picker uses an Account-style menu", async () => {
  const picker = await read("public/linked-contact-picker.js");

  assert.match(picker, /linked-contact-menu-heading/);
  assert.match(picker, />Saved contacts</);
  assert.match(picker, /linked-contact-avatar/);
  assert.match(picker, /linked-contact-copy/);
  assert.match(picker, /\/account\/#savedContactsSection/);
  assert.match(picker, />Manage contacts</);
  assert.match(picker, /border-radius:12px/);
  assert.match(picker, /width:300px/);
});

test("contact picker and state bridge are syntax checked", async () => {
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(packageJson.scripts.check, /node --check public\/linked-contact-picker\.js/);
  assert.match(packageJson.scripts.check, /node --check public\/portal-state-bridge\.js/);
});
