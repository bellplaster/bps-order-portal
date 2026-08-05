import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("optional Account select prompts remain selectable and update the live model", async () => {
  const source = await read("public/account-admin-shopify-polish.js");

  assert.match(source, /emptyOption\.disabled = false/);
  assert.match(source, /new Option\("Any", "ANY"\)/);
  assert.match(source, /function syncInMemoryDefaults\(select\)/);
  assert.match(source, /orderDefaults\.timeSlot = select\.value/);
  assert.match(source, /syncSelect\(select, \{ updateModel: true \}\)/);
  assert.doesNotMatch(source, /emptyOption\.disabled = true/);
});

test("order defaults explicitly clear and apply the matching order-form controls", async () => {
  const bridge = await read("public/portal-state-bridge.js");

  assert.match(bridge, /function applyOrderDefaults\(defaults\)/);
  assert.match(bridge, /setValue\("reference", defaults\.reference\)/);
  assert.match(bridge, /setValue\("requiredDate", defaults\.requiredDate\)/);
  assert.match(bridge, /clearChoiceGroup\("timeSlot"\)/);
  assert.match(bridge, /selectChoice\("timeSlot", timeSlot\)/);
  assert.match(bridge, /clearChoiceGroup\("deliveryType"\)/);
  assert.match(bridge, /selectChoice\("deliveryType", deliveryType\)/);
  assert.match(bridge, /clearChoiceGroup\("deliveryExtra"\)/);
  assert.match(bridge, /window\.initialiseOrderDetailFields\?\.\(\)/);
  assert.match(bridge, /window\.formatOrderDetailFields\?\.\(\)/);
  assert.match(bridge, /\["Crane Delivery", "Mechanical \(Forklift\/Crane\/Own\)"\]/);
  assert.match(bridge, /payload\.profile\?\.orderDefaults/);
});

test("Account cards share one left content inset", async () => {
  const styles = await read("public/account-shopify-compact.css");

  assert.match(styles, /saved-contact-row>\*\{padding-right:0!important;padding-left:0!important\}/);
  assert.match(styles, /security-toggle\{padding-right:18px!important;padding-left:18px!important\}/);
  assert.match(styles, /saved-address-row\{[^}]*padding:12px 18px!important/);
});
