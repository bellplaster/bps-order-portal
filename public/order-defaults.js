(() => {
  let initialised = false;
  let applying = false;
  let originalResetOrder = null;
  let resetButtonsBound = false;

  function configuredDate(value) {
    const text = String(value || "");
    const today = document.getElementById("orderDateIso")?.value || new Date().toISOString().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && text >= today ? text : "";
  }

  function fullAddress(defaults) {
    const street = String(defaults.street || "").trim();
    const suburb = String(defaults.suburb || "").trim();
    const postcode = String(defaults.postcode || "").trim();
    const locality = [suburb, "VIC", postcode].filter(Boolean).join(" ");
    return [street, locality].filter(Boolean).join(", ");
  }

  function controlsReady() {
    return Boolean(
      state?.account
      && document.getElementById("deliveryStreet")
      && document.getElementById("deliveryAddressSearch")
      && document.getElementById("deliveryPostcode")
      && document.querySelector(".delivery-select-deliveryType .delivery-select")
    );
  }

  function applyFreshOrderDefaults() {
    if (applying || state?.editingOrder || !controlsReady()) return false;
    const profile = state.account;
    const defaults = profile.orderDefaults || {};
    const street = document.getElementById("deliveryStreet");
    const suburb = document.getElementById("deliveryAddressSearch");
    const postcode = document.getElementById("deliveryPostcode");

    applying = true;
    state.suppressDraft = true;
    try {
      setValue("customerName", profile.companyName || "");
      setValue("reference", defaults.reference || "");
      setValue("requiredDate", configuredDate(defaults.requiredDate));
      setValue("contactName", profile.defaultContactName || "");
      setValue("contactMobile", profile.defaultMobile || "");
      setValue("deliveryInstructions", defaults.instructions || "");

      document.querySelectorAll('input[name="timeSlot"]').forEach((input) => {
        input.checked = Boolean(defaults.timeSlot) && input.value === defaults.timeSlot;
      });
      document.querySelectorAll('input[name="deliveryType"]').forEach((input) => {
        input.checked = Boolean(defaults.deliveryType) && input.value === defaults.deliveryType;
      });
      document.querySelectorAll('input[name="deliveryExtra"]').forEach((input) => {
        input.checked = false;
      });

      street.value = defaults.street || "";
      suburb.value = defaults.suburb || "";
      const stateInput = document.getElementById("deliveryState");
      if (stateInput) stateInput.value = "VIC";
      postcode.value = defaults.postcode || "";
      setValue("deliveryAddressLine1", defaults.street || "");
      setValue("deliveryAddressLine2", [defaults.suburb || "", "VIC", defaults.postcode || ""].filter(Boolean).join(" "));
      setValue("deliveryAddress", fullAddress(defaults));

      if (typeof syncStructuredAddress === "function") syncStructuredAddress();
      if (typeof syncDeliverySelect === "function") syncDeliverySelect();
      if (typeof updateExtrasSummary === "function") updateExtrasSummary();
      if (typeof updatePickupMode === "function") updatePickupMode();
      if (typeof updateFutureDateConfirmation === "function") updateFutureDateConfirmation();
      if (typeof updateGeneratedDeliverySummary === "function") updateGeneratedDeliverySummary();
      if (typeof renderCounts === "function") renderCounts();
      if (typeof clearDraft === "function") clearDraft();
    } finally {
      state.suppressDraft = false;
      applying = false;
    }
    return true;
  }

  function installResetWrapper() {
    if (typeof resetOrder !== "function") return false;
    if (resetOrder.__accountDefaultsWrapped) return true;
    originalResetOrder = resetOrder;
    const wrapped = function resetOrderWithAccountDefaults(...args) {
      const result = originalResetOrder.apply(this, args);
      window.setTimeout(applyFreshOrderDefaults, 0);
      return result;
    };
    wrapped.__accountDefaultsWrapped = true;
    window.resetOrder = wrapped;
    try { resetOrder = wrapped; } catch (_error) { }
    return true;
  }

  function bindCapturedResetButtons() {
    if (resetButtonsBound) return;
    ["startNewOrderButton", "cancelEditButton"].forEach((id) => {
      document.getElementById(id)?.addEventListener("click", () => window.setTimeout(applyFreshOrderDefaults, 0));
    });
    resetButtonsBound = true;
  }

  function initialiseDefaults() {
    bindCapturedResetButtons();
    if (initialised || !controlsReady() || !installResetWrapper()) return initialised;

    // The base application has already built a clean product workspace.
    // Applying account defaults must not call resetOrder again here, because
    // later tab refinements can remove the freshly rendered product panels.
    initialised = applyFreshOrderDefaults();
    return initialised;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (initialiseDefaults() || attempts >= 150) window.clearInterval(timer);
  }, 100);

  document.addEventListener("DOMContentLoaded", initialiseDefaults, { once: true });
})();