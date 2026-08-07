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

  document.getElementById("customerName").value = state.account.companyName || "";
  window.BPSOrderFields?.setValue("contactName", state.account.defaultContactName || "", { assist: true });
  window.BPSOrderFields?.setValue("contactMobile", state.account.defaultMobile || "", { assist: true });
  document.getElementById("accountSummary").textContent = [state.account.companyName, state.account.debtorCode].filter(Boolean).join(" · ");
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
