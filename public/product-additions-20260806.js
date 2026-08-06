(() => {
  const previousRenderer = window.renderUnifiedFloorSheet;
  if (typeof previousRenderer !== "function" || previousRenderer.__productAdditions20260806) return;

  const RONDO_LENGTHS = ["1800", "2400", "2700", "3000", "3600", "6000"];
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

  const RONDO_EXPANDED = Object.freeze([{"title":"RONDO WALL FRAMING","tables":[{"columns":["2400","2700","3000","3300","3600","4200"],"rows":[{"label":"64 mm Stud 0.50 BMT","skus":{"2400":"11202400","2700":"11202700","3000":"11203000","3600":"11203600","4200":"11204200"}},{"label":"76 mm Stud 0.55 BMT","skus":{"2400":"40302400","2700":"40302700","3000":"40303000","3300":"40303300","3600":"40303600","4200":"40304200"}},{"label":"92 mm Stud 0.55 BMT","skus":{"2400":"25102400","2700":"25102700","3000":"25103000","3600":"25103600","4200":"25104200"}},{"label":"51 mm Stud 0.50 BMT","skus":{"2400":"40102400","2700":"40102700","3000":"40103000","3300":"40103300","3600":"40103600"}}]},{"columns":["4800","6000"],"rows":[{"label":"64 mm Stud 0.50 BMT","skus":{"4800":"11204800","6000":"11206000"}},{"label":"76 mm Stud 0.55 BMT","skus":{"4800":"40304800"}},{"label":"92 mm Stud 0.55 BMT","skus":{"4800":"25104800","6000":"25106000"}}]},{"columns":["3000","3600"],"rows":[{"label":"51 mm Track 0.50 BMT","skus":{"3000":"40003000"}},{"label":"64 mm Track 0.50 BMT","skus":{"3000":"11103000","3600":"11103600"}},{"label":"76 mm Track 0.50 BMT","skus":{"3000":"40203000"}},{"label":"92 mm Track 0.50 BMT","skus":{"3000":"25003000","3600":"25003600"}},{"label":"64 mm DH Track 0.50 BMT","skus":{"3000":"48003000"}},{"label":"76 mm DH Track 0.50 BMT","skus":{"3000":"48203000"}},{"label":"92 mm DH Track 0.50 BMT","skus":{"3000":"48303000"}}],"subheading":"TRACKS & DH TRACKS — STANDARD"}]},{"title":"RONDO FURRING CHANNELS","tables":[{"columns":["2700","3000","3600","4800","6000"],"rows":[{"label":"16 mm Furring Channel","skus":{"3000":"30803000","3600":"30803600","4800":"30804800","6000":"30806000"}},{"label":"28 mm Furring Channel","skus":{"2700":"12902700","3000":"12903000","3600":"12903600","4800":"12904800","6000":"12906000"}}]}]},{"title":"RONDO MEDIUM GAUGE STUDS — 0.75 BMT","tables":[{"columns":["2400","2700","2820","3000","3600","3900"],"rows":[{"label":"64 mm Stud","skus":{"2400":"49102400","2700":"49102700","3000":"49103000","3600":"49103600"}},{"label":"76 mm Stud","skus":{"2400":"49302400","2700":"49302700","3000":"49303000","3600":"49303600"}},{"label":"92 mm Stud","skus":{"2400":"49502400","2700":"49502700","3000":"49503000","3600":"49503600"}},{"label":"150 mm Stud","skus":{"3000":"51103000","3600":"51103600"}},{"label":"51 mm Stud","skus":{"3000":"48903000","3600":"48903600"}}]},{"columns":["4200","4800","6000","7200"],"rows":[{"label":"64 mm Stud","skus":{"4200":"49104200","4800":"49104800","6000":"49106000"}},{"label":"76 mm Stud","skus":{"4200":"49304200","4800":"49304800","6000":"49306000"}},{"label":"92 mm Stud","skus":{"4200":"49504200","4800":"49504800","6000":"49506000"}},{"label":"150 mm Stud","skus":{"4200":"51104200","4800":"51104800","6000":"51106000","7200":"51107200"}}]}]},{"title":"RONDO TRACKS & DH TRACK","tables":[{"columns":["3000","6000"],"rows":[{"label":"51 mm Track 0.70 BMT","skus":{"3000":"49003000"}},{"label":"64 mm Track 0.75 BMT","skus":{"3000":"49203000"}},{"label":"76 mm Track 0.70 BMT","skus":{"3000":"49403000"}},{"label":"92 mm Track 0.70 BMT","skus":{"3000":"49603000"}},{"label":"51 mm DH Track 0.70 BMT","skus":{"3000":"48803000"}},{"label":"64 mm DH Track 0.70 BMT","skus":{"3000":"49703000"}},{"label":"76 mm DH Track 0.70 BMT","skus":{"3000":"49803000"}},{"label":"92 mm DH Track 0.75 BMT","skus":{"3000":"49903000"}},{"label":"150 mm DH Track 0.75 BMT","skus":{"3000":"51003000"}},{"label":"92 mm Seismic DH Track 0.70 BMT","skus":{"3000":"87203000"}},{"label":"150 mm Seismic DH Track 0.75 BMT","skus":{"3000":"87303000"}}]}]},{"title":"RONDO NOGGIN TRACK 0.70 BMT / 3.6m","tables":[{"columns":["300 cts","400 cts","450 cts","600 cts"],"rows":[{"label":"51 mm Noggin Track","skus":{"450 cts":"503036000450","600 cts":"503036000600"}},{"label":"64 mm Noggin Track","skus":{"300 cts":"504036000300","400 cts":"504036000400","450 cts":"504036000450","600 cts":"504036000600"}},{"label":"76 mm Noggin Track","skus":{"300 cts":"505036000300","450 cts":"505036000450","600 cts":"505036000600"}},{"label":"92 mm Noggin Track","skus":{"300 cts":"506036000300","400 cts":"506036000400","450 cts":"506036000450","600 cts":"506036000600"}},{"label":"150 mm Noggin Track","skus":{"300 cts":"507036000300","450 cts":"507036000450","600 cts":"507036000600"}}]}]},{"title":"RONDO HEAVY-DUTY WALL FRAMING","tables":[{"columns":["2400","2700","3000","3600","4200","4800"],"rows":[{"label":"64 mm Stud 1.15 BMT","skus":{"2700":"66102700","3000":"66103000","3600":"66103600","4200":"66104200","4800":"66104800"}},{"label":"76 mm Stud 1.15 BMT","skus":{"2400":"67102400","2700":"67102700","3000":"67103000","3600":"67103600","4800":"67104800"}},{"label":"92 mm Stud 1.15 BMT","skus":{"2700":"68102700","3000":"68103000","3600":"68103600","4200":"68104200","4800":"68104800"}},{"label":"150 mm Stud 1.15 BMT","skus":{"3000":"69103000","3600":"69103600","4200":"69104200","4800":"69104800"}}]},{"columns":["6000","7200"],"rows":[{"label":"76 mm Stud 1.15 BMT","skus":{"6000":"67106000"}},{"label":"92 mm Stud 1.15 BMT","skus":{"6000":"68106000","7200":"68107200"}},{"label":"150 mm Stud 1.15 BMT","skus":{"6000":"69106000","7200":"69107200"}}]},{"columns":["3000","6000"],"rows":[{"label":"64 mm Track 1.15 BMT","skus":{"3000":"66003000"}},{"label":"76 mm Track 1.15 BMT","skus":{"3000":"67003000"}},{"label":"92 mm Track 1.15 BMT","skus":{"3000":"68003000"}},{"label":"64 mm DH Track 1.15 BMT","skus":{"3000":"66303000"}},{"label":"76 mm DH Track 1.15 BMT","skus":{"3000":"67303000"}},{"label":"92 mm DH Track 1.15 BMT","skus":{"3000":"68303000"}},{"label":"150 mm DH Track 1.15 BMT","skus":{"3000":"69003000"}},{"label":"92 x 85 mm Long Leg DH Track 1.50 BMT","skus":{"3000":"76603000"}}],"subheading":"TRACKS & DH TRACKS HEAVY DUTY"}]},{"title":"RONDO FINISHING BEADS & ANGLES","tables":[{"columns":["2400","2550","2700","3000","3600"],"rows":[{"label":"External Angle 90° (20 Pack)","skus":{"2550":"P0102550"}},{"label":"Casing Bead 6 mm (20 Pack)","skus":{"3000":"P0303000"}},{"label":"Casing Bead 13 mm (20 Pack)","skus":{"2400":"P0702400","2700":"P0702700","3000":"P0703000","3600":"P0703600"}},{"label":"Casing Bead 16 mm (20 Pack)","skus":{"3000":"P0803000"}},{"label":"Stopping Bead 6 mm (20 Pack)","skus":{"3000":"P1103000"}},{"label":"Stopping Bead 10 mm (20 Pack)","skus":{"2400":"P1202400","2700":"P1202700","3000":"P1203000","3600":"P1203600"}},{"label":"Stopping Bead 13 mm (20 Pack)","skus":{"2400":"P1302400","2700":"P1302700","3000":"P1303000","3600":"P1303600"}},{"label":"Stopping Bead 16 mm (20 Pack)","skus":{"3000":"P1403000"}},{"label":"Long Leg L-Bead 10 mm (20 Pack)","skus":{"3000":"P2503000"}},{"label":"Long Leg L-Bead 13 mm (20 Pack)","skus":{"3000":"P2603000"}},{"label":"Long Leg L-Bead 16 mm (20 Pack)","skus":{"3000":"P2703000"}},{"label":"Long Leg L-Bead 32 mm (20 Pack)","skus":{"3000":"P2803000"}},{"label":"Shadowline Casing Bead 13 mm (10 Pack)","skus":{"3000":"P0903000"}},{"label":"Arch Bead 6 mm (20 Pack)","skus":{"3000":"P1003000"}},{"label":"Expansion Joint 10 mm (10 Pack)","skus":{"3000":"P35W3000"}},{"label":"Shadowline Stop Angle 10 mm (20 Pack)","skus":{"3000":"P5003000"}},{"label":"Shadowline Stop Bead 10 mm (10 Pack)","skus":{"3000":"P5103000"}},{"label":"Shadowline Set Bead 13 mm (10 Pack)","skus":{"3000":"P5203000"}},{"label":"Shadowline Stop Angle 6 mm (20 Pack)","skus":{"3000":"P6003000"}},{"label":"FC Stopping Bead 8 mm Light Grey","skus":{"3000":"EP173000"}}]}]},{"title":"TRIM-TEX TEAR AWAY BEADS","tables":[{"columns":["Flat","6 mm","10 mm Zip","13 mm","16 mm"],"rows":[{"label":"Tear Away L-Bead 3.0 m (50 Pack)","skus":{"Flat":"72-9000","6 mm":"72-9002","10 mm Zip":"72-9004","13 mm":"72-9010","16 mm":"72-9110"}}]}]}]);

  function slug(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function keyFor(sku, identity = "") {
    const base = `product-addition-${slug(sku)}`;
    const suffix = slug(identity);
    return suffix ? `${base}--${suffix}` : base;
  }

  function expandedIdentity(groupIndex, tableIndex, rowIndex, columnIndex) {
    return `rondo-expanded-${groupIndex}-${tableIndex}-${rowIndex}-${columnIndex}`;
  }

  function registerProduct(sku, label, detail = "", identity = "") {
    if (!state.catalog || typeof state.catalog !== "object") state.catalog = {};
    const key = keyFor(sku, identity);
    state.catalog[key] = {
      ...(state.catalog[key] || {}),
      sku,
      stockCode: sku,
      label,
      description: label,
      detail,
      lineIdentity: identity || key,
      mapped: true,
      available: true,
    };
    return key;
  }

  function registerExpandedRondoProducts() {
    RONDO_EXPANDED.forEach((group, groupIndex) => {
      group.tables.forEach((table, tableIndex) => {
        table.rows.forEach((row, rowIndex) => {
          table.columns.forEach((column, columnIndex) => {
            const sku = row.skus[column];
            if (!sku) return;
            registerProduct(
              sku,
              row.label,
              column,
              expandedIdentity(groupIndex, tableIndex, rowIndex, columnIndex),
            );
          });
        });
      });
    });
  }

  function registerProducts() {
    Object.values(PRODUCTS.rondo).forEach((definition) => {
      Object.values(definition.cells).forEach(([sku, label, detail]) => registerProduct(sku, label, detail));
    });
    PRODUCTS.fasteners.forEach(([label, sku]) => registerProduct(sku, label));
    registerExpandedRondoProducts();
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
    const table = document.querySelector(`#${CSS.escape(floor)}OrderSheet .rondo-category .rondo-table`);
    const tbody = table?.querySelector("tbody");
    if (!table || !tbody) return;
    const colgroup = table.querySelector("colgroup");
    if (colgroup) {
      colgroup.replaceChildren();
      [34, 11, 11, 11, 11, 11, 11].forEach((width) => {
        const col = document.createElement("col");
        col.style.width = `${width}%`;
        colgroup.append(col);
      });
    }
    const header = tbody.querySelector(".lower-matrix-header");
    if (header) {
      const title = header.querySelector("th")?.textContent || "Product";
      header.replaceChildren();
      [title, ...RONDO_LENGTHS].forEach((text) => {
        const th = document.createElement("th");
        th.textContent = text;
        header.append(th);
      });
    }
    [...tbody.querySelectorAll("tr")].forEach((row) => {
      while (row.children.length > 7) row.lastElementChild?.remove();
    });
    replaceRondoRow(floor, tbody, PRODUCTS.rondo.p40, ["P40 Int"]);
    replaceRondoRow(floor, tbody, PRODUCTS.rondo.casing, ["Metal Casing Bead 10 mm", "PVC Casing Bead 10 mm"]);
  }

  function expandedFirstColumnWidth(columnCount) {
    if (columnCount <= 2) return 58;
    if (columnCount === 3) return 52;
    if (columnCount === 4) return 46;
    if (columnCount === 5) return 42;
    return 40;
  }

  function makeExpandedTable(columnCount) {
    const table = document.createElement("table");
    table.className = "lower-catalogue-table rondo-grid-table rondo-expanded-table";
    const firstWidth = expandedFirstColumnWidth(columnCount);
    const variantWidth = (100 - firstWidth) / columnCount;
    const colgroup = document.createElement("colgroup");
    [firstWidth, ...Array(columnCount).fill(variantWidth)].forEach((width) => {
      const col = document.createElement("col");
      col.style.width = `${width}%`;
      colgroup.append(col);
    });
    table.append(colgroup);
    return table;
  }

  function appendExpandedSubheading(tbody, title, totalColumns) {
    if (!title) return;
    const row = document.createElement("tr");
    row.className = "lower-subheader lower-group-heading rondo-expanded-subheading";
    const cell = document.createElement("th");
    cell.colSpan = totalColumns;
    cell.textContent = title;
    row.append(cell);
    tbody.append(row);
  }

  function appendExpandedHeader(tbody, columns) {
    const row = document.createElement("tr");
    row.className = "lower-subheader lower-matrix-header";
    ["Product", ...columns].forEach((text) => {
      const cell = document.createElement("th");
      cell.textContent = text;
      row.append(cell);
    });
    tbody.append(row);
  }

  function renderExpandedTable(floor, definition, groupIndex, tableIndex) {
    const table = makeExpandedTable(definition.columns.length);
    const tbody = document.createElement("tbody");
    appendExpandedSubheading(tbody, definition.subheading, definition.columns.length + 1);
    appendExpandedHeader(tbody, definition.columns);

    definition.rows.forEach((rowDefinition, rowIndex) => {
      const row = document.createElement("tr");
      const name = document.createElement("th");
      name.scope = "row";
      name.textContent = rowDefinition.label;
      row.append(name);

      definition.columns.forEach((column, columnIndex) => {
        const sku = rowDefinition.skus[column];
        const identity = expandedIdentity(groupIndex, tableIndex, rowIndex, columnIndex);
        row.append(createQuantityCell(floor, sku ? keyFor(sku, identity) : null));
      });
      tbody.append(row);
    });

    table.append(tbody);
    return table;
  }

  function patchExpandedRondo(floor) {
    const section = document.querySelector(`#${CSS.escape(floor)}OrderSheet .rondo-category`);
    if (!section || section.querySelector(".rondo-expanded-catalogue")) return;

    const catalogue = document.createElement("div");
    catalogue.className = "rondo-expanded-catalogue";

    RONDO_EXPANDED.forEach((group, groupIndex) => {
      const groupSection = document.createElement("section");
      groupSection.className = "lower-catalogue-section rondo-expanded-group";

      const heading = document.createElement("h4");
      heading.className = "lower-category-title";
      heading.textContent = group.title;
      groupSection.append(heading);

      group.tables.forEach((table, tableIndex) => {
        groupSection.append(renderExpandedTable(floor, table, groupIndex, tableIndex));
      });
      catalogue.append(groupSection);
    });

    const duoTable = section.querySelector(".duo-grid-table");
    if (duoTable) duoTable.insertAdjacentElement("afterend", catalogue);
    else section.append(catalogue);
  }

  function applyGroupSeparator(row) {
    row.classList.add("self-drilling-bugle-group-start");
    row.style.setProperty("height", "30px", "important");
    [...row.children].forEach((cell) => {
      cell.style.setProperty("height", "30px", "important");
      cell.style.setProperty("min-height", "30px", "important");
      cell.style.setProperty("border-top", "4px solid #c3c9c7", "important");
    });
  }

  function makeFastenerRow(floor, label, sku, groupStart = false) {
    const row = document.createElement("tr");
    row.className = "self-drilling-bugle-row";
    const name = document.createElement("th");
    name.scope = "row";
    name.colSpan = 2;
    name.textContent = label;
    row.append(name, createQuantityCell(floor, keyFor(sku)));
    if (groupStart) applyGroupSeparator(row);
    return row;
  }

  function patchFasteners(floor) {
    const tbody = document.querySelector(`#${CSS.escape(floor)}OrderSheet .fasteners-category .fasteners-table tbody`);
    if (!tbody) return;
    tbody.querySelectorAll(".self-drilling-bugle-row, .self-drilling-bugle-separator").forEach((row) => row.remove());
    const nailsHeader = [...tbody.querySelectorAll("tr")].find((row) => row.querySelector("th")?.textContent?.trim().toLowerCase() === "nails");
    const fragment = document.createDocumentFragment();
    PRODUCTS.fasteners.forEach(([label, sku], index) => fragment.append(makeFastenerRow(floor, label, sku, index === 0)));
    if (nailsHeader) tbody.insertBefore(fragment, nailsHeader);
    else tbody.append(fragment);
  }

  const renderer = function renderWithProductAdditions(floor, ...args) {
    registerProducts();
    const result = previousRenderer.call(this, floor, ...args);
    patchRondo(floor);
    patchExpandedRondo(floor);
    patchFasteners(floor);
    return result;
  };

  renderer.__productAdditions20260806 = true;
  window.renderUnifiedFloorSheet = renderer;
  registerProducts();

  globalThis.BpsProductAdditions20260806 = Object.freeze({
    PRODUCTS,
    RONDO_EXPANDED,
    keyFor,
  });

  queueMicrotask(() => {
    const areas = Array.isArray(state?.deliveryAreas) ? state.deliveryAreas : [];
    areas.forEach((area) => {
      if (area?.id) window.renderUnifiedFloorSheet(area.id);
    });
  });
})();
