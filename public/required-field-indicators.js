(() => {
  if (window.__bpsRequiredFieldIndicatorsStarted) return;
  window.__bpsRequiredFieldIndicatorsStarted = true;

  const PICKUP_VALUE = "Pickup (Customer to collect)";
  const STATIC_REQUIRED_FIELDS = Object.freeze([
    "requiredDateDisplay",
    "contactName",
    "contactMobile",
  ]);
  const STRUCTURED_ADDRESS_FIELDS = Object.freeze([
    { id: "deliveryStreet", label: "Street" },
    { id: "deliveryAddressSearch", label: "Suburb" },
    { id: "deliveryPostcode", label: "Postcode" },
  ]);
  let addressSyncQueued = false;

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

  function markRequiredSelect(name) {
    const label = document.querySelector(`.delivery-select-${CSS.escape(name)} > span`);
    const select = document.querySelector(`.delivery-select-${CSS.escape(name)} > .delivery-select`);
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

    const indicator = label.querySelector(":scope > .required-field-indicator");
    if (indicator) indicator.remove();
    label.textContent = "Debtor Code";
    ensureIndicator(label);
    input.placeholder = "Debtor Code";
    input.setAttribute("aria-label", "Debtor Code");
    input.setAttribute("aria-required", "true");
  }

  function directText(element) {
    return [...(element?.childNodes || [])]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findStructuredAddressLabel(field, text) {
    const cell = field?.closest(".structured-address-cell");
    if (!cell) return null;

    const explicit = cell.querySelector(`label[for="${CSS.escape(field.id)}"]`);
    if (explicit) return explicit;

    return [...cell.querySelectorAll("label, span, small, b")].find((element) => {
      return element.dataset.requiredFieldLabel === text || directText(element) === text;
    }) || null;
  }

  function setConditionalIndicator(label, required) {
    const indicator = ensureIndicator(label);
    if (indicator) indicator.hidden = !required;
  }

  function syncAddressRequirement() {
    const pickup = document.querySelector('input[name="deliveryType"]:checked')?.value === PICKUP_VALUE;
    const required = !pickup;
    const suburbInput = document.getElementById("deliveryAddressSearch");
    const addressField = suburbInput?.closest(".delivery-address-field");
    const addressLabel = addressField?.querySelector(':scope > label[for="deliveryAddressSearch"]')
      || document.querySelector('label[for="deliveryAddressSearch"]');

    setConditionalIndicator(addressLabel, required);

    STRUCTURED_ADDRESS_FIELDS.forEach(({ id, label: labelText }) => {
      const field = document.getElementById(id);
      if (!field) return;
      const label = findStructuredAddressLabel(field, labelText);
      if (label) {
        label.dataset.requiredFieldLabel = labelText;
        setConditionalIndicator(label, required);
      }
      field.required = required;
      field.setAttribute("aria-required", String(required));
    });
  }

  function queueAddressRequirementSync() {
    if (addressSyncQueued) return;
    addressSyncQueued = true;
    queueMicrotask(() => {
      addressSyncQueued = false;
      syncAddressRequirement();
    });
  }

  function observeAddressStructure() {
    const root = document.querySelector(".delivery-address-field");
    if (!root || root.dataset.requiredIndicatorObserved === "true") return;
    root.dataset.requiredIndicatorObserved = "true";

    const observer = new MutationObserver((records) => {
      const relevant = records.some((record) => [...record.addedNodes, ...record.removedNodes]
        .some((node) => node instanceof Element));
      if (relevant) queueAddressRequirementSync();
    });
    observer.observe(root, { childList: true, subtree: true });
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
    markRequiredSelect("timeSlot");
    markRequiredSelect("deliveryType");
    markGateCode();
    markCustomerServiceDebtor();
    syncAddressRequirement();
    observeAddressStructure();
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
