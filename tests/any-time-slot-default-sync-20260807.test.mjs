import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../public/portal-state-bridge.js", import.meta.url),
  "utf8",
);

test("saved Any remains an explicit checked time-slot value", () => {
  assert.match(source, /const timeSlot = String\(defaults\.timeSlot \|\| ""\)\.trim\(\)\.toUpperCase\(\)/);
  assert.match(source, /const selectedTimeSlot = timeSlot \? selectChoice\("timeSlot", timeSlot\) : null/);
  assert.match(source, /timeSlot === "ANY" \? "Any" : timeSlot/);
});

test("generated delivery controls resynchronise after account defaults are applied", () => {
  assert.match(source, /function resyncGeneratedDeliveryControls\(selectedTimeSlot\)/);
  assert.match(source, /selectedTimeSlot\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
  assert.match(source, /window\.syncUnifiedDeliveryControls\?\.\(\)/);
  assert.match(source, /queueMicrotask\(\(\) => resyncGeneratedDeliveryControls\(selectedTimeSlot\)\)/);
  assert.match(source, /window\.requestAnimationFrame\(\(\) => resyncGeneratedDeliveryControls\(selectedTimeSlot\)\)/);
});

test("choice selection reports failure instead of silently assuming a match", () => {
  assert.match(source, /if \(!\(selected instanceof HTMLInputElement\)\) return null/);
  assert.match(source, /selected\.checked = true/);
  assert.match(source, /return selected/);
});
