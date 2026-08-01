(() => {
  const previousRenderer = window.renderUnifiedFloorSheet;
  if (typeof previousRenderer !== "function" || previousRenderer.__rondoHebelCatalogue) return;

  const RONDO = Object.freeze({
    suspended: {
      title: "Suspended Ceiling Grid",
      columns: ["3000", "3600", "6000"],
      rows: [
        ["5mm Suspension Rod", [null, ["12103600", "5mm Suspension Rod", "3600"], null]],
        ["Top Cross Rail", [null, ["12703600", "Top Cross Rail", "3600"], null]],
        ["28mm Furring Channel", [null, null, ["12906000", "28mm Furring Channel", "6000"]]],
        ["28mm Wall Track", [["14003000", "28mm Wall Track", "3000"], null, null]],
      ],
      accessories: [
        ["TCR Clip", "2534"],
        ["Locking Clip", "139"],
        ["Flat Rod Bracket", "274"],
        ["Angle Rod Bracket", "247"],
      ],
    },
    duo: {
      title: "DUO Grid",
      columns: ["1200", "3600"],
      rows: [
        ["5mm Suspension Rod", [null, ["12103600", "5mm Suspension Rod", "3600"]]],
        ["DUO1 Main Tee", [null, ["DUO13600TW10", "DUO1 Main Tee", "3600"]]],
        ["DUO2 Cross Tee", [["DUO21200TW00", "DUO2 Cross Tee", "1200"], null]],
        ["DUO5 Wall Angle", [null, ["DUO53600TW00", "DUO5 Wall Angle", "3600"]]],
      ],
      accessories: [
        ["Rod Spring Clip", "700"],
        ["Flat Rod Bracket", "274"],
      ],
    },
  });

  const HEBEL = Object.freeze({
    panels: {
      columns: ["1800", "2400", "2550", "2700", "2850", "3000", "3300"],
      rows: [
        ["PowerPanel50 50mm", [null, ["99939", "PowerPanel50 50mm", "2400"], null, ["162758", "PowerPanel50 50mm", "2700"], ["162756", "PowerPanel50 50mm", "2850"], ["162760", "PowerPanel50 50mm", "3000"], null]],
        ["PowerPanelXL 75mm", [null, ["118014", "PowerPanelXL 75mm", "2400"], ["118015", "PowerPanelXL 75mm", "2550"], ["118016", "PowerPanelXL 75mm", "2700"], ["118019", "PowerPanelXL 75mm", "2850"], ["118020", "PowerPanelXL 75mm", "3000"], ["126504", "PowerPanelXL 75mm", "3300"]]],
        ["PowerPanel 75mm", [null, null, null, null, null, ["21969", "PowerPanel 75mm", "3000"], ["81462", "PowerPanel 75mm", "3300"]]],
        ["PowerPanel T&G 75mm", [null, null, null, null, null, ["118283", "PowerPanel T&G 75mm", "3000"], ["118284", "PowerPanel T&G 75mm", "3300"]]],
        ["PowerFence 75mm", [["118891", "PowerFence 75mm", "1800"], ["21965", "PowerFence 75mm", "2400"], null, null, null, null, null]],
        ["PowerFloor T&G 75mm", [["21987", "PowerFloor T&G 75mm", "1800"], null, null, null, null, null, null]],
      ],
    },
    compounds: [
      ["Hebel Adhesive", "20 kg", "21933"],
      ["Hebel Mortar", "20 kg", "21935"],
      ["Hebel Patch", "10 kg", "21949"],
      ["Base Sealer", "5 L", "111161"],
      ["Anti Corrosion Paint", "500 ml", "25594"],
    ],
    steel: {
      columns: ["3000", "4800"],
      rows: [
        ["24mm Top Hat", [null, ["21909", "24mm Top Hat", "4800"]]],
        ["35mm Perforated Top Hat", [null, ["105536", "35mm Perforated Top Hat", "4800"]]],
        ["45mm Perforated Top Hat", [null, ["168890", "45mm Perforated Top Hat", "4800"]]],
        ["50mm Commercial Top Hat", [null, ["141233", "50mm Commercial Top Hat", "4800"]]],
        ["75mm Top Hat", [null, ["24092", "75mm Top Hat", "4800"]]],
        ["150 x 100mm Shelf Angle", [["126323", "150 x 100mm Shelf Angle", "3000"], null]],
      ],
    },
  });

  const renderer = function renderWithRondoHebelCatalogue(floor, ...args) {
    registerCatalogue();
    const result = previousRenderer.call(this, floor, ...args);
    renderRondoExtensions(floor);
    renderHebel(floor);
    return result;
  };
  renderer.__rondoHebelCatalogue = true;
  window.renderUnifiedFloorSheet = renderer;

  function slug(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function keyFor(sku, lineIdentity = "") {
    const base = `catalogue-${slug(sku)}`;
    const suffix = slug(lineIdentity);
    return suffix ? `${base}--${suffix}` : base;
  }

  function register(sku, label, detail = "", lineIdentity = "") {
    if (!sku) return null;
    const key = keyFor(sku, lineIdentity);
    if (!state.catalog) state.catalog = {};
    const existing = state.catalog[key] || {};
    state.catalog[key] = {
      ...existing,
      sku,
      stockCode: sku,
      label,
      description: label,
      detail,
      lineIdentity,
      mapped: true,
      available: true,
    };
    return key;
  }

  function matrixLineIdentity(scope, rowIndex, cellIndex) {
    return `${scope}-matrix-${rowIndex}-${cellIndex}`;
  }

  function accessoryLineIdentity(scope, index) {
    return `${scope}-accessory-${index}`;
  }

  function registerDefinition(definition, scope) {
    definition.rows.forEach(([, cells], rowIndex) => cells.forEach((entry, cellIndex) => {
      if (entry) register(entry[0], entry[1], entry[2], matrixLineIdentity(scope, rowIndex, cellIndex));
    }));
    (definition.accessories || []).forEach(([label, sku], index) => {
      register(sku, label, "", accessoryLineIdentity(scope, index));
    });
  }

  function registerCatalogue() {
    if (!state?.catalog) state.catalog = {};
    registerDefinition(RONDO.suspended, "rondo-suspended");
    registerDefinition(RONDO.duo, "rondo-duo");
    registerDefinition(HEBEL.panels, "hebel-panels");
    registerDefinition(HEBEL.steel, "hebel-steel");
    HEBEL.compounds.forEach(([label, detail, sku], index) => {
      register(sku, label, detail, `hebel-compounds-${index}`);
    });
  }

  function makeTable(className, widths) {
    const table = document.createElement("table");
    table.className = `lower-catalogue-table ${className}`;
    const colgroup = document.createElement("colgroup");
    widths.forEach((width) => {
      const col = document.createElement("col");
      col.style.width = `${width}%`;
      colgroup.append(col);
    });
    table.append(colgroup);
    return table;
  }

  function appendHeader(tbody, title, columns) {
    const row = document.createElement("tr");
    row.className = "lower-subheader lower-matrix-header";
    [title, ...columns].forEach((text) => {
      const cell = document.createElement("th");
      cell.textContent = text;
      row.append(cell);
    });
    tbody.append(row);
  }

  function quantityCell(floor, entry, lineIdentity) {
    return createQuantityCell(floor, entry ? keyFor(entry[0], lineIdentity) : null);
  }

  function appendMatrixRows(tbody, floor, definition, scope) {
    definition.rows.forEach(([label, cells], rowIndex) => {
      const row = document.createElement("tr");
      const name = document.createElement("th");
      name.scope = "row";
      name.textContent = label;
      row.append(name);
      cells.forEach((entry, cellIndex) => {
        row.append(quantityCell(floor, entry, matrixLineIdentity(scope, rowIndex, cellIndex)));
      });
      tbody.append(row);
    });
  }

  function appendAccessoryHeading(tbody, totalColumns) {
    const row = document.createElement("tr");
    row.className = "lower-subheader lower-group-heading";
    const cell = document.createElement("th");
    cell.colSpan = totalColumns;
    cell.textContent = "Clips & Brackets";
    row.append(cell);
    tbody.append(row);
  }

  function appendAccessoryRows(tbody, floor, accessories, totalColumns, scope) {
    appendAccessoryHeading(tbody, totalColumns);

    if (totalColumns === 4) {
      for (let index = 0; index < accessories.length; index += 2) {
        const row = document.createElement("tr");
        row.className = "rondo-accessory-row rondo-accessory-pair";
        [accessories[index], accessories[index + 1]].forEach((entry, pairIndex) => {
          const accessoryIndex = index + pairIndex;
          if (entry) {
            const name = document.createElement("th");
            name.scope = "row";
            name.textContent = entry[0];
            row.append(name, createQuantityCell(floor, keyFor(entry[1], accessoryLineIdentity(scope, accessoryIndex))));
          } else {
            row.append(document.createElement("td"), document.createElement("td"));
          }
        });
        tbody.append(row);
      }
      return;
    }

    accessories.forEach(([label, sku], index) => {
      const row = document.createElement("tr");
      row.className = "rondo-accessory-row";
      const name = document.createElement("th");
      name.scope = "row";
      name.colSpan = totalColumns - 1;
      name.textContent = label;
      row.append(name, createQuantityCell(floor, keyFor(sku, accessoryLineIdentity(scope, index))));
      tbody.append(row);
    });
  }

  function renderRondoGridTable(floor, definition, className, scope) {
    const totalColumns = definition.columns.length + 1;
    const table = makeTable(className, totalColumns === 4 ? [55, 15, 15, 15] : [58, 21, 21]);
    const tbody = document.createElement("tbody");
    appendHeader(tbody, definition.title, definition.columns);
    appendMatrixRows(tbody, floor, definition, scope);
    appendAccessoryRows(tbody, floor, definition.accessories, totalColumns, scope);
    table.append(tbody);
    return table;
  }

  function renderRondoExtensions(floor) {
    const section = document.querySelector(`#${CSS.escape(floor)}OrderSheet .rondo-category`);
    if (!section || section.querySelector(".suspended-grid-table")) return;
    section.append(
      renderRondoGridTable(floor, RONDO.suspended, "rondo-grid-table suspended-grid-table", "rondo-suspended"),
      renderRondoGridTable(floor, RONDO.duo, "rondo-grid-table duo-grid-table", "rondo-duo"),
    );
  }

  function renderHebel(floor) {
    const insulation = document.querySelector(`#${CSS.escape(floor)}OrderSheet .insulation-category`);
    const column = insulation?.parentElement;
    if (!column || column.querySelector(".hebel-category")) return;

    const section = document.createElement("section");
    section.className = "lower-catalogue-section hebel-category";
    const heading = document.createElement("h3");
    heading.className = "lower-category-title";
    heading.textContent = "HEBEL";
    section.append(heading, renderHebelPanels(floor), renderHebelCompounds(floor), renderHebelSteel(floor));
    column.insertBefore(section, insulation);
  }

  function renderHebelPanels(floor) {
    const table = makeTable("hebel-panel-table", [31, 9.86, 9.86, 9.86, 9.86, 9.86, 9.86, 9.84]);
    const tbody = document.createElement("tbody");
    appendHeader(tbody, "Product", HEBEL.panels.columns);
    appendMatrixRows(tbody, floor, HEBEL.panels, "hebel-panels");
    table.append(tbody);
    return table;
  }

  function renderHebelCompounds(floor) {
    const table = makeTable("hebel-compounds-table", [58, 22, 20]);
    const tbody = document.createElement("tbody");
    appendHeader(tbody, "Compounds & Coatings", ["Size", "Qty"]);
    HEBEL.compounds.forEach(([label, detail, sku], index) => {
      const row = document.createElement("tr");
      const name = document.createElement("th");
      name.scope = "row";
      name.textContent = label;
      const size = document.createElement("td");
      size.className = "lower-item-detail";
      size.textContent = detail;
      row.append(name, size, createQuantityCell(floor, keyFor(sku, `hebel-compounds-${index}`)));
      tbody.append(row);
    });
    table.append(tbody);
    return table;
  }

  function renderHebelSteel(floor) {
    const table = makeTable("hebel-steel-table", [58, 21, 21]);
    const tbody = document.createElement("tbody");
    appendHeader(tbody, "Top Hats & Angles", HEBEL.steel.columns);
    appendMatrixRows(tbody, floor, HEBEL.steel, "hebel-steel");
    table.append(tbody);
    return table;
  }

  function refreshExistingSheets() {
    if (!document.querySelector(".floor-panels .pdf-form-sheet")) return;
    const areas = Array.isArray(state?.deliveryAreas) ? state.deliveryAreas : [];
    areas.forEach((area) => {
      if (area?.id) window.renderUnifiedFloorSheet(area.id);
    });
  }

  globalThis.BpsRondoHebelCatalogue = Object.freeze({ RONDO, HEBEL, keyFor });
  queueMicrotask(refreshExistingSheets);
})();