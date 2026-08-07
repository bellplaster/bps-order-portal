import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("STUDS and TRACKS have clear separation from adjacent product tables", async () => {
  const [studStyles, trackScript] = await Promise.all([
    read("public/studs-bmt-tabs-20260807.css"),
    read("public/tracks-bmt-tabs-20260807.js"),
  ]);

  assert.match(studStyles, /\.studs-bmt-section\{[^}]*margin-top:8px/);
  assert.match(trackScript, /\.tracks-bmt-section\{[^}]*margin-top:8px;[^}]*margin-bottom:8px/);
});
