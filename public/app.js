const state = {
  account: null,
  catalog: {},
  layout: null,
  activeFloor: "ground",
  activeStep: "form",
  quantities: { ground: new Map(), first: new Map() },
  otherMaterials: { ground: [], first: [] },
  editingOrder: null,
  readOnlyOrder: null,
  searchTimer: null,
  draftTimer: null,
  suppressDraft: false,
  addressAutocompleteReady: false,
  addressAutocompleteApi: null,
  addressSessionToken: null,
  addressSearchTimer: null,
  addressRequestId: 0,
  addressPredictions: [],
  addressPredictionIndex: -1,
  addressPreviewCache: new Map(),
  addressPreviewTimer: null,
  adminAccounts: [],
  adminOrderAccountId: null,
  customerServiceAccounts: [],
  customerServiceOrderAccountId: null,
  customerServiceDebtorMatches: [],
  customerServiceDebtorActiveIndex: -1,
};

const floorLabels = { ground: "Ground Floor", first: "1st Floor" };
const deliveryTypes = new Set([
  "Hand Unload",
  "Forklift Delivery",
  "Crane Delivery",
  "Delivery (No Assistance)",
  "Pickup (Customer to collect)",
]);

window.addEventListener("DOMContentLoaded", initialise);

async function initialise() {
  bindStaticActions();
  setToday();
  try {
    clearDraft();
    await Promise.all([loadAccount(), loadCatalog()]);
    updateGeneratedDeliverySummary();
    renderCounts();
  } catch (error) {
    showGlobal(error.message || String(error), "error");
  }
}

function bindStaticActions() {
  document.getElementById("logoutButton")?.addEventListener("click", logout);
  document.getElementById("clearAddressButton")?.addEventListener("click", clearAddress);
  document.getElementById("continueToReviewButton")?.addEventListener("click", () => {
    try { validateForm(); renderReview(); setStep("review"); }
    catch (error) { showGlobal(error.message || String(error), "error"); }
  });
  document.getElementById("backToFormButton")?.addEventListener("click", () => setStep("form"));
  document.getElementById("editFormButton")?.addEventListener("click", () => setStep("form", { scrollTop: true }));
  document.getElementById("editProductsButton")?.addEventListener("click", () => {
    setStep("form");
    document.querySelector(".products-area")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("orderForm")?.addEventListener("submit", submitOrder);
  document.getElementById("startNewOrderButton")?.addEventListener("click", resetOrder);
  document.getElementById("cancelEditButton")?.addEventListener("click", resetOrder);

  document.getElementById("adminCustomerAccount")?.addEventListener("change", (event) => {
    selectAdminOrderAccount(Number(event.target.value || 0));
  });
  document.getElementById("fillActiveAreaWithOneButton")?.addEventListener("click", fillActiveAreaWithOne);
  document.getElementById("adminTestQuantity")?.addEventListener("input", (event) => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 5);
  });
  document.getElementById("adminTestQuantity")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      fillActiveAreaWithOne();
    }
  });
  document.getElementById("clearActiveAreaTestButton")?.addEventListener("click", clearActiveAreaTestValues);

  document.querySelectorAll("[data-step-target]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.stepTarget === "review") {
        try { validateForm(); renderReview(); setStep("review"); }
        catch (error) { showGlobal(error.message || String(error), "error"); }
      } else setStep("form");
    });
  });

  document.querySelectorAll("[data-floor-tab]").forEach((button) => {
    button.addEventListener("click", () => activateFloor(button.dataset.floorTab));
  });

  document.getElementById("requiredDate")?.addEventListener("change", updateFutureDateConfirmation);

  document.querySelectorAll("#orderForm input, #orderForm textarea").forEach((field) => {
    if (field.classList.contains("quantity-input")) return;
    field.addEventListener("input", scheduleDraft);
    field.addEventListener("change", scheduleDraft);
  });

  document.querySelectorAll('input[name="timeSlot"], input[name="deliveryType"], input[name="deliveryExtra"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (input.name === "deliveryType") updatePickupMode();
      updateGeneratedDeliverySummary();
      scheduleDraft();
    });
  });
}

async function loadAccount() {
  const result = await fetchJson("/api/account");
  state.account = result.profile;

  if (state.account?.role === "admin") {
    configureAdminOrderTools(result.accounts || []);
    return;
  }

  if (state.account?.role === "customer_service") {
    configureCustomerServiceOrderTools(result.accounts || []);
    return;
  }

  document.getElementById("customerName").value = state.account.companyName || "";
  window.BPSOrderFields?.setValue("contactName", state.account.defaultContactName || "", { assist: true });
  window.BPSOrderFields?.setValue("contactMobile", state.account.defaultMobile || "", { assist: true });
  document.getElementById("accountSummary").textContent = [state.account.companyName, state.account.debtorCode].filter(Boolean).join(" · ");
}

function configureCustomerServiceOrderTools(accounts) {
  state.customerServiceAccounts = accounts.filter((account) => Number(account.active) === 1);
  state.customerServiceOrderAccountId = null;
  state.customerServiceDebtorMatches = [];
  state.customerServiceDebtorActiveIndex = -1;
  state.account.accountId = null;
  state.account.companyName = "Customer Service";
  state.account.debtorCode = "";
  state.account.defaultContactName = "";
  state.account.defaultMobile = "";
  state.account.orderDefaults = {};

  document.querySelector('.portal-actions a[href="/account/"]')?.setAttribute("hidden", "");
  ensureCustomerServiceOrderingStyles();

  const tools = document.getElementById("adminOrderTools");
  if (tools) {
    tools.hidden = true;
    tools.className = "admin-order-tools";
    tools.removeAttribute("aria-label");
    tools.replaceChildren();
  }

  installCustomerServiceDebtorField();

  const customerName = document.getElementById("customerName");
  if (customerName) customerName.value = "";
  const summary = document.getElementById("accountSummary");
  if (summary) summary.textContent = "Customer Service · Select debtor";

  document.dispatchEvent(new CustomEvent("bps:order-account-changed", {
    detail: { accountId: null, role: "customer_service" },
  }));
}

function ensureCustomerServiceOrderingStyles() {
  if (document.querySelector('link[data-customer-service-ordering="true"]')) return;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/customer-service-ordering.css?v=20260808-3";
  stylesheet.dataset.customerServiceOrdering = "true";
  document.head.append(stylesheet);
}

function installCustomerServiceDebtorField() {
  const grid = document.querySelector(".sheet-details-grid");
  const referenceRow = document.getElementById("reference")?.closest(".sheet-field-row");
  const requiredDateRow = document.getElementById("requiredDateDisplay")?.closest(".sheet-field-row");
  const contactRow = document.getElementById("contactName")?.closest(".sheet-field-row");
  const phoneRow = document.getElementById("contactMobile")?.closest(".sheet-field-row");
  if (!grid || !referenceRow || !requiredDateRow || !contactRow || !phoneRow) return;

  grid.classList.add("customer-service-details-grid");
  referenceRow.classList.add("customer-service-reference-row");
  requiredDateRow.classList.add("customer-service-required-date-row");
  contactRow.classList.add("customer-service-contact-row");
  phoneRow.classList.add("customer-service-phone-row");

  let row = document.getElementById("customerServiceDebtorRow");
  if (!row) {
    row = document.createElement("div");
    row.id = "customerServiceDebtorRow";
    row.className = "sheet-field-row customer-service-debtor-row";

    const label = document.createElement("label");
    label.htmlFor = "customerServiceCustomerAccount";
    label.textContent = "Debtor";

    const control = document.createElement("div");
    control.className = "customer-service-debtor-control";

    const input = document.createElement("input");
    input.id = "customerServiceCustomerAccount";
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.required = true;
    input.placeholder = "Debtor";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", "customerServiceDebtorResults");
    input.setAttribute("aria-label", "Debtor");

    const results = document.createElement("div");
    results.id = "customerServiceDebtorResults";
    results.className = "customer-service-debtor-results";
    results.setAttribute("role", "listbox");
    results.hidden = true;

    control.append(input, results);
    row.append(label, control);
    grid.insertBefore(row, referenceRow);
  }

  const input = document.getElementById("customerServiceCustomerAccount");
  if (!(input instanceof HTMLInputElement) || input.dataset.debtorBound === "true") return;
  input.dataset.debtorBound = "true";

  input.addEventListener("focus", () => openCustomerServiceDebtorResults());
  input.addEventListener("input", () => {
    const selectedCode = String(input.dataset.selectedDebtorCode || "").trim().toLowerCase();
    if (selectedCode && input.value.trim().toLowerCase() !== selectedCode) {
      state.customerServiceOrderAccountId = null;
      state.account.accountId = null;
      delete input.dataset.selectedAccountId;
      delete input.dataset.selectedDebtorCode;
    }
    openCustomerServiceDebtorResults(input.value);
  });
  input.addEventListener("keydown", handleCustomerServiceDebtorKeydown);

  document.addEventListener("mousedown", (event) => {
    if (!row.contains(event.target)) closeCustomerServiceDebtorResults();
  });

  document.getElementById("orderForm")?.addEventListener("reset", () => {
    window.setTimeout(() => {
      const selected = state.customerServiceAccounts.find(
        (account) => Number(account.id) === Number(state.customerServiceOrderAccountId || 0),
      ) || null;
      syncCustomerServiceDebtorField(selected);
    }, 0);
  });
}

function openCustomerServiceDebtorResults(query = null) {
  const input = document.getElementById("customerServiceCustomerAccount");
  const results = document.getElementById("customerServiceDebtorResults");
  if (!(input instanceof HTMLInputElement) || !results) return;

  const selectedCode = String(input.dataset.selectedDebtorCode || "").trim().toLowerCase();
  const typed = query == null ? input.value : String(query);
  const search = selectedCode && typed.trim().toLowerCase() === selectedCode ? "" : typed;
  state.customerServiceDebtorMatches = filterCustomerServiceAccounts(search);
  state.customerServiceDebtorActiveIndex = -1;
  renderCustomerServiceDebtorResults();
  results.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function closeCustomerServiceDebtorResults() {
  const input = document.getElementById("customerServiceCustomerAccount");
  const results = document.getElementById("customerServiceDebtorResults");
  if (results) results.hidden = true;
  if (input) {
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }
  state.customerServiceDebtorActiveIndex = -1;
}

function filterCustomerServiceAccounts(query) {
  const needle = String(query || "").trim().toLowerCase();
  const scored = state.customerServiceAccounts.map((account) => {
    const company = String(account.company_name || "").trim();
    const code = String(account.debtor_code || "").trim();
    const companyKey = company.toLowerCase();
    const codeKey = code.toLowerCase();
    let score = 99;

    if (!needle) score = 10;
    else if (codeKey === needle) score = 0;
    else if (companyKey === needle) score = 1;
    else if (codeKey.startsWith(needle)) score = 2;
    else if (companyKey.startsWith(needle)) score = 3;
    else if (codeKey.includes(needle)) score = 4;
    else if (companyKey.includes(needle)) score = 5;

    return { account, companyKey, codeKey, score };
  }).filter((item) => item.score < 99);

  scored.sort((left, right) => left.score - right.score
    || left.companyKey.localeCompare(right.companyKey)
    || left.codeKey.localeCompare(right.codeKey));
  return scored.map((item) => item.account);
}

function renderCustomerServiceDebtorResults() {
  const results = document.getElementById("customerServiceDebtorResults");
  const input = document.getElementById("customerServiceCustomerAccount");
  if (!results || !(input instanceof HTMLInputElement)) return;
  results.replaceChildren();

  if (!state.customerServiceDebtorMatches.length) {
    const empty = document.createElement("div");
    empty.className = "customer-service-debtor-empty";
    empty.textContent = "No matching customer";
    results.append(empty);
    input.removeAttribute("aria-activedescendant");
    return;
  }

  state.customerServiceDebtorMatches.forEach((account, index) => {
    const option = document.createElement("button");
    option.id = `customerServiceDebtorOption${index}`;
    option.type = "button";
    option.className = "customer-service-debtor-option";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(Number(account.id) === Number(state.customerServiceOrderAccountId || 0)));
    if (index === state.customerServiceDebtorActiveIndex) option.classList.add("is-active");

    const company = document.createElement("strong");
    company.textContent = String(account.company_name || "").trim() || "Unnamed customer";
    const code = document.createElement("span");
    code.textContent = String(account.debtor_code || "").trim();
    option.append(company, code);

    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.addEventListener("click", () => selectCustomerServiceOrderAccount(Number(account.id)));
    results.append(option);
  });

  const active = state.customerServiceDebtorActiveIndex;
  if (active >= 0) input.setAttribute("aria-activedescendant", `customerServiceDebtorOption${active}`);
  else input.removeAttribute("aria-activedescendant");
}

function handleCustomerServiceDebtorKeydown(event) {
  if (!["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) return;

  const results = document.getElementById("customerServiceDebtorResults");
  if (event.key === "Escape") {
    event.preventDefault();
    closeCustomerServiceDebtorResults();
    return;
  }

  if (results?.hidden) openCustomerServiceDebtorResults();
  const matches = state.customerServiceDebtorMatches;
  if (!matches.length) return;

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const current = state.customerServiceDebtorActiveIndex;
    state.customerServiceDebtorActiveIndex = current < 0
      ? (direction > 0 ? 0 : matches.length - 1)
      : (current + direction + matches.length) % matches.length;
    renderCustomerServiceDebtorResults();
    document.getElementById(`customerServiceDebtorOption${state.customerServiceDebtorActiveIndex}`)?.scrollIntoView({ block: "nearest" });
    return;
  }

  if (event.key === "Enter") {
    const index = state.customerServiceDebtorActiveIndex >= 0 ? state.customerServiceDebtorActiveIndex : (matches.length === 1 ? 0 : -1);
    if (index >= 0) {
      event.preventDefault();
      selectCustomerServiceOrderAccount(Number(matches[index].id));
    }
  }
}

function selectCustomerServiceOrderAccount(accountId) {
  if (state.account?.role !== "customer_service") return;
  const selected = state.customerServiceAccounts.find((account) => Number(account.id) === Number(accountId || 0)) || null;
  applyCustomerServiceOrderAccount(selected);
  resetOrder();
  syncCustomerServiceDebtorField(selected);
  closeCustomerServiceDebtorResults();

  document.dispatchEvent(new CustomEvent("bps:order-account-changed", {
    detail: {
      accountId: state.customerServiceOrderAccountId,
      role: "customer_service",
      companyName: selected?.company_name || "",
      debtorCode: selected?.debtor_code || "",
    },
  }));
}

function applyCustomerServiceOrderAccount(account) {
  const id = Number(account?.id || 0) || null;
  const companyName = String(account?.company_name || "");
  const debtorCode = String(account?.debtor_code || "");

  state.customerServiceOrderAccountId = id;
  state.account.accountId = id;
  state.account.companyName = companyName || "Customer Service";
  state.account.debtorCode = debtorCode;
  state.account.defaultContactName = "";
  state.account.defaultMobile = "";
  state.account.orderDefaults = {};

  syncCustomerServiceDebtorField(account);
  const customerName = document.getElementById("customerName");
  if (customerName) customerName.value = companyName;
  const summary = document.getElementById("accountSummary");
  if (summary) summary.textContent = id
    ? [companyName, debtorCode].filter(Boolean).join(" · ")
    : "Customer Service · Select debtor";
}

function syncCustomerServiceDebtorField(account) {
  const input = document.getElementById("customerServiceCustomerAccount");
  if (!(input instanceof HTMLInputElement)) return;
  const id = Number(account?.id || 0) || null;
  const debtorCode = String(account?.debtor_code || "").trim();
  const companyName = String(account?.company_name || "").trim();
  input.value = debtorCode;
  input.title = id ? [companyName, debtorCode].filter(Boolean).join(" · ") : "";
  if (id) {
    input.dataset.selectedAccountId = String(id);
    input.dataset.selectedDebtorCode = debtorCode;
  } else {
    delete input.dataset.selectedAccountId;
    delete input.dataset.selectedDebtorCode;
  }
}

function configureAdminOrderTools(accounts) {
  state.adminAccounts = accounts.filter((account) => Number(account.active) === 1);
  const tools = document.getElementById("adminOrderTools");
  const select = document.getElementById("adminCustomerAccount");
  if (!tools || !select) return;

  tools.hidden = false;
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select customer account";
  select.append(placeholder);

  state.adminAccounts.forEach((account) => {
    const option = document.createElement("option");
    option.value = String(account.id);
    option.textContent = `${account.company_name} · ${account.debtor_code}`;
    select.append(option);
  });

  const selected = state.adminAccounts.find((account) => Number(account.id) === Number(state.account.accountId || 0));
  applyAdminOrderAccount(selected || null);
}

async function selectAdminOrderAccount(accountId) {
  if (state.account?.role !== "admin") return;
  const select = document.getElementById("adminCustomerAccount");
  const previousId = state.adminOrderAccountId;
  setAdminOrderToolsBusy(true);

  try {
    const result = await fetchJson("/api/admin-order-account", {
      method: "POST",
      body: JSON.stringify({ accountId: accountId || null }),
    });
    const selected = result.account
      ? state.adminAccounts.find((account) => Number(account.id) === Number(result.account.id)) || {
          id: result.account.id,
          debtor_code: result.account.debtorCode,
          company_name: result.account.companyName,
          active: 1,
        }
      : null;
    applyAdminOrderAccount(selected);
    resetOrder();
    showGlobal(selected
      ? `Admin orders will be placed under ${selected.company_name}.`
      : "Choose a customer account before testing an order.", "success");
  } catch (error) {
    if (select) select.value = previousId ? String(previousId) : "";
    showGlobal(error.message || String(error), "error");
  } finally {
    setAdminOrderToolsBusy(false);
  }
}

function applyAdminOrderAccount(account) {
  const id = Number(account?.id || 0) || null;
  const companyName = String(account?.company_name || account?.companyName || "");
  const debtorCode = String(account?.debtor_code || account?.debtorCode || "");

  state.adminOrderAccountId = id;
  state.account.accountId = id;
  state.account.companyName = companyName;
  state.account.debtorCode = debtorCode;
  state.account.defaultContactName = "";
  state.account.defaultMobile = "";
  state.account.orderDefaults = {};

  const select = document.getElementById("adminCustomerAccount");
  if (select) select.value = id ? String(id) : "";
  const customerName = document.getElementById("customerName");
  if (customerName) customerName.value = companyName;
  const summary = document.getElementById("accountSummary");
  if (summary) summary.textContent = [companyName, debtorCode].filter(Boolean).join(" · ");

  document.getElementById("adminTestQuantity")?.toggleAttribute("disabled", !id);
  document.getElementById("fillActiveAreaWithOneButton")?.toggleAttribute("disabled", !id);
  document.getElementById("clearActiveAreaTestButton")?.toggleAttribute("disabled", !id);
}

function setAdminOrderToolsBusy(busy) {
  const select = document.getElementById("adminCustomerAccount");
  const quantity = document.getElementById("adminTestQuantity");
  const fill = document.getElementById("fillActiveAreaWithOneButton");
  const clear = document.getElementById("clearActiveAreaTestButton");
  if (select) select.disabled = busy;
  if (quantity) quantity.disabled = busy || !state.adminOrderAccountId;
  if (fill) fill.disabled = busy || !state.adminOrderAccountId;
  if (clear) clear.disabled = busy || !state.adminOrderAccountId;
}

function fillActiveAreaWithOne() {
  if (state.account?.role !== "admin" || !state.adminOrderAccountId) {
    showGlobal("Choose a customer account before using the test controls.", "error");
    return;
  }

  const quantityInput = document.getElementById("adminTestQuantity");
  const quantity = Number(quantityInput?.value || 0);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
    showGlobal("Enter a whole-number test quantity from 1 to 10,000.", "error");
    quantityInput?.focus();
    quantityInput?.select();
    return;
  }

  const areaId = state.activeFloor;
  const sheet = document.getElementById(`${areaId}OrderSheet`);
  const inputs = [...(sheet?.querySelectorAll(".quantity-input[data-product-key]") || [])];
  if (!(state.quantities[areaId] instanceof Map)) state.quantities[areaId] = new Map();

  const keys = new Set();
  inputs.forEach((input) => {
    const key = String(input.dataset.productKey || "").trim();
    if (!key) return;
    keys.add(key);
    state.quantities[areaId].set(key, quantity);
    input.value = String(quantity);
    input.classList.add("has-value");
  });

  renderCounts();
  scheduleDraft();
  showGlobal(`${keys.size} standard products in ${floorLabels[areaId] || "the active area"} were set to ${quantity.toLocaleString()}.`, "success");
}

function clearActiveAreaTestValues() {
  if (state.account?.role !== "admin" || !state.adminOrderAccountId) return;
  const areaId = state.activeFloor;
  const sheet = document.getElementById(`${areaId}OrderSheet`);
  state.quantities[areaId]?.clear();
  state.otherMaterials[areaId] = [];

  sheet?.querySelectorAll(".quantity-input[data-product-key]").forEach((input) => {
    input.value = "";
    input.classList.remove("has-value");
  });
  if (typeof renderSelectedAdditional === "function") renderSelectedAdditional(areaId);
  renderCounts();
  scheduleDraft();
  showGlobal(`${floorLabels[areaId] || "The active area"} was cleared.`, "success");
}

async function loadCatalog() {
  const result = await fetchJson("/api/catalog");
  state.catalog = result.products || {};
  state.layout = result.layout;
  if (!state.layout) throw new Error("The product order form layout is missing.");
  const renderer = window.renderUnifiedFloorSheet;
  if (typeof renderer !== "function") throw new Error("The unified board renderer did not load.");
  renderer("ground");
  renderer("first");
}