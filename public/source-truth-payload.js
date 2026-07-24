(() => {
  installCatalogueStyles();

  buildFloorPayload = function buildSourceTruthFloorPayload(floor) {
    const totals = new Map();
    [...state.quantities[floor].entries()]
      .filter(([, quantity]) => quantity > 0)
      .forEach(([key, quantity]) => {
        const product = state.catalog[key];
        const sku = String(product?.sku || "").trim();
        if (sku && sku !== "__UNAVAILABLE__") totals.set(sku, (totals.get(sku) || 0) + quantity);
      });
    (state.otherMaterials[floor] || [])
      .filter((item) => item.quantity > 0)
      .forEach((item) => totals.set(item.sku, (totals.get(item.sku) || 0) + item.quantity));
    return {
      items: [],
      otherMaterials: [...totals.entries()].map(([sku, quantity]) => ({ sku, quantity })),
    };
  };

  const originalApplyPayload = applyPayload;
  applyPayload = function applySourceTruthPayload(payload) {
    const next = typeof structuredClone === "function"
      ? structuredClone(payload)
      : JSON.parse(JSON.stringify(payload || {}));
    Object.values(next.floors || {}).forEach((area) => {
      const restoredItems = [];
      const remainingAdditional = [];
      (area.otherMaterials || []).forEach((item) => {
        const match = Object.entries(state.catalog || {}).find(([, product]) =>
          String(product?.sku || "").toUpperCase() === String(item?.sku || "").toUpperCase()
        );
        if (match) restoredItems.push({ key: match[0], quantity: Number(item.quantity || 0) });
        else remainingAdditional.push(item);
      });
      area.items = [...(area.items || []), ...restoredItems];
      area.otherMaterials = remainingAdditional;
    });
    return originalApplyPayload(next);
  };

  const previousRenderer = window.renderUnifiedFloorSheet;
  window.renderUnifiedFloorSheet = function renderSourceTruthOrder(floor, ...args) {
    const result = previousRenderer.call(this, floor, ...args);
    reorderPartiwall(floor);
    refineFasteners(floor);
    mergeAcousticWeights(floor);
    mergeInsulationTypes(floor);
    removeEmptyRondo6100(floor);
    renameRondoProductHeader(floor);
    return result;
  };

  function reorderPartiwall(floor) {
    const body = document.querySelector(`#${CSS.escape(floor)}OrderSheet .partiwall-table tbody`);
    if (!body) return;
    const labels = [
      "Aluminium Clips Angled (each)",
      "Aluminium Clips Flat (each)",
      "50mm Partiwall Batt (3 Pack)",
      "16mm Small Head DP",
      "25mm Coarse NP",
      "32mm Coarse NP",
      "38mm Laminating",
    ];
    const rows = [...body.querySelectorAll("tr")];
    labels.forEach((label) => {
      const row = rows.find((candidate) => candidate.textContent.includes(label));
      if (row) body.append(row);
    });
  }

  function refineFasteners(floor) {
    const table = document.querySelector(`#${CSS.escape(floor)}OrderSheet .fasteners-table`);
    if (!table) return;

    [...table.querySelectorAll("tbody > tr")].forEach((row) => {
      const firstText = normalise(row.cells[0]?.textContent);
      if (firstText === "SCREWS") {
        row.remove();
        return;
      }
      if (firstText === "LOOSE") setMatrixHeader(row, "Loose Screws", ["25 mm", "32 mm"]);
      if (firstText === "COLLATED") setMatrixHeader(row, "Collated Screws", ["25 mm", "32 mm"]);
    });

    const nailHeader = [...table.querySelectorAll("tbody > tr")]
      .find((row) => normalise(row.cells[0]?.textContent) === "NAILS");
    if (nailHeader) setMatrixHeader(nailHeader, "Nails", ["30 mm", "40 mm"]);
  }

  function setMatrixHeader(row, title, columns) {
    row.replaceChildren();
    row.className = "lower-subheader lower-matrix-header";
    [title, ...columns].forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      row.append(th);
    });
  }

  function mergeAcousticWeights(floor) {
    const table = document.querySelector(`#${CSS.escape(floor)}OrderSheet .acoustics-table`);
    if (!table) return;

    const rows = [...table.querySelectorAll("tbody > tr:not(.lower-subheader)")];
    mergeRepeatedFirstColumn(rows, "acoustic-weight-cell");
  }

  function mergeInsulationTypes(floor) {
    const table = document.querySelector(`#${CSS.escape(floor)}OrderSheet .insulation-table`);
    if (!table) return;

    const rows = [...table.querySelectorAll("tbody > tr:not(.lower-subheader)")];
    mergeRepeatedFirstColumn(rows, "insulation-type-cell");
  }

  function mergeRepeatedFirstColumn(rows, className) {
    for (let index = 0; index < rows.length;) {
      const firstCell = rows[index].querySelector(":scope > th:first-child");
      if (!firstCell) {
        index += 1;
        continue;
      }
      const value = normalise(firstCell.textContent);
      let end = index + 1;
      while (end < rows.length) {
        const nextCell = rows[end].querySelector(":scope > th:first-child");
        if (!nextCell || normalise(nextCell.textContent) !== value) break;
        end += 1;
      }
      const span = end - index;
      if (span > 1) {
        firstCell.rowSpan = span;
        firstCell.classList.add(className);
        for (let rowIndex = index + 1; rowIndex < end; rowIndex += 1) {
          rows[rowIndex].querySelector(":scope > th:first-child")?.remove();
        }
      }
      index = end;
    }
  }

  function removeEmptyRondo6100(floor) {
    const table = document.querySelector(`#${CSS.escape(floor)}OrderSheet .rondo-table`);
    if (!table) return;
    const header = [...table.querySelectorAll("tbody > tr")]
      .find((row) => [...row.cells].some((cell) => normalise(cell.textContent) === "6100"));
    if (!header) return;
    const columnIndex = [...header.cells].findIndex((cell) => normalise(cell.textContent) === "6100");
    if (columnIndex < 0) return;
    table.querySelectorAll("tbody > tr").forEach((row) => row.cells[columnIndex]?.remove());
    table.querySelector(`colgroup col:nth-child(${columnIndex + 1})`)?.remove();
  }

  function renameRondoProductHeader(floor) {
    const table = document.querySelector(`#${CSS.escape(floor)}OrderSheet .rondo-table`);
    const heading = table?.querySelector(".lower-matrix-header th:first-child");
    if (heading) heading.textContent = "Product";
  }

  function installCatalogueStyles() {
    if (document.getElementById("catalogueFinalRefinementStyles")) return;
    const style = document.createElement("style");
    style.id = "catalogueFinalRefinementStyles";
    style.textContent = `
      .fasteners-table tbody>tr:first-child{display:table-row!important}
      .fasteners-table .lower-group-heading th{font-size:11px!important;line-height:24px!important}
      .fasteners-table .lower-group-heading th::before,.fasteners-table .lower-group-heading th::after,.fasteners-table tbody>tr:nth-child(2) th::before,.fasteners-table tbody>tr:nth-child(2) th::after,.fasteners-table tbody>tr:nth-child(6) th::before,.fasteners-table tbody>tr:nth-child(6) th::after{display:none!important;content:none!important}
      .fasteners-table .lower-matrix-header th:first-child{text-align:left!important}
      .fasteners-table .lower-matrix-header th:not(:first-child){text-align:center!important}
      .fasteners-table th{overflow:visible!important;text-overflow:clip!important}
      .insulation-table col:nth-child(1){width:32%!important}
      .insulation-table col:nth-child(2){width:28%!important}
      .insulation-table col:nth-child(3),.insulation-table col:nth-child(4){width:20%!important}
      .insulation-table .lower-item-detail{overflow:visible!important;text-overflow:clip!important;white-space:nowrap!important;text-align:center!important}
      .insulation-table .lower-matrix-header th:nth-child(2){text-align:center!important}
      .insulation-table .insulation-type-cell{vertical-align:middle!important;text-align:left!important}
      .acoustics-table .lower-item-detail{text-align:center!important}
      .acoustics-table .acoustic-weight-cell{vertical-align:middle!important;text-align:left!important}
      .rondo-table col:first-child{width:36%!important}
      .rondo-table .lower-matrix-header th:not(:first-child),.rondo-table td{text-align:center!important}
    `;
    document.head.append(style);
  }

  function normalise(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
  }
})();