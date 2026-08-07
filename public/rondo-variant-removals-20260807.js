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
    "66102700",
    "67102400", "67102700",
    "68102700",
    "68107200", "69107200",
    "504036000300", "504036000400",
    "505036000300",
    "506036000300", "506036000400",
    "507036000300",
  ]);

  const COLUMN_RULES = Object.freeze({
    "RONDO WALL FRAMING": [
      ["2400", "2700", "3300"],
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
    "RONDO NOGGIN TRACK 0.70 BMT / 3.6M": [
      ["300 cts", "400 cts"],
    ],
    "RONDO HEAVY-DUTY WALL FRAMING": [
      ["2400", "2700"],
      ["7200"],
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

  function rowLabel(row) {
    return normalise(row?.querySelector("th")?.textContent || row?.children?.[0]?.textContent);
  }

  function expandLeadingCell(row, amount = 1) {
    const firstCell = row?.children?.[0];
    if (!firstCell) return;
    firstCell.colSpan = Math.max(1, Number(firstCell.colSpan || 1) + amount);
  }

  function removeEmbeddedSubgroupColumn(section, subgroupTitle, heading) {
    const groupRow = [...section.querySelectorAll("tr")].find((row) => rowLabel(row) === normalise(subgroupTitle));
    if (!groupRow) return false;

    let header = groupRow.nextElementSibling;
    while (header && !header.classList.contains("lower-matrix-header")) {
      if (header.classList.contains("lower-group-heading")) return false;
      header = header.nextElementSibling;
    }
    if (!header) return false;

    const columnIndex = [...header.children].findIndex((cell, index) =>
      index > 0 && String(cell.textContent || "").trim() === heading,
    );
    if (columnIndex < 1) return false;

    header.children[columnIndex]?.remove();
    expandLeadingCell(header);

    let row = header.nextElementSibling;
    while (row && !row.classList.contains("lower-group-heading")) {
      row.children[columnIndex]?.remove();
      expandLeadingCell(row);
      row = row.nextElementSibling;
    }
    return true;
  }

  function unavailableCellTemplate(table) {
    const cell = [...table.querySelectorAll("td")].find((candidate) => !candidate.querySelector("input"));
    if (!cell) return null;
    const clone = cell.cloneNode(false);
    clone.removeAttribute("id");
    clone.removeAttribute("data-product-key");
    clone.removeAttribute("data-key");
    clone.textContent = "";
    return clone;
  }

  function equaliseWallFramingColumnWidths(table) {
    const header = table.querySelector("tr.lower-matrix-header, thead tr, tbody tr");
    const columnCount = header?.children.length || 0;
    if (columnCount !== 6) return;

    let colgroup = table.querySelector("colgroup");
    if (!colgroup) {
      colgroup = document.createElement("colgroup");
      table.prepend(colgroup);
    }
    colgroup.replaceChildren();

    const productColumn = document.createElement("col");
    productColumn.style.width = "36%";
    colgroup.append(productColumn);

    const lengthWidth = 64 / (columnCount - 1);
    for (let index = 1; index < columnCount; index += 1) {
      const column = document.createElement("col");
      column.style.width = `${lengthWidth}%`;
      colgroup.append(column);
    }
  }

  function consolidateWallFramingStudTables(section) {
    const tables = [...section.querySelectorAll("table")];
    const primary = tables[0];
    const longLengths = tables[1];
    if (!(primary instanceof HTMLTableElement) || !(longLengths instanceof HTMLTableElement)) return;

    const primaryHeader = primary.querySelector("tr.lower-matrix-header, thead tr, tbody tr");
    const longHeader = longLengths.querySelector("tr.lower-matrix-header, thead tr, tbody tr");
    if (!primaryHeader || !longHeader) return;

    const longColumns = [...longHeader.children].slice(1).map((cell) => String(cell.textContent || "").trim());
    if (!longColumns.length || longColumns.some((column) => !["4800", "6000"].includes(column))) return;

    [...longHeader.children].slice(1).forEach((cell) => primaryHeader.append(cell));

    const primaryRows = [...primary.rows].slice(1);
    const longRows = [...longLengths.rows].slice(1);
    const longRowsByLabel = new Map(longRows.map((row) => [rowLabel(row), row]));
    const unavailableTemplate = unavailableCellTemplate(longLengths) || unavailableCellTemplate(primary);

    primaryRows.forEach((row) => {
      const matchingRow = longRowsByLabel.get(rowLabel(row));
      if (matchingRow) {
        [...matchingRow.children].slice(1).forEach((cell) => row.append(cell));
        return;
      }

      longColumns.forEach(() => {
        if (unavailableTemplate) row.append(unavailableTemplate.cloneNode(false));
        else row.append(document.createElement("td"));
      });
    });

    longLengths.remove();
    equaliseWallFramingColumnWidths(primary);
  }

  function removeVariantsFromSection(section) {
    const title = normalise(section.querySelector(".rondo-expanded-title, .lower-category-title, h3")?.textContent);
    const rules = COLUMN_RULES[title];
    if (!rules) return;

    const tables = [...section.querySelectorAll("table")];
    rules.forEach((headings, tableIndex) => removeTableColumns(tables[tableIndex], headings));

    if (title === "RONDO WALL FRAMING") {
      consolidateWallFramingStudTables(section);
      removeEmbeddedSubgroupColumn(section, "TRACKS & DH TRACKS — STANDARD", "3600");
    }

    if (title === "RONDO HEAVY-DUTY WALL FRAMING") {
      removeEmbeddedSubgroupColumn(section, "TRACKS & DH TRACKS HEAVY DUTY", "6000");
    }
  }

  function collapseNailsToSingleSize() {
    document.querySelectorAll(".fasteners-table").forEach((table) => {
      const header = [...table.querySelectorAll("tr.lower-matrix-header")]
        .find((row) => rowLabel(row) === "NAILS");
      if (!header) return;

      const cells = [...header.children];
      const thirty = cells.find((cell) => String(cell.textContent || "").trim() === "30 mm");
      const forty = cells.find((cell) => String(cell.textContent || "").trim() === "40 mm");
      if (forty) forty.remove();
      if (thirty) thirty.colSpan = 2;

      let row = header.nextElementSibling;
      while (row && !row.classList.contains("lower-matrix-header") && !row.classList.contains("lower-group-heading")) {
        if (row.children.length > 2) row.lastElementChild?.remove();
        const quantity = row.children[1];
        if (quantity) quantity.colSpan = 2;
        row = row.nextElementSibling;
      }
    });
  }

  function placeDonnGridImmediatelyAfterDuo() {
    document.querySelectorAll(".rondo-category").forEach((section) => {
      const duo = section.querySelector(".duo-grid-table");
      const donn = section.querySelector(".donn-grid-table");
      if (!duo || !donn || duo.nextElementSibling === donn) return;
      duo.insertAdjacentElement("afterend", donn);
    });
  }

  function apply() {
    purgeCatalogue();
    document.querySelectorAll(".rondo-expanded-group, .lower-catalogue-section").forEach(removeVariantsFromSection);
    collapseNailsToSingleSize();
    placeDonnGridImmediatelyAfterDuo();
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
