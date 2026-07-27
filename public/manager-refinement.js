(() => {
  const DELIVERY_OPTIONS = [
    { value: "Hand unload", label: "Hand unload" },
    { value: "Forklift", label: "Forklift" },
    { value: "Crane", label: "Crane" },
    { value: "Delivery (No assistance)", label: "Delivery (No assistance)" },
    { value: "Pickup (Customer to collect)", label: "Pickup" },
  ];
  const LEGACY_DELIVERY_MAP = new Map([
    ["Manual Unload (Knauf Labour)", "Hand unload"],
    ["Mechanical (Forklift/Crane/Own)", "Forklift"],
    ["Mixed Unload (Hand + Machine)", "Delivery (No assistance)"],
    ["Pickup", "Pickup (Customer to collect)"],
  ]);
  const PICKUP_VALUE = "Pickup (Customer to collect)";
  let attempts = 0;

  loadStyles();
  initialise();
  document.addEventListener("DOMContentLoaded", initialise, { once: true });

  const retryTimer = window.setInterval(() => {
    attempts += 1;
    initialise();
    if (attempts >= 80 || document.querySelector(".structured-address-grid")) {
      window.clearInterval(retryTimer);
    }
  }, 100);

  document.addEventListener("input", (event) => {
    if (event.target.matches(".quantity-input")) updateTabSummary();
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-floor-tab], [data-add-area], [data-delete-area], .remove-row, .additional-result-row")) {
      window.setTimeout(() => {
        ensureTabSummary();
        updateTabSummary();
        refineInsulationLabels();
      }, 0);
    }
  });

  function initialise() {
    configureDeliveryTypes();
    patchDeliveryTypeLabel();
    patchPickupMode();
    setupStructuredAddress();
    patchAddressHelpers();
    patchValidation();
    patchApplyPayload();
    patchRenderCounts();
    patchRenderer();
    refineInsulationLabels();
    ensureTabSummary();
    updateTabSummary();
  }

  function loadStyles() {
    if (document.querySelector('link[data-manager-refinement="true"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/manager-refinement.css?v=20260727-1";
    link.dataset.managerRefinement = "true";
    document.head.append(link);
  }

  function configureDeliveryTypes() {
    const group = document.querySelector(".delivery-type-field .stacked-options");
    if (!group) return;

    const currentValue = normaliseDeliveryValue(selectedRadio("deliveryType"));
    let labels = [...group.querySelectorAll(":scope > label")];
    while (labels.length < DELIVERY_OPTIONS.length) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "deliveryType";
      const span = document.createElement("span");
      label.append(input, span);
      group.append(label);
      labels.push(label);
    }
    labels.slice(DELIVERY_OPTIONS.length).forEach((label) => label.remove());

    labels.forEach((label, index) => {
      const option = DELIVERY_OPTIONS[index];
      const input = label.querySelector('input[type="radio"]');
      const span = label.querySelector("span") || label.appendChild(document.createElement("span"));
      if (!input) return;
      input.name = "deliveryType";
      input.value = option.value;
      input.checked = option.value === currentValue;
      span.textContent = option.label;
      if (input.dataset.managerBound !== "true") {
        input.dataset.managerBound = "true";
        input.addEventListener("change", () => {
          updatePickupMode?.();
          updateGeneratedDeliverySummary?.();
          scheduleDraft?.();
          syncDeliverySelect();
        });
      }
    });

    try {
      DELIVERY_OPTIONS.forEach((option) => deliveryTypes.add(option.value));
      LEGACY_DELIVERY_MAP.forEach((_mapped, legacy) => deliveryTypes.add(legacy));
    } catch (_error) { }

    rebuildDeliverySelect();
  }

  function rebuildDeliverySelect() {
    const current = document.querySelector(".delivery-select-deliveryType .delivery-select");
    if (!current) return;
    if (current.dataset.managerDeliverySelect === "true") {
      syncDeliverySelect();
      return;
    }

    const select = current.cloneNode(false);
    select.dataset.managerDeliverySelect = "true";
    select.className = current.className;
    select.setAttribute("aria-label", "Delivery Type");
    select.append(new Option("Select delivery type", ""));
    DELIVERY_OPTIONS.forEach((option) => select.append(new Option(option.label, option.value)));
    current.replaceWith(select);

    select.addEventListener("change", () => {
      document.querySelectorAll('input[name="deliveryType"]').forEach((radio) => {
        radio.checked = radio.value === select.value;
      });
      const selected = document.querySelector('input[name="deliveryType"]:checked');
      selected?.dispatchEvent(new Event("change", { bubbles: true }));
      select.classList.toggle("is-placeholder", !select.value);
      updatePickupMode?.();
      updateGeneratedDeliverySummary?.();
      scheduleDraft?.();
    });
    syncDeliverySelect();
  }

  function syncDeliverySelect() {
    const select = document.querySelector(".delivery-select-deliveryType .delivery-select");
    if (!select) return;
    select.value = normaliseDeliveryValue(selectedRadio("deliveryType"));
    select.classList.toggle("is-placeholder", !select.value);
  }

  function normaliseDeliveryValue(value) {
    return LEGACY_DELIVERY_MAP.get(value) || value || "";
  }

  function patchDeliveryTypeLabel() {
    const refined = (value) => {
      const labels = {
        "Hand unload": "Hand unload",
        Forklift: "Forklift",
        Crane: "Crane",
        "Delivery (No assistance)": "Delivery (No assistance)",
        [PICKUP_VALUE]: "Pickup",
        "Manual Unload (Knauf Labour)": "Hand unload",
        "Mechanical (Forklift/Crane/Own)": "Forklift",
        "Mixed Unload (Hand + Machine)": "Delivery (No assistance)",
        Pickup: "Pickup",
      };
      return labels[value] || "Not selected";
    };
    window.deliveryTypeLabel = refined;
    try { deliveryTypeLabel = refined; } catch (_error) { }
  }

  function patchPickupMode() {
    if (window.updatePickupMode?.__structuredAddressPatched) return;
    const refined = function updateStructuredPickupMode() {
      const pickup = selectedRadio("deliveryType") === PICKUP_VALUE;
      const street = document.getElementById("deliveryStreet");
      const streetLabel = document.querySelector('[data-address-part="street"] .structured-address-label');
      if (street) {
        street.required = !pickup;
        street.placeholder = pickup ? "Street (optional)" : "Street";
      }
      if (streetLabel) streetLabel.textContent = pickup ? "Street · optional" : "Street";
      const suburb = document.getElementById("deliveryAddressSearch");
      if (suburb) {
        suburb.disabled = false;
        suburb.placeholder = "Suburb";
      }
      syncStructuredAddress();
    };
    refined.__structuredAddressPatched = true;
    window.updatePickupMode = refined;
    try { updatePickupMode = refined; } catch (_error) { }
  }

  function setupStructuredAddress() {
    const field = document.querySelector(".delivery-address-field");
    const originalInput = document.getElementById("deliveryAddressSearch");
    if (!field || !originalInput) return;

    if (field.dataset.structuredAddress === "true") {
      setupSuburbAutocomplete();
      syncStructuredAddressFromHidden();
      return;
    }
    field.dataset.structuredAddress = "true";
    field.classList.add("structured-address-field");

    const heading = field.querySelector(':scope > label[for="deliveryAddressSearch"]') || document.createElement("label");
    heading.textContent = "Address";
    heading.setAttribute("for", "deliveryStreet");

    const hiddenFields = [...field.querySelectorAll('input[type="hidden"]')];
    const oldControl = originalInput.closest(".address-control");
    const input = originalInput.cloneNode(true);
    input.value = originalInput.value;
    input.placeholder = "Suburb";
    input.autocomplete = "off";
    originalInput.replaceWith(input);

    const oldClear = document.getElementById("clearAddressButton");
    let clearButton = oldClear;
    if (oldClear) {
      clearButton = oldClear.cloneNode(true);
      oldClear.replaceWith(clearButton);
    }
    clearButton?.addEventListener("click", clearStructuredAddress);

    const grid = document.createElement("div");
    grid.className = "structured-address-grid";

    const street = document.createElement("input");
    street.id = "deliveryStreet";
    street.type = "text";
    street.maxLength = 240;
    street.autocomplete = "address-line1";
    street.placeholder = "Street";

    const stateInput = document.createElement("input");
    stateInput.id = "deliveryState";
    stateInput.type = "text";
    stateInput.value = "VIC";
    stateInput.readOnly = true;
    stateInput.tabIndex = -1;
    stateInput.setAttribute("aria-label", "State");

    const postcode = document.createElement("input");
    postcode.id = "deliveryPostcode";
    postcode.type = "text";
    postcode.inputMode = "numeric";
    postcode.maxLength = 4;
    postcode.readOnly = true;
    postcode.placeholder = "Postcode";

    grid.append(
      makeAddressCell("street", "Street", street),
      makeAddressCell("suburb", "Suburb", oldControl),
      makeAddressCell("state", "State", stateInput),
      makeAddressCell("postcode", "Postcode", postcode),
    );

    field.replaceChildren(heading, grid, ...hiddenFields);

    street.addEventListener("input", () => {
      syncStructuredAddress();
      scheduleDraft?.();
    });
    input.addEventListener("input", () => {
      postcode.value = "";
      input.setCustomValidity("");
      syncStructuredAddress();
      scheduleDraft?.();
    });

    syncStructuredAddressFromHidden();
    setupSuburbAutocomplete();
    updatePickupMode?.();
  }

  function makeAddressCell(part, labelText, control) {
    const cell = document.createElement("div");
    cell.className = `structured-address-cell structured-address-${part}`;
    cell.dataset.addressPart = part;
    const label = document.createElement("span");
    label.className = "structured-address-label";
    label.textContent = labelText;
    cell.append(label, control);
    return cell;
  }

  function setupSuburbAutocomplete() {
    const input = document.getElementById("deliveryAddressSearch");
    if (!input || input.dataset.suburbAutocomplete === "true") return;
    if (!window.google?.maps?.places?.Autocomplete) return;
    input.dataset.suburbAutocomplete = "true";

    const autocomplete = new google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: "au" },
      fields: ["address_components", "formatted_address", "place_id"],
      types: ["(regions)"],
    });
    state.addressAutocomplete = autocomplete;
    autocomplete.addListener("place_changed", async () => {
      const place = autocomplete.getPlace();
      let parsed = parseSuburbPlace(place?.address_components || []);
      if (!parsed.postcode && place?.place_id && window.google?.maps?.Geocoder) {
        try {
          const geocoder = new google.maps.Geocoder();
          const response = await geocoder.geocode({ placeId: place.place_id });
          parsed = parseSuburbPlace(response.results?.[0]?.address_components || place?.address_components || []);
        } catch (_error) { }
      }
      if (parsed.state && parsed.state !== "VIC") {
        input.setCustomValidity("Choose a Victorian suburb.");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      input.value = titleCaseAddress(parsed.suburb || input.value);
      const postcode = document.getElementById("deliveryPostcode");
      if (postcode) postcode.value = parsed.postcode || "";
      syncStructuredAddress();
      document.getElementById("clearAddressButton")?.removeAttribute("hidden");
      scheduleDraft?.();
    });
  }

  function parseSuburbPlace(components) {
    const get = (type, short = false) => {
      const component = components.find((item) => item.types?.includes(type));
      return component ? component[short ? "short_name" : "long_name"] : "";
    };
    return {
      suburb: get("locality") || get("postal_town") || get("sublocality") || get("administrative_area_level_2"),
      state: String(get("administrative_area_level_1", true) || "").toUpperCase(),
      postcode: get("postal_code"),
    };
  }

  function titleCaseAddress(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\b([a-z])/g, (match) => match.toUpperCase())
      .replace(/\bVic\b/g, "VIC");
  }

  function syncStructuredAddress() {
    const street = value("deliveryStreet");
    const suburb = value("deliveryAddressSearch");
    const postcode = value("deliveryPostcode");
    const line2 = [suburb, "VIC", postcode].filter(Boolean).join(" ");
    setValue("deliveryAddressLine1", street);
    setValue("deliveryAddressLine2", line2);
    setValue("deliveryAddress", [street, line2].filter(Boolean).join(", "));
    const clear = document.getElementById("clearAddressButton");
    if (clear) clear.hidden = !(street || suburb || postcode);
  }

  function syncStructuredAddressFromHidden() {
    const street = document.getElementById("deliveryStreet");
    const suburb = document.getElementById("deliveryAddressSearch");
    const postcode = document.getElementById("deliveryPostcode");
    if (!street || !suburb || !postcode) return;

    const line1 = value("deliveryAddressLine1");
    const line2 = value("deliveryAddressLine2");
    const full = value("deliveryAddress");
    const match = line2.match(/^(.*?)\s+(?:VIC|Victoria)\s+(\d{4})$/i);
    if (line1 && line1.toLowerCase() !== "pickup") street.value = titleCaseAddress(line1);
    if (match) {
      suburb.value = titleCaseAddress(match[1]);
      postcode.value = match[2];
    } else if (!suburb.value && full) {
      const fullMatch = full.match(/^(?:(.*?),\s*)?([^,]+?)\s+(?:VIC|Victoria)\s+(\d{4})$/i);
      if (fullMatch) {
        if (fullMatch[1] && !street.value) street.value = titleCaseAddress(fullMatch[1]);
        suburb.value = titleCaseAddress(fullMatch[2]);
        postcode.value = fullMatch[3];
      }
    }
    syncStructuredAddress();
  }

  function clearStructuredAddress(event) {
    event?.preventDefault?.();
    ["deliveryStreet", "deliveryAddressSearch", "deliveryPostcode", "deliveryAddress", "deliveryAddressLine1", "deliveryAddressLine2"]
      .forEach((id) => setValue(id, ""));
    const stateInput = document.getElementById("deliveryState");
    if (stateInput) stateInput.value = "VIC";
    const clear = document.getElementById("clearAddressButton");
    if (clear) clear.hidden = true;
    document.getElementById("deliveryAddressSearch")?.setCustomValidity("");
    scheduleDraft?.();
  }

  function patchAddressHelpers() {
    const parse = function parseStructuredAddress() {
      syncStructuredAddress();
    };
    window.parseAndStoreManualAddress = parse;
    try { parseAndStoreManualAddress = parse; } catch (_error) { }
    window.clearAddress = clearStructuredAddress;
    try { clearAddress = clearStructuredAddress; } catch (_error) { }
  }

  function patchValidation() {
    const original = window.validateForm;
    if (typeof original !== "function" || original.__structuredAddressPatched) return;
    const patched = function validateWithStructuredAddress(...args) {
      syncStructuredAddress();
      const result = original.apply(this, args);
      const pickup = selectedRadio("deliveryType") === PICKUP_VALUE;
      const street = value("deliveryStreet");
      const suburb = value("deliveryAddressSearch");
      const postcode = value("deliveryPostcode");
      if (!pickup && !street) throw fieldError("deliveryStreet", "Enter the street address.");
      if (!suburb) throw fieldError("deliveryAddressSearch", "Choose a Victorian suburb.");
      if (!/^(?:3\d{3}|8\d{3})$/.test(postcode)) {
        throw fieldError("deliveryAddressSearch", "Choose a suburb from the suggestions so the postcode can be confirmed.");
      }
      return result;
    };
    patched.__structuredAddressPatched = true;
    window.validateForm = patched;
    try { validateForm = patched; } catch (_error) { }
  }

  function patchApplyPayload() {
    const original = window.applyPayload;
    if (typeof original !== "function" || original.__structuredAddressPatched) return;
    const patched = function applyPayloadWithStructuredAddress(payload, ...args) {
      const mapped = payload && typeof payload === "object"
        ? { ...payload, deliveryType: normaliseDeliveryValue(payload.deliveryType) }
        : payload;
      const result = original.call(this, mapped, ...args);
      window.setTimeout(() => {
        configureDeliveryTypes();
        setupStructuredAddress();
        syncStructuredAddressFromHidden();
        syncDeliverySelect();
        updatePickupMode?.();
      }, 0);
      return result;
    };
    patched.__structuredAddressPatched = true;
    window.applyPayload = patched;
    try { applyPayload = patched; } catch (_error) { }
  }

  function patchRenderCounts() {
    const original = window.renderCounts;
    if (typeof original !== "function" || original.__tabSummaryPatched) return;
    const patched = function renderCountsWithTabSummary(...args) {
      const result = original.apply(this, args);
      ensureTabSummary();
      updateTabSummary();
      return result;
    };
    patched.__tabSummaryPatched = true;
    window.renderCounts = patched;
    try { renderCounts = patched; } catch (_error) { }
  }

  function patchRenderer() {
    const original = window.renderUnifiedFloorSheet;
    if (typeof original !== "function" || original.__managerRefinementPatched) return;
    const patched = function renderWithManagerRefinements(...args) {
      const result = original.apply(this, args);
      refineInsulationLabels();
      ensureTabSummary();
      updateTabSummary();
      return result;
    };
    patched.__managerRefinementPatched = true;
    window.renderUnifiedFloorSheet = patched;
    try { renderUnifiedFloorSheet = patched; } catch (_error) { }
  }

  function refineInsulationLabels() {
    document.querySelectorAll(".insulation-table .lower-item-detail").forEach((cell) => {
      const text = cell.textContent.trim().replace(/\s+/g, " ");
      if (text === "2.0 90 mm") cell.textContent = "90 mm 2.0";
      if (text === "2.5 HD 90 mm") cell.textContent = "90 mm 2.5 HD";
    });
  }

  function ensureTabSummary() {
    const tabs = document.getElementById("deliveryAreaTabs") || document.querySelector(".floor-tabs");
    if (!tabs) return;
    let summary = tabs.querySelector(".area-tab-summary");
    if (!summary) {
      summary = document.createElement("div");
      summary.className = "area-tab-summary";
      summary.innerHTML = '<span class="area-summary-metric" data-tab-lines>Lines 0</span><span class="area-summary-separator">·</span><span class="area-summary-metric" data-tab-units>Qty 0</span><button type="button" class="area-tab-reset">Reset tab</button>';
      summary.querySelector(".area-tab-reset").addEventListener("click", resetActiveTab);
      tabs.append(summary);
    }
  }

  function updateTabSummary() {
    const summary = document.querySelector(".area-tab-summary");
    if (!summary || typeof state === "undefined") return;
    const areaId = state.activeFloor;
    const lines = typeof getFloorLines === "function" ? getFloorLines(areaId) : [];
    const lineCount = lines.length;
    const unitCount = lines.reduce((total, line) => total + Number(line.quantity || 0), 0);
    const lineNode = summary.querySelector("[data-tab-lines]");
    const unitNode = summary.querySelector("[data-tab-units]");
    const reset = summary.querySelector(".area-tab-reset");
    if (lineNode) lineNode.textContent = `Lines ${lineCount}`;
    if (unitNode) unitNode.textContent = `Qty ${unitCount}`;
    if (reset) reset.disabled = lineCount === 0;
  }

  function resetActiveTab() {
    if (typeof state === "undefined") return;
    const areaId = state.activeFloor;
    const area = state.deliveryAreas?.find((candidate) => candidate.id === areaId);
    const lines = typeof getFloorLines === "function" ? getFloorLines(areaId) : [];
    if (lines.length && !window.confirm(`Clear all quantities in ${area?.label || "this tab"}?`)) return;
    state.quantities[areaId] = new Map();
    state.otherMaterials[areaId] = [];
    window.renderUnifiedFloorSheet?.(areaId);
    renderCounts?.();
    scheduleDraft?.();
    refineInsulationLabels();
    updateTabSummary();
  }
})();
