(() => {
  let initialised = false;
  let applying = false;

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

  function applyFreshOrderDefaults() {
    if (applying || state?.editingOrder) return false;
    const profile = state?.account;
    const defaults = profile?.orderDefaults || {};
    const street = document.getElementById("deliveryStreet");
    const suburb = document.getElementById("deliveryAddressSearch");
    const postcode = document.getElementById("deliveryPostcode");
    const deliverySelect = document.querySelector(".delivery-select-deliveryType .delivery-select");
    if (!profile || !street || !suburb || !postcode || !deliverySelect) return false;

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
      const extras = new Set(Array.isArray(defaults.extras) ? defaults.extras : []);
      document.querySelectorAll('input[name="deliveryExtra"]').forEach((input) => {
        input.checked = extras.has(input.value);
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
    if (typeof resetOrder !== "function" || resetOrder.__accountDefaultsWrapped) return false;
    const originalResetOrder = resetOrder;
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

  function initialiseDefaults() {
    installResetWrapper();
    if (!initialised && applyFreshOrderDefaults()) initialised = true;
    return initialised;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    initialiseDefaults();
    if ((initialised && installResetWrapper()) || attempts >= 150) window.clearInterval(timer);
  }, 100);

  document.addEventListener("DOMContentLoaded", initialiseDefaults, { once: true });
})();