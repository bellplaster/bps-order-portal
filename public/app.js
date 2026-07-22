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
};

const floorLabels = { ground: "Ground Floor", first: "1st Floor" };
const deliveryTypes = new Set([
  "Manual Unload (Knauf Labour)",
  "Mechanical (Forklift/Crane/Own)",
  "Mixed Unload (Hand + Machine)",
  "Pickup (Customer to collect)",
]);

window.addEventListener("DOMContentLoaded", initialise);
window.addEventListener("DOMContentLoaded", enforceUppercaseGoogleAddress);
window.addEventListener("DOMContentLoaded", loadDeliveryRefinement);

async function initialise() {
  bindStaticActions();
  setToday();
  try {
    await Promise.all([loadAccount(), loadCatalog()]);
    await initialiseGoogleAddress();
    restoreDraft();
    updateGeneratedDeliverySummary();
    await loadOrderHistory();
    renderCounts();
  } catch (error) {
    showGlobal(error.message || String(error), "error");
  }
}

function bindStaticActions() {
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("clearAddressButton").addEventListener("click", clearAddress);
  document.getElementById("continueToReviewButton").addEventListener("click", () => {
    try { validateForm(); renderReview(); setStep("review"); }
    catch (error) { showGlobal(error.message || String(error), "error"); }
  });
  document.getElementById("backToFormButton").addEventListener("click", () => setStep("form"));
  document.getElementById("editFormButton").addEventListener("click", () => setStep("form", { scrollTop: true }));
  document.getElementById("editProductsButton").addEventListener("click", () => {
    setStep("form");
    document.querySelector(".products-area")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("orderForm").addEventListener("submit", submitOrder);
  document.getElementById("startNewOrderButton").addEventListener("click", resetOrder);
  document.getElementById("viewHistoryButton").addEventListener("click", openHistory);
  document.getElementById("cancelEditButton").addEventListener("click", resetOrder);

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

  document.getElementById("openHistoryButton").addEventListener("click", openHistory);
  document.getElementById("closeHistoryButton").addEventListener("click", closeHistory);
  document.getElementById("historyBackdrop").addEventListener("click", closeHistory);
  document.getElementById("refreshHistoryButton").addEventListener("click", loadOrderHistory);
  document.getElementById("showArchivedOrders").addEventListener("change", loadOrderHistory);

  document.getElementById("requiredDate").addEventListener("change", updateFutureDateConfirmation);
  document.getElementById("contactMobile").addEventListener("input", (event) => {
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
    window.location.replace("/account/");
    throw new Error("Opening customer administration.");
  }
  document.getElementById("customerName").value = state.account.companyName || "";
  document.getElementById("contactName").value = state.account.defaultContactName || "";
  document.getElementById("contactMobile").value = state.account.defaultMobile || "";
  document.getElementById("accountSummary").textContent = [state.account.companyName, state.account.debtorCode].filter(Boolean).join(" · ");
}

async function loadCatalog() {
  const result = await fetchJson("/api/catalog");
  state.catalog = result.products || {};
  state.layout = result.layout;
  if (!state.layout) throw new Error("The product order form layout is missing.");
  renderFloorSheet("ground");
  renderFloorSheet("first");
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
  const script = document.createElement("script");
  script.src = "/delivery-refinement.js?v=20260722-1";
  script.defer = true;
  document.body.append(script);
}
