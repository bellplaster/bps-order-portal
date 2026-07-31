import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/payload-sku-bridge.js", import.meta.url), "utf8");
const context = vm.createContext({ console });
vm.runInContext(source, context, { filename: "payload-sku-bridge.js" });
const naming = context.BpsProductDisplayName;

test("fastener review titles include group, type and size", () => {
  assert.equal(
    naming.productDisplayName({ label: "Loose - Needle Point (S)", detail: "25 mm" }),
    "Loose - Needle Point (S) - 25 mm",
  );
  assert.equal(
    naming.productDisplayName({ label: "Loose - Needle Point (S)", detail: "32 mm" }),
    "Loose - Needle Point (S) - 32 mm",
  );
  assert.equal(
    naming.productDisplayName({ label: "Collated - Coarse (W)", detail: "25 mm" }),
    "Collated - Coarse (W) - 25 mm",
  );
});

test("different fastener variants cannot collapse to the same title", () => {
  const names = [
    { label: "Loose - Needle Point (S)", detail: "25 mm" },
    { label: "Loose - Needle Point (S)", detail: "32 mm" },
    { label: "Loose - Coarse (W)", detail: "25 mm" },
    { label: "Loose - Coarse (W)", detail: "32 mm" },
    { label: "Collated - Needle Point (S)", detail: "25 mm" },
    { label: "Collated - Needle Point (S)", detail: "32 mm" },
    { label: "Collated - Coarse (W)", detail: "25 mm" },
    { label: "Collated - Coarse (W)", detail: "32 mm" },
  ].map(naming.productDisplayName);

  assert.equal(new Set(names).size, names.length);
});

test("pack sizes and lengths are preserved for other catalogue products", () => {
  assert.equal(naming.productDisplayName({ label: "BaseCote 45", detail: "20 kg" }), "BaseCote 45 - 20 kg");
  assert.equal(naming.productDisplayName({ label: "Paper Tape", detail: "150 m" }), "Paper Tape - 150 m");
  assert.equal(naming.productDisplayName({ label: "P01 External Angle 90°", detail: "2400 mm" }), "P01 External Angle 90° - 2400 mm");
});

test("detail is not duplicated when already present in the base name", () => {
  assert.equal(
    naming.productDisplayName({ label: "Villaboard 6 mm - 1200 x 3000 mm", detail: "3000 mm" }),
    "Villaboard 6 mm - 1200 x 3000 mm",
  );
});

test("review lines and payload descriptions use the same naming function", () => {
  assert.match(source, /description:\s*productDisplayName\(product\)/);
  assert.match(source, /label:\s*productDisplayName\(product\)/);
});