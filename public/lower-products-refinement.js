(() => {
  const originalRenderer = window.renderUnifiedFloorSheet;
  if (typeof originalRenderer !== "function" || originalRenderer.__lowerCatalogueRefined) return;

  const ACCESSORY_PATTERN = /^(Stud Adhesive|Paper Tape|Fibreglass Tape)$/i;
  const RONDO_LENGTHS = ["1800", "2400", "2700", "3000", "3600", "6000", "6100"];

  const refinedRenderer = function renderUnifiedFloorSheetWithLowerCatalogue(floor, ...args) {
    const result = originalRenderer.call(this, floor, ...args);
    renderLowerCatalogue(floor);
    return result;
  };
  refinedRenderer.__lowerCatalogueRefined = true;
  window.renderUnifiedFloorSheet = refinedRenderer;

  function renderLowerCatalogue(floor) {
    const root = document.getElementById(`${floor}OrderSheet`);
    const currentGrid = root?.querySelector(".pdf-lower-grid");
    const sections = state.layout?.sections;
    if (!root || !currentGrid || !sections) return;

    const compounds = sections.compounds?.rows || [];
    const compoundRows = compounds.filter((row) => !ACCESSORY_PATTERN.test(String(row.label || "")));
    const accessoryRows = compounds.filter((row) => ACCESSORY_PATTERN.test(String(row.label || "")));

    const grid = document.createElement("div");
    grid.className = "lower-catalogue-grid";

    grid.append(
      makeColumn(
        renderListCategory(floor, "COMPOUNDS", compoundRows, "compounds-category"),
      ),
      makeColumn(
        renderListCategory(floor, "ACCESSORIES", accessoryRows, "accessories-category"),
        renderFastenersCategory(floor, sections.screws, sections.nails),
      ),
      makeColumn(
        renderRondoCategory(floor, sections.rondo),
        renderCornicesCategory(floor, sections.cove, sections.decorative),
      ),
      makeColumn(
        renderThermalCategory(floor, sections.insulation?.thermalRows || []),
        renderAcousticCategory(floor, sections.insulation?.acousticRows || []),
        renderPartiwallCategory(
          floor,
          sections.partiwall,
          sections.partiwall_accessories,
          sections.partiwall_screws,
        ),
      ),
    );

    currentGrid.replaceWith(grid);
  }

  function makeColumn(...sections) {
    const column = document.createElement("div");
    column.className = "lower-catalogue-column";
    sections.filter(Boolean).forEach((section) => column.append(section));
    return column;
  }

  function makeCategory(title, className = "") {
    const section = document.createElement("section");
    section.className = `lower-catalogue-section ${className}`.trim();

    const heading = document.createElement("h3");
    heading.className = "lower-category-title";
    heading.textContent = title;
    section.append(heading);
    return section;
  }

  function makeTable(className = "") {
    const table = document.createElement("table");
    table.className = `lower-catalogue-table ${className}`.trim();
    return table;
  }

  function addColgroup(table, widths) {
    const colgroup = document.createElement("colgroup");
    widths.forEach((width) => {
      const col = document.createElement("col");
      col.style.width = `${width}%`;
      colgroup.append(col);
    });
    table.append(colgroup);
  }

  function renderListCategory(floor, title, rows, className = "") {
    const section = makeCategory(title, className);
    const table = makeTable("lower-list-table");
    addColgroup(table, [66, 20, 14]);
    const tbody = document.createElement("tbody");

    (rows || []).forEach((row) => {
      const tr = document.createElement("tr");
      const name = document.createElement("th");
      name.scope = "row";
      name.textContent = row.label || "";
      const detail = document.createElement("td");
      detail.className = "lower-item-detail";
      detail.textContent = row.detail || "";
      tr.append(name, detail, createQuantityCell(floor, row.key || null));
      tbody.append(tr);
    });

    table.append(tbody);
    section.append(table);
    return section;
  }

  function renderFastenersCategory(floor, screws, nails) {
    const section = makeCategory("FASTENERS", "fasteners-category");
    const table = makeTable("fasteners-table");
    addColgroup(table, [64, 18, 18]);
    const tbody = document.createElement("tbody");

    appendMatrixHeader(tbody, "Screws", screws?.columns || ["25 mm", "32 mm"]);

    let currentGroup = "";
    (screws?.rows || []).forEach((row) => {
      const match = String(row.label || "").match(/^(Loose|Collated)\s*-\s*(.+)$/i);
      const group = match?.[1] || "Screws";
      const label = match?.[2] || row.label || "";
      if (group !== currentGroup) {
        appendSubheading(tbody, group, 3);
        currentGroup = group;
      }
      appendMatrixRow(tbody, floor, label, row.cells || []);
    });

    appendMatrixHeader(tbody, "Nails", nails?.columns || ["30 mm", "40 mm"]);
    (nails?.rows || []).forEach((row) => appendMatrixRow(tbody, floor, row.label || "", row.cells || []));

    table.append(tbody);
    section.append(table);
    return section;
  }

  function appendMatrixHeader(tbody, title, columns) {
    const tr = document.createElement("tr");
    tr.className = "lower-subheader lower-matrix-header";
    const titleCell = document.createElement("th");
    titleCell.textContent = title;
    tr.append(titleCell);
    (columns || []).forEach((column) => {
      const th = document.createElement("th");
      th.textContent = column;
      tr.append(th);
    });
    tbody.append(tr);
  }

  function appendSubheading(tbody, title, colspan) {
    const tr = document.createElement("tr");
    tr.className = "lower-subheader lower-group-heading";
    const th = document.createElement("th");
    th.colSpan = colspan;
    th.textContent = title;
    tr.append(th);
    tbody.append(tr);
  }

  function appendMatrixRow(tbody, floor, label, cells) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = label;
    tr.append(th);
    (cells || []).forEach((key) => tr.append(createQuantityCell(floor, key || null)));
    tbody.append(tr);
  }

  function renderRondoCategory(floor, definition) {
    const section = makeCategory("RONDO/PVC", "rondo-category");
    const table = makeTable("rondo-table");
    addColgroup(table, [34, 9.43, 9.43, 9.43, 9.43, 9.43, 9.43, 9.42]);
    const tbody = document.createElement("tbody");
    appendMatrixHeader(tbody, "Type", RONDO_LENGTHS);

    const products = new Map();
    (definition?.rows || []).forEach((row) => {
      const label = String(row.label || "").trim();
      const length = String(row.detail || "").match(/\d+/)?.[0] || "";
      if (!products.has(label)) products.set(label, new Map());
      if (length) products.get(label).set(length, row.key);
    });

    products.forEach((lengthMap, label) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      th.textContent = label;
      tr.append(th);
      RONDO_LENGTHS.forEach((length) => tr.append(createQuantityCell(floor, lengthMap.get(length) || null)));
      tbody.append(tr);
    });

    table.append(tbody);
    section.append(table);
    return section;
  }

  function renderCornicesCategory(floor, cove, decorative) {
    const section = makeCategory("CORNICES", "cornices-category");

    const coveTable = makeTable("cornice-cove-table");
    addColgroup(coveTable, [46, 18, 18, 18]);
    const coveBody = document.createElement("tbody");
    appendMatrixHeader(coveBody, "Sheetrock® Cove", cove?.columns || ["55 mm", "75 mm", "90 mm"]);
    (cove?.rows || []).forEach((row) => appendMatrixRow(coveBody, floor, row.label || "", row.cells || []));
    coveTable.append(coveBody);
    section.append(coveTable);

    const decorativeTable = makeTable("decorative-cornice-table");
    addColgroup(decorativeTable, [41, 9, 41, 9]);
    const decorativeBody = document.createElement("tbody");
    appendSubheading(decorativeBody, "Decorative Cornice 4200 mm", 4);
    const rows = decorative?.rows || [];
    for (let index = 0; index < rows.length; index += 2) {
      const tr = document.createElement("tr");
      [rows[index], rows[index + 1]].forEach((row) => {
        if (row) {
          const th = document.createElement("th");
          th.scope = "row";
          th.textContent = row.label || "";
          tr.append(th, createQuantityCell(floor, row.key || null));
        } else {
          const emptyName = document.createElement("td");
          const emptyQuantity = document.createElement("td");
          emptyName.className = "empty-cornice-cell";
          emptyQuantity.className = "empty-cornice-cell";
          tr.append(emptyName, emptyQuantity);
        }
      });
      decorativeBody.append(tr);
    }
    decorativeTable.append(decorativeBody);
    section.append(decorativeTable);
    return section;
  }

  function renderThermalCategory(floor, rows) {
    const section = makeCategory("INSULATIONS", "insulation-category");
    const table = makeTable("insulation-table");
    addColgroup(table, [45, 13, 21, 21]);
    const tbody = document.createElement("tbody");
    appendMatrixHeader(tbody, "Type", ["R", "430 mm", "580 mm"]);

    (rows || []).forEach((row) => {
      const match = String(row.label || "").match(/^(Wall|Ceiling)\s+R?([\d.]+)/i);
      const tr = document.createElement("tr");
      const type = document.createElement("th");
      type.scope = "row";
      type.textContent = match?.[1] || row.label || "";
      const rating = document.createElement("td");
      rating.className = "lower-item-detail";
      rating.textContent = match?.[2] || "";
      tr.append(type, rating);
      (row.cells || []).forEach((key) => tr.append(createQuantityCell(floor, key || null)));
      tbody.append(tr);
    });

    table.append(tbody);
    section.append(table);
    return section;
  }

  function renderAcousticCategory(floor, rows) {
    const section = makeCategory("ACOUSTICS", "acoustics-category");
    const table = makeTable("acoustics-table");
    addColgroup(table, [30, 28, 21, 21]);
    const tbody = document.createElement("tbody");
    appendMatrixHeader(tbody, "kg", ["mm", "430 mm", "580 mm"]);

    (rows || []).forEach((row) => {
      const match = String(row.label || "").match(/^(\d+)\s*kg\s*-\s*(\d+)\s*mm/i);
      const tr = document.createElement("tr");
      const kg = document.createElement("th");
      kg.scope = "row";
      kg.textContent = match?.[1] || row.label || "";
      const mm = document.createElement("td");
      mm.className = "lower-item-detail";
      mm.textContent = match?.[2] || "";
      tr.append(kg, mm);
      (row.cells || []).forEach((key) => tr.append(createQuantityCell(floor, key || null)));
      tbody.append(tr);
    });

    table.append(tbody);
    section.append(table);
    return section;
  }

  function renderPartiwallCategory(floor, matrix, accessories, screws) {
    const section = makeCategory("PARTIWALL®", "partiwall-category");
    const table = makeTable("partiwall-table");
    addColgroup(table, [62, 19, 19]);
    const tbody = document.createElement("tbody");
    appendMatrixHeader(tbody, "Product", matrix?.columns || ["3000", "3600"]);
    (matrix?.rows || []).forEach((row) => appendMatrixRow(tbody, floor, row.label || "", row.cells || []));

    [...(accessories?.rows || []), ...(screws?.rows || [])].forEach((row) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      th.colSpan = 2;
      th.textContent = row.label || "";
      tr.append(th, createQuantityCell(floor, row.key || null));
      tbody.append(tr);
    });

    table.append(tbody);
    section.append(table);
    return section;
  }
})();