import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("../public/order-detail-fields.js", import.meta.url), "utf8");
const endpoint = await readFile(new URL("../functions/api/address-search.js", import.meta.url), "utf8");

test("address suggestions are not selected until the user explicitly activates one", () => {
  assert.match(client, /suggestions = Array\.isArray\(payload\.suggestions\) \? payload\.suggestions : \[\];\s*activeIndex = -1;/s);
  assert.match(client, /if \(activeIndex >= 0\) \{\s*void choose\(suggestions\[activeIndex\]\);\s*\} else \{\s*close\(\);\s*input\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\);/s);
  assert.doesNotMatch(client, /suggestions\[Math\.max\(0, activeIndex\)\]/);
});

test("keyboard and pointer navigation explicitly activate a suggestion", () => {
  assert.match(client, /button\.addEventListener\("mouseenter", \(\) => \{\s*activeIndex = index;/s);
  assert.match(client, /event\.key === "ArrowDown"/);
  assert.match(client, /event\.key === "ArrowUp"/);
  assert.match(client, /aria-activedescendant/);
});

test("manual unit, lot and street-number details are retained after a deliberate selection", () => {
  assert.match(client, /function mergeManualStreetDetails\(manualValue, resolvedValue\)/);
  assert.match(client, /unit\|suite\|shop\|factory\|warehouse\|tenancy\|level\|lot/);
  assert.match(client, /mergeManualStreetDetails\(manualStreet, place\.street\)/);
});

test("street search rejects pure businesses and landmarks", () => {
  assert.match(endpoint, /const STREET_ADDRESS_TYPES = new Set/);
  assert.match(endpoint, /const NON_ADDRESS_TYPES = new Set/);
  assert.match(endpoint, /isOnlyNonAddressPlace/);
  assert.match(endpoint, /mode === "street" && !route/);
  assert.match(endpoint, /Choose a street address rather than a business or landmark/);
});
