import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("tracks consolidate into four BMT tabs", async () => {
  const source = await read("public/tracks-bmt-tabs-20260807.js");
  for (const label of ["0.50 BMT", "0.70 BMT", "0.75 BMT", "1.15 BMT"]) assert.match(source, new RegExp(label.replace(".", "\\.")));
  assert.match(source, /heading\.textContent = "TRACKS"/);
  assert.match(source, /\["Product", "3000"\]/);
});

test("approved track products retain their SKU-backed quantity cells", async () => {
  const source = await read("public/tracks-bmt-tabs-20260807.js");
  for (const sku of [
    "40003000", "11103000", "40203000", "25003000", "48003000", "48203000", "48303000",
    "49003000", "49403000", "49603000", "48803000", "49703000", "49803000", "87203000",
    "49203000", "49903000", "51003000", "87303000",
    "66003000", "67003000", "68003000", "66303000", "67303000", "68303000", "69003000",
  ]) assert.match(source, new RegExp(sku));
  assert.match(source, /createQuantityCell\(floor, key\)/);
  assert.match(source, /catalogue key missing for SKU/);
});

test("track tabs match the STUDS interaction and header design", async () => {
  const source = await read("public/tracks-bmt-tabs-20260807.js");
  assert.match(source, /height:34px/);
  assert.match(source, /font:700 11px\/24px/);
  assert.match(source, /transition:transform \.28s cubic-bezier\(\.22,\.8,\.28,1\)/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /Home/);
  assert.match(source, /End/);
});

test("all legacy track source sections are removed after the consolidated section is built", async () => {
  const source = await read("public/tracks-bmt-tabs-20260807.js");
  assert.match(source, /"RONDO WALL FRAMING"/);
  assert.match(source, /"RONDO TRACKS & DH TRACK"/);
  assert.match(source, /"RONDO HEAVY-DUTY WALL FRAMING"/);
  assert.match(source, /studs\.insertAdjacentElement\("afterend", newSection\)/);
  assert.match(source, /removeLegacyTrackSources\(root\)/);
  const applyStart = source.indexOf("function apply(floor)");
  const buildIndex = source.indexOf("const newSection = buildSection(floor)", applyStart);
  const removeIndex = source.indexOf("removeLegacyTrackSources(root);", buildIndex);
  assert.ok(applyStart >= 0 && buildIndex > applyStart && removeIndex > buildIndex);
});

test("track consolidation is floor-scoped and render-driven", async () => {
  const source = await read("public/tracks-bmt-tabs-20260807.js");
  assert.match(source, /function apply\(floor\)/);
  assert.match(source, /document\.getElementById\(`\$\{floor\}OrderSheet`\)/);
  assert.match(source, /root\.querySelector\("\.studs-bmt-section"\)/);
  assert.match(source, /root\.querySelectorAll\("\.tracks-bmt-section"\)/);
  assert.doesNotMatch(source, /document\.querySelector\("\.studs-bmt-section"\)/);
  assert.doesNotMatch(source, /MutationObserver/);
  assert.doesNotMatch(source, /queueMicrotask/);
  assert.doesNotMatch(source, /DOMContentLoaded/);
});

test("tracks controller is statically installed before floor rendering", async () => {
  const [index, loader] = await Promise.all([read("public/index.html"), read("public/draft-restore-fix.js")]);
  const tracksIndex = index.indexOf("/tracks-bmt-tabs-20260807.js?v=20260807-2");
  const deliveryIndex = index.indexOf("/delivery-areas.js?v=20260724-1");
  assert.ok(tracksIndex >= 0);
  assert.ok(deliveryIndex > tracksIndex);
  assert.doesNotMatch(loader, /tracks-bmt-tabs-20260807\.js/);
});
