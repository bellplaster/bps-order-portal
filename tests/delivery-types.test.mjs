import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const canonicalTypes = [
  "Hand Unload",
  "Forklift Delivery",
  "Crane Delivery",
  "Delivery (No Assistance)",
  "Pickup (Customer to collect)",
];

const retiredTypes = [
  "Manual Unload (Knauf Labour)",
  "Mechanical (Forklift/Crane/Own)",
  "Mixed Unload (Hand + Machine)",
];

test("order form exposes only the canonical delivery types", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  for (const type of canonicalTypes) {
    assert.match(html, new RegExp(`name="deliveryType" value="${type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }

  for (const type of retiredTypes) {
    assert.doesNotMatch(html, new RegExp(`name="deliveryType" value="${type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
});

test("account defaults use the same canonical delivery types", async () => {
  const html = await readFile(new URL("../public/account/index.html", import.meta.url), "utf8");

  for (const type of canonicalTypes) {
    assert.match(html, new RegExp(`option value="${type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
});

test("legacy delivery values are read-only compatibility mappings", async () => {
  const bridge = await readFile(new URL("../public/portal-state-bridge.js", import.meta.url), "utf8");

  assert.match(bridge, /Compatibility is intentionally one-way/);
  assert.match(bridge, /\["Manual Unload \(Knauf Labour\)", "Hand Unload"\]/);
  assert.doesNotMatch(bridge, /\["Hand Unload", "Manual Unload \(Knauf Labour\)"\]/);
});

test("unpublished saved-address picker asset is removed", async () => {
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.doesNotMatch(packageJson, /saved-address-picker\.js/);
});
