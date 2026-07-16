const state = {
  catalog: {},
  isSubmitting: false,
  editingOrder: null,
};

const sectionOrder = [
  "Knauf board matrix",
  "Specialty boards",
  "Compounds",
  "Cornice",
  "Partiwall",
  "Accessories",
];

const floorLabels = {
  ground: "Ground Floor",
  first: "1st Floor",
};

document.addEventListener("DOMContentLoaded", initialise);

async function initialise() {
  bindTabs();
  bindFloorToggles();
  bindSearch();
  bindSubmission();
  bindLogout();

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
}

function bindFloorToggles() {
  ["ground", "first"].forEach((floor) => {
    document
      .getElementById(`${floor}Enabled`)
      .addEventListener("change", () => {
        applyFloorEnabledState(floor);
      });
  });
}

function applyFloorEnabledState(floor) {
  const enabled = document.getElementById(`${floor}Enabled`).checked;
  const content = document.querySelector(
    `[data-floor-content="${floor}"]`,
  );

  content.classList.toggle("is-disabled", !enabled);

  content.querySelectorAll("input, textarea, button").forEach((field) => {
    field.disabled = !enabled;
  });

  updateFloorSummary(floor);
}

function setFloorEnabled(floor, enabled) {
  document.getElementById(`${floor}Enabled`).checked = enabled;
  applyFloorEnabledState(floor);
}

function bindSearch() {
  ["ground", "first"].forEach((floor) => {
    document
      .getElementById(`${floor}ProductSearch`)
      .addEventListener("input", (event) => {
        filterProducts(floor, event.target.value);
      });
  });
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
      error: "The catalogue service returned an unreadable response.",
    }));

    if (!response.ok || !result.ok) {
      throw new Error(
        result.error ||
        result.message ||
        "The product catalogue could not be loaded.",
      );
    }

    state.catalog = result.products || {};

    ["ground", "first"].forEach((floor) => {
      renderCatalog(floor);
      applyFloorEnabledState(floor);
    });
  } catch (error) {
    showMessage(
      `The product catalogue could not be loaded. ${error.message || String(error)}`,
      "error",
    );
  }
}

function renderCatalog(floor) {
  const container = document.getElementById(`${floor}ProductList`);
  container.replaceChildren();

  const grouped = {};

  Object.entries(state.catalog).forEach(([key, product]) => {
    if (!Array.isArray(product.floors) || !product.floors.includes(floor)) {
      return;
    }

    const section = product.section || "Other";
    grouped[section] ||= [];
    grouped[section].push({
      key,
      ...product,
    });
  });

  const sections = Object.keys(grouped).sort((left, right) => {
    const leftIndex = sectionOrder.indexOf(left);
    const rightIndex = sectionOrder.indexOf(right);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });

  sections.forEach((section, sectionIndex) => {
    const products = grouped[section].sort((left, right) =>
      left.label.localeCompare(right.label),
    );

    const details = document.createElement("details");
    details.className = "product-section";
    details.open = sectionIndex === 0;

    const summary = document.createElement("summary");

    const title = document.createElement("span");
    title.textContent = section;

    const count = document.createElement("span");
    count.className = "section-count";
    count.textContent = String(products.length);

    summary.append(title, count);
    details.append(summary);

    const grid = document.createElement("div");
    grid.className = "product-list";

    products.forEach((product) => {
      grid.append(createProductRow(floor, product));
    });

    details.append(grid);
    container.append(details);
  });
}

function createProductRow(floor, product) {
  const row = document.createElement("label");
  row.className = "product-row";
  row.dataset.searchText = [
    product.label,
    product.sku,
    product.description,
    product.section,
  ]
    .join(" ")
    .toLowerCase();

  const info = document.createElement("span");
  info.className = "product-info";

  const label = document.createElement("strong");
  label.textContent = product.label;

  const meta = document.createElement("span");
  meta.className = "product-meta";
  meta.textContent = product.sku;

  info.append(label, meta);

  const quantity = document.createElement("input");
  quantity.className = "quantity-input";
  quantity.type = "number";
  quantity.min = "0";
  quantity.max = "999";
  quantity.step = "1";
  quantity.inputMode = "numeric";
  quantity.autocomplete = "off";
  quantity.placeholder = "0";
  quantity.setAttribute("aria-label", `${product.label} quantity`);
  quantity.dataset.productKey = product.key;
  quantity.dataset.floor = floor;
  quantity.disabled = !document.getElementById(`${floor}Enabled`).checked;

  quantity.addEventListener("input", () => {
    normaliseQuantityField(quantity);
    updateFloorSummary(floor);
  });

  row.append(info, quantity);
  return row;
}

function normaliseQuantityField(field) {
  const digits = String(field.value || "")
    .replace(/\D/g, "")
    .slice(0, 3);

  if (!digits) {
    field.value = "";
    return;
  }

  const quantity = Math.min(
    999,
    Number.parseInt(digits, 10),
  );

  field.value = Number.isFinite(quantity)
    ? String(quantity)
    : "";
}

function filterProducts(floor, rawQuery) {
  const query = String(rawQuery || "").trim().toLowerCase();
  const container = document.getElementById(`${floor}ProductList`);

  container.querySelectorAll(".product-section").forEach((section) => {
    let visibleRows = 0;

    section.querySelectorAll(".product-row").forEach((row) => {
      const visible = !query || row.dataset.searchText.includes(query);
      row.hidden = !visible;

      if (visible) {
        visibleRows += 1;
      }
    });

    section.hidden = visibleRows === 0;

    if (query && visibleRows > 0) {
      section.open = true;
    }
  });
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
    .filter((item) => Number.isInteger(item.quantity) && item.quantity > 0);
}

function updateFloorSummary(floor) {
  const enabled = document.getElementById(`${floor}Enabled`).checked;
  const items = enabled ? getFloorItems(floor) : [];
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  const text = !enabled
    ? "Floor not included"
    : items.length === 0
      ? "No products selected"
      : `${items.length} line${items.length === 1 ? "" : "s"} · ${totalUnits} total`;

  document.getElementById(`${floor}Summary`).textContent = text;
  document.getElementById(`${floor}TabCount`).textContent = String(items.length);
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
    resetOrderForm();
    await loadOrderHistory();
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
  const enabledFloors = ["ground", "first"].filter(
    (floor) => document.getElementById(`${floor}Enabled`).checked,
  );

  if (enabledFloors.length === 0) {
    throw new Error("Include at least one floor.");
  }

  enabledFloors.forEach((floor) => {
    const items = getFloorItems(floor);
    const otherProducts = document
      .getElementById(`${floor}OtherProducts`)
      .value.trim();

    if (items.length === 0 && !otherProducts) {
      activateFloorTab(floor);
      throw new Error(
        `${floorLabels[floor]} requires at least one product.`,
      );
    }
  });
}

function buildPayload() {
  const submissionId = state.editingOrder?.submissionId || (
    typeof crypto.randomUUID === "function"
      ? `BPS-${crypto.randomUUID()}`
      : `BPS-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  const floors = {};

  ["ground", "first"].forEach((floor) => {
    if (!document.getElementById(`${floor}Enabled`).checked) {
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
      items: getFloorItems(floor),
      otherProducts: document
        .getElementById(`${floor}OtherProducts`)
        .value.trim(),
    };
  });

  return {
    submissionId,
    customerReference: state.editingOrder?.orderNumber || "",
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
    `Permanently delete ${orderNumber}? This removes its D1 history and every XLSX and metadata file from R2. This cannot be undone.`,
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
    setFloorEnabled(floor, Boolean(floorPayload));

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
      field.closest("details").open = true;
    }

    document.getElementById(`${floor}OtherProducts`).value =
      floorPayload.otherProducts || "";

    updateFloorSummary(floor);
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

  const firstIncluded = Boolean(floors.ground)
    ? "ground"
    : "first";

  activateFloorTab(firstIncluded);

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
  setFloorEnabled("ground", true);
  setFloorEnabled("first", false);
  activateFloorTab("ground");
  document.getElementById("editModeBanner").hidden = true;
  document.getElementById("editOrderNumber").textContent = "";
  document.getElementById("editRevisionText").textContent = "";
  document.getElementById("submitButton").textContent = "Submit order";
}

function clearProductSelections() {
  document.querySelectorAll(".quantity-input").forEach((field) => {
    field.value = "";
  });

  ["ground", "first"].forEach((floor) => {
    document.getElementById(`${floor}OtherProducts`).value = "";
    document.getElementById(`${floor}ProductSearch`).value = "";
    filterProducts(floor, "");
    updateFloorSummary(floor);
  });
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(String(value));
  }

  return String(value).replace(/(["\\])/g, "\\$1");
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

  summary.textContent = result.duplicate
    ? "This order was already processed."
    : result.updated
      ? `${generated.length} replacement file${generated.length === 1 ? " was" : "s were"} generated for Revision ${result.revisionNo}.`
      : `${generated.length} Accrivia file${generated.length === 1 ? " was" : "s were"} generated and saved.`;

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
      const download = createDownloadLink(
        file.downloadUrl,
        file.filename,
      );
      item.append(download);
    }

    files.append(item);
  });

  if (Array.isArray(result.manualReview) && result.manualReview.length > 0) {
    const warning = document.createElement("div");
    warning.className = "manual-review-warning";
    warning.textContent =
      "Your order note has been saved with this order.";
    files.append(warning);
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
    const otherProducts = document.createElement("div");
    otherProducts.className = "history-other-products";

    const heading = document.createElement("strong");
    heading.textContent = "Order note";
    otherProducts.append(heading);

    order.other_products.forEach((item) => {
      const line = document.createElement("span");
      line.textContent = `${item.floor_label}: ${item.details}`;
      otherProducts.append(line);
    });

    card.append(otherProducts);
  }

  if (Array.isArray(order.files) && order.files.length > 0) {
    const fileList = document.createElement("div");
    fileList.className = "history-files";

    order.files.forEach((file) => {
      const fileRow = document.createElement("div");
      fileRow.className = "history-file-row";

      const info = document.createElement("div");
      info.className = "history-file-info";

      const name = document.createElement("strong");
      name.textContent = file.filename;

      const detail = document.createElement("span");
      detail.textContent = `Revision ${file.revision} · ${file.floor_label} · ${file.item_count} line${Number(file.item_count) === 1 ? "" : "s"}`;

      info.append(name, detail);
      fileRow.append(info);
      fileRow.append(
        createDownloadLink(
          file.download_url,
          file.filename,
        ),
      );
      fileList.append(fileRow);
    });

    card.append(fileList);
  }

  return card;
}

function createDownloadLink(url, filename) {
  const link = document.createElement("a");
  link.className = "button button-secondary button-small download-button";
  link.href = url;
  link.download = filename;
  link.textContent = "Download XLSX";
  return link;
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
