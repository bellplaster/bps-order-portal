(() => {
  if (globalThis.BPS_ORDER_READONLY) return;

  let initialised = false;
  let applying = false;
  let originalResetOrder = null;
  let resetButtonsBound = false;

  function configuredDate(value) {
    const text = String(value || "");
    const today = document.getElementById("orderDateIso")?.value || new Date().toISOString().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && text >= today ? text : "";
  }

  function normaliseTimeSlot(value) {
    const slot = String(value || "").trim().toUpperCase();
    return ["1ST", "2ND", "AM", "PM"].includes(slot) ? slot : "";
  }

  function fullAddress(defaults) {
    const street = String(defaults.street || "").trim();
    const suburb = String(defaults.suburb || "").trim();
    const postcode = String(defaults.postcode || "").trim();
    const locality = [suburb, "VIC", postcode].filter(Boolean).join(" ");
    return [street, locality].filter(Boolean).join(", ");
  }

  function ensureHeaderIdentity() {
    const profile = typeof state !== "undefined" ? state.account : null;
    const header = document.querySelector(".order-form-page .portal-header");
    if (!profile || !header) return false;

    let identity = header.querySelector(".portal-company-identity");
    if (!identity) {
      identity = document.createElement("div");
      identity.className = "portal-company-identity";
      identity.innerHTML = "<strong></strong><span></span>";
      header.prepend(identity);
    }

    const companyName = profile.companyName || "Customer account";
    const debtorCode = profile.debtorCode || "";
    identity.querySelector("strong").textContent = companyName;
    identity.querySelector("span").textContent = debtorCode;
    identity.querySelector("span").hidden = !debtorCode;
    identity.title = [companyName, debtorCode].filter(Boolean).join(" · ");
    return true;
  }

  function removeAnyTimeSlot() {
    document.querySelectorAll('input[name="timeSlot"][value="ANY"]').forEach((input) => input.closest("label")?.remove());
    document.querySelectorAll('.delivery-select-timeSlot .delivery-select option[value="ANY"]').forEach((option) => option.remove());
  }

  function visibleTimeSlotSelect() {
    return document.querySelector(".delivery-select-timeSlot .delivery-select");
  }

  function ensureTimeSlotPlaceholder() {
    removeAnyTimeSlot();
    const select = visibleTimeSlotSelect();
    if (!(select instanceof HTMLSelectElement)) return false;
    let placeholder = [...select.options].find((option) => option.value === "");
    if (!placeholder) {
      placeholder = new Option("Select time slot", "");
      select.insertBefore(placeholder, select.firstChild);
    } else {
      placeholder.textContent = "Select time slot";
    }
    return true;
  }

  function syncVisibleDeliveryControls() {
    ensureTimeSlotPlaceholder();
    if (typeof window.syncUnifiedDeliveryControls === "function") {
      window.syncUnifiedDeliveryControls();
    }
    const timeSelect = visibleTimeSlotSelect();
    const selectedTime = document.querySelector('input[name="timeSlot"]:checked');
    if (timeSelect) timeSelect.value = selectedTime?.value || "";

    const deliverySelect = document.querySelector(".delivery-select-deliveryType .delivery-select");
    const selectedDelivery = document.querySelector('input[name="deliveryType"]:checked');
    if (deliverySelect) deliverySelect.value = selectedDelivery?.value || "";
  }

  function controlsReady() {
    return Boolean(
      state?.account
      && document.getElementById("deliveryStreet")
      && document.getElementById("deliveryAddressSearch")
      && document.getElementById("deliveryPostcode")
      && visibleTimeSlotSelect()
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
    const savedTimeSlot = normaliseTimeSlot(defaults.timeSlot);

    applying = true;
    state.suppressDraft = true;
    try {
      ensureHeaderIdentity();
      setValue("customerName", profile.companyName || "");
      setValue("reference", defaults.reference || "");
      setValue("requiredDate", configuredDate(defaults.requiredDate));
      setValue("contactName", profile.defaultContactName || "");
      setValue("contactMobile", profile.defaultMobile || "");
      setValue("deliveryInstructions", defaults.instructions || "");

      document.querySelectorAll('input[name="timeSlot"]').forEach((input) => {
        input.checked = Boolean(savedTimeSlot) && input.value === savedTimeSlot;
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
      syncVisibleDeliveryControls();
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
    ensureHeaderIdentity();
    removeAnyTimeSlot();
    ensureTimeSlotPlaceholder();
    bindCapturedResetButtons();
    if (initialised || !controlsReady() || !installResetWrapper()) return initialised;

    initialised = applyFreshOrderDefaults();
    return initialised;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    ensureHeaderIdentity();
    removeAnyTimeSlot();
    ensureTimeSlotPlaceholder();
    if (initialiseDefaults() || attempts >= 150) window.clearInterval(timer);
  }, 100);

  document.addEventListener("DOMContentLoaded", initialiseDefaults, { once: true });
})();
