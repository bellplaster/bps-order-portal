const state = {
  catalog: {},
  layout: null,
  isSubmitting: false,
  editingOrder: null,
  activeFloor: "ground",
  draftSaveTimer: null,
  isRestoringDraft: false,
  suppressDraftUntilInput: false,
};

const DRAFT_STORAGE_KEY = "bps-standard-order-form-draft-v3";
const DRAFT_VERSION = 3;

const floorLabels = {
  ground: "Ground Floor",
  first: "1st Floor",
};

document.addEventListener("DOMContentLoaded", initialise);

async function initialise() {
  bindTabs();
  bindSubmission();
  bindLogout();
  bindDraftPersistence();

  document
    .getElementById("refreshHistoryButton")
    .addEventListener("click", loadOrderHistory);

  document
    .getElementById("cancelEditButton")
    .addEventListener("click", cancelEdit);

  await loadCatalog();
  await loadOrderHistory();
}

function bindTabs() {
  document.querySelectorAll("[data-floor-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activateFloorTab(button.dataset.floorTab);
    });
  });
}

function activateFloorTab(floor) {
  document.querySelectorAll("[data-floor-tab]").forEach((tab) => {
    const active = tab.dataset.floorTab === floor;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });

  document.querySelectorAll("[data-floor-panel]").forEach((panel) => {
    const active = panel.dataset.floorPanel === floor;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });

  state.activeFloor = floor;

  if (!state.isRestoringDraft) {
    scheduleDraftSave();
  }
}

function bindSubmission() {
  document
    .getElementById("orderForm")
    .addEventListener("submit", submitOrder);
}

function bindLogout() {
  document
    .getElementById("logoutButton")
    .addEventListener("click", async () => {
      await fetch("/api/logout", {
        method: "POST",
      }).catch(() => null);

      window.location.replace("/signin/");
    });
}

async function loadCatalog() {
  try {
    const response = await fetch("/api/catalog", {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 401) {
      window.location.replace("/signin/");
      return;
    }

    const result = await response.json().catch(() => ({
      ok: false,
      error: "The order form service returned an unreadable response.",
    }));

    if (!response.ok || !result.ok) {
      throw new Error(
        result.error ||
        result.message ||
        "The order form could not be loaded.",
      );
    }

    state.catalog = result.products || {};
    state.layout = result.layout || null;

    if (!state.layout) {
      throw new Error("The standard order-form layout is missing.");
    }

    renderFloorSheet("ground");
    renderFloorSheet("first");
    restoreDraft();
    updateAllFloorCounts();
  } catch (error) {
    showMessage(
      `The order form could not be loaded. ${error.message || String(error)}`,
      "error",
    );
  }
}

function renderFloorSheet(floor) {
  const container = document.getElementById(`${floor}OrderSheet`);
  container.replaceChildren();

  container.append(
    renderMainMatrix(floor, state.layout.mainMatrix),
  );

  const lowerGrid = document.createElement("div");
  lowerGrid.className = "lower-sheet-grid";

  state.layout.lowerColumns.forEach((sectionIds) => {
    const lane = document.createElement("div");
    lane.className = "lower-sheet-lane";

    sectionIds.forEach((sectionId) => {
      const section = state.layout.sections[sectionId];

      if (section) {
        lane.append(
          ["multi4", "multi3"].includes(section.id)
            ? renderMultiBoardSection(floor, section)
            : renderLowerSection(floor, section),
        );
      }
    });

    lowerGrid.append(lane);
  });

  container.append(lowerGrid);
}

function renderMainMatrix(floor, matrix) {
  const section = document.createElement("section");
  section.className = "sheet-section main-matrix-section";

  const title = document.createElement("div");
  title.className = "sheet-section-title";
  title.textContent = matrix.title;

  const scroller = document.createElement("div");
  scroller.className = "matrix-scroller";

  const table = document.createElement("table");
  table.className = "excel-matrix";

  const thead = document.createElement("thead");
  const groupRow = document.createElement("tr");

  const lengthHeading = document.createElement("th");
  lengthHeading.className = "matrix-length-heading";
  lengthHeading.textContent = "LENGTH";
  groupRow.append(lengthHeading);

  matrix.groups.forEach((group) => {
    const heading = document.createElement("th");
    heading.colSpan = group.span;
    heading.textContent = group.label;
    groupRow.append(heading);
  });

  const variantRow = document.createElement("tr");

  const unitHeading = document.createElement("th");
  unitHeading.className = "matrix-unit-heading";
  unitHeading.textContent = "mm";
  variantRow.append(unitHeading);

  matrix.columns.forEach((column) => {
    const heading = document.createElement("th");
    heading.textContent = column.variant || "Qty";
    variantRow.append(heading);
  });

  thead.append(groupRow, variantRow);
  table.append(thead);

  const tbody = document.createElement("tbody");

  matrix.rows.forEach((row) => {
    const tableRow = document.createElement("tr");

    const lengthCell = document.createElement("th");
    lengthCell.className = "matrix-length-cell";
    lengthCell.textContent = row.length;
    tableRow.append(lengthCell);

    row.cells.forEach((productKey) => {
      tableRow.append(
        createSheetQuantityCell(floor, productKey),
      );
    });

    tbody.append(tableRow);
  });

  table.append(tbody);
  scroller.append(table);
  section.append(title, scroller);

  return section;
}

function renderMultiBoardSection(
  floor,
  sectionDefinition,
) {
  const section = document.createElement("section");
  section.className =
    "sheet-section lower-sheet-section multi-board-section";

  const title = document.createElement("div");
  title.className = "sheet-section-title";
  title.textContent = sectionDefinition.title;

  const scroller = document.createElement("div");
  scroller.className = "lower-table-scroller";

  const table = document.createElement("table");
  table.className = "lower-sheet-table multi-board-table";

  const thead = document.createElement("thead");

  const axisRow = document.createElement("tr");

  const thicknessHeading = document.createElement("th");
  thicknessHeading.className = "multi-thickness-heading";
  thicknessHeading.textContent = "BOARD THICKNESS";

  const widthHeading = document.createElement("th");
  widthHeading.className = "multi-width-heading";
  widthHeading.colSpan = sectionDefinition.columns.length;
  widthHeading.textContent = "BOARD WIDTH";

  axisRow.append(thicknessHeading, widthHeading);

  const unitRow = document.createElement("tr");

  const thicknessUnit = document.createElement("th");
  thicknessUnit.textContent = "mm";
  unitRow.append(thicknessUnit);

  sectionDefinition.columns.forEach((column) => {
    const heading = document.createElement("th");
    heading.textContent = `${column} mm`;
    unitRow.append(heading);
  });

  thead.append(axisRow, unitRow);
  table.append(thead);

  const tbody = document.createElement("tbody");

  sectionDefinition.rows.forEach((row) => {
    const tableRow = document.createElement("tr");

    const labelCell = document.createElement("th");
    labelCell.textContent = row.label;
    tableRow.append(labelCell);

    row.cells.forEach((productKey) => {
      tableRow.append(
        createSheetQuantityCell(floor, productKey),
      );
    });

    tbody.append(tableRow);
  });

  table.append(tbody);
  scroller.append(table);
  section.append(title, scroller);

  return section;
}

function renderLowerSection(floor, sectionDefinition) {
  const section = document.createElement("section");
  section.className = "sheet-section lower-sheet-section";

  const title = document.createElement("div");
  title.className = "sheet-section-title";
  title.textContent = sectionDefinition.title;

  const scroller = document.createElement("div");
  scroller.className = "lower-table-scroller";

  const table = document.createElement("table");
  table.className = "lower-sheet-table";

  const thead = document.createElement("thead");
  const headingRow = document.createElement("tr");

  const rowHeader = document.createElement("th");
  rowHeader.textContent = sectionDefinition.rowHeader || "Product";
  headingRow.append(rowHeader);

  sectionDefinition.columns.forEach((column) => {
    const heading = document.createElement("th");
    heading.textContent = column;
    headingRow.append(heading);
  });

  thead.append(headingRow);
  table.append(thead);

  const tbody = document.createElement("tbody");

  sectionDefinition.rows.forEach((row) => {
    const tableRow = document.createElement("tr");

    const labelCell = document.createElement("th");
    const label = document.createElement("span");
    label.textContent = row.label;
    labelCell.append(label);

    if (row.detail) {
      const detail = document.createElement("small");
      detail.textContent = row.detail;
      labelCell.append(detail);
    }

    tableRow.append(labelCell);

    row.cells.forEach((productKey) => {
      tableRow.append(
        createSheetQuantityCell(floor, productKey),
      );
    });

    tbody.append(tableRow);
  });

  table.append(tbody);
  scroller.append(table);
  section.append(title, scroller);

  return section;
}

function createSheetQuantityCell(floor, productKey) {
  const cell = document.createElement("td");

  if (!productKey) {
    cell.className = "sheet-blocked-cell";
    cell.setAttribute("aria-hidden", "true");
    return cell;
  }

  cell.className = "sheet-quantity-cell";

  const product = state.catalog[productKey];

  if (!product) {
    cell.classList.add("sheet-blocked-cell");
    return cell;
  }

  const quantity = document.createElement("input");
  quantity.className = "quantity-input";
  quantity.type = "number";
  quantity.min = "0";
  quantity.max = "999";
  quantity.step = "1";
  quantity.inputMode = "numeric";
  quantity.autocomplete = "off";
  quantity.placeholder = "0";
  quantity.dataset.productKey = productKey;
  quantity.dataset.floor = floor;
  quantity.setAttribute(
    "aria-label",
    `${product.label} quantity for ${floorLabels[floor]}`,
  );
  quantity.title = product.label;

  quantity.addEventListener("input", () => {
    normaliseQuantityField(quantity);
    updateFloorCount(floor);
    markDraftChanged();
  });

  quantity.addEventListener("focus", () => {
    quantity.select();
  });

  quantity.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    focusNextQuantityField(
      floor,
      quantity,
      event.shiftKey ? -1 : 1,
    );
  });

  cell.append(quantity);
  return cell;
}

function normaliseQuantityField(field) {
  if (field.value === "") {
    return;
  }

  const quantity = Number(field.value);

  if (!Number.isFinite(quantity) || quantity < 0) {
    field.value = "";
    return;
  }

  field.value = String(
    Math.min(
      999,
      Math.floor(quantity),
    ),
  );
}

function getFloorItems(floor) {
  return Array.from(
    document.querySelectorAll(
      `.quantity-input[data-floor="${floor}"]`,
    ),
  )
    .map((field) => ({
      key: field.dataset.productKey,
      quantity: Number(field.value || 0),
    }))
    .filter((item) =>
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      item.quantity <= 999
    );
}

function getFloorNote(floor) {
  return document
    .getElementById(`${floor}OtherProducts`)
    .value
    .trim();
}

function updateFloorCount(floor) {
  const lineCount = getFloorItems(floor).length;
  document.getElementById(`${floor}TabCount`).textContent =
    String(lineCount);
}

function updateAllFloorCounts() {
  updateFloorCount("ground");
  updateFloorCount("first");
}

async function submitOrder(event) {
  event.preventDefault();

  if (state.isSubmitting) {
    return;
  }

  clearMessage();
  document.getElementById("successPanel").hidden = true;

  try {
    validateOrder();

    const payload = buildPayload();
    const editing = Boolean(state.editingOrder);
    const endpoint = editing
      ? `/api/orders/${encodeURIComponent(state.editingOrder.submissionId)}`
      : "/api/submit";

    state.isSubmitting = true;

    const button = document.getElementById("submitButton");
    button.disabled = true;
    button.textContent = editing
      ? "Saving changes…"
      : "Generating files…";

    showMessage(
      editing
        ? `Generating an updated revision for ${state.editingOrder.orderNumber}…`
        : "Generating order files…",
      "info",
    );

    const response = await fetch(endpoint, {
      method: editing ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      window.location.replace("/signin/");
      return;
    }

    const result = await response.json().catch(() => ({
      ok: false,
      error: "The submission service returned an unreadable response.",
    }));

    if (!response.ok || !result.ok) {
      const stage = result.diagnostic?.lastStage?.stage;
      const parts = [result.error || "The order could not be generated."];

      if (stage) {
        parts.push(`Failed stage: ${stage}.`);
      }

      if (result.requestId) {
        parts.push(`Request ID: ${result.requestId}.`);
      }

      throw new Error(parts.join(" "));
    }

    showSuccess(result);
    await loadOrderHistory();
    clearSavedDraft({
      statusText: result.updated
        ? "Revision saved. Local draft cleared."
        : "Order submitted. Local draft cleared.",
    });

    if (editing) {
      resetOrderForm();
    } else {
      state.suppressDraftUntilInput = true;
    }
  } catch (error) {
    showMessage(error.message || String(error), "error");
  } finally {
    state.isSubmitting = false;

    const button = document.getElementById("submitButton");
    button.disabled = false;
    button.textContent = state.editingOrder
      ? "Save changes"
      : "Submit order";
  }
}

function validateOrder() {
  const itemCount =
    getFloorItems("ground").length +
    getFloorItems("first").length;

  if (itemCount === 0) {
    throw new Error("Enter a quantity for at least one product.");
  }
}

function buildPayload() {
  const submissionId =
    typeof crypto.randomUUID === "function"
      ? `BPS-${crypto.randomUUID()}`
      : `BPS-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const floors = {};

  ["ground", "first"].forEach((floor) => {
    const items = getFloorItems(floor);
    const otherProducts = getFloorNote(floor);

    if (items.length === 0 && !otherProducts) {
      return;
    }

    floors[floor] = {
      dateRequired: new Date().toISOString().slice(0, 10),
      deliveryMode: "",
      deliverySequence: "",
      deliveryWindow: "",
      clearAccess: false,
      scaffolding: false,
      passUp: false,
      level: floor === "ground" ? "Ground Floor" : "1st Floor",
      areaSetAside: false,
      plasticWrap: false,
      deliveryNotes: "",
      items,
      otherProducts,
    };
  });

  return {
    submissionId,
    customerReference: "",
    jobName: "BPS Brunswick Plastering Services",
    siteAddress1: "125 Sussex Street",
    siteAddress2: "Pascoe Vale VIC 3044",
    siteContact: "",
    siteContactPhone: "",
    requesterName: "BPS",
    requesterPhone: "",
    comments: "",
    floors,
  };
}

function showSuccess(result) {
  clearMessage();

  const panel = document.getElementById("successPanel");
  const title = document.getElementById("successTitle");
  const summary = document.getElementById("successSummary");
  const files = document.getElementById("generatedFiles");

  files.replaceChildren();

  const generated = Array.isArray(result.generatedFiles)
    ? result.generatedFiles
    : [];

  title.textContent = result.updated
    ? "Order updated"
    : "Order created";

  if (generated.length > 0) {
    summary.textContent = result.updated
      ? `${generated.length} replacement file${generated.length === 1 ? " was" : "s were"} generated for Revision ${result.revisionNo}.`
      : `${generated.length} Accrivia file${generated.length === 1 ? " was" : "s were"} generated and saved.`;
  } else {
    summary.textContent =
      "The order was saved. No Accrivia file was generated because the selected lines still require SKU mapping.";
  }

  generated.forEach((file) => {
    const item = document.createElement("div");
    item.className = "generated-file";

    const info = document.createElement("div");
    info.className = "generated-file-info";

    const name = document.createElement("strong");
    name.textContent = file.filename;

    const detail = document.createElement("span");
    detail.textContent = `${file.floorLabel} · ${file.itemCount} line${file.itemCount === 1 ? "" : "s"}`;

    info.append(name, detail);
    item.append(info);

    if (file.downloadUrl) {
      item.append(
        createDownloadLink(
          file.downloadUrl,
          file.filename,
        ),
      );
    }

    files.append(item);
  });

  const manualReview = Array.isArray(result.manualReview)
    ? result.manualReview
    : [];

  const noteCount = manualReview.filter(
    (item) => item.kind === "order-note",
  ).length;

  const mappingCount = manualReview
    .filter((item) => item.kind === "sku-mapping")
    .reduce(
      (total, item) => total + (Array.isArray(item.items) ? item.items.length : 0),
      0,
    );

  if (noteCount > 0) {
    const notice = document.createElement("div");
    notice.className = "manual-review-warning";
    notice.textContent = "Your order note has been saved with this order.";
    files.append(notice);
  }

  if (mappingCount > 0) {
    const notice = document.createElement("div");
    notice.className = "mapping-warning";
    notice.textContent =
      `${mappingCount} selected product line${mappingCount === 1 ? " is" : "s are"} saved but awaiting Accrivia SKU mapping.`;
    files.append(notice);
  }

  document.getElementById("orderNumberDisplay").textContent =
    result.customerReference || result.submissionId || "Not returned";

  panel.hidden = false;
  panel.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

async function loadOrderHistory() {
  const status = document.getElementById("orderHistoryStatus");
  const list = document.getElementById("orderHistoryList");

  status.textContent = "Loading orders…";
  list.replaceChildren();

  try {
    const response = await fetch("/api/orders", {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 401) {
      window.location.replace("/signin/");
      return;
    }

    const result = await response.json().catch(() => ({
      ok: false,
      error: "The order history service returned an unreadable response.",
    }));

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Order history could not be loaded.");
    }

    const orders = Array.isArray(result.orders) ? result.orders : [];

    if (orders.length === 0) {
      status.textContent = "No orders yet.";
      return;
    }

    status.textContent = `${orders.length} order${orders.length === 1 ? "" : "s"}`;

    orders.forEach((order) => {
      list.append(createHistoryOrderCard(order));
    });
  } catch (error) {
    status.textContent = error.message || String(error);
  }
}

function createHistoryOrderCard(order) {
  const card = document.createElement("article");
  card.className = "history-order";

  const header = document.createElement("div");
  header.className = "history-order-header";

  const identity = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = order.customer_reference || order.submission_id;

  const meta = document.createElement("span");
  meta.textContent = [
    formatHistoryDate(order.updated_at || order.created_at),
    `Revision ${order.latest_revision || 1}`,
  ].join(" · ");

  identity.append(title, meta);

  const headerActions = document.createElement("div");
  headerActions.className = "history-header-actions";

  const badge = document.createElement("span");
  badge.className = `history-badge history-badge-${order.status || "unknown"}`;
  badge.textContent = String(order.status || "unknown").replace(/_/g, " ");
  headerActions.append(badge);

  if (order.can_edit) {
    const editButton = document.createElement("button");
    editButton.className = "button button-secondary button-small";
    editButton.type = "button";
    editButton.textContent = "Edit order";
    editButton.addEventListener("click", () => {
      editOrder(order.submission_id);
    });
    headerActions.append(editButton);
  }

  if (order.can_archive) {
    const archiveButton = document.createElement("button");
    archiveButton.className = "button button-secondary button-small";
    archiveButton.type = "button";
    archiveButton.textContent = "Archive";
    archiveButton.addEventListener("click", () => {
      changeOrderArchiveStatus(
        order.submission_id,
        order.customer_reference,
        "archive",
      );
    });
    headerActions.append(archiveButton);
  }

  if (order.can_restore) {
    const restoreButton = document.createElement("button");
    restoreButton.className = "button button-secondary button-small";
    restoreButton.type = "button";
    restoreButton.textContent = "Restore";
    restoreButton.addEventListener("click", () => {
      changeOrderArchiveStatus(
        order.submission_id,
        order.customer_reference,
        "restore",
      );
    });
    headerActions.append(restoreButton);
  }

  if (order.can_delete) {
    const deleteButton = document.createElement("button");
    deleteButton.className = "button button-danger button-small";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      deleteOrder(
        order.submission_id,
        order.customer_reference,
      );
    });
    headerActions.append(deleteButton);
  }

  header.append(identity, headerActions);
  card.append(header);

  if (
    Array.isArray(order.other_products) &&
    order.other_products.length > 0
  ) {
    const noteBlock = document.createElement("div");
    noteBlock.className = "history-note-block";

    const heading = document.createElement("strong");
    heading.textContent = "Order note";
    noteBlock.append(heading);

    order.other_products.forEach((item) => {
      const line = document.createElement("span");
      line.textContent = `${item.floor_label}: ${item.details}`;
      noteBlock.append(line);
    });

    card.append(noteBlock);
  }

  if (
    Array.isArray(order.pending_mapping) &&
    order.pending_mapping.length > 0
  ) {
    const mappingBlock = document.createElement("details");
    mappingBlock.className = "history-mapping-block";

    const summary = document.createElement("summary");
    const pendingCount = order.pending_mapping.reduce(
      (total, floor) => total + (floor.items?.length || 0),
      0,
    );
    summary.textContent =
      `${pendingCount} line${pendingCount === 1 ? "" : "s"} awaiting SKU mapping`;
    mappingBlock.append(summary);

    order.pending_mapping.forEach((floor) => {
      floor.items.forEach((item) => {
        const line = document.createElement("span");
        line.textContent =
          `${floor.floor_label}: ${item.label} × ${item.quantity}`;
        mappingBlock.append(line);
      });
    });

    card.append(mappingBlock);
  }

  if (Array.isArray(order.files) && order.files.length > 0) {
    const files = document.createElement("div");
    files.className = "history-files";

    order.files.forEach((file) => {
      const row = document.createElement("div");
      row.className = "history-file-row";

      const info = document.createElement("div");
      info.className = "history-file-info";

      const name = document.createElement("strong");
      name.textContent = file.filename;

      const detail = document.createElement("span");
      detail.textContent = [
        `Revision ${file.revision || 1}`,
        file.floor_label,
        `${file.item_count} line${file.item_count === 1 ? "" : "s"}`,
      ].join(" · ");

      info.append(name, detail);
      row.append(info);

      if (file.download_url) {
        row.append(
          createDownloadLink(
            file.download_url,
            file.filename,
          ),
        );
      }

      files.append(row);
    });

    card.append(files);
  }

  return card;
}

function createDownloadLink(url, filename) {
  const link = document.createElement("a");
  link.className = "button button-secondary button-small download-button";
  link.href = url;
  link.textContent = "Download XLSX";
  link.setAttribute("download", filename || "");

  return link;
}

async function editOrder(submissionId) {
  clearMessage();
  document.getElementById("successPanel").hidden = true;

  try {
    const response = await fetch(
      `/api/orders/${encodeURIComponent(submissionId)}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (response.status === 401) {
      window.location.replace("/signin/");
      return;
    }

    const result = await response.json().catch(() => ({
      ok: false,
      error: "The order could not be loaded for editing.",
    }));

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "The order could not be loaded for editing.");
    }

    populateOrderForEditing(result);
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

function populateOrderForEditing(result) {
  clearProductSelections();

  const payload = result.payload || {};
  const floors = payload.floors || {};

  ["ground", "first"].forEach((floor) => {
    const floorPayload = floors[floor];

    if (!floorPayload) {
      return;
    }

    for (const item of floorPayload.items || []) {
      const field = document.querySelector(
        `.quantity-input[data-floor="${floor}"][data-product-key="${cssEscape(item.key)}"]`,
      );

      if (!field) {
        continue;
      }

      field.value = String(item.quantity);
    }

    document.getElementById(`${floor}OtherProducts`).value =
      floorPayload.otherProducts || "";

    updateFloorCount(floor);
  });

  state.editingOrder = {
    submissionId: result.order.submissionId,
    orderNumber: result.order.orderNumber,
    latestRevision: result.order.latestRevision,
  };

  document.getElementById("editOrderNumber").textContent =
    result.order.orderNumber;

  document.getElementById("editRevisionText").textContent =
    `Saving will create Revision ${result.order.latestRevision + 1}. Earlier files will remain available.`;

  document.getElementById("editModeBanner").hidden = false;
  document.getElementById("submitButton").textContent = "Save changes";

  const firstIncluded = floors.ground
    ? "ground"
    : "first";

  activateFloorTab(firstIncluded);
  state.suppressDraftUntilInput = false;
  saveDraftNow();

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function cancelEdit() {
  resetOrderForm();
  clearMessage();
  document.getElementById("successPanel").hidden = true;
}

function resetOrderForm() {
  state.editingOrder = null;
  clearProductSelections();
  activateFloorTab("ground");
  document.getElementById("editModeBanner").hidden = true;
  document.getElementById("editOrderNumber").textContent = "";
  document.getElementById("editRevisionText").textContent = "";
  document.getElementById("submitButton").textContent = "Submit order";
  clearSavedDraft({
    statusText: "Form cleared.",
  });
  state.suppressDraftUntilInput = true;
}

function clearProductSelections() {
  document.querySelectorAll(".quantity-input").forEach((field) => {
    field.value = "";
  });

  ["ground", "first"].forEach((floor) => {
    document.getElementById(`${floor}OtherProducts`).value = "";
    updateFloorCount(floor);
  });
}

async function changeOrderArchiveStatus(
  submissionId,
  orderNumber,
  action,
) {
  const verb = action === "archive"
    ? "archive"
    : "restore";

  if (
    action === "archive" &&
    !window.confirm(
      `Archive ${orderNumber}? The order and files will remain available.`,
    )
  ) {
    return;
  }

  try {
    const response = await fetch(
      `/api/orders/${encodeURIComponent(submissionId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action,
        }),
      },
    );

    const result = await response.json().catch(() => ({
      ok: false,
      error: `The order could not be ${verb}d.`,
    }));

    if (!response.ok || !result.ok) {
      throw new Error(
        result.error ||
        `The order could not be ${verb}d.`,
      );
    }

    if (
      state.editingOrder?.submissionId === submissionId &&
      action === "archive"
    ) {
      cancelEdit();
    }

    await loadOrderHistory();
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

async function deleteOrder(
  submissionId,
  orderNumber,
) {
  const confirmed = window.confirm(
    `Permanently delete ${orderNumber}? This removes its order history and every generated file. This cannot be undone.`,
  );

  if (!confirmed) {
    return;
  }

  const typed = window.prompt(
    `Type ${orderNumber} to confirm permanent deletion.`,
  );

  if (typed !== orderNumber) {
    showMessage("Deletion cancelled because the order number did not match.", "error");
    return;
  }

  try {
    const response = await fetch(
      `/api/orders/${encodeURIComponent(submissionId)}`,
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      },
    );

    const result = await response.json().catch(() => ({
      ok: false,
      error: "The order could not be deleted.",
    }));

    if (!response.ok || !result.ok) {
      throw new Error(
        result.error ||
        "The order could not be deleted.",
      );
    }

    if (state.editingOrder?.submissionId === submissionId) {
      cancelEdit();
    }

    document.getElementById("successPanel").hidden = true;
    clearMessage();
    await loadOrderHistory();
  } catch (error) {
    showMessage(error.message || String(error), "error");
  }
}

function bindDraftPersistence() {
  ["ground", "first"].forEach((floor) => {
    document
      .getElementById(`${floor}OtherProducts`)
      .addEventListener("input", markDraftChanged);
  });

  window.addEventListener("beforeunload", () => {
    saveDraftNow({
      silent: true,
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      saveDraftNow({
        silent: true,
      });
    }
  });
}

function markDraftChanged() {
  state.suppressDraftUntilInput = false;
  scheduleDraftSave();
}

function scheduleDraftSave() {
  if (
    state.isRestoringDraft ||
    state.suppressDraftUntilInput
  ) {
    return;
  }

  setDraftStatus("Saving draft…", "saving");

  window.clearTimeout(state.draftSaveTimer);

  state.draftSaveTimer = window.setTimeout(() => {
    saveDraftNow();
  }, 180);
}

function saveDraftNow(options = {}) {
  if (
    state.isRestoringDraft ||
    state.suppressDraftUntilInput ||
    !state.layout
  ) {
    return;
  }

  window.clearTimeout(state.draftSaveTimer);

  const draft = collectDraft();

  if (!draftHasContent(draft)) {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (_error) {
      // Local storage may be disabled by the browser.
    }

    if (!options.silent) {
      setDraftStatus(
        "Changes save automatically on this device.",
        "idle",
      );
    }

    return;
  }

  try {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify(draft),
    );

    if (!options.silent) {
      setDraftStatus(
        `Draft saved ${formatDraftTime(draft.updatedAt)}.`,
        "saved",
      );
    }
  } catch (_error) {
    if (!options.silent) {
      setDraftStatus(
        "Draft saving is unavailable in this browser.",
        "error",
      );
    }
  }
}

function collectDraft() {
  const floors = {};

  ["ground", "first"].forEach((floor) => {
    const quantities = {};

    document
      .querySelectorAll(
        `.quantity-input[data-floor="${floor}"]`,
      )
      .forEach((field) => {
        const value = Number(field.value || 0);

        if (
          Number.isInteger(value) &&
          value > 0 &&
          value <= 999
        ) {
          quantities[field.dataset.productKey] = value;
        }
      });

    floors[floor] = {
      quantities,
      note:
        document
          .getElementById(`${floor}OtherProducts`)
          .value,
    };
  });

  return {
    version: DRAFT_VERSION,
    updatedAt: new Date().toISOString(),
    activeFloor: state.activeFloor,
    editingOrder: state.editingOrder,
    floors,
  };
}

function draftHasContent(draft) {
  if (draft.editingOrder) {
    return true;
  }

  return Object.values(draft.floors || {}).some((floor) => {
    return (
      Object.keys(floor.quantities || {}).length > 0 ||
      String(floor.note || "").trim().length > 0
    );
  });
}

function restoreDraft() {
  let draft;

  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);

    if (!raw) {
      setDraftStatus(
        "Changes save automatically on this device.",
        "idle",
      );
      return;
    }

    draft = JSON.parse(raw);
  } catch (_error) {
    setDraftStatus(
      "The previous browser draft could not be read.",
      "error",
    );
    return;
  }

  if (
    !draft ||
    draft.version !== DRAFT_VERSION
  ) {
    clearSavedDraft();
    return;
  }

  state.isRestoringDraft = true;

  try {
    ["ground", "first"].forEach((floor) => {
      const floorDraft = draft.floors?.[floor] || {};

      Object.entries(
        floorDraft.quantities || {},
      ).forEach(([productKey, quantity]) => {
        const field = document.querySelector(
          `.quantity-input[data-floor="${floor}"][data-product-key="${cssEscape(productKey)}"]`,
        );

        if (field) {
          field.value = String(quantity);
        }
      });

      document.getElementById(`${floor}OtherProducts`).value =
        floorDraft.note || "";
    });

    state.editingOrder =
      draft.editingOrder || null;

    if (state.editingOrder) {
      document.getElementById("editOrderNumber").textContent =
        state.editingOrder.orderNumber || "";

      document.getElementById("editRevisionText").textContent =
        `Saving will create Revision ${(state.editingOrder.latestRevision || 0) + 1}. Earlier files will remain available.`;

      document.getElementById("editModeBanner").hidden = false;
      document.getElementById("submitButton").textContent =
        "Save changes";
    }

    activateFloorTab(
      ["ground", "first"].includes(draft.activeFloor)
        ? draft.activeFloor
        : "ground",
    );

    updateAllFloorCounts();
    state.suppressDraftUntilInput = false;

    setDraftStatus(
      `Draft restored from ${formatDraftTime(draft.updatedAt)}.`,
      "restored",
    );
  } finally {
    state.isRestoringDraft = false;
  }
}

function clearSavedDraft(options = {}) {
  window.clearTimeout(state.draftSaveTimer);

  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (_error) {
    // Local storage may be disabled by the browser.
  }

  if (options.statusText) {
    setDraftStatus(
      options.statusText,
      "saved",
    );
  }
}

function setDraftStatus(text, status) {
  const element =
    document.getElementById("draftStatus");

  if (!element) {
    return;
  }

  element.textContent = text;
  element.dataset.status = status || "idle";
}

function formatDraftTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat(
    "en-AU",
    {
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(date);
}

function focusNextQuantityField(
  floor,
  currentField,
  direction,
) {
  const fields = Array.from(
    document.querySelectorAll(
      `[data-floor-panel="${floor}"] .quantity-input`,
    ),
  );

  const currentIndex =
    fields.indexOf(currentField);

  if (currentIndex < 0) {
    return;
  }

  const nextIndex =
    currentIndex + direction;

  const nextField =
    fields[nextIndex];

  if (!nextField) {
    return;
  }

  nextField.focus();
  nextField.select();
  nextField.scrollIntoView({
    block: "nearest",
    inline: "nearest",
  });
}

function formatHistoryDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value || "");
  }

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(String(value));
  }

  return String(value).replace(/(["\\])/g, "\\$1");
}

function showMessage(text, type) {
  const message = document.getElementById("formMessage");
  message.textContent = text;
  message.className = `message message-${type}`;
  message.hidden = false;
}

function clearMessage() {
  const message = document.getElementById("formMessage");
  message.hidden = true;
  message.textContent = "";
  message.className = "message";
}
