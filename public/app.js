const state = {
  catalog: {},
  submissionId: null,
  isSubmitting: false,
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
  setMinimumDates();
  bindTabs();
  bindFloorToggles();
  bindSearch();
  bindSubmission();
  bindLogout();

  await loadCatalog();
}

function setMinimumDates() {
  const today = new Date();
  const localDate = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 10);

  ["groundDateRequired", "firstDateRequired"].forEach((id) => {
    const field = document.getElementById(id);
    field.min = localDate;
  });
}

function bindTabs() {
  document.querySelectorAll("[data-floor-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const floor = button.dataset.floorTab;

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
    });
  });
}

function bindFloorToggles() {
  ["ground", "first"].forEach((floor) => {
    const checkbox = document.getElementById(`${floor}Enabled`);

    checkbox.addEventListener("change", () => {
      const content = document.querySelector(
        `[data-floor-content="${floor}"]`,
      );

      content.classList.toggle("is-disabled", !checkbox.checked);

      content.querySelectorAll("input, select, textarea, button").forEach((field) => {
        field.disabled = !checkbox.checked;
      });

      updateFloorSummary(floor);
    });
  });
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

      window.location.replace("/login.html");
    });
}

async function loadCatalog() {
  const status = document.getElementById("catalogStatus");

  try {
    const response = await fetch("/api/catalog", {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 401) {
      window.location.replace("/login.html");
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
        "The verified product catalogue could not be loaded.",
      );
    }

    state.catalog = result.products || {};

    ["ground", "first"].forEach((floor) => {
      renderCatalog(floor);
      updateFloorSummary(floor);
    });

    const count = Object.keys(state.catalog).length;
    status.textContent = `${count} verified Accrivia products available`;
    status.classList.add("status-pill-ready");
  } catch (error) {
    status.textContent = `Catalogue error: ${error.message || String(error)}`;
    status.classList.add("status-pill-error");

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

    const section = product.section || "Other verified products";
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
    details.open = sectionIndex < 2;

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
  meta.textContent = `SKU ${product.sku}`;

  info.append(label, meta);

  const quantity = document.createElement("input");
  quantity.className = "quantity-input";
  quantity.type = "number";
  quantity.min = "0";
  quantity.max = "99999";
  quantity.step = "1";
  quantity.inputMode = "numeric";
  quantity.placeholder = "0";
  quantity.dataset.productKey = product.key;
  quantity.dataset.floor = floor;
  quantity.setAttribute(
    "aria-label",
    `${floorLabels[floor]} quantity for ${product.label}`,
  );

  quantity.addEventListener("input", () => {
    normaliseQuantityField(quantity);
    updateFloorSummary(floor);
  });

  row.append(info, quantity);
  return row;
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

  if (!Number.isInteger(quantity)) {
    field.value = String(Math.floor(quantity));
  }
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
    ? "Floor excluded"
    : items.length === 0
      ? "No products selected"
      : `${items.length} product line${items.length === 1 ? "" : "s"} · ${totalUnits} total units`;

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
    validateBrowserForm();

    const payload = buildPayload();
    state.submissionId = payload.submissionId;
    state.isSubmitting = true;

    const button = document.getElementById("submitButton");
    button.disabled = true;
    button.textContent = "Generating Accrivia files…";

    showMessage(
      "Submission received by the portal. Validating products and generating separate floor files…",
      "info",
    );

    const response = await fetch("/api/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      window.location.replace("/login.html");
      return;
    }

    const result = await response.json().catch(() => ({
      ok: false,
      error: "The submission service returned an unreadable response.",
    }));

    if (!response.ok || !result.ok) {
      const diagnostic = result.diagnostic?.lastError;
      const stage = result.diagnostic?.lastStage?.stage;

      const parts = [
        result.error || "The order could not be generated.",
      ];

      if (stage) {
        parts.push(`Failed stage: ${stage}.`);
      }

      if (diagnostic?.message && diagnostic.message !== result.error) {
        parts.push(diagnostic.message);
      }

      if (result.requestId) {
        parts.push(`Request ID: ${result.requestId}.`);
      }

      throw new Error(parts.join(" "));
    }

    showSuccess(result);
  } catch (error) {
    showMessage(error.message || String(error), "error");
  } finally {
    state.isSubmitting = false;

    const button = document.getElementById("submitButton");
    button.disabled = false;
    button.textContent = "Submit order";
  }
}

function validateBrowserForm() {
  const form = document.getElementById("orderForm");

  if (!form.reportValidity()) {
    throw new Error("Complete the required order and site fields.");
  }

  const enabledFloors = ["ground", "first"].filter(
    (floor) => document.getElementById(`${floor}Enabled`).checked,
  );

  if (enabledFloors.length === 0) {
    throw new Error("Include at least one floor.");
  }

  enabledFloors.forEach((floor) => {
    const dateField = document.getElementById(`${floor}DateRequired`);
    const items = getFloorItems(floor);
    const otherProducts = document
      .getElementById(`${floor}OtherProducts`)
      .value.trim();

    if (!dateField.value) {
      activateFloorTab(floor);
      dateField.focus();
      throw new Error(`${floorLabels[floor]} requires a Date Required.`);
    }

    if (items.length === 0 && !otherProducts) {
      activateFloorTab(floor);
      throw new Error(
        `${floorLabels[floor]} requires at least one verified product or an Other Products entry.`,
      );
    }
  });
}

function activateFloorTab(floor) {
  const button = document.querySelector(`[data-floor-tab="${floor}"]`);
  button.click();
}

function buildPayload() {
  const submissionId =
    typeof crypto.randomUUID === "function"
      ? `BPS-${crypto.randomUUID()}`
      : `BPS-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const floors = {};

  ["ground", "first"].forEach((floor) => {
    if (!document.getElementById(`${floor}Enabled`).checked) {
      return;
    }

    floors[floor] = {
      dateRequired: value(`${floor}DateRequired`),
      deliveryMode: value(`${floor}DeliveryMode`),
      deliverySequence: value(`${floor}DeliverySequence`),
      deliveryWindow: value(`${floor}DeliveryWindow`),
      clearAccess: checked(`${floor}ClearAccess`),
      scaffolding: checked(`${floor}Scaffolding`),
      passUp: checked(`${floor}PassUp`),
      level: value(`${floor}Level`),
      areaSetAside: checked(`${floor}AreaSetAside`),
      plasticWrap: checked(`${floor}PlasticWrap`),
      deliveryNotes: value(`${floor}DeliveryNotes`),
      items: getFloorItems(floor),
      otherProducts: value(`${floor}OtherProducts`),
    };
  });

  return {
    submissionId,
    customerReference: value("customerReference"),
    jobName: value("jobName"),
    siteAddress1: value("siteAddress1"),
    siteAddress2: value("siteAddress2"),
    siteContact: value("siteContact"),
    siteContactPhone: value("siteContactPhone"),
    requesterName: value("requesterName"),
    requesterPhone: value("requesterPhone"),
    comments: value("comments"),
    floors,
  };
}

function showSuccess(result) {
  clearMessage();

  const panel = document.getElementById("successPanel");
  const summary = document.getElementById("successSummary");
  const files = document.getElementById("generatedFiles");
  const submissionId = result.submissionId || state.submissionId;

  files.replaceChildren();

  const generated = Array.isArray(result.generatedFiles)
    ? result.generatedFiles
    : [];

  summary.textContent = result.duplicate
    ? "This submission was already processed. No duplicate files or email were created."
    : `${generated.length} Accrivia file${generated.length === 1 ? " was" : "s were"} generated${result.emailSent ? " and emailed to Bell Plaster" : ""}.`;

  generated.forEach((file) => {
    const item = document.createElement("div");
    item.className = "generated-file";

    const name = document.createElement("strong");
    name.textContent = file.filename;

    const detail = document.createElement("span");
    detail.textContent = `${file.floorLabel} · ${file.itemCount} product line${file.itemCount === 1 ? "" : "s"}`;

    item.append(name, detail);
    files.append(item);
  });

  if (Array.isArray(result.manualReview) && result.manualReview.length > 0) {
    const warning = document.createElement("div");
    warning.className = "manual-review-warning";
    warning.textContent =
      "This submission includes Other Products that Bell Plaster must review manually.";
    files.append(warning);
  }

  document.getElementById("submissionIdDisplay").textContent =
    submissionId || "Not returned";

  panel.hidden = false;
  panel.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
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

function value(id) {
  return document.getElementById(id).value.trim();
}

function checked(id) {
  return document.getElementById(id).checked;
}
