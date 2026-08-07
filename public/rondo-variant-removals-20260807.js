(() => {
  if (window.__bpsRondoVariantRemovals20260807) return;
  window.__bpsRondoVariantRemovals20260807 = true;

  const REMOVED_SKUS = new Set([
    "11202400", "11202700",
    "40302400", "40302700", "40303300",
    "25102400", "25102700",
    "40102400", "40102700", "40103300",
    "11103600", "25003600",
    "12902700",
    "49102400", "49102700",
    "49302400", "49302700",
    "49502400", "49502700",
    "51107200",
  ]);

  const COLUMN_RULES = Object.freeze({
    "RONDO WALL FRAMING": [
      ["2400", "2700", "3300"],
      [],
      ["3600"],
    ],
    "RONDO FURRING CHANNELS": [
      ["2700"],
    ],
    "RONDO MEDIUM GAUGE STUDS — 0.75 BMT": [
      ["2400", "2700", "2820", "3900"],
      ["7200"],
    ],
    "RONDO TRACKS & DH TRACK": [
      ["6000"],
    ],
  });

  function normalise(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
  }

  function purgeCatalogue() {
    const catalog = globalThis.state?.catalog;
    if (!catalog || typeof catalog !== "object") return;

    Object.keys(catalog).forEach((key) => {
      const product = catalog[key];
      const sku = String(product?.sku || product?.stockCode || "").trim();
      if (REMOVED_SKUS.has(sku)) delete catalog[key];
    });
  }

  function removeTableColumns(table, headings) {
    if (!(table instanceof HTMLTableElement) || !headings?.length) return;
    const header = table.querySelector("tr.lower-matrix-header, thead tr, tbody tr");
    if (!header) return;

    const removeIndexes = [...header.children]
      .map((cell, index) => headings.includes(String(cell.textContent || "").trim()) ? index : -1)
      .filter((index) => index > 0)
      .sort((left, right) => right - left);

    if (!removeIndexes.length) return;

    [...table.rows].forEach((row) => {
      removeIndexes.forEach((index) => row.children[index]?.remove());
    });

    const cols = table.querySelectorAll("colgroup col");
    removeIndexes.forEach((index) => cols[index]?.remove());
  }

  function removeVariantsFromSection(section) {
    const title = normalise(section.querySelector(".rondo-expanded-title, .lower-category-title, h3")?.textContent);
    const rules = COLUMN_RULES[title];
    if (!rules) return;

    const tables = [...section.querySelectorAll("table")];
    rules.forEach((headings, tableIndex) => removeTableColumns(tables[tableIndex], headings));
  }

  function apply() {
    purgeCatalogue();
    document.querySelectorAll(".rondo-expanded-group, .lower-catalogue-section").forEach(removeVariantsFromSection);
  }

  const previousRenderer = window.renderUnifiedFloorSheet;
  if (typeof previousRenderer === "function" && !previousRenderer.__rondoVariantRemovals20260807) {
    const renderer = function renderWithRondoVariantRemovals(floor, ...args) {
      const result = previousRenderer.call(this, floor, ...args);
      apply();
      return result;
    };
    renderer.__rondoVariantRemovals20260807 = true;
    window.renderUnifiedFloorSheet = renderer;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
  else apply();
})();
