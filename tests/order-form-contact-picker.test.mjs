import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the order-form saved address picker remains unpublished and removed", async () => {
  const index = await read("public/index.html");
  const bridge = await read("public/portal-state-bridge.js");
  const packageJson = JSON.parse(await read("package.json"));

  assert.doesNotMatch(index, /saved-address-picker\.js/);
  assert.doesNotMatch(bridge, /savedAddressPickerButton|savedAddressPickerMenu|has-saved-address-picker/);
  assert.doesNotMatch(packageJson.scripts.check, /saved-address-picker\.js/);

  await assert.rejects(
    access(new URL("../public/saved-address-picker.js", import.meta.url)),
    { code: "ENOENT" },
  );
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
