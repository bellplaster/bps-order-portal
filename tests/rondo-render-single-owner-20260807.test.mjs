import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const staticControllers = [
  "/product-additions-20260806.js?v=20260807-2",
  "/remove-rondo-finishing-beads-20260807.js?v=20260807-2",
  "/rondo-variant-removals-20260807.js?v=20260807-5",
  "/studs-bmt-tabs-20260807.js?v=20260807-2",
  "/tracks-bmt-tabs-20260807.js?v=20260807-2",
];

test("Rondo render controllers have one deterministic static load order", async () => {
  const index = await read("public/index.html");
  const deliveryIndex = index.indexOf("/delivery-areas.js?v=20260724-1");
  assert.ok(deliveryIndex >= 0, "delivery-area renderer is missing");

  let previousIndex = -1;
  for (const src of staticControllers) {
    assert.equal((index.match(new RegExp(src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 1, `${src} must load exactly once`);
    const controllerIndex = index.indexOf(src);
    assert.ok(controllerIndex > previousIndex, `${src} is out of order`);
    assert.ok(controllerIndex < deliveryIndex, `${src} must be installed before delivery areas render floor sheets`);
    previousIndex = controllerIndex;
  }
});

test("payload naming bridge does not load the expanded catalogue", async () => {
  const payload = await read("public/payload-sku-bridge.js");
  assert.doesNotMatch(payload, /product-additions-20260806\.js/);
  assert.doesNotMatch(payload, /document\.createElement\("script"\)/);
  assert.doesNotMatch(payload, /append\(additionsScript\)/);
});

test("draft restoration does not own Rondo catalogue controllers", async () => {
  const loader = await read("public/draft-restore-fix.js");
  for (const name of [
    "product-additions-20260806",
    "remove-rondo-finishing-beads-20260807",
    "rondo-variant-removals-20260807",
    "studs-bmt-tabs-20260807",
    "tracks-bmt-tabs-20260807",
    "studs-bmt-row-order-20260807",
  ]) assert.doesNotMatch(loader, new RegExp(name));
});

test("tabbed wall-framing controllers are floor-scoped and have no timing retry lifecycle", async () => {
  const [studs, tracks] = await Promise.all([
    read("public/studs-bmt-tabs-20260807.js"),
    read("public/tracks-bmt-tabs-20260807.js"),
  ]);

  for (const source of [studs, tracks]) {
    assert.match(source, /function apply\(floor\)/);
    assert.match(source, /document\.getElementById\(`\$\{floor\}OrderSheet`\)/);
    assert.doesNotMatch(source, /MutationObserver/);
    assert.doesNotMatch(source, /queueMicrotask/);
    assert.doesNotMatch(source, /requestAnimationFrame/);
    assert.doesNotMatch(source, /setTimeout/);
  }
});

test("TRACKS owns cleanup of every legacy track source including embedded standard tracks", async () => {
  const tracks = await read("public/tracks-bmt-tabs-20260807.js");
  assert.match(tracks, /const legacyTitles = new Set\(\[/);
  assert.match(tracks, /"RONDO WALL FRAMING"/);
  assert.match(tracks, /"RONDO TRACKS & DH TRACK"/);
  assert.match(tracks, /"RONDO HEAVY-DUTY WALL FRAMING"/);
  assert.match(tracks, /removeLegacyTrackSources\(root\)/);
});

test("redundant stud row-order patch is not loaded", async () => {
  const [index, loader] = await Promise.all([
    read("public/index.html"),
    read("public/draft-restore-fix.js"),
  ]);
  assert.doesNotMatch(index, /studs-bmt-row-order-20260807\.js/);
  assert.doesNotMatch(loader, /studs-bmt-row-order-20260807\.js/);
});
