(() => {
  if (window.__bpsDeliveryRefinementLoaded) return;
  window.__bpsDeliveryRefinementLoaded = true;

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

    const deliveryBlock = grid.closest(".delivery-block");
    deliveryBlock?.querySelector(".delivery-block-title")?.remove();
    deliveryBlock?.removeAttribute("aria-labelledby");

    const sourceControls = document.createElement("div");
    sourceControls.className = "delivery-source-controls";
    sourceControls.hidden = true;

    const timeSelect = createSyncedSelect("timeSlot", "Time Slot", true);
    const deliverySelect = createSyncedSelect("deliveryType", "Delivery Type", true);
    const extrasControl = createExtrasDropdown(extrasField);
    const gateControl = createGateCodeControl();

    const controlRow = document.createElement("div");
    controlRow.className = "delivery-instruction-controls delivery-table-row";
    controlRow.append(timeSelect.wrapper, deliverySelect.wrapper, extrasControl.wrapper, gateControl.wrapper);

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
    };

    window.BPSGateCode = Object.freeze({
      value: gateControl.value,
      setValue: gateControl.setValue,
      validate: gateControl.validate,
      normalise: gateControl.normalise,
    });

    const originalApplyPayload = window.applyPayload;
    if (typeof originalApplyPayload === "function") {
      window.applyPayload = function refinedApplyPayload(...args) {
        const result = originalApplyPayload.apply(this, args);
        queueMicrotask(() => window.syncUnifiedDeliveryControls?.());
        return result;
      };
    }

    document.getElementById("orderForm")?.addEventListener("reset", () => {
      gateControl.setValue("");
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
    if (document.getElementById("order-details-control-refinement")) return;
    const style = document.createElement("style");
    style.id = "order-details-control-refinement";
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
      .order-details-section .sheet-field-row .address-control > input {
        line-height: 39px !important;
      }
      .order-details-section .sheet-field-row > input::placeholder,
      .order-details-section .sheet-field-row .address-control > input::placeholder {
        line-height: 39px !important;
      }
    `;
    document.head.append(style);
  }

  function applyOrderSheetCopy() {
    const heading = document.getElementById("orderDetailsHeading");
    if (heading) heading.textContent = "Order Details";

    const reference = document.getElementById("reference");
    const referenceLabel = document.querySelector('label[for="reference"]');
    if (referenceLabel) referenceLabel.textContent = "Reference";
    if (reference) reference.placeholder = "Reference (optional)";

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

    if (includePlaceholder) {
      const placeholder = name === "timeSlot" ? "Select time slot" : "Select delivery type";
      select.append(new Option(placeholder, ""));
    }
    radios.forEach((radio) => {
      const optionLabel = radio.closest("label")?.querySelector("span")?.textContent?.trim() || radio.value;
      select.append(new Option(optionLabel, radio.value));
    });

    const updatePresentation = () => select.classList.toggle("is-placeholder", !select.value);
    select.value = radios.find((radio) => radio.checked)?.value || "";
    updatePresentation();
    select.addEventListener("change", () => {
      const radio = radios.find((candidate) => candidate.value === select.value);
      radios.forEach((candidate) => { candidate.checked = candidate === radio; });
      updatePresentation();
      if (!radio) return;
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    });

    wrapper.append(label, select);
    return { wrapper, select };
  }

  function syncSelectFromRadios(select, name) {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    select.value = selected?.value || "";
    select.classList.toggle("is-placeholder", !select.value);
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

  function createGateCodeControl() {
    const MAX_LENGTH = 6;
    const normalise = (value) => String(value || "").replace(/\D/g, "").slice(0, MAX_LENGTH);

    const wrapper = document.createElement("div");
    wrapper.className = "delivery-select-field gate-code-field";

    const label = document.createElement("span");
    label.textContent = "Gate Code";

    const control = document.createElement("div");
    control.className = "gate-code-control";

    const input = document.createElement("input");
    input.id = "gateCode";
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.maxLength = MAX_LENGTH;
    input.placeholder = "Code";
    input.setAttribute("aria-label", "Gate code, 4 to 6 digits");

    const naLabel = document.createElement("label");
    naLabel.className = "gate-code-na";
    const na = document.createElement("input");
    na.id = "gateCodeNotApplicable";
    na.type = "checkbox";
    na.autocomplete = "off";
    const naText = document.createElement("span");
    naText.textContent = "N/A";
    naLabel.append(na, naText);

    const clearValidation = () => control.classList.remove("is-invalid");
    const value = () => na.checked ? "N/A" : normalise(input.value);
    const setValue = (saved) => {
      const source = String(saved || "").trim();
      const notApplicable = source.toUpperCase() === "N/A";
      na.checked = notApplicable;
      input.value = notApplicable ? "" : normalise(source);
      input.disabled = notApplicable;
      clearValidation();
    };
    const validate = () => {
      const valid = na.checked || /^\d{4,6}$/.test(normalise(input.value));
      control.classList.toggle("is-invalid", !valid);
      if (!valid) {
        input.disabled = false;
        input.focus();
      }
      return valid;
    };

    input.addEventListener("input", () => {
      input.value = normalise(input.value);
      if (input.value) na.checked = false;
      input.disabled = false;
      clearValidation();
      window.scheduleDraft?.();
    });
    na.addEventListener("change", () => {
      if (na.checked) {
        input.value = "";
        input.disabled = true;
      } else {
        input.disabled = false;
        input.focus();
      }
      clearValidation();
      window.scheduleDraft?.();
    });

    control.append(input, naLabel);
    wrapper.append(label, control);
    return { wrapper, value, setValue, validate, normalise };
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
