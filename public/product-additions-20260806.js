(() => {
  const previousRenderer = window.renderUnifiedFloorSheet;
  if (typeof previousRenderer !== "function" || previousRenderer.__productAdditions20260806) return;

  const RONDO_LENGTHS = ["1800", "2400", "2700", "3000", "3600", "6000", "6100"];
  const PRODUCTS = Object.freeze({
    rondo: {
      p40: {
        label: "P40 Int",
        cells: {
          "1800": ["P4001800", "P40 Int", "1800 mm"],
          "2400": ["P4002400", "P40 Int", "2400 mm"],
        },
      },
      casing: {
        label: "Metal Casing Bead 10 mm",
        cells: {
          "2400": ["P0502400", "Metal Casing Bead 10 mm", "2400 mm"],
          "2700": ["P0502700", "Metal Casing Bead 10 mm", "2700 mm"],
          "3000": ["P0503000", "Metal Casing Bead 10 mm", "3000 mm"],
          "3600": ["P0503600", "Metal Casing Bead 10 mm", "3600 mm"],
        },
      },
    },
    fasteners: [
      ["Self-Drilling Bugle 25 mm", "CSDBUZY0625-PWR"],
      ["Self-Drilling Bugle 32 mm", "CSDBUZY0632-PWR"],
      ["Self-Drilling Bugle 41 mm", "CSDBUZY0641-PWR"],
    ],
  });

  function slug(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function keyFor(sku) {
    return `product-addition-${slug(sku)}`;
  }

  function registerProduct(sku, label, detail = "") {
    if (!state.catalog || typeof state.catalog !== "object") state.catalog = {};
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
    return key;
  }

  function registerProducts() {
    Object.values(PRODUCTS.rondo).forEach((definition) => {
      Object.values(definition.cells).forEach(([sku, label, detail]) => registerProduct(sku, label, detail));
    });
    PRODUCTS.fasteners.forEach(([label, sku]) => registerProduct(sku, label));
  }

  function replaceRondoRow(floor, tbody, definition, aliases) {
    const rows = [...tbody.querySelectorAll("tr")];
    let row = rows.find((candidate) => {
      const label = candidate.querySelector("th")?.textContent?.trim().toLowerCase() || "";
      return aliases.some((alias) => label === alias.toLowerCase());
    });

    if (!row) {
      row = document.createElement("tr");
      tbody.append(row);
    }

    row.replaceChildren();
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = definition.label;
    row.append(name);

    RONDO_LENGTHS.forEach((length) => {
      const entry = definition.cells[length];
      row.append(createQuantityCell(floor, entry ? keyFor(entry[0]) : null));
    });
  }

  function patchRondo(floor) {
    const tbody = document.querySelector(`#${CSS.escape(floor)}OrderSheet .rondo-category .rondo-table tbody`);
    if (!tbody) return;
    replaceRondoRow(floor, tbody, PRODUCTS.rondo.p40, ["P40 Int"]);
    replaceRondoRow(floor, tbody, PRODUCTS.rondo.casing, ["Metal Casing Bead 10 mm", "PVC Casing Bead 10 mm"]);
  }

  function makeFastenerRow(floor, label, sku, first) {
    const row = document.createElement("tr");
    row.className = "self-drilling-bugle-row";
    if (first) row.style.borderTop = "1px solid #aeb6b4";

    const name = document.createElement("th");
    name.scope = "row";
    name.colSpan = 2;
    name.textContent = label;
    row.append(name, createQuantityCell(floor, keyFor(sku)));
    return row;
  }

  function patchFasteners(floor) {
    const tbody = document.querySelector(`#${CSS.escape(floor)}OrderSheet .fasteners-category .fasteners-table tbody`);
    if (!tbody) return;
    tbody.querySelectorAll(".self-drilling-bugle-row").forEach((row) => row.remove());

    const nailsHeader = [...tbody.querySelectorAll("tr")].find((row) => {
      const first = row.querySelector("th")?.textContent?.trim().toLowerCase();
      return first === "nails";
    });

    const fragment = document.createDocumentFragment();
    PRODUCTS.fasteners.forEach(([label, sku], index) => fragment.append(makeFastenerRow(floor, label, sku, index === 0)));
    if (nailsHeader) tbody.insertBefore(fragment, nailsHeader);
    else tbody.append(fragment);
  }

  const renderer = function renderWithProductAdditions(floor, ...args) {
    registerProducts();
    const result = previousRenderer.call(this, floor, ...args);
    patchRondo(floor);
    patchFasteners(floor);
    return result;
  };

  renderer.__productAdditions20260806 = true;
  window.renderUnifiedFloorSheet = renderer;

  registerProducts();
  queueMicrotask(() => {
    const areas = Array.isArray(state?.deliveryAreas) ? state.deliveryAreas : [];
    areas.forEach((area) => {
      if (area?.id) window.renderUnifiedFloorSheet(area.id);
    });
  });
})();
