(() => {
  if (window.__bpsRequiredFieldIndicatorsStarted) return;
  window.__bpsRequiredFieldIndicatorsStarted = true;

  const PICKUP_VALUE = "Pickup (Customer to collect)";
  const STATIC_REQUIRED_FIELDS = Object.freeze([
    "requiredDateDisplay",
    "contactName",
    "contactMobile",
  ]);

  function createIndicator() {
    const indicator = document.createElement("span");
    indicator.className = "required-field-indicator";
    indicator.setAttribute("aria-hidden", "true");
    indicator.textContent = "*";
    return indicator;
  }

  function ensureIndicator(label) {
    if (!label) return null;
    let indicator = label.querySelector(":scope > .required-field-indicator");
    if (!indicator) {
      indicator = createIndicator();
      label.append(indicator);
    }
    return indicator;
  }

  function markRequiredField(fieldId) {
    const field = document.getElementById(fieldId);
    const label = document.querySelector(`label[for="${CSS.escape(fieldId)}"]`);
    if (!field || !label) return;
    ensureIndicator(label);
    field.setAttribute("aria-required", "true");
  }

  function markDeliveryType() {
    const label = document.querySelector(".delivery-select-deliveryType > span");
    const select = document.querySelector(".delivery-select-deliveryType > .delivery-select");
    if (!label || !select) return;
    ensureIndicator(label);
    select.required = true;
    select.setAttribute("aria-required", "true");
  }

  function markGateCode() {
    const label = document.querySelector(".gate-code-field > span");
    if (!label) return;
    ensureIndicator(label);
  }

  function markCustomerServiceDebtor() {
    const input = document.getElementById("customerServiceCustomerAccount");
    const label = document.querySelector('label[for="customerServiceCustomerAccount"]');
    if (!input || !label) return;
    ensureIndicator(label);
    input.setAttribute("aria-required", "true");
  }

  function syncAddressRequirement() {
    const input = document.getElementById("deliveryAddressSearch");
    const label = document.querySelector('label[for="deliveryAddressSearch"]');
    if (!input || !label) return;

    const pickup = document.querySelector('input[name="deliveryType"]:checked')?.value === PICKUP_VALUE;
    const indicator = ensureIndicator(label);
    if (indicator) indicator.hidden = pickup;
    input.required = !pickup;
    input.setAttribute("aria-required", String(!pickup));
  }

  function bindDeliveryTypeChanges() {
    document.querySelectorAll('input[name="deliveryType"]').forEach((input) => {
      if (input.dataset.requiredIndicatorBound === "true") return;
      input.dataset.requiredIndicatorBound = "true";
      input.addEventListener("change", syncAddressRequirement);
    });
  }

  function installDeliverySyncBridge() {
    const previous = window.syncUnifiedDeliveryControls;
    if (typeof previous !== "function" || previous.__requiredFieldIndicators === true) return;
    const synced = function syncUnifiedDeliveryControlsWithRequiredIndicators(...args) {
      const result = previous.apply(this, args);
      syncAddressRequirement();
      return result;
    };
    synced.__requiredFieldIndicators = true;
    window.syncUnifiedDeliveryControls = synced;
  }

  function applyIndicators() {
    STATIC_REQUIRED_FIELDS.forEach(markRequiredField);
    markDeliveryType();
    markGateCode();
    markCustomerServiceDebtor();
    syncAddressRequirement();
  }

  function initialise() {
    applyIndicators();
    bindDeliveryTypeChanges();
    installDeliverySyncBridge();
    document.getElementById("orderForm")?.addEventListener("reset", () => {
      queueMicrotask(syncAddressRequirement);
    });
  }

  document.addEventListener("bps:order-account-changed", applyIndicators);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
