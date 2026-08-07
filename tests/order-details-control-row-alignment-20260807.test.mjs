import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("time slot owns a real empty placeholder state", async () => {
  const source = await read("public/delivery-refinement.js");

  assert.match(source, /createSyncedSelect\("timeSlot", "Time Slot", true\)/);
  assert.match(source, /name === "timeSlot" \? "Select time slot" : "Select delivery type"/);
  assert.match(source, /select\.classList\.toggle\("is-placeholder", !select\.value\)/);
  assert.match(source, /radios\.forEach\(\(candidate\) => \{ candidate\.checked = candidate === radio; \}\)/);
});

test("order details row reserves columns for gate code and N\/A", async () => {
  const styles = await read("public/order-control-refinement.css");

  assert.match(styles, /Canonical Order Details control row/);
  assert.match(styles, /112px minmax\(110px, \.55fr\)/);
  assert.match(styles, /minmax\(62px, auto\)/);
  assert.match(styles, /delivery-select\.is-placeholder/);
  assert.match(styles, /text-align-last: left/);
  assert.match(styles, /label:has\(input\[type="checkbox"\]\)/);
});

test("gate-code text input focus remains inside its own cell", async () => {
  const styles = await read("public/order-control-refinement.css");

  assert.match(styles, /delivery-instruction-controls input\[type="text"\]/);
  assert.match(styles, /box-shadow: inset 0 0 0 1px var\(--bell-green\)/);
  assert.doesNotMatch(styles, /box-shadow: inset 0 0 0 2px var\(--bell-green\)/);
  assert.match(styles, /height: 39px !important/);
  assert.match(styles, /border-right: 1px solid #d4d9d7 !important/);
});
