(() => {
  const previousRenderer = window.renderUnifiedFloorSheet;
  if (typeof previousRenderer !== "function" || previousRenderer.__partiwallWallTrackLabel) return;

  const SKU = "14003000";
  const LABEL = "28 mm Wall Track (C Channel)";

  function updateCatalogue() {
    if (!state?.catalog) return;
    Object.values(state.catalog).forEach((product) => {
      const sku = String(product?.sku || product?.stockCode || "").trim();
      if (sku !== SKU) return;
      product.label = LABEL;
      product.description = LABEL;
    });
  }

  function updateLayout() {
    const section = state.layout?.sections?.partiwall;
    if (!section) return;
    (section.rows || []).forEach((row) => {
      const cells = Array.isArray(row?.cells) ? row.cells : [];
      const containsSku = cells.some((key) => {
        const product = key ? state.catalog?.[key] : null;
        return String(product?.sku || product?.stockCode || "").trim() === SKU;
      });
      if (containsSku || /^140\s+Wall\s+Track/i.test(String(row?.label || ""))) row.label = LABEL;
    });
  }

  function updateRenderedRow(floor) {
    const tbody = document.querySelector(`#${CSS.escape(floor)}OrderSheet .partiwall-category table tbody`);
    if (!tbody) return;
    [...tbody.querySelectorAll("tr")].forEach((row) => {
      const heading = row.querySelector("th");
      if (!heading) return;
      if (/^140\s+Wall\s+Track/i.test(heading.textContent.trim())) heading.textContent = LABEL;
    });
  }

  const renderer = function renderWithPartiwallWallTrackLabel(floor, ...args) {
    updateCatalogue();
    updateLayout();
    const result = previousRenderer.call(this, floor, ...args);
    updateRenderedRow(floor);
    return result;
  };

  renderer.__partiwallWallTrackLabel = true;
  window.renderUnifiedFloorSheet = renderer;
  updateCatalogue();
  updateLayout();

  queueMicrotask(() => {
    const areas = Array.isArray(state?.deliveryAreas) ? state.deliveryAreas : [];
    areas.forEach((area) => {
      if (area?.id) window.renderUnifiedFloorSheet(area.id);
    });
  });
})();
