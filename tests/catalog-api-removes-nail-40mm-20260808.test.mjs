import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet } from "../functions/api/catalog.js";

test("catalog API never exposes the retired 40 mm Nails variant", async () => {
  const response = onRequestGet();
  const catalog = await response.json();
  const nails = catalog.layout?.sections?.nails;

  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.ok(nails, "Nails layout must exist");
  assert.deepEqual(nails.columns, ["30 mm"]);
  assert.ok(
    nails.rows.every((row) => Array.isArray(row.cells) && row.cells.length === 1),
    "every Nails row must contain exactly one 30 mm cell",
  );
  assert.doesNotMatch(JSON.stringify(nails), /40\s*mm/i);

  const retiredProducts = Object.entries(catalog.products || {}).filter(([, product]) =>
    String(product?.section || "").trim().toLowerCase() === "nails"
      && /\b40\s*mm\b/i.test(`${product?.label || ""} ${product?.description || ""}`),
  );
  assert.deepEqual(retiredProducts, []);
});
