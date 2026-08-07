(() => {
  const previousRenderer = window.renderUnifiedFloorSheet;
  if (typeof previousRenderer !== "function" || previousRenderer.__rondoFinishingBeadsRemoved20260807) return;

  const REMOVED_TITLE = "RONDO FINISHING BEADS & ANGLES";
  const REMOVED_SKUS = new Set([
    "P0102550", "P0303000", "P0702400", "P0702700", "P0703000", "P0703600",
    "P0803000", "P1103000", "P1202400", "P1202700", "P1203000", "P1203600",
    "P1302400", "P1302700", "P1303000", "P1303600", "P1403000", "P2503000",
    "P2603000", "P2703000", "P2803000", "P0903000", "P1003000", "P35W3000",
    "P5003000", "P5103000", "P5203000", "P6003000", "EP173000",
  ]);

  function removeCatalogueProducts() {
    if (!state.catalog || typeof state.catalog !== "object") return;
    Object.entries(state.catalog).forEach(([key, product]) => {
      const sku = String(product?.sku || product?.stockCode || "").trim();
      if (REMOVED_SKUS.has(sku)) delete state.catalog[key];
    });
  }

  function removeRenderedSection(floor) {
    const catalogue = document.querySelector(`#${CSS.escape(floor)}OrderSheet .rondo-expanded-catalogue`);
    if (!catalogue) return;
    [...catalogue.querySelectorAll(":scope > .rondo-expanded-group")].forEach((section) => {
      const title = section.querySelector(":scope > .lower-category-title")?.textContent?.trim();
      if (title === REMOVED_TITLE) section.remove();
    });
  }

  const renderer = function renderWithoutRondoFinishingBeads(floor, ...args) {
    removeCatalogueProducts();
    const result = previousRenderer.call(this, floor, ...args);
    removeRenderedSection(floor);
    return result;
  };

  renderer.__rondoFinishingBeadsRemoved20260807 = true;
  window.renderUnifiedFloorSheet = renderer;
  removeCatalogueProducts();

  queueMicrotask(() => {
    const areas = Array.isArray(state?.deliveryAreas) ? state.deliveryAreas : [];
    areas.forEach((area) => {
      if (area?.id) window.renderUnifiedFloorSheet(area.id);
    });
  });
})();
