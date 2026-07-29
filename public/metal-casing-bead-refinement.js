(() => {
  const previousRenderer = window.renderUnifiedFloorSheet;
  if (typeof previousRenderer !== "function" || previousRenderer.__metalCasingBeadRefined) return;

  const PRODUCT_KEY = "source-rondo-metal-casing-bead-10-mm-3000";
  const SKU = "P0503000";
  const LABEL = "Metal Casing Bead 10 mm";
  const LENGTHS = ["1800", "2400", "2700", "3000", "3600", "6000", "6100"];

  const refinedRenderer = function renderWithMetalCasingBead(floor, ...args) {
    registerProduct();
    const result = previousRenderer.call(this, floor, ...args);
    insertRondoRow(floor);
    return result;
  };

  refinedRenderer.__metalCasingBeadRefined = true;
  window.renderUnifiedFloorSheet = refinedRenderer;

  function registerProduct() {
    if (!window.state) return;
    if (!state.catalog) state.catalog = {};
    const existing = state.catalog[PRODUCT_KEY] || {};
    state.catalog[PRODUCT_KEY] = {
      ...existing,
      key: PRODUCT_KEY,
      sku: SKU,
      stockCode: SKU,
      label: LABEL,
      description: LABEL,
      detail: "3000 mm",
      mapped: true,
      available: true,
    };
  }

  function insertRondoRow(floor) {
    const root = document.getElementById(`${floor}OrderSheet`);
    const tbody = root?.querySelector(".rondo-table tbody");
    if (!tbody || tbody.querySelector(`[data-product-key="${PRODUCT_KEY}"]`)) return;

    const row = document.createElement("tr");
    row.dataset.productKey = PRODUCT_KEY;

    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = LABEL;
    row.append(heading);

    LENGTHS.forEach((length) => {
      row.append(createQuantityCell(floor, length === "3000" ? PRODUCT_KEY : null));
    });

    const pvcRow = [...tbody.querySelectorAll("tr")].find((candidate) =>
      /PVC\s+Casing\s+Bead\s+10\s*mm/i.test(candidate.textContent || "")
    );

    if (pvcRow) tbody.insertBefore(row, pvcRow);
    else tbody.append(row);
  }
})();
