import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shared = await readFile(new URL("../public/order-field-behaviour.js", import.meta.url), "utf8");
const details = await readFile(new URL("../public/order-detail-fields.js", import.meta.url), "utf8");
const legacyUtility = await readFile(new URL("../public/phone-date-refinement.js", import.meta.url), "utf8");
const bridge = await readFile(new URL("../public/portal-state-bridge.js", import.meta.url), "utf8");

test("shared controller is the only owner of order text casing and phone formatting", () => {
  assert.match(shared, /window\.BPSOrderFields =/);
  assert.match(shared, /window\.BPSPhone = phoneApi/);
  assert.match(shared, /formatLoadedValue/);

  assert.doesNotMatch(details, /UPPERCASE_IDS/);
  assert.doesNotMatch(details, /textTransform\s*=\s*["']uppercase/);
  assert.doesNotMatch(details, /text-transform:\s*uppercase/);
  assert.doesNotMatch(details, /toLocaleUpperCase/);

  assert.doesNotMatch(legacyUtility, /function cleanReference/);
  assert.doesNotMatch(legacyUtility, /function initialiseReference/);
  assert.doesNotMatch(legacyUtility, /patchReferenceValidation/);
  assert.doesNotMatch(legacyUtility, /window\.BPSPhone\s*=/);
  assert.doesNotMatch(legacyUtility, /addressTitleCase/);
  assert.doesNotMatch(legacyUtility, /repairTimer/);
  assert.doesNotMatch(legacyUtility, /setInterval/);
});

test("account defaults use the same shared order field setter", () => {
  assert.match(bridge, /window\.BPSOrderFields\?\.setValue/);
  assert.match(bridge, /setValue\("contactName"/);
  assert.match(bridge, /setValue\("contactMobile"/);
  assert.match(bridge, /setValue\("deliveryAddressSearch"/);
  assert.match(bridge, /setValue\("deliveryInstructions"/);
});

test("address autocomplete no longer rewrites order values in uppercase", () => {
  assert.match(details, /window\.BPSOrderFields\?\.formatAddressDisplay/);
  assert.match(details, /text-transform:none/);
  assert.doesNotMatch(details, /data-order-detail-formatting="uppercase"/);
});
