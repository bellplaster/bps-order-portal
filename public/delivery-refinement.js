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

    hideNonEditableOrderFields();
    addressField.querySelector(".field-help")?.remove();

    const sourceControls = document.createElement("div");
    sourceControls.className = "delivery-source-controls";
    sourceControls.hidden = true;

    const timeSelect = createSyncedSelect("timeSlot", "Time slot", false);
    const deliverySelect = createSyncedSelect("deliveryType", "Delivery type", true);
    const extrasControl = createExtrasDropdown(extrasField);

    const controlRow = document.createElement("div");
    controlRow.className = "delivery-instruction-controls";
    controlRow.append(timeSelect.wrapper, deliverySelect.wrapper, extrasControl.wrapper);

    const heading = notesField.querySelector(":scope > span");
    if (heading) heading.textContent = "Delivery instructions";

    notesField.querySelector(".generated-delivery-notes")?.remove();

    const textLabel = notesField.querySelector(".additional-instructions-label");
    const textarea = document.getElementById("deliveryInstructions");
    const textWrapper = document.createElement("div");
    textWrapper.className = "floating-textarea-control";
    if (textarea) textarea.placeholder = "Additional instructions";
    if (textLabel) {
      textLabel.textContent = "Additional instructions (optional)";
      textLabel.className = "floating-textarea-label";
    }
    if (textarea) textWrapper.append(textarea);
    if (textLabel) textWrapper.append(textLabel);

    sourceControls.append(timeField, typeField, extrasField);
    notesField.replaceChildren(
      ...(heading ? [heading] : []),
      controlRow,
      ...(textWrapper.childElementCount ? [textWrapper] : []),
      sourceControls,
    );

    grid.replaceChildren(addressField, notesField);
    grid.classList.add("delivery-grid-unified");

    window.syncUnifiedDeliveryControls = () => {
      syncSelectFromRadios(timeSelect.select, "timeSlot");
      syncSelectFromRadios(deliverySelect.select, "deliveryType");
      extrasControl.updateSummary();
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

    document.addEventListener("click", (event) => {
      if (!extrasControl.details.contains(event.target)) extrasControl.details.open = false;
    });

    window.syncUnifiedDeliveryControls();
  }

  function hideNonEditableOrderFields() {
    const accountSummary = document.getElementById("accountSummary");
    if (accountSummary) accountSummary.hidden = true;

    ["orderDate", "customerName"].forEach((id) => {
      const input = document.getElementById(id);
      const field = input?.closest("label.form-field");
      if (field) field.classList.add("system-only-field");
    });

    document.querySelector(".basic-details-grid")?.classList.add("customer-entry-grid");
  }

  function createSyncedSelect(name, labelText, includePlaceholder) {
    const radios = [...document.querySelectorAll(`input[name="${name}"]`)];
    const wrapper = document.createElement("label");
    wrapper.className = "delivery-select-field floating-select-field";
    const label = document.createElement("span");
    label.className = "floating-select-label";
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

    wrapper.append(select, label);
    return { wrapper, select };
  }

  function syncSelectFromRadios(select, name) {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    select.value = selected?.value || "";
  }

  function createExtrasDropdown(extrasField) {
    const options = extrasField.querySelector(".extras-options");
    const wrapper = document.createElement("div");
    wrapper.className = "delivery-select-field extras-dropdown-field floating-select-field";
    const label = document.createElement("span");
    label.className = "floating-select-label";
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
    wrapper.append(details, label);

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