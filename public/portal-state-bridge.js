(() => {
  try {
    if (typeof state !== "undefined") globalThis.state = state;
  } catch (_error) {
    // The confirmation route can still load from the server without client state.
  }

  if (!document.body.classList.contains("order-form-page")) return;

  // A submitted order viewer owns every displayed value. Applying the signed-in
  // user's current defaults here would overwrite the historical snapshot.
  if (new URLSearchParams(window.location.search).has("viewOrder")) return;

  const CANONICAL_DELIVERY_TYPES = new Set([
    "Hand Unload",
    "Forklift Delivery",
    "Crane Delivery",
    "Delivery (No Assistance)",
    "Pickup (Customer to collect)",
  ]);

  // Compatibility is intentionally one-way: obsolete stored defaults are read
  // into the current model, but current values are never translated back into
  // the retired delivery-type vocabulary.
  const LEGACY_DELIVERY_TYPE_MAP = new Map([
    ["Manual Unload (Knauf Labour)", "Hand Unload"],
    ["Mechanical (Forklift/Crane/Own)", "Forklift Delivery"],
    ["Mixed Unload (Hand + Machine)", "Hand Unload"],
    ["Customer Pickup", "Pickup (Customer to collect)"],
  ]);

  function canonicalDeliveryType(value) {
    const stored = String(value || "").trim();
    const canonical = LEGACY_DELIVERY_TYPE_MAP.get(stored) || stored;
    return CANONICAL_DELIVERY_TYPES.has(canonical) ? canonical : "";
  }

  function setValue(id, value) {
    const field = document.getElementById(id);
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      field.value = String(value || "");
    }
  }

  function clearChoiceGroup(name) {
    document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      if (input instanceof HTMLInputElement) input.checked = false;
    });
  }

  function selectChoice(name, value) {
    const selected = document.querySelector(`input[name="${name}"][value="${CSS.escape(String(value || ""))}"]`);
    if (selected instanceof HTMLInputElement) selected.checked = true;
  }

  function formatDefaultAddress(defaults) {
    return [
      defaults.street,
      [defaults.suburb, defaults.state || "VIC", defaults.postcode].filter(Boolean).join(" "),
    ].filter(Boolean).join(", ");
  }

  function syncVisibleSelect(selector, value, label = "") {
    const select = document.querySelector(selector);
    if (!(select instanceof HTMLSelectElement)) return;

    const normalised = String(value || "");
    if (normalised && ![...select.options].some((option) => option.value === normalised)) {
      select.append(new Option(label || normalised, normalised));
    }

    select.value = normalised;
    select.classList.toggle("is-placeholder", !normalised);
  }

  function syncVisibleOrderDetailFields(timeSlot, deliveryType) {
    window.initialiseOrderDetailFields?.();
    window.formatOrderDetailFields?.();

    syncVisibleSelect(".delivery-select-timeSlot .delivery-select", timeSlot, timeSlot === "ANY" ? "Any" : timeSlot);
    syncVisibleSelect(".delivery-select-deliveryType .delivery-select", deliveryType, deliveryType);
  }

  function applyOrderDefaults(defaults) {
    if (!defaults || typeof defaults !== "object") return;

    setValue("reference", defaults.reference);
    setValue("requiredDate", defaults.requiredDate);
    setValue("deliveryInstructions", defaults.instructions);

    const address = formatDefaultAddress(defaults);
    setValue("deliveryAddressSearch", address);
    setValue("deliveryAddress", address);
    setValue("deliveryAddressLine1", defaults.street);
    setValue("deliveryAddressLine2", [defaults.suburb, defaults.state || "VIC", defaults.postcode].filter(Boolean).join(" "));

    clearChoiceGroup("timeSlot");
    const timeSlot = String(defaults.timeSlot || "").trim().toUpperCase();
    if (timeSlot) selectChoice("timeSlot", timeSlot);

    clearChoiceGroup("deliveryType");
    const deliveryType = canonicalDeliveryType(defaults.deliveryType);
    if (deliveryType) selectChoice("deliveryType", deliveryType);

    clearChoiceGroup("deliveryExtra");
    if (Array.isArray(defaults.extras)) {
      defaults.extras.forEach((extra) => selectChoice("deliveryExtra", extra));
    }

    if (globalThis.state?.account) {
      globalThis.state.account.orderDefaults = {
        ...defaults,
        deliveryType,
      };
    }
    syncVisibleOrderDetailFields(timeSlot, deliveryType);

    if (typeof updateFutureDateConfirmation === "function") updateFutureDateConfirmation();
    if (typeof updatePickupMode === "function") updatePickupMode();
    if (typeof updateGeneratedDeliverySummary === "function") updateGeneratedDeliverySummary();
  }

  async function loadOrderDefaults() {
    try {
      const response = await fetch("/api/account", { credentials: "same-origin", headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) return;
      applyOrderDefaults(payload.profile?.orderDefaults || {});
    } catch (_error) {
      // The main order-form bootstrap owns account-load error reporting.
    }
  }

  // Saved addresses remain available from the Account page, but the order-form
  // picker is intentionally unpublished until the workflow is approved.
  document.getElementById("savedAddressPickerButton")?.remove();
  document.getElementById("savedAddressPickerMenu")?.remove();
  document.querySelector(".address-control")?.classList.remove("has-saved-address-picker");
  document.querySelectorAll('[data-saved-address-picker="true"]').forEach((element) => element.remove());

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadOrderDefaults, { once: true });
  } else {
    void loadOrderDefaults();
  }
})();
