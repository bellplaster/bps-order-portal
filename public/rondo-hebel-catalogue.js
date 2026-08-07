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
        ["Flat Rod Bracket", "274"],
        ["Locking Clip", "139"],
        ["Angle Rod Bracket", "247"],
      ],
    },
    duo: {
      title: "DUO® Grid",
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
    donn: {
      title: "DONN® Grid",
      columns: ["600", "1200", "3600"],
      rows: [
        ["DX3 Cross Tee 1200mm", [null, ["DX301200", "DX3 Cross Tee 1200mm", "1200"], null]],
        ["DX4 Cross Tee 600mm", [["DX400600", "DX4 Cross Tee 600mm", "600"], null, null]],
        ["DX1 Main Tee 3600mm", [null, null, ["DX103600", "DX1 Main Tee 3600mm", "3600"]]],
        ["WADX Wall Angle 3600mm", [null, null, ["WADX3600", "WADX Wall Angle 3600mm", "3600"]]],
      ],
      accessories: [
        ["DXCL Suspension Clip", "DXCL"],
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

  const NASAHI = Object.freeze({
    panels: {
      columns: ["2200", "2400", "2550", "2700", "2850", "3000", "3300"],
      rows: [
        ["Nasahi Panel 50mm", [["1P502200", "Nasahi Panel 50mm", "2200"], ["1P502400", "Nasahi Panel 50mm", "2400"], ["1P502550", "Nasahi Panel 50mm", "2550"], ["1P502700", "Nasahi Panel 50mm", "2700"], ["1P502850", "Nasahi Panel 50mm", "2850"], ["1P503000", "Nasahi Panel 50mm", "3000"], null]],
        ["Nasahi Panel LD 75mm", [["1P752200LD", "Nasahi Panel LD 75mm", "2200"], ["1P752400LD", "Nasahi Panel LD 75mm", "2400"], ["1P752550LD", "Nasahi Panel LD 75mm", "2550"], ["1P752700LD", "Nasahi Panel LD 75mm", "2700"], ["1P752850LD", "Nasahi Panel LD 75mm", "2850"], ["1P753000LD", "Nasahi Panel LD 75mm", "3000"], ["1P753300LD", "Nasahi Panel LD 75mm", "3300"]]],
      ],
    },
    accessories: [
      ["75mm Nasahi Panels Flooring SQ", "1800 x 600 mm", "1P751800SQ"],
      ["AAC Base Sealer", "5 L", "AACBS"],
      ["Corrosion Paint", "250 mL", "ACP250"],
      ["AAC Adhesive", "20 kg", "ADH20"],
      ["Party Wall Angle Bracket", "", "APW01"],
      ["C Batten 16mm", "2.85 m", "BC162850"],
      ["C Batten 24mm (12 Pack)", "2.85 m", "BC242850"],
      ["C Batten 35mm", "3.0 m", "BC353000"],
      ["H Section 50mm", "3.0 m", "BH503000"],
      ["Fire Rated Caulking", "600 mL", "FRIC600"],
      ["Concrete Screw M8 x 100mm (50 Pack)", "", "SCON100"],
      ["Metal Batten Screw 20mm (500 Pack)", "", "SSHX20"],
      ["Steel Panel Screw 90mm (500 Pack)", "", "SSHX90"],
      ["Timber Panel Screw 100mm Bugle (500 Pack)", "", "STBB100"],
      ["Timber Panel Screw 150mm Hex (250 Pack)", "", "STHX150"],
      ["Timber Batten Screw 25mm Hex (500 Pack)", "", "STHX25"],
      ["Timber Batten Screw 35mm Hex (500 Pack)", "", "STHX35"],
      ["Timber Panel Screw 45mm Hex (1000 Pack)", "", "STHX45"],
    ],
  });

  const PROPANEL = Object.freeze({
    panels: {
      columns: ["2200", "2400", "2700", "2850", "3000", "3300"],
      rows: [
        ["AAC Panel 50 mm (15 Pack)", [["BPS/2200-50MM", "AAC Panel 50 mm (15 Pack)", "2200"], ["BPS/99939", "AAC Panel 50 mm (15 Pack)", "2400"], ["BPS/162758", "AAC Panel 50 mm (15 Pack)", "2700"], ["BPS/162756", "AAC Panel 50 mm (15 Pack)", "2850"], ["BPS/162760", "AAC Panel 50 mm (15 Pack)", "3000"], null]],
        ["AAC Panel 75 mm (10 Pack)", [null, ["BPS/118014", "AAC Panel 75 mm (10 Pack)", "2400"], ["BPS/118016", "AAC Panel 75 mm (10 Pack)", "2700"], ["BPS/118019", "AAC Panel 75 mm (10 Pack)", "2850"], ["BPS/118020", "AAC Panel 75 mm (10 Pack)", "3000"], ["BPS/126504", "AAC Panel 75 mm (10 Pack)", "3300"]]],
      ],
    },
    accessories: [
      ["Unitex AAC Adhesive", "20 kg", "BPS/UNITEXAD"],
      ["24 mm Perforated Top Hat", "4800 mm", "BPS/21909"],
      ["35 mm Perforated Top Hat", "4800 mm", "BPS/105536"],
    ],
  });

  const AAC_BRANDS = Object.freeze({
    hebel: { label: "Hebel", render: renderHebelBrand },
    nasahi: { label: "Nasahi", render: renderNasahiBrand },
    propanel: { label: "Propanel", render: renderPropanelBrand },
  });

  const renderer = function renderWithRondoHebelCatalogue(floor, ...args) {
    retireNail40mm();
    registerCatalogue();
    const result = previousRenderer.call(this, floor, ...args);
    renderRondoExtensions(floor);
    renderAacSection(floor);
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
    state.catalog[key] = { ...existing, sku, stockCode: sku, label, description: label, detail, lineIdentity, mapped: true, available: true };
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
    (definition.accessories || []).forEach(([label, sku], index) => register(sku, label, "", accessoryLineIdentity(scope, index)));
  }

  function registerAccessoryList(accessories, scope) {
    accessories.forEach(([label, detail, sku], index) => register(sku, label, detail, accessoryLineIdentity(scope, index)));
  }

  function retireNail40mm() {
    const nails = state.layout?.sections?.nails;
    if (!nails || !Array.isArray(nails.columns) || !Array.isArray(nails.rows)) return;

    const keepIndexes = [];
    const retiredIndexes = [];
    nails.columns.forEach((column, index) => {
      if (/^40\s*mm$/i.test(String(column || "").trim())) retiredIndexes.push(index);
      else keepIndexes.push(index);
    });
    if (!retiredIndexes.length) return;

    const retiredKeys = new Set();
    nails.rows = nails.rows.map((row) => {
      const cells = Array.isArray(row?.cells) ? row.cells : [];
      retiredIndexes.forEach((index) => {
        if (cells[index]) retiredKeys.add(cells[index]);
      });
      return { ...row, cells: keepIndexes.map((index) => cells[index] || null) };
    });
    nails.columns = keepIndexes.map((index) => nails.columns[index]);

    retiredKeys.forEach((key) => {
      delete state.catalog?.[key];
      Object.values(state.quantities || {}).forEach((quantities) => quantities?.delete?.(key));
    });
  }

  function registerCatalogue() {
    if (!state?.catalog) state.catalog = {};
    registerDefinition(RONDO.suspended, "rondo-suspended");
    registerDefinition(RONDO.duo, "rondo-duo");
    registerDefinition(RONDO.donn, "rondo-donn");
    registerDefinition(HEBEL.panels, "hebel-panels");
    registerDefinition(HEBEL.steel, "hebel-steel");
    registerAccessoryList(HEBEL.compounds, "hebel-compounds");
    registerDefinition(NASAHI.panels, "nasahi-panels");
    registerAccessoryList(NASAHI.accessories, "nasahi-accessories");
    registerDefinition(PROPANEL.panels, "propanel-panels");
    registerAccessoryList(PROPANEL.accessories, "propanel-accessories");
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
      cells.forEach((entry, cellIndex) => row.append(quantityCell(floor, entry, matrixLineIdentity(scope, rowIndex, cellIndex))));
      tbody.append(row);
    });
  }

  function appendAccessoryRows(tbody, floor, accessories, totalColumns, scope) {
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
      renderRondoGridTable(floor, RONDO.donn, "rondo-grid-table donn-grid-table", "rondo-donn"),
    );
  }

  function renderAacSection(floor) {
    const partiwall = document.querySelector(`#${CSS.escape(floor)}OrderSheet .partiwall-category`);
    const column = partiwall?.parentElement;
    if (!column || column.querySelector(".aac-category")) return;

    const section = document.createElement("section");
    section.className = "lower-catalogue-section hebel-category aac-category";
    section.dataset.activeBrand = "hebel";

    const tabs = document.createElement("div");
    tabs.className = "aac-brand-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "AAC brands");

    const content = document.createElement("div");
    content.className = "aac-brand-content";

    Object.entries(AAC_BRANDS).forEach(([key, brand], index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "aac-brand-tab";
      button.textContent = brand.label;
      button.dataset.brand = key;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", index === 0 ? "true" : "false");
      button.tabIndex = index === 0 ? 0 : -1;
      if (index === 0) button.classList.add("is-active");
      tabs.append(button);
    });

    tabs.addEventListener("click", (event) => {
      const button = event.target.closest(".aac-brand-tab");
      if (button) activateAacBrand(section, floor, button.dataset.brand);
    });

    tabs.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...tabs.querySelectorAll(".aac-brand-tab")];
      const current = Math.max(0, buttons.indexOf(document.activeElement));
      let next = current;
      if (event.key === "ArrowRight") next = (current + 1) % buttons.length;
      if (event.key === "ArrowLeft") next = (current - 1 + buttons.length) % buttons.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = buttons.length - 1;
      buttons[next].focus();
      activateAacBrand(section, floor, buttons[next].dataset.brand);
    });

    section.append(tabs, content);
    column.insertBefore(section, partiwall);
    activateAacBrand(section, floor, "hebel");
  }

  function activateAacBrand(section, floor, brandKey) {
    const brand = AAC_BRANDS[brandKey] || AAC_BRANDS.hebel;
    section.dataset.activeBrand = brandKey;
    section.querySelectorAll(".aac-brand-tab").forEach((button) => {
      const active = button.dataset.brand === brandKey;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    });
    section.querySelector(".aac-brand-content").replaceChildren(...brand.render(floor));
  }

  function renderMatrixTable(floor, definition, className, scope) {
    const remainder = 62 / definition.columns.length;
    const table = makeTable(className, [38, ...definition.columns.map(() => remainder)]);
    const tbody = document.createElement("tbody");
    appendHeader(tbody, "Product", definition.columns);
    appendMatrixRows(tbody, floor, definition, scope);
    table.append(tbody);
    return table;
  }

  function renderAccessoryTable(floor, title, accessories, className, scope, detailHeading = "Size") {
    const table = makeTable(className, [58, 22, 20]);
    const tbody = document.createElement("tbody");
    appendHeader(tbody, title, [detailHeading, "Qty"]);
    accessories.forEach(([label, detail, sku], index) => {
      const row = document.createElement("tr");
      const name = document.createElement("th");
      name.scope = "row";
      name.textContent = label;
      const size = document.createElement("td");
      size.className = "lower-item-detail";
      size.textContent = detail;
      row.append(name, size, createQuantityCell(floor, keyFor(sku, accessoryLineIdentity(scope, index))));
      tbody.append(row);
    });
    table.append(tbody);
    return table;
  }

  function renderHebelBrand(floor) {
    return [renderMatrixTable(floor, HEBEL.panels, "hebel-panel-table", "hebel-panels"), renderAccessoryTable(floor, "Compounds & Coatings", HEBEL.compounds, "hebel-compounds-table", "hebel-compounds"), renderMatrixTable(floor, HEBEL.steel, "hebel-steel-table", "hebel-steel")];
  }

  function renderNasahiBrand(floor) {
    return [renderMatrixTable(floor, NASAHI.panels, "hebel-panel-table nasahi-panel-table", "nasahi-panels"), renderAccessoryTable(floor, "Nasahi Accessories", NASAHI.accessories, "hebel-compounds-table nasahi-accessories-table", "nasahi-accessories")];
  }

  function renderPropanelBrand(floor) {
    return [renderMatrixTable(floor, PROPANEL.panels, "hebel-panel-table propanel-panel-table", "propanel-panels"), renderAccessoryTable(floor, "Accessories", PROPANEL.accessories, "hebel-compounds-table propanel-accessories-table", "propanel-accessories", "Spec")];
  }

  function refreshExistingSheets() {
    if (!document.querySelector(".floor-panels .pdf-form-sheet")) return;
    const areas = Array.isArray(state?.deliveryAreas) ? state.deliveryAreas : [];
    areas.forEach((area) => {
      if (area?.id) window.renderUnifiedFloorSheet(area.id);
    });
  }

  globalThis.BpsRondoHebelCatalogue = Object.freeze({ RONDO, HEBEL, NASAHI, PROPANEL, keyFor });
  queueMicrotask(refreshExistingSheets);
})();