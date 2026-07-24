(() => {
  installCatalogueStyles();
  refineInterface();
  refineValidationMessage();

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
    formatInsulationRatings(floor);
    removeEmptyRondo6100(floor);
    renameRondoProductHeader(floor);
    return result;
  };

  function refineInterface() {
    document.querySelector("#historyDrawer .drawer-header .eyebrow")?.remove();

    const dateShell = document.querySelector(".date-input-shell");
    const futureConfirmation = document.getElementById("futureDateConfirmation");
    if (dateShell && futureConfirmation && !dateShell.parentElement?.classList.contains("required-date-inline")) {
      const wrapper = document.createElement("div");
      wrapper.className = "required-date-inline";
      dateShell.replaceWith(wrapper);
      wrapper.append(dateShell, futureConfirmation);
      const message = futureConfirmation.querySelector("span");
      if (message) message.textContent = "Required date is 6+ months away. Confirm.";
    }
  }

  function refineValidationMessage() {
    if (typeof validateForm !== "function" || validateForm.__genericPhoneValidation) return;
    const originalValidateForm = validateForm;
    const refinedValidateForm = function refinedValidateForm(...args) {
      try {
        return originalValidateForm.apply(this, args);
      } catch (error) {
        if (error && /Australian mobile number/i.test(String(error.message || ""))) {
          error.message = "Enter a valid number.";
        }
        throw error;
      }
    };
    refinedValidateForm.__genericPhoneValidation = true;
    validateForm = refinedValidateForm;
  }

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

  function formatInsulationRatings(floor) {
    const table = document.querySelector(`#${CSS.escape(floor)}OrderSheet .insulation-table`);
    if (!table) return;
    table.querySelectorAll(".lower-item-detail").forEach((cell) => {
      cell.textContent = String(cell.textContent || "").replace(/90\s*mm/gi, "90 mm");
    });
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
      .lower-catalogue-table .lower-subheader>*{background:#c4cac8!important;border-bottom-color:#aab3b0!important}
      .lower-catalogue-grid .unavailable-cell,.lower-catalogue-grid .quantity-cell.is-unavailable,.unified-board-table .unavailable-cell,.unified-board-table .quantity-cell.is-unavailable{background:#e1e5e4!important;background-image:none!important}
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
      .required-date-inline{display:flex;align-items:stretch;min-width:0;height:39px;background:#fff}
      .required-date-inline>.date-input-shell{flex:1 1 210px;min-width:190px}
      .future-confirmation[hidden]{display:none!important}
      .future-confirmation:not([hidden]){flex:0 0 auto;display:inline-flex!important;align-items:center;gap:6px;max-width:230px;margin:0!important;padding:0 8px!important;color:#795600;background:#fff8df!important;border:0!important;border-left:1px solid #e5cf8b!important;border-radius:0!important;font-size:10px!important;font-weight:600;line-height:1.2;white-space:normal}
      .future-confirmation input[type="checkbox"]{flex:0 0 14px;width:14px!important;height:14px!important;min-height:14px!important;margin:0!important;padding:0!important;accent-color:var(--bell-maroon);box-shadow:none!important}
      .history-controls label{display:inline-flex!important;align-items:center!important;gap:7px!important;font-size:12px}
      .history-controls input[type="checkbox"]{flex:0 0 14px;width:14px!important;height:14px!important;min-height:14px!important;margin:0!important;padding:0!important;accent-color:var(--bell-maroon);box-shadow:none!important}
      @media(max-width:900px){.required-date-inline{height:auto;min-height:39px;flex-wrap:wrap}.required-date-inline>.date-input-shell{flex-basis:100%}.future-confirmation:not([hidden]){min-height:30px;max-width:none;width:100%;border-left:0!important;border-top:1px solid #e5cf8b!important}}
    `;
    document.head.append(style);
  }

  function normalise(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
  }
})();