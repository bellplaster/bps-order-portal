import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("saved Any remains an explicit checked time-slot value", async () => {
  const bridge = await read("public/portal-state-bridge.js");

  assert.match(bridge, /const timeSlot = String\(defaults\.timeSlot \|\| ""\)\.trim\(\)\.toUpperCase\(\)/);
  assert.match(bridge, /selectChoice\("timeSlot", timeSlot, \{ notify: true \}\)/);
  assert.match(bridge, /if \(notify\) selected\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
  assert.match(bridge, /window\.syncUnifiedDeliveryControls\?\.\(\)/);
});

test("default application has no timing retries", async () => {
  const bridge = await read("public/portal-state-bridge.js");

  assert.doesNotMatch(bridge, /queueMicrotask/);
  assert.doesNotMatch(bridge, /requestAnimationFrame/);
  assert.doesNotMatch(bridge, /resyncGeneratedDeliveryControls/);
});

test("app does not dynamically load the delivery refinement controller", async () => {
  const app = await read("public/app.js");
  const index = await read("public/index.html");

  assert.doesNotMatch(app, /loadDeliveryRefinement/);
  assert.doesNotMatch(app, /delivery-refinement\.js/);
  assert.equal((index.match(/<script src="\/delivery-refinement\.js[^>]*><\/script>/g) || []).length, 1);
});

test("choice selection reports failure instead of silently assuming a match", async () => {
  const bridge = await read("public/portal-state-bridge.js");

  assert.match(bridge, /if \(!\(selected instanceof HTMLInputElement\)\) return null/);
  assert.match(bridge, /selected\.checked = true/);
  assert.match(bridge, /return selected/);
});
