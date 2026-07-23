(() => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiseDeliveryRefinement, { once: true });
  } else {
    initialiseDeliveryRefinement();
  }

  function initialiseDeliveryRefinement() {
    const grid = document.querySelector(".delivery-grid");
    const addressField = document.querySelector(".delivery-address-field");
    const notesField = document.querySelector(".delivery-notes-field");
    const timeField = document.querySelector(".time-slot-field");
    const typeField = document.querySelector(".delivery-type-field");
    const extrasField = document.querySelector(".extras-field");
    if (!grid || !addressField || !notesField || !timeField || !typeField || !extrasField) return;

    injectOrderDetailsRefinementStyles();
    applyOrderSheetCopy();
    hideNonEditableOrderFields();
    addressField.querySelector(".field-help")?.remove();
    const requiredDateControl = initialiseRequiredDateControl();

    const deliveryBlock = grid.closest(".delivery-block");
    deliveryBlock?.querySelector(".delivery-block-title")?.remove();
    deliveryBlock?.removeAttribute("aria-labelledby");

    const sourceControls = document.createElement("div");
    sourceControls.className = "delivery-source-controls";
    sourceControls.hidden = true;

    const timeSelect = createSyncedSelect("timeSlot", "Time Slot", false);
    const deliverySelect = createSyncedSelect("deliveryType", "Delivery Type", true);
    const extrasControl = createExtrasDropdown(extrasField);

    const controlRow = document.createElement("div");
    controlRow.className = "delivery-instruction-controls delivery-table-row";
    controlRow.append(timeSelect.wrapper, deliverySelect.wrapper, extrasControl.wrapper);

    notesField.querySelector(":scope > span")?.remove();
    notesField.querySelector(".generated-delivery-notes")?.remove();

    const textLabel = notesField.querySelector(".additional-instructions-label");
    const textarea = document.getElementById("deliveryInstructions");
    const instructionRow = document.createElement("div");
    instructionRow.className = "sheet-field-row instruction-sheet-row";
    if (textLabel) {
      textLabel.textContent = "Instructions";
      textLabel.className = "";
      instructionRow.append(textLabel);
    }
    if (textarea) {
      textarea.placeholder = "Access, unloading or site notes";
      instructionRow.append(textarea);
    }

    sourceControls.append(timeField, typeField, extrasField);
    notesField.replaceChildren(
      controlRow,
      ...(instructionRow.childElementCount ? [instructionRow] : []),
      sourceControls,
    );

    grid.replaceChildren(addressField, notesField);
    grid.classList.add("delivery-grid-unified");

    window.syncUnifiedDeliveryControls = () => {
      syncSelectFromRadios(timeSelect.select, "timeSlot");
      syncSelectFromRadios(deliverySelect.select, "deliveryType");
      extrasControl.updateSummary();
      updateAddressPlaceholder();
      requiredDateControl.syncFromNative();
    };

    const originalApplyPayload = window.applyPayload;
    if (typeof originalApplyPayload === "function") {
      window.applyPayload = function refinedApplyPayload(...args) {
        const result = originalApplyPayload.apply(this, args);
        queueMicrotask(() => window.syncUnifiedDeliveryControls?.());
        return result;
      };
    }

    document.getElementById("orderForm")?.addEventListener("reset", () => {
      window.setTimeout(() => window.syncUnifiedDeliveryControls?.(), 0);
    });

    document.querySelectorAll('input[name="deliveryType"]').forEach((input) => {
      input.addEventListener("change", updateAddressPlaceholder);
    });

    document.addEventListener("click", (event) => {
      if (!extrasControl.details.contains(event.target)) extrasControl.details.open = false;
    });

    window.syncUnifiedDeliveryControls();
  }

  function injectOrderDetailsRefinementStyles() {
    if (document.getElementById("order-details-date-refinement")) return;
    const style = document.createElement("style");
    style.id = "order-details-date-refinement";
    style.textContent = `
      .order-details-section .sheet-field-row > label,
      .order-details-section .sheet-field-row > input,
      .order-details-section .sheet-field-row .address-control > input,
      .order-details-section .delivery-select-field > span,
      .order-details-section .delivery-select,
      .order-details-section .extras-dropdown > summary,
      .order-details-section .instruction-sheet-row > textarea {
        font-size: 11px !important;
      }

      .order-details-section .sheet-field-row > input,
      .order-details-section .sheet-field-row .address-control > input,
      .order-details-section #requiredDateDisplay {
        line-height: 39px !important;
      }

      .order-details-section .sheet-field-row > input::placeholder,
      .order-details-section .sheet-field-row .address-control > input::placeholder,
      .order-details-section #requiredDateDisplay::placeholder {
        line-height: 39px !important;
      }

      .date-input-shell::after {
        display: none !important;
        content: none !important;
      }

      .date-input-shell #requiredDate.date-native-picker {
        position: absolute !important;
        z-index: 5 !important;
        left: 0 !important;
        top: 0 !important;
        width: 38px !important;
        min-width: 38px !important;
        height: 39px !important;
        min-height: 39px !important;
        margin: 0 !important;
        padding: 0 !important;
        opacity: 0.001 !important;
        cursor: pointer !important;
      }

      .date-input-shell #requiredDateDisplay {
        width: 100% !important;
        min-width: 0 !important;
        height: 39px !important;
        min-height: 39px !important;
        margin: 0 !important;
        padding: 0 8px 0 42px !important;
        color: var(--ink) !important;
        background: #fff !important;
        border: 0 !important;
        border-radius: 0 !important;
        outline: 0 !important;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        font-size: 11px !important;
        font-weight: 400 !important;
      }

      .date-input-shell #requiredDateDisplay::placeholder {
        color: #aab0b2 !important;
        opacity: 1 !important;
      }

      .date-input-shell #requiredDateDisplay:focus {
        position: relative;
        z-index: 2;
        box-shadow: inset 0 0 0 2px var(--bell-green);
      }
    `;
    document.head.append(style);
  }

  function initialiseRequiredDateControl() {
    const nativeInput = document.getElementById("requiredDate");
    const shell = nativeInput?.closest(".date-input-shell");
    if (!nativeInput || !shell) return { syncFromNative() {} };

    let displayInput = document.getElementById("requiredDateDisplay");
    if (!displayInput) {
      displayInput = document.createElement("input");
      displayInput.id = "requiredDateDisplay";
      displayInput.type = "text";
      displayInput.inputMode = "numeric";
      displayInput.autocomplete = "off";
      displayInput.maxLength = 10;
      displayInput.placeholder = "DD/MM/YYYY";
      displayInput.setAttribute("aria-label", "Required date");
      shell.append(displayInput);
    }

    nativeInput.classList.add("date-native-picker");
    nativeInput.tabIndex = -1;
    nativeInput.setAttribute("aria-label", "Choose required date from calendar");
    document.querySelector('label[for="requiredDate"]')?.setAttribute("for", "requiredDateDisplay");

    const syncFromNative = () => {
      displayInput.value = requiredDateDisplay(nativeInput.value);
    };

    displayInput.addEventListener("input", () => {
      const formatted = formatRequiredDateTyping(displayInput.value);
      if (displayInput.value !== formatted) displayInput.value = formatted;
      const iso = parseRequiredDateDisplay(formatted);
      if (nativeInput.value === iso) return;
      nativeInput.value = iso;
      nativeInput.dispatchEvent(new Event("input", { bubbles: true }));
      nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    displayInput.addEventListener("blur", () => {
      const iso = parseRequiredDateDisplay(displayInput.value);
      if (iso) displayInput.value = requiredDateDisplay(iso);
    });

    nativeInput.addEventListener("change", syncFromNative);
    syncFromNative();
    return { syncFromNative };
  }

  function formatRequiredDateTyping(input) {
    const digits = String(input || "").replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  function parseRequiredDateDisplay(input) {
    const digits = String(input || "").replace(/\D/g, "");
    if (digits.length !== 8) return "";
    const day = Number(digits.slice(0, 2));
    const month = Number(digits.slice(2, 4));
    const year = Number(digits.slice(4, 8));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day
    ) return "";
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function requiredDateDisplay(iso) {
    const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
  }

  function applyOrderSheetCopy() {
    const heading = document.getElementById("orderDetailsHeading");
    if (heading) heading.textContent = "Order Details";

    const reference = document.getElementById("reference");
    const referenceLabel = document.querySelector('label[for="reference"]');
    if (referenceLabel) referenceLabel.textContent = "Reference";
    if (reference) reference.placeholder = "Purchase order or order number";

    const contact = document.getElementById("contactName");
    if (contact) contact.placeholder = "Name";

    const address = document.getElementById("deliveryAddressSearch");
    if (address) address.placeholder = "Address";
  }

  function updateAddressPlaceholder() {
    const input = document.getElementById("deliveryAddressSearch");
    if (!input) return;
    input.placeholder = selectedRadio("deliveryType") === "Pickup (Customer to collect)"
      ? "Not required for pickup"
      : "Address";
  }

  function hideNonEditableOrderFields() {
    const accountSummary = document.getElementById("accountSummary");
    if (accountSummary) accountSummary.hidden = true;
  }

  function createSyncedSelect(name, labelText, includePlaceholder) {
    const radios = [...document.querySelectorAll(`input[name="${name}"]`)];
    const wrapper = document.createElement("div");
    wrapper.className = `delivery-select-field delivery-select-${name}`;
    const label = document.createElement("span");
    label.textContent = labelText;
    const select = document.createElement("select");
    select.className = "delivery-select";
    select.setAttribute("aria-label", labelText);

    if (includePlaceholder) select.append(new Option("Select delivery type", ""));
    radios.forEach((radio) => {
      const optionLabel = radio.closest("label")?.querySelector("span")?.textContent?.trim() || radio.value;
      select.append(new Option(optionLabel, radio.value));
    });

    select.value = radios.find((radio) => radio.checked)?.value || (includePlaceholder ? "" : "ANY");
    select.addEventListener("change", () => {
      const radio = radios.find((candidate) => candidate.value === select.value);
      if (!radio) return;
      radio.checked = true;
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    });

    wrapper.append(label, select);
    return { wrapper, select };
  }

  function syncSelectFromRadios(select, name) {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    select.value = selected?.value || "";
  }

  function createExtrasDropdown(extrasField) {
    const options = extrasField.querySelector(".extras-options");
    const wrapper = document.createElement("div");
    wrapper.className = "delivery-select-field extras-dropdown-field";
    const label = document.createElement("span");
    label.textContent = "Extras";
    const details = document.createElement("details");
    details.className = "extras-dropdown";
    const summary = document.createElement("summary");
    const summaryText = document.createElement("span");
    summary.append(summaryText);
    const menu = document.createElement("div");
    menu.className = "extras-dropdown-menu";
    if (options) menu.append(options);
    details.append(summary, menu);
    wrapper.append(label, details);

    const updateSummary = () => {
      const values = [...menu.querySelectorAll('input[name="deliveryExtra"]:checked')]
        .map((input) => input.closest("label")?.querySelector("span")?.textContent?.trim() || input.value);
      summaryText.textContent = values.length ? values.join(", ") : "None";
      summary.title = summaryText.textContent;
    };
    menu.querySelectorAll('input[name="deliveryExtra"]').forEach((input) => input.addEventListener("change", updateSummary));
    updateSummary();
    return { wrapper, details, updateSummary };
  }

  window.getGeneratedDeliveryLines = function refinedGeneratedDeliveryLines(payload = null) {
    const source = payload || {
      timeSlot: selectedRadio("timeSlot") || "ANY",
      deliveryType: selectedRadio("deliveryType"),
      extras: checkedValues("deliveryExtra"),
    };
    return [
      `Time slot: ${timeSlotLabel(source.timeSlot)}.`,
      `Delivery type: ${deliveryTypeLabel(source.deliveryType)}.`,
      `Extras: ${(source.extras || []).join(", ") || "None"}.`,
    ];
  };

  window.renderRefinedAddressSuggestions = function refinedAddressSuggestionsWithPostcodes() {
    const results = document.getElementById("addressSearchResults");
    results.replaceChildren();
    if (!state.addressPredictions.length) {
      const empty = document.createElement("div");
      empty.className = "address-no-results";
      empty.textContent = "No matching address";
      results.append(empty);
    } else {
      state.addressPredictions.forEach((prediction, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "address-result";
        button.classList.toggle("is-active", index === state.addressPredictionIndex);
        button.dataset.addressResultIndex = String(index);
        button.setAttribute("role", "option");
        const line = document.createElement("span");
        line.className = "address-result-line";
        const key = addressPredictionKey(prediction);
        line.textContent = state.addressPreviewCache.get(key) || formatAddressDisplay(refinedPredictionText(prediction));
        button.append(line);
        button.addEventListener("click", () => void selectRefinedAddress(prediction));
        results.append(button);
      });
      scheduleAddressPreviewHydration();
    }
    const attribution = document.createElement("div");
    attribution.className = "google-maps-attribution";
    attribution.textContent = "Google";
    results.append(attribution);
    results.hidden = false;
    document.getElementById("deliveryAddressSearch").setAttribute("aria-expanded", "true");
  };

  function scheduleAddressPreviewHydration() {
    window.clearTimeout(state.addressPreviewTimer);
    state.addressPreviewTimer = window.setTimeout(() => {
      state.addressPredictions.slice(0, 5).forEach((prediction, index) => void hydrateAddressPreview(prediction, index));
    }, 120);
  }

  async function hydrateAddressPreview(prediction, index) {
    const key = addressPredictionKey(prediction);
    if (state.addressPreviewCache.has(key)) return;
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "addressComponents"] });
      const display = formatAddressDisplay(parseRefinedGoogleAddress(place).full);
      if (!display) return;
      state.addressPreviewCache.set(key, display);
      if (state.addressPredictions[index] !== prediction) return;
      const line = document.querySelector(`[data-address-result-index="${index}"] .address-result-line`);
      if (line) line.textContent = display;
    } catch (error) {
      console.debug("Address preview could not be enriched.", error);
    }
  }

  function addressPredictionKey(prediction) {
    return String(prediction?.placeId || prediction?.id || refinedPredictionText(prediction));
  }
})();