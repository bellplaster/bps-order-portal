const state = {
  account: null,
  catalog: {},
  layout: null,
  activeFloor: "ground",
  activeStep: "form",
  quantities: { ground: new Map(), first: new Map() },
  otherMaterials: { ground: [], first: [] },
  editingOrder: null,
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
  "Manual Unload (Knauf Labour)",
  "Mechanical (Forklift/Crane/Own)",
  "Mixed Unload (Hand + Machine)",
  "Pickup (Customer to collect)",
]);

window.addEventListener("DOMContentLoaded", initialise);
window.addEventListener("DOMContentLoaded", loadDeliveryRefinement);

async function initialise() {
  bindStaticActions();
  setToday();
  try {
    clearDraft();
    await Promise.all([loadAccount(), loadCatalog()]);
    updateGeneratedDeliverySummary();
    await loadOrderHistory();
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
  document.getElementById("viewHistoryButton")?.addEventListener("click", openHistory);
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

  document.getElementById("openHistoryButton")?.addEventListener("click", openHistory);
  document.getElementById("closeHistoryButton")?.addEventListener("click", closeHistory);
  document.getElementById("historyBackdrop")?.addEventListener("click", closeHistory);
  document.getElementById("refreshHistoryButton")?.addEventListener("click", loadOrderHistory);
  document.getElementById("showArchivedOrders")?.addEventListener("change", loadOrderHistory);

  document.getElementById("requiredDate")?.addEventListener("change", updateFutureDateConfirmation);
  document.getElementById("contactMobile")?.addEventListener("input", (event) => {
    event.target.value = formatMobileTyping(event.target.value);
    scheduleDraft();
  });

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
  document.getElementById("contactName").value = state.account.defaultContactName || "";
  document.getElementById("contactMobile").value = state.account.defaultMobile || "";
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

function enforceUppercaseGoogleAddress() {
  const style = document.createElement("style");
  style.textContent = ".pac-item,.pac-item-query{text-transform:uppercase}";
  document.head.append(style);

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    const autocomplete = state.addressAutocomplete;
    if (!autocomplete && attempts < 80) return;
    window.clearInterval(timer);
    if (!autocomplete?.addListener) return;
    autocomplete.addListener("place_changed", () => {
      window.setTimeout(() => {
        const input = document.getElementById("deliveryAddressSearch");
        if (!input?.value) return;
        const formatted = formatAddressDisplay(input.value);
        input.value = formatted;
        document.getElementById("deliveryAddress").value = formatted;
        document.getElementById("deliveryAddressLine1").value = document.getElementById("deliveryAddressLine1").value.toUpperCase();
        document.getElementById("deliveryAddressLine2").value = document.getElementById("deliveryAddressLine2").value.toUpperCase();
        scheduleDraft();
      }, 0);
    });
  }, 250);
}

function formatAddressDisplay(value) {
  return String(value || "")
    .replace(/,?\s*Australia\s*$/i, "")
    .replace(/\bVictoria\b/gi, "VIC")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function loadDeliveryRefinement() {
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "/final-ui-polish.css?v=20260729-3";
  document.head.append(style);

  const controlStyle = document.createElement("link");
  controlStyle.rel = "stylesheet";
  controlStyle.href = "/order-control-refinement.css?v=20260729-2";
  document.head.append(controlStyle);

  const script = document.createElement("script");
  script.src = "/delivery-refinement.js?v=20260723-5";
  script.defer = true;
  script.addEventListener("load", () => {
    const polish = document.createElement("script");
    polish.src = "/final-ui-polish.js?v=20260723-4";
    polish.defer = true;
    document.body.append(polish);
  });
  document.body.append(script);
}
