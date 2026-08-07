import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("required indicators cover the fields enforced by order validation", async () => {
  const source = await read("public/required-field-indicators.js");

  for (const id of ["requiredDateDisplay", "contactName", "contactMobile"]) {
    assert.match(source, new RegExp(`"${id}"`));
  }
  assert.match(source, /\.delivery-select-deliveryType > span/);
  assert.match(source, /\.gate-code-field > span/);
  assert.match(source, /label\[for="customerServiceCustomerAccount"\]/);

  assert.doesNotMatch(source, /STATIC_REQUIRED_FIELDS[\s\S]*"reference"/);
  assert.doesNotMatch(source, /STATIC_REQUIRED_FIELDS[\s\S]*"deliveryInstructions"/);
  assert.doesNotMatch(source, /delivery-select-timeSlot > span/);
  assert.doesNotMatch(source, /extras-dropdown-field > span/);
});

test("address required indicator follows the delivery versus pickup rule", async () => {
  const source = await read("public/required-field-indicators.js");

  assert.match(source, /PICKUP_VALUE = "Pickup \(Customer to collect\)"/);
  assert.match(source, /input\[name="deliveryType"\]:checked/);
  assert.match(source, /indicator\.hidden = pickup/);
  assert.match(source, /input\.required = !pickup/);
  assert.match(source, /input\.setAttribute\("aria-required", String\(!pickup\)\)/);
  assert.match(source, /input\.addEventListener\("change", syncAddressRequirement\)/);
  assert.match(source, /installDeliverySyncBridge/);
  assert.match(source, /previous\.apply\(this, args\);[\s\S]*syncAddressRequirement\(\)/);
});

test("required markers are visual only and use the Bell maroon treatment", async () => {
  const [source, styles] = await Promise.all([
    read("public/required-field-indicators.js"),
    read("public/order-control-refinement.css"),
  ]);

  assert.match(source, /indicator\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(source, /indicator\.textContent = "\*"/);
  assert.match(styles, /\.required-field-indicator\s*\{[\s\S]*color: var\(--bell-maroon, #a32b46\) !important;/);
  assert.match(styles, /\.required-field-indicator\[hidden\]\s*\{[\s\S]*display: none !important;/);
});

test("indicator controller loads after delivery controls and current assets are cache busted", async () => {
  const [html, packageSource] = await Promise.all([
    read("public/index.html"),
    read("package.json"),
  ]);

  const deliveryIndex = html.indexOf("/delivery-refinement.js?v=20260806-2");
  const indicatorIndex = html.indexOf("/required-field-indicators.js?v=20260808-1");
  assert.ok(deliveryIndex >= 0 && indicatorIndex > deliveryIndex);
  assert.match(html, /order-control-refinement\.css\?v=20260808-1/);
  assert.match(packageSource, /node --check public\/required-field-indicators\.js/);
});
