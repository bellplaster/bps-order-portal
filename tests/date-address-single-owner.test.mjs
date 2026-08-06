import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("required date and delivery refinement have one deterministic lifecycle", async () => {
  const [index, fieldBehaviour, dateState, phoneRefinement, deliveryRefinement, referencePlaceholder, draftRestore] = await Promise.all([
    read("public/index.html"),
    read("public/order-field-behaviour.js"),
    read("public/order-details-date-state.js"),
    read("public/phone-date-refinement.js"),
    read("public/delivery-refinement.js"),
    read("public/reference-placeholder.js"),
    read("public/draft-restore-fix.js"),
  ]);

  const dateScript = index.indexOf('/order-details-date-state.js?v=20260806-3');
  const appScript = index.indexOf('/app.js?v=20260805-1');
  const deliveryScript = index.indexOf('/delivery-refinement.js?v=20260806-2');
  const phoneScript = index.indexOf('/phone-date-refinement.js?v=20260806-2');

  assert.ok(dateScript >= 0, "canonical date controller must be loaded statically");
  assert.ok(deliveryScript >= 0, "delivery refinement must be loaded statically");
  assert.ok(dateScript < appScript, "date controller must initialise before app lifecycle listeners");
  assert.ok(deliveryScript < phoneScript, "delivery layout must settle before phone-only refinement");

  assert.match(dateState, /function parseSmartDateDigits/);
  assert.match(dateState, /dd-mm-yy/i);
  assert.match(dateState, /requiredDateDisplay/);
  assert.doesNotMatch(fieldBehaviour, /function parseSmartDateDigits/);
  assert.doesNotMatch(fieldBehaviour, /function datePartsFromDigits/);
  assert.match(fieldBehaviour, /BPSRequiredDate/);
  assert.doesNotMatch(phoneRefinement, /type\s*=\s*["']date["']/);
  assert.doesNotMatch(referencePlaceholder, /createElement\(["']script["']\)/);
  assert.doesNotMatch(draftRestore, /calendar-control/);
  assert.doesNotMatch(draftRestore, /requiredDate/);
  assert.match(deliveryRefinement, /__bpsDeliveryRefinementLoaded/);
  assert.doesNotMatch(deliveryRefinement, /DD\/MM\/YYYY/);
});

test("canonical required date controller owns the explicit calendar button and panel", async () => {
  const dateState = await read("public/order-details-date-state.js");

  assert.match(dateState, /BUTTON_ID = "requiredDateCalendarButton"/);
  assert.match(dateState, /PANEL_ID = "requiredDateCalendarPanel"/);
  assert.match(dateState, /button\.addEventListener\("click"/);
  assert.match(dateState, /if \(panel\.hidden\) openCalendar\(\)/);
  assert.match(dateState, /panel\.hidden = false/);
  assert.match(dateState, /required-date-calendar-open/);
  assert.match(dateState, /setValue\(dayButton\.dataset\.date \|\| "", \{ emit: true \}\)/);
  assert.match(dateState, /hidden\.type = "hidden"/);
  assert.match(dateState, /hidden\.hidden = true/);
  assert.match(dateState, /classList\.remove\("date-native-picker"\)/);
  assert.doesNotMatch(dateState, /hidden\.type = "date"/);
  assert.doesNotMatch(dateState, /className\s*=\s*"date-native-picker"/);
  assert.doesNotMatch(dateState, /classList\.add\("date-native-picker"\)/);
  assert.doesNotMatch(dateState, /showPicker/);
  assert.doesNotMatch(dateState, /setInterval/);

  await assert.rejects(
    access(new URL("../public/calendar-control.js", import.meta.url)),
    { code: "ENOENT" },
    "the duplicate legacy calendar controller must not exist",
  );
});

test("visible State is removed without clearing the hidden VIC value", async () => {
  const dateState = await read("public/order-details-date-state.js");
  assert.match(dateState, /VIC/);
  assert.match(dateState, /MutationObserver/);
  assert.match(dateState, /disconnect\(\)/);
});
