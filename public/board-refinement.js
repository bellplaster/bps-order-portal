(() => {
  const originalRenderReview = window.renderReview;

  window.renderUnifiedFloorSheet = function renderUnifiedFloorSheet(floor) {
    const root = document.getElementById(`${floor}OrderSheet`);
    root.replaceChildren();

    const sectionEntries = Object.entries(state.layout.sections || {});
    const villaboardEntry = sectionEntries.find(([, definition]) => /villaboard/i.test(String(definition?.title || "")));
    const villaboardId = villaboardEntry?.[0] || "";
    const villaboardDefinition = villaboardEntry?.[1] || null;

    root.append(renderUnifiedBoardMatrix(
      floor,
      state.layout.mainBoard,
      state.layout.specialtyBoards || [],
      villaboardDefinition,
    ));

    const lower = document.createElement("div");
    lower.className = "pdf-lower-grid";
    for (const columnIds of state.layout.lowerColumns || []) {
      const column = document.createElement("div");
      column.className = "pdf-lower-column";
      for (const id of columnIds) {
        if (["usg_tiles", "other_materials", villaboardId].includes(id)) continue;
        const definition = state.layout.sections?.[id];
        if (!definition || /villaboard/i.test(String(definition.title || ""))) continue;
        column.append(renderSection(floor, definition));
      }
      if (column.childElementCount) lower.append(column);
    }
    root.append(lower);
    root.append(renderOtherMaterialsSection(floor));
  };

  window.renderReview = function renderReviewWithPoLabel(...args) {
    const result = typeof originalRenderReview === "function"
      ? originalRenderReview.apply(this, args)
      : undefined;
    document.querySelectorAll("#reviewDetails > div > span").forEach((label) => {
      if (label.textContent.trim().toLowerCase() === "reference") label.textContent = "PO number";
    });
    return result;
  };

  function renderUnifiedBoardMatrix(floor, mainDefinition, specialtyGroups, villaboardDefinition) {
    const products = [
      ...buildMainProducts(mainDefinition),
      ...buildSpecialtyProducts(specialtyGroups),
      ...buildVillaboardProduct(villaboardDefinition),
    ].filter((product) => product.columns.length);

    const preferredLengths = ["6000", "4800", "4200", "3600", "3000", "2700", "2400", "1800"];
    const discoveredLengths = new Set(preferredLengths);
    products.forEach((product) => product.columns.forEach((column) => {
      column.cells.forEach((_key, length) => discoveredLengths.add(String(length)));
    }));
    const lengths = [...discoveredLengths].sort((left, right) => {
      const leftIndex = preferredLengths.indexOf(left);
      const rightIndex = preferredLengths.indexOf(right);
      if (leftIndex >= 0 || rightIndex >= 0) {
        if (leftIndex < 0) return 1;
        if (rightIndex < 0) return -1;
        return leftIndex - rightIndex;
      }
      return Number(right) - Number(left);
    });

    const section = document.createElement("section");
    section.className = "pdf-product-section unified-board-section";

    const wrap = document.createElement("div");
    wrap.className = "board-table-wrap unified-board-scroll";
    wrap.tabIndex = 0;
    wrap.setAttribute("aria-label", "Board product quantities. Scroll horizontally to view all board products.");

    const table = document.createElement("table");
    table.className = "pdf-table main-board-table unified-board-table";

    const lengthColumnWidth = 54;
    const productColumnWidths = products.flatMap((product) => calculateProductColumnWidths(product));
    const tableWidth = lengthColumnWidth + productColumnWidths.reduce((total, width) => total + width, 0);
    table.style.width = `${tableWidth}px`;
    table.style.minWidth = `${tableWidth}px`;

    const colgroup = document.createElement("colgroup");
    const lengthColumn = document.createElement("col");
    lengthColumn.className = "board-length-column";
    lengthColumn.style.width = `${lengthColumnWidth}px`;
    colgroup.append(lengthColumn);
    productColumnWidths.forEach((width) => {
      const column = document.createElement("col");
      column.className = "board-quantity-column";
      column.style.width = `${width}px`;
      colgroup.append(column);
    });
    table.append(colgroup);

    const thead = document.createElement("thead");
    const productRow = document.createElement("tr");
    const boardHeading = document.createElement("th");
    boardHeading.className = "board-corner-heading";
    boardHeading.textContent = "BOARD";
    productRow.append(boardHeading);
    products.forEach((product) => {
      const heading = document.createElement("th");
      heading.colSpan = product.columns.length;
      heading.className = "board-product-heading";
      heading.textContent = product.title;
      productRow.append(heading);
    });

    const thicknessRow = document.createElement("tr");
    const lengthHeading = document.createElement("th");
    lengthHeading.className = "board-axis-heading";
    lengthHeading.textContent = "Length";
    thicknessRow.append(lengthHeading);
    products.forEach((product) => product.thicknesses.forEach((thickness) => {
      const heading = document.createElement("th");
      heading.colSpan = thickness.span;
      heading.className = "board-thickness-heading";
      heading.textContent = thickness.label;
      thicknessRow.append(heading);
    }));

    const widthRow = document.createElement("tr");
    const unitHeading = document.createElement("th");
    unitHeading.className = "board-axis-heading";
    unitHeading.textContent = "mm";
    widthRow.append(unitHeading);
    products.forEach((product) => product.columns.forEach((column) => {
      const heading = document.createElement("th");
      heading.className = "board-width-heading";
      heading.textContent = column.width;
      widthRow.append(heading);
    }));

    thead.append(productRow, thicknessRow, widthRow);

    const tbody = document.createElement("tbody");
    lengths.forEach((length) => {
      const row = document.createElement("tr");
      const heading = document.createElement("th");
      heading.className = "board-row-heading";
      heading.textContent = length;
      row.append(heading);
      products.forEach((product) => product.columns.forEach((column) => {
        row.append(createQuantityCell(floor, column.cells.get(length) || null));
      }));
      tbody.append(row);
    });

    table.append(thead, tbody);
    wrap.append(table);
    section.append(wrap);
    return section;
  }

  function calculateProductColumnWidths(product) {
    const widthByProduct = {
      "SHEETROCK® ONE": 48,
      "SHEETROCK® PLUS": 48,
      "WETSTOP®": 46,
      "FIRESTOP®": 48,
      "ImpactStop™": 55,
      "MultiStop™ ONE": 58,
      "MultiStop™ ONE HI": 110,
      "FLEXIBOARD": 84,
      "Villaboard": 50,
    };
    const width = widthByProduct[product.title] || 50;
    return product.columns.map(() => width);
  }

  function buildMainProducts(definition) {
    if (!definition) return [];
    const products = [];
    let columnIndex = 0;

    (definition.groups || []).forEach((group) => {
      const span = Number(group.span || 0);
      const title = displayProductName(group.group);
      let product = products.at(-1);
      if (!product || product.title !== title) {
        product = { title, thicknesses: [], columns: [] };
        products.push(product);
      }
      product.thicknesses.push({ label: normaliseThickness(group.subgroup), span });

      for (let offset = 0; offset < span; offset += 1) {
        const sourceIndex = columnIndex + offset;
        const sourceColumn = definition.columns?.[sourceIndex] || {};
        const cells = new Map();
        (definition.rows || []).forEach((row) => {
          const key = row.cells?.[sourceIndex];
          if (key) cells.set(String(row.length), key);
        });
        product.columns.push({
          width: String(sourceColumn.variant || ""),
          cells,
        });
      }
      columnIndex += span;
    });
    return products;
  }

  function buildSpecialtyProducts(groups) {
    return (groups || []).map((group) => {
      const columns = [];
      (group.rows || []).forEach((row) => {
        const dimensions = parseBoardDimensions(`${row.label || ""} ${row.detail || ""}`);
        if (!dimensions || !row.key) return;
        columns.push({
          thickness: dimensions.thickness,
          width: dimensions.width,
          cells: new Map([[dimensions.length, row.key]]),
        });
      });
      return {
        title: displayProductName(group.title),
        columns,
        thicknesses: mergeThicknesses(columns),
      };
    });
  }

  function buildVillaboardProduct(definition) {
    if (!definition) return [];
    const sourceColumns = (definition.columns || []).map((width, index) => ({ width: String(width), index }));
    sourceColumns.sort((left, right) => Number(left.width) - Number(right.width));
    const columns = sourceColumns.map((source) => {
      const cells = new Map();
      (definition.rows || []).forEach((row) => {
        const key = row.cells?.[source.index];
        if (key) cells.set(String(row.label ?? row.length ?? ""), key);
      });
      return { width: source.width.replace(/\s*mm$/i, ""), cells };
    });
    return [{
      title: "Villaboard",
      thicknesses: [{ label: "6 mm", span: columns.length }],
      columns,
    }];
  }

  function mergeThicknesses(columns) {
    const groups = [];
    columns.forEach((column) => {
      const label = normaliseThickness(column.thickness);
      const previous = groups.at(-1);
      if (previous?.label === label) previous.span += 1;
      else groups.push({ label, span: 1 });
    });
    return groups;
  }

  function parseBoardDimensions(value) {
    const text = String(value || "").replace(/×/g, "x");
    const match = text.match(/(\d+(?:\.\d+)?)\s*mm.*?(\d{4})\s*mm\s*x\s*(\d{4})\s*mm/i);
    if (!match) return null;
    return {
      thickness: `${match[1]} mm`,
      width: match[2],
      length: match[3],
    };
  }

  function normaliseThickness(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    return /mm$/i.test(text) ? text.replace(/\s*mm$/i, " mm") : `${text} mm`;
  }

  function displayProductName(value) {
    const key = String(value || "").trim().toUpperCase().replace(/®|™/g, "").replace(/\s+/g, " ");
    const names = {
      "SHEETROCK ONE": "SHEETROCK® ONE",
      "SHEETROCK PLUS": "SHEETROCK® PLUS",
      "WETSTOP": "WETSTOP®",
      "FIRESTOP": "FIRESTOP®",
      "IMPACTSTOP": "ImpactStop™",
      "MULTISTOP ONE": "MultiStop™ ONE",
      "MULTISTOP ONE HI": "MultiStop™ ONE HI",
      "FLEXIBOARD": "FLEXIBOARD",
      "VILLABOARD": "Villaboard",
    };
    return names[key] || String(value || "").trim();
  }
})();