import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("approved Rondo columns and SKUs are removed", async () => {
  const source = await read("public/rondo-variant-removals-20260807.js");

  for (const sku of [
    "11202400", "11202700", "40302400", "40302700", "40303300",
    "25102400", "25102700", "40102400", "40102700", "40103300",
    "11103600", "25003600", "12902700",
    "49102400", "49102700", "49302400", "49302700",
    "49502400", "49502700", "51107200",
  ]) {
    assert.match(source, new RegExp(`"${sku}"`));
  }

  assert.match(source, /"RONDO WALL FRAMING"/);
  assert.match(source, /\["2400", "2700", "3300"\]/);
  assert.match(source, /\["3600"\]/);
  assert.match(source, /"RONDO FURRING CHANNELS"/);
  assert.match(source, /\["2700"\]/);
  assert.match(source, /"RONDO MEDIUM GAUGE STUDS — 0\.75 BMT"/);
  assert.match(source, /\["2400", "2700", "2820", "3900"\]/);
  assert.match(source, /\["7200"\]/);
  assert.match(source, /"RONDO TRACKS & DH TRACK"/);
  assert.match(source, /\["6000"\]/);
});

test("removed Rondo variants are purged from catalogue and every rerender", async () => {
  const [source, loader] = await Promise.all([
    read("public/rondo-variant-removals-20260807.js"),
    read("public/draft-restore-fix.js"),
  ]);

  assert.match(source, /delete catalog\[key\]/);
  assert.match(source, /window\.renderUnifiedFloorSheet = renderer/);
  assert.match(source, /removeTableColumns/);
  assert.match(loader, /rondo-variant-removals-20260807\.js\?v=20260807-1/);
});
