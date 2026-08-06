(() => {
  const previousRenderer = window.renderUnifiedFloorSheet;
  if (typeof previousRenderer !== "function" || previousRenderer.__compoundRangeUpdate20260807) return;

  const COMPOUND_RANGE = Object.freeze([
    ["BaseCote 50", "20 kg", "BC5020"],
    ["BaseCote 75", "20 kg", "BC7520"],
    ["Uniflott", "5 kg", "40007195"],
    ["Redibase", "18 kg", "REDIBASE"],
    ["All Purpose Premix", "18 kg", "LCOTE18"],
    ["LiteFinish", "18 kg", "LFINISH18"],
    ["FinalCote", "20 kg", "FCOTE20"],
    ["Cornice Adhesive 50", "20 kg", "CAN5020"],
    ["Cornice Adhesive 90", "20 kg", "CAN9020"],
    ["Masonry Adhesive", "20 kg", "CMASON20"],
    ["Back-Block Adhesive", "20 kg", "BBADHESIVE20"],
    ["Casting Plaster", "20 kg", "CAST20"],
    ["Firesound Sausage", "600 ml", "6026194133"],
  ]);

  const RETIRED_SKUS = new Set(["BC4520", "BC6020", "BC9020", "CAN4520", "CAN6020"]);

  function slug(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function keyFor(sku) {
    return `compound-range-${slug(sku)}`;
  }

  function registerRange() {
    if (!state.catalog || typeof state.catalog !== "object") state.catalog = {};

    Object.entries(state.catalog).forEach(([key, product]) => {
      const sku = String(product?.sku || product?.stockCode || "").trim();
      if (RETIRED_SKUS.has(sku)) delete state.catalog[key];
    });

    COMPOUND_RANGE.forEach(([label, detail, sku]) => {
      const key = keyFor(sku);
      state.catalog[key] = {
        ...(state.catalog[key] || {}),
        sku,
        stockCode: sku,
        label,
        description: label,
        detail,
        mapped: true,
        available: true,
      };
    });
  }

  function updateLayoutSource() {
    const section = state.layout?.sections?.compounds;
    if (!section) return;
    section.rows = COMPOUND_RANGE.map(([label, detail, sku]) => ({
      label,
      detail,
      key: keyFor(sku),
    }));
  }

  function renderRows(floor) {
    const tbody = document.querySelector(`#${CSS.escape(floor)}OrderSheet .compounds-category .compounds-table tbody`);
    if (!tbody) return;

    tbody.querySelectorAll(":scope > tr:not(.lower-subheader)").forEach((row) => row.remove());
    COMPOUND_RANGE.forEach(([label, detail, sku]) => {
      const row = document.createElement("tr");
      const name = document.createElement("th");
      name.scope = "row";
      name.textContent = label;
      const size = document.createElement("td");
      size.className = "lower-item-detail";
      size.textContent = detail;
      row.append(name, size, createQuantityCell(floor, keyFor(sku)));
      tbody.append(row);
    });
  }

  const renderer = function renderWithUpdatedCompoundRange(floor, ...args) {
    const result = previousRenderer.call(this, floor, ...args);
    registerRange();
    updateLayoutSource();
    renderRows(floor);
    return result;
  };

  renderer.__compoundRangeUpdate20260807 = true;
  window.renderUnifiedFloorSheet = renderer;
  registerRange();
  queueMicrotask(() => {
    const areas = Array.isArray(state?.deliveryAreas) ? state.deliveryAreas : [];
    areas.forEach((area) => {
      if (area?.id) window.renderUnifiedFloorSheet(area.id);
    });
  });
})();
