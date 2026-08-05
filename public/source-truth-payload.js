(() => {
  installCatalogueStyles();
  refineInterface();
  refineValidationMessage();

  function ensureAreaCollections(areaId) {
    if (!state.quantities || typeof state.quantities !== "object") state.quantities = {};
    if (!state.otherMaterials || typeof state.otherMaterials !== "object") state.otherMaterials = {};
    if (!(state.quantities[areaId] instanceof Map)) state.quantities[areaId] = new Map();
    if (!Array.isArray(state.otherMaterials[areaId])) state.otherMaterials[areaId] = [];
    return {
      quantities: state.quantities[areaId],
      otherMaterials: state.otherMaterials[areaId],
    };
  }

  buildFloorPayload = function buildSourceTruthFloorPayload(areaId) {
    const { quantities, otherMaterials } = ensureAreaCollections(areaId);
    return {
      items: [...quantities.entries()]
        .filter(([, quantity]) => Number(quantity) > 0)
        .map(([key, quantity]) => ({ key, quantity: Number(quantity) })),
      otherMaterials: otherMaterials
        .filter((item) => Number(item?.quantity) > 0)
        .map((item) => ({ sku: item.sku, quantity: Number(item.quantity) })),
    };
  };

  const originalBuildPayload = buildPayload;
  buildPayload = function buildSourceTruthPayload(...args) {
    if (Array.isArray(state.deliveryAreas)) {
      state.deliveryAreas.forEach((area) => ensureAreaCollections(area.id));
    }
    const payload = originalBuildPayload.apply(this, args);
    if (state.account?.role === "admin") payload.customerAccountId = state.adminOrderAccountId || null;
    return payload;
  };

  const originalApplyPayload = applyPayload;
  applyPayload = function applySourceTruthPayload(payload) {
    const next = typeof structuredClone === "function"
      ? structuredClone(payload)
      : JSON.parse(JSON.stringify(payload || {}));

    // Editable drafts follow today's catalogue so newly standardised SKUs return
    // to their grid cells. A submitted order snapshot must preserve the original
    // distinction between grid products and manually added products.
    if (globalThis.BPS_ORDER_READONLY) return originalApplyPayload(next);

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
    ensureAreaCollections(floor);
    const result = previousRenderer.call(this, floor, ...args);
    reorderPartiwall(floor);
    rebuildFastenerRows(floor);
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
        if (error && /Australian mobile number/i.test(String(error.message || ""))) error.message = "Enter a valid number.";
        throw error;
      }
    };
    refinedValidateForm.__genericPhoneValidation = true;
    validateForm = refinedValidateForm;
  }

  function reorderPartiwall(floor) {
    const body = document.querySelector(`#${CSS.escape(floor)}OrderSheet .partiwall-table tbody`);
    if (!body) return;
    const labels = ["Aluminium Clips Angled (each)", "Aluminium Clips Flat (each)", "50mm Partiwall Batt (3 Pack)", "16mm Small Head DP", "25mm Coarse NP", "32mm Coarse NP", "38mm Laminating"];
    const rows = [...body.querySelectorAll("tr")];
    labels.forEach((label) => {
      const row = rows.find((candidate) => candidate.textContent.includes(label));
      if (row) body.append(row);
    });
  }

  function fastenerMatrixLabel(value) {
    return String(value || "")
      .replace(/^(?:Loose|Collated)\s+Screws?\s*/i, "")
      .replace(/^(?:Loose|Collated)\s*-\s*/i, "")
      .replace(/^(?:Loose|Collated)(?=(?:Needle|Coarse))/i, "")
      .replace(/^\s*-\s*/, "")
      .replace(/\s*(25|32)\s*mm\s*$/i, "")
      .trim();
  }

  function createMatrixHeader(title, columns) {
    const row = document.createElement("tr");
    row.className = "lower-subheader lower-matrix-header";
    [title, ...columns].forEach((text) => {
      const cell = document.createElement("th");
      cell.textContent = text;
      row.append(cell);
    });
    return row;
  }

  function rebuildFastenerRows(floor) {
    const tbody = document.querySelector(`#${CSS.escape(floor)}OrderSheet .fasteners-table tbody`);
    if (!tbody) return;

    const output = [];
    let section = "";

    [...tbody.rows].forEach((row) => {
      const firstCell = row.cells[0];
      const firstText = normalise(firstCell?.textContent);

      if (firstText === "SCREWS") return;

      if (firstText === "LOOSE" || firstText === "LOOSE SCREWS") {
        section = "LOOSE";
        output.push(createMatrixHeader("Loose Screws", ["25 mm", "32 mm"]));
        return;
      }

      if (firstText === "COLLATED" || firstText === "COLLATED SCREWS") {
        section = "COLLATED";
        output.push(createMatrixHeader("Collated Screws", ["25 mm", "32 mm"]));
        return;
      }

      if (firstText === "NAILS") {
        section = "NAILS";
        output.push(createMatrixHeader("Nails", ["30 mm", "40 mm"]));
        return;
      }

      if (section === "LOOSE" || section === "COLLATED") {
        const labelCell = row.querySelector(":scope > th:first-child");
        if (labelCell) labelCell.textContent = fastenerMatrixLabel(labelCell.textContent);
      }

      output.push(row);
    });

    tbody.replaceChildren(...output);
  }

  globalThis.BpsFastenerMatrixLabels = Object.freeze({ fastenerMatrixLabel });

  function mergeAcousticWeights(floor) {
    const table = document.querySelector(`#${CSS.escape(floor)}OrderSheet .acoustics-table`);
    if (table) mergeRepeatedFirstColumn([...table.querySelectorAll("tbody > tr:not(.lower-subheader)")], "acoustic-weight-cell");
  }

  function mergeInsulationTypes(floor) {
    const table = document.querySelector(`#${CSS.escape(floor)}OrderSheet .insulation-table`);
    if (table) mergeRepeatedFirstColumn([...table.querySelectorAll("tbody > tr:not(.lower-subheader)")], "insulation-type-cell");
  }

  function formatInsulationRatings(floor) {
    document.querySelectorAll(`#${CSS.escape(floor)}OrderSheet .insulation-table .lower-item-detail`).forEach((cell) => {
      cell.textContent = String(cell.textContent || "").replace(/90\s*mm/gi, "90 mm");
    });
  }

  function mergeRepeatedFirstColumn(rows, className) {
    for (let index = 0; index < rows.length;) {
      const firstCell = rows[index].querySelector(":scope > th:first-child");
      if (!firstCell) { index += 1; continue; }
      const value = normalise(firstCell.textContent);
      let end = index + 1;
      while (end < rows.length) {
        const nextCell = rows[end].querySelector(":scope > th:first-child");
        if (!nextCell || normalise(nextCell.textContent) !== value) break;
        end += 1;
      }
      if (end - index > 1) {
        firstCell.rowSpan = end - index;
        firstCell.classList.add(className);
        for (let rowIndex = index + 1; rowIndex < end; rowIndex += 1) rows[rowIndex].querySelector(":scope > th:first-child")?.remove();
      }
      index = end;
    }
  }

  function removeEmptyRondo6100(floor) {
    const table = document.querySelector(`#${CSS.escape(floor)}OrderSheet .rondo-table`);
    if (!table) return;
    const header = [...table.querySelectorAll("tbody > tr")].find((row) => [...row.cells].some((cell) => normalise(cell.textContent) === "6100"));
    if (!header) return;
    const columnIndex = [...header.cells].findIndex((cell) => normalise(cell.textContent) === "6100");
    if (columnIndex < 0) return;
    table.querySelectorAll("tbody > tr").forEach((row) => row.cells[columnIndex]?.remove());
    table.querySelector(`colgroup col:nth-child(${columnIndex + 1})`)?.remove();
  }

  function renameRondoProductHeader(floor) {
    const heading = document.querySelector(`#${CSS.escape(floor)}OrderSheet .rondo-table .lower-matrix-header th:first-child`);
    if (heading) heading.textContent = "Product";
  }

  function installCatalogueStyles() {
    if (document.getElementById("catalogueFinalRefinementStyles")) return;
    const style = document.createElement("style");
    style.id = "catalogueFinalRefinementStyles";
    style.textContent = `.fasteners-table tbody>tr:first-child{display:table-row!important}.fasteners-table .lower-matrix-header th:first-child{text-align:left!important}.fasteners-table .lower-matrix-header th:not(:first-child){text-align:center!important}.lower-catalogue-table .lower-subheader>*{background:#c4cac8!important;border-bottom-color:#aab3b0!important}.lower-catalogue-grid .unavailable-cell,.lower-catalogue-grid .quantity-cell.is-unavailable,.unified-board-table .unavailable-cell,.unified-board-table .quantity-cell.is-unavailable{background:#e1e5e4!important;background-image:none!important}.insulation-table col:nth-child(1){width:32%!important}.insulation-table col:nth-child(2){width:28%!important}.insulation-table col:nth-child(3),.insulation-table col:nth-child(4){width:20%!important}.insulation-table .lower-item-detail,.acoustics-table .lower-item-detail{text-align:center!important}.insulation-table .insulation-type-cell,.acoustics-table .acoustic-weight-cell{vertical-align:middle!important;text-align:left!important}.rondo-table col:first-child{width:36%!important}.rondo-table .lower-matrix-header th:not(:first-child),.rondo-table td{text-align:center!important}.required-date-inline{display:flex;align-items:stretch;min-width:0;height:39px;background:#fff}.required-date-inline>.date-input-shell{flex:1 1 210px;min-width:190px}.future-confirmation[hidden]{display:none!important}.future-confirmation:not([hidden]){flex:0 0 auto;display:inline-flex!important;align-items:center;gap:6px;max-width:230px;margin:0!important;padding:0 8px!important;color:#795600;background:#fff8df!important;border:0!important;border-left:1px solid #e5cf8b!important;border-radius:0!important;font-size:10px!important;font-weight:600;line-height:1.2}.future-confirmation input[type="checkbox"]{width:14px!important;height:14px!important;accent-color:var(--bell-maroon)}@media(max-width:900px){.required-date-inline{height:auto;min-height:39px;flex-wrap:wrap}.required-date-inline>.date-input-shell{flex-basis:100%}.future-confirmation:not([hidden]){max-width:none;width:100%;border-left:0!important;border-top:1px solid #e5cf8b!important}}`;
    document.head.append(style);
  }

  function normalise(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
  }
})();
