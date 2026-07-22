function renderFloorSheet(floor) {
  const root = document.getElementById(`${floor}OrderSheet`);
  root.replaceChildren();
  root.append(renderMainBoardMatrix(floor, state.layout.mainBoard));
  root.append(renderSpecialtyBoards(floor, state.layout.specialtyBoards));

  const lower = document.createElement("div");
  lower.className = "pdf-lower-grid";
  for (const columnIds of state.layout.lowerColumns || []) {
    const column = document.createElement("div");
    column.className = "pdf-lower-column";
    for (const id of columnIds) {
      const definition = state.layout.sections?.[id];
      if (definition) column.append(renderSection(floor, definition));
    }
    lower.append(column);
  }
  root.append(lower);
}

function renderMainBoardMatrix(floor, definition) {
  const section = document.createElement("section");
  section.className = "pdf-product-section pdf-board-section";
  section.innerHTML = `<h3 class="pdf-section-title">${escapeHtml(definition.title || "BOARD")}</h3>`;
  const wrap = document.createElement("div");
  wrap.className = "board-table-wrap";
  const table = document.createElement("table");
  table.className = "pdf-table main-board-table";
  const thead = document.createElement("thead");
  const groupRow = document.createElement("tr");
  const lengthTop = document.createElement("th");
  lengthTop.rowSpan = 3;
  lengthTop.textContent = "Length";
  groupRow.append(lengthTop);
  (definition.groups || []).forEach((group) => {
    const th = document.createElement("th");
    th.colSpan = group.span;
    th.innerHTML = `<strong>${escapeHtml(group.group)}</strong><span>${escapeHtml(group.subgroup)}</span>`;
    groupRow.append(th);
  });
  const variantRow = document.createElement("tr");
  (definition.columns || []).forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column.variant;
    variantRow.append(th);
  });
  const unitRow = document.createElement("tr");
  (definition.columns || []).forEach(() => {
    const th = document.createElement("th");
    th.textContent = "mm";
    unitRow.append(th);
  });
  thead.append(groupRow, variantRow, unitRow);
  const tbody = document.createElement("tbody");
  (definition.rows || []).forEach((row) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = row.length;
    tr.append(th);
    (row.cells || []).forEach((key) => tr.append(createQuantityCell(floor, key)));
    tbody.append(tr);
  });
  table.append(thead, tbody);
  wrap.append(table);
  section.append(wrap);
  return section;
}

function renderSpecialtyBoards(floor, groups) {
  const section = document.createElement("section");
  section.className = "specialty-grid";
  (groups || []).forEach((group) => {
    const card = document.createElement("div");
    card.className = "specialty-card";
    const title = document.createElement("h3");
    title.className = "pdf-section-title";
    title.textContent = group.title;
    card.append(title);
    (group.rows || []).forEach((row) => {
      const line = document.createElement("div");
      line.className = "pdf-list-row";
      const label = document.createElement("span");
      label.textContent = combinedLabel(row.label, row.detail);
      line.append(label, createQuantityInput(floor, row.key));
      card.append(line);
    });
    section.append(card);
  });
  return section;
}

function renderSection(floor, definition) {
  if (definition.type === "matrix") return renderMatrixSection(floor, definition);
  if (definition.type === "list") return renderListSection(floor, definition);
  if (definition.type === "insulation") return renderInsulationSection(floor, definition);
  if (definition.type === "otherMaterials") return renderOtherMaterialsSection(floor, definition);
  return document.createDocumentFragment();
}

function renderMatrixSection(floor, definition) {
  const section = document.createElement("section");
  section.className = "pdf-product-section";
  const title = document.createElement("h3");
  title.className = "pdf-section-title";
  title.textContent = definition.title;
  section.append(title);
  const table = document.createElement("table");
  table.className = "pdf-table compact-table";
  const thead = document.createElement("thead");
  const head = document.createElement("tr");
  const first = document.createElement("th");
  first.textContent = definition.rowHeader || "Product";
  head.append(first);
  (definition.columns || []).forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column;
    head.append(th);
  });
  thead.append(head);
  const tbody = document.createElement("tbody");
  (definition.rows || []).forEach((row) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = combinedLabel(row.label, row.detail);
    tr.append(th);
    (row.cells || []).forEach((key) => tr.append(createQuantityCell(floor, key)));
    tbody.append(tr);
  });
  table.append(thead, tbody);
  section.append(table);
  return section;
}

function renderListSection(floor, definition) {
  const section = document.createElement("section");
  section.className = "pdf-product-section";
  const title = document.createElement("h3");
  title.className = "pdf-section-title";
  title.textContent = definition.title;
  section.append(title);
  const list = document.createElement("div");
  list.className = "pdf-list";
  (definition.rows || []).forEach((row) => {
    const line = document.createElement("div");
    line.className = "pdf-list-row";
    const label = document.createElement("span");
    label.textContent = combinedLabel(row.label, row.detail);
    line.append(label, createQuantityInput(floor, row.key));
    list.append(line);
  });
  section.append(list);
  return section;
}

function renderInsulationSection(floor, definition) {
  const section = document.createElement("section");
  section.className = "pdf-product-section";
  const title = document.createElement("h3");
  title.className = "pdf-section-title";
  title.textContent = "INSULATION";
  section.append(title);
  section.append(renderSimpleInsulationTable(floor, "Thermal Batts", definition.thermalRows));
  section.append(renderSimpleInsulationTable(floor, "Acoustic", definition.acousticRows));
  return section;
}

function renderSimpleInsulationTable(floor, titleText, rows) {
  const block = document.createElement("div");
  block.className = "insulation-block";
  const heading = document.createElement("h4");
  heading.textContent = titleText;
  block.append(heading);
  const table = document.createElement("table");
  table.className = "pdf-table compact-table";
  table.innerHTML = "<thead><tr><th>Product</th><th>430 mm</th><th>580 mm</th></tr></thead>";
  const tbody = document.createElement("tbody");
  (rows || []).forEach((row) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = combinedLabel(row.label, row.detail);
    tr.append(th);
    (row.cells || []).forEach((key) => tr.append(createQuantityCell(floor, key)));
    tbody.append(tr);
  });
  table.append(tbody);
  block.append(table);
  return block;
}

function renderOtherMaterialsSection(floor) {
  const section = document.createElement("section");
  section.className = "pdf-product-section other-materials-section";
  const title = document.createElement("h3");
  title.className = "pdf-section-title";
  title.textContent = "ADDITIONAL PRODUCTS";
  const search = document.createElement("div");
  search.className = "additional-search";
  search.innerHTML = `
    <label for="${floor}AdditionalSearch">Search the full Accrivia catalogue</label>
    <input id="${floor}AdditionalSearch" type="search" autocomplete="off" placeholder="Stock code or product description">
    <div class="additional-results" data-additional-results="${floor}" hidden></div>
  `;
  const selected = document.createElement("div");
  selected.className = "selected-additional";
  selected.dataset.selectedAdditional = floor;
  section.append(title, search, selected);
  search.querySelector("input").addEventListener("input", (event) => searchAdditionalProducts(floor, event.target.value));
  renderSelectedAdditional(floor, selected);
  return section;
}

function createQuantityCell(floor, key) {
  const td = document.createElement("td");
  if (!key) {
    td.className = "unavailable-cell";
    td.setAttribute("aria-label", "Not available");
    return td;
  }
  td.append(createQuantityInput(floor, key));
  return td;
}

function createQuantityInput(floor, key) {
  const product = state.catalog[key];
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.pattern = "[0-9]*";
  input.maxLength = 3;
  input.className = "quantity-input";
  input.value = String(state.quantities[floor].get(key) || "");
  input.placeholder = "0";
  input.setAttribute("aria-label", `${product?.label || key} quantity for ${floorLabels[floor]}`);
  input.addEventListener("focus", () => input.select());
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 3);
    const quantity = Math.min(999, Number(input.value || 0));
    if (quantity > 0) state.quantities[floor].set(key, quantity);
    else state.quantities[floor].delete(key);
    renderCounts();
    scheduleDraft();
  });
  return input;
}

async function searchAdditionalProducts(floor, query) {
  clearTimeout(state.searchTimer);
  const results = document.querySelector(`[data-additional-results="${floor}"]`);
  if (!results) return;
  if (query.trim().length < 2) {
    results.hidden = true;
    results.replaceChildren();
    return;
  }
  state.searchTimer = setTimeout(async () => {
    try {
      const response = await fetchJson(`/api/products?q=${encodeURIComponent(query.trim())}`);
      results.replaceChildren();
      const products = response.products || [];
      if (!products.length) {
        results.innerHTML = '<p class="empty-state">No matching active products.</p>';
      } else {
        const header = document.createElement("div");
        header.className = "additional-result-header";
        header.innerHTML = "<span>SKU</span><span>Product description</span><span>Action</span>";
        results.append(header);
        products.slice(0, 20).forEach((product) => {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "additional-result-row";
          row.innerHTML = `<strong>${escapeHtml(product.sku)}</strong><span>${escapeHtml(product.description)}</span><em>Add</em>`;
          row.addEventListener("click", () => addAdditionalProduct(floor, product));
          results.append(row);
        });
      }
      results.hidden = false;
    } catch (error) {
      results.innerHTML = `<p class="empty-state">${escapeHtml(error.message || String(error))}</p>`;
      results.hidden = false;
    }
  }, 220);
}

function addAdditionalProduct(floor, product) {
  const existing = state.otherMaterials[floor].find((item) => item.sku.toLowerCase() === product.sku.toLowerCase());
  if (existing) existing.quantity = Math.min(999, existing.quantity + 1);
  else state.otherMaterials[floor].push({ sku: product.sku, description: product.description, quantity: 1 });
  renderSelectedAdditional(floor);
  const search = document.getElementById(`${floor}AdditionalSearch`);
  if (search) search.value = "";
  const results = document.querySelector(`[data-additional-results="${floor}"]`);
  if (results) { results.hidden = true; results.replaceChildren(); }
  renderCounts();
  scheduleDraft();
}

function renderSelectedAdditional(floor, suppliedContainer = null) {
  const container = suppliedContainer || document.querySelector(`[data-selected-additional="${floor}"]`);
  if (!container) return;
  container.replaceChildren();
  if (!state.otherMaterials[floor].length) {
    container.innerHTML = '<p class="empty-state">No additional products selected.</p>';
    return;
  }
  const header = document.createElement("div");
  header.className = "selected-additional-header";
  header.innerHTML = "<span>SKU</span><span>Product description</span><span>Qty</span><span></span>";
  container.append(header);
  state.otherMaterials[floor].forEach((item) => {
    const row = document.createElement("div");
    row.className = "selected-additional-row";
    const sku = document.createElement("strong");
    sku.textContent = item.sku;
    const description = document.createElement("span");
    description.textContent = item.description;
    const quantity = document.createElement("input");
    quantity.type = "text";
    quantity.inputMode = "numeric";
    quantity.maxLength = 3;
    quantity.className = "quantity-input";
    quantity.value = item.quantity;
    quantity.setAttribute("aria-label", `${item.sku} quantity`);
    quantity.addEventListener("input", () => {
      quantity.value = quantity.value.replace(/\D/g, "").slice(0, 3);
      item.quantity = Math.max(1, Math.min(999, Number(quantity.value || 1)));
      renderCounts();
      scheduleDraft();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-row";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${item.sku}`);
    remove.addEventListener("click", () => {
      state.otherMaterials[floor] = state.otherMaterials[floor].filter((candidate) => candidate !== item);
      renderSelectedAdditional(floor);
      renderCounts();
      scheduleDraft();
    });
    row.append(sku, description, quantity, remove);
    container.append(row);
  });
}

function activateFloor(floor) {
  state.activeFloor = floor;
  document.querySelectorAll("[data-floor-tab]").forEach((button) => {
    const active = button.dataset.floorTab === floor;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-floor-panel]").forEach((panel) => {
    const active = panel.dataset.floorPanel === floor;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
}
