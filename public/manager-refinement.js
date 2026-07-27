(() => {
  const PICKUP_VALUE = "Pickup (Customer to collect)";
  const DELIVERY_OPTIONS = [
    { value: "Hand Unload", label: "Hand Unload" },
    { value: "Forklift Delivery", label: "Forklift Delivery" },
    { value: "Crane Delivery", label: "Crane Delivery" },
    { value: "Delivery (No Assistance)", label: "Delivery (No Assistance)" },
    { value: PICKUP_VALUE, label: "Customer Pickup" },
  ];
  const LEGACY_DELIVERY_MAP = new Map([
    ["Manual Unload (Knauf Labour)", "Hand Unload"],
    ["Mechanical (Forklift/Crane/Own)", "Forklift Delivery"],
    ["Mixed Unload (Hand + Machine)", "Delivery (No Assistance)"],
    ["Hand unload", "Hand Unload"],
    ["Forklift", "Forklift Delivery"],
    ["Crane", "Crane Delivery"],
    ["Delivery (No assistance)", "Delivery (No Assistance)"],
    ["Pickup", PICKUP_VALUE],
    ["Customer Pickup", PICKUP_VALUE],
  ]);
  let retryCount = 0;
  let tabArrangeTimer = 0;
  let tabObserver = null;

  removeUppercaseAddressListener();
  loadStyles();
  patchGoogleAddressInitialiser();
  patchAddressFormatting();
  initialiseRefinements();
  document.addEventListener("DOMContentLoaded", initialiseRefinements, { once: true });

  const retryTimer = window.setInterval(() => {
    retryCount += 1;
    initialiseRefinements();
    if (retryCount >= 100 && document.querySelector(".structured-address-grid")) {
      window.clearInterval(retryTimer);
    }
  }, 100);

  document.addEventListener("input", (event) => {
    if (event.target.matches(".quantity-input")) updateTabSummary();
  });
  document.addEventListener("change", (event) => {
    if (event.target.matches('input[name="deliveryExtra"]')) {
      capitaliseExtras();
      updateExtrasSummary();
    }
  });
  document.addEventListener("click", interceptAddTab, true);
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-floor-tab], [data-delete-area], .remove-row, .additional-result-row")) {
      window.setTimeout(postRenderCleanup, 0);
    }
  });

  function initialiseRefinements() {
    configureDeliveryTypes();
    capitaliseExtras();
    patchDeliveryTypeLabel();
    patchPickupMode();
    setupStructuredAddress();
    patchAddressHelpers();
    patchValidation();
    patchApplyPayload();
    patchRenderCounts();
    patchRenderer();
    refineInsulationLabels();
    normaliseEmptyDefaultTab();
    observeTabRow();
    scheduleTabArrangement();
  }

  function loadStyles() {
    let link = document.querySelector('link[data-manager-refinement="true"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.dataset.managerRefinement = "true";
      document.head.append(link);
    }
    link.href = "/manager-refinement.css?v=20260727-2";
  }

  function removeUppercaseAddressListener() {
    try {
      if (typeof enforceUppercaseGoogleAddress === "function") {
        window.removeEventListener("DOMContentLoaded", enforceUppercaseGoogleAddress);
      }
    } catch (_error) { }
  }

  function patchGoogleAddressInitialiser() {
    if (window.initialiseGoogleAddress?.__managerAddressPatched) return;
    const patched = async function initialiseManagerGoogleAddress() {
      try {
        const config = await fetchJson("/api/address-config");
        if (!config.configured || !config.apiKey) return;
        await loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.apiKey)}&libraries=places&v=weekly`);
        setupStructuredAddress();
        bindAddressAutocompletes();
      } catch (error) {
        console.warn("Google address suggestions are unavailable.", error);
      }
    };
    patched.__managerAddressPatched = true;
    window.initialiseGoogleAddress = patched;
    try { initialiseGoogleAddress = patched; } catch (_error) { }
  }

  function patchAddressFormatting() {
    const formatter = (input) => titleCaseAddress(String(input || "")
      .replace(/,?\s*Australia\s*$/i, "")
      .replace(/\bVictoria\b/gi, "VIC")
      .replace(/\s+/g, " ")
      .trim());
    window.formatAddressDisplay = formatter;
    try { formatAddressDisplay = formatter; } catch (_error) { }
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
          if (typeof updatePickupMode === "function") updatePickupMode();
          if (typeof updateGeneratedDeliverySummary === "function") updateGeneratedDeliverySummary();
          if (typeof scheduleDraft === "function") scheduleDraft();
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
      document.querySelector('input[name="deliveryType"]:checked')
        ?.dispatchEvent(new Event("change", { bubbles: true }));
      select.classList.toggle("is-placeholder", !select.value);
      if (typeof updatePickupMode === "function") updatePickupMode();
      if (typeof updateGeneratedDeliverySummary === "function") updateGeneratedDeliverySummary();
      if (typeof scheduleDraft === "function") scheduleDraft();
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
    const labels = {
      "Hand Unload": "Hand Unload",
      "Forklift Delivery": "Forklift Delivery",
      "Crane Delivery": "Crane Delivery",
      "Delivery (No Assistance)": "Delivery (No Assistance)",
      [PICKUP_VALUE]: "Customer Pickup",
      "Manual Unload (Knauf Labour)": "Hand Unload",
      "Mechanical (Forklift/Crane/Own)": "Forklift Delivery",
      "Mixed Unload (Hand + Machine)": "Delivery (No Assistance)",
      "Hand unload": "Hand Unload",
      Forklift: "Forklift Delivery",
      Crane: "Crane Delivery",
      "Delivery (No assistance)": "Delivery (No Assistance)",
      Pickup: "Customer Pickup",
    };
    const refined = (value) => labels[value] || "Not selected";
    window.deliveryTypeLabel = refined;
    try { deliveryTypeLabel = refined; } catch (_error) { }
  }

  function capitaliseExtras() {
    const copy = {
      Downstairs: "Downstairs",
      Upstairs: "Upstairs",
      Wrap: "Wrap",
      Strap: "Strap",
      "Extra Labour": "Extra Labour",
    };
    document.querySelectorAll('input[name="deliveryExtra"]').forEach((input) => {
      const span = input.closest("label")?.querySelector("span");
      if (span) span.textContent = copy[input.value] || titleCaseAddress(input.value);
    });
    updateExtrasSummary();
  }

  function updateExtrasSummary() {
    const summary = document.querySelector(".extras-dropdown > summary span");
    if (!summary) return;
    const values = [...document.querySelectorAll('input[name="deliveryExtra"]:checked')]
      .map((input) => input.closest("label")?.querySelector("span")?.textContent?.trim() || input.value);
    summary.textContent = values.length ? values.join(", ") : "Select extras";
    summary.closest("summary")?.classList.toggle("is-placeholder", values.length === 0);
  }

  function patchPickupMode() {
    if (window.updatePickupMode?.__managerAddressPatched) return;
    const refined = function updateManagerPickupMode() {
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
    refined.__managerAddressPatched = true;
    window.updatePickupMode = refined;
    try { updatePickupMode = refined; } catch (_error) { }
  }

  function setupStructuredAddress() {
    const field = document.querySelector(".delivery-address-field");
    const originalInput = document.getElementById("deliveryAddressSearch");
    if (!field || !originalInput) return;
    if (field.dataset.structuredAddress === "true") {
      syncStructuredAddressFromHidden();
      bindAddressAutocompletes();
      return;
    }

    field.dataset.structuredAddress = "true";
    field.classList.add("structured-address-field");
    const heading = field.querySelector(':scope > label[for="deliveryAddressSearch"]') || document.createElement("label");
    heading.textContent = "Address";
    heading.setAttribute("for", "deliveryStreet");
    const hiddenFields = [...field.querySelectorAll('input[type="hidden"]')];

    const suburbControl = document.createElement("div");
    suburbControl.className = "address-control";
    const suburb = originalInput.cloneNode(true);
    suburb.value = originalInput.value;
    suburb.placeholder = "Suburb";
    suburb.autocomplete = "off";
    suburb.removeAttribute("data-suburb-autocomplete");
    suburb.removeAttribute("data-manager-suburb-ready");
    const clear = document.getElementById("clearAddressButton")?.cloneNode(true) || document.createElement("button");
    clear.id = "clearAddressButton";
    clear.className = "clear-input";
    clear.type = "button";
    clear.setAttribute("aria-label", "Clear address");
    clear.textContent = "×";
    clear.addEventListener("click", clearStructuredAddress);
    suburbControl.append(suburb, clear);

    const street = document.createElement("input");
    street.id = "deliveryStreet";
    street.type = "text";
    street.maxLength = 240;
    street.autocomplete = "off";
    street.placeholder = "Street";
    street.setAttribute("aria-label", "Street address");

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
    postcode.tabIndex = -1;
    postcode.placeholder = "Postcode";
    postcode.setAttribute("aria-label", "Postcode");

    const grid = document.createElement("div");
    grid.className = "structured-address-grid";
    grid.append(
      makeAddressCell("street", "Street", street),
      makeAddressCell("suburb", "Suburb", suburbControl),
      makeAddressCell("state", "State", stateInput),
      makeAddressCell("postcode", "Postcode", postcode),
    );
    field.replaceChildren(heading, grid, ...hiddenFields);

    street.addEventListener("input", () => {
      syncStructuredAddress();
      if (typeof scheduleDraft === "function") scheduleDraft();
    });
    suburb.addEventListener("input", () => {
      setValue("deliveryPostcode", "");
      suburb.setCustomValidity("");
      syncStructuredAddress();
      if (typeof scheduleDraft === "function") scheduleDraft();
    });

    syncStructuredAddressFromHidden();
    bindAddressAutocompletes();
    if (typeof updatePickupMode === "function") updatePickupMode();
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

  function bindAddressAutocompletes() {
    if (!window.google?.maps?.places?.Autocomplete) return;
    bindStreetAutocomplete();
    bindSuburbAutocomplete();
  }

  function bindStreetAutocomplete() {
    const input = document.getElementById("deliveryStreet");
    if (!input || input.dataset.googleAutocomplete === "street") return;
    input.dataset.googleAutocomplete = "street";
    const autocomplete = new google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: "au" },
      fields: ["address_components", "formatted_address", "place_id"],
      types: ["address"],
    });
    state.streetAddressAutocomplete = autocomplete;
    autocomplete.addListener("place_changed", async () => {
      const place = autocomplete.getPlace();
      let parsed = parseGoogleComponents(place?.address_components || []);
      if ((!parsed.postcode || !parsed.suburb) && place?.place_id) parsed = await geocodePlace(place.place_id, parsed);
      if (parsed.state && parsed.state !== "VIC") return showAddressError(input, "Choose a Victorian address.");
      input.setCustomValidity("");
      input.value = titleCaseAddress(parsed.line1 || input.value);
      setValue("deliveryAddressSearch", titleCaseAddress(parsed.suburb));
      setValue("deliveryPostcode", parsed.postcode);
      syncStructuredAddress();
      if (typeof scheduleDraft === "function") scheduleDraft();
    });
  }

  function bindSuburbAutocomplete() {
    const input = document.getElementById("deliveryAddressSearch");
    if (!input || input.dataset.googleAutocomplete === "suburb") return;
    input.dataset.googleAutocomplete = "suburb";
    const autocomplete = new google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: "au" },
      fields: ["address_components", "formatted_address", "place_id"],
      types: ["(cities)"],
    });
    state.addressAutocomplete = autocomplete;
    autocomplete.addListener("place_changed", async () => {
      const place = autocomplete.getPlace();
      let parsed = parseGoogleComponents(place?.address_components || []);
      if (!parsed.postcode && place?.place_id) parsed = await geocodePlace(place.place_id, parsed);
      if (parsed.state && parsed.state !== "VIC") return showAddressError(input, "Choose a Victorian suburb.");
      input.setCustomValidity("");
      input.value = titleCaseAddress(parsed.suburb || input.value);
      setValue("deliveryPostcode", parsed.postcode);
      syncStructuredAddress();
      if (typeof scheduleDraft === "function") scheduleDraft();
    });
  }

  async function geocodePlace(placeId, fallback) {
    if (!window.google?.maps?.Geocoder || !placeId) return fallback;
    try {
      const response = await new google.maps.Geocoder().geocode({ placeId });
      return parseGoogleComponents(response.results?.[0]?.address_components || []) || fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function parseGoogleComponents(components) {
    const get = (type, short = false) => {
      const component = components.find((item) => item.types?.includes(type));
      return component ? component[short ? "short_name" : "long_name"] : "";
    };
    const streetNumber = get("street_number");
    const route = get("route");
    const unit = get("subpremise");
    const street = [streetNumber, route].filter(Boolean).join(" ");
    return {
      line1: unit && street ? `${unit}/${street}` : street,
      suburb: get("locality") || get("postal_town") || get("sublocality") || get("administrative_area_level_2"),
      state: String(get("administrative_area_level_1", true) || "").toUpperCase(),
      postcode: get("postal_code"),
    };
  }

  function showAddressError(input, message) {
    input.setCustomValidity(message);
    input.reportValidity();
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
    setValue("deliveryState", "VIC");
    document.getElementById("deliveryAddressSearch")?.setCustomValidity("");
    const clear = document.getElementById("clearAddressButton");
    if (clear) clear.hidden = true;
    if (typeof scheduleDraft === "function") scheduleDraft();
  }

  function patchAddressHelpers() {
    const parse = function parseManagerAddress() { syncStructuredAddress(); };
    window.parseAndStoreManualAddress = parse;
    try { parseAndStoreManualAddress = parse; } catch (_error) { }
    window.clearAddress = clearStructuredAddress;
    try { clearAddress = clearStructuredAddress; } catch (_error) { }
  }

  function patchValidation() {
    const original = window.validateForm;
    if (typeof original !== "function" || original.__managerAddressPatched) return;
    const patched = function validateManagerAddress(...args) {
      syncStructuredAddress();
      const result = original.apply(this, args);
      const pickup = selectedRadio("deliveryType") === PICKUP_VALUE;
      const street = value("deliveryStreet");
      const suburb = value("deliveryAddressSearch");
      const postcode = value("deliveryPostcode");
      if (!pickup && !street) throw fieldError("deliveryStreet", "Enter the street address.");
      if (!suburb) throw fieldError("deliveryAddressSearch", "Choose a Victorian suburb.");
      if (!/^(?:3\d{3}|8\d{3})$/.test(postcode)) {
        throw fieldError("deliveryAddressSearch", "Choose the suburb from the suggestions so its postcode can be confirmed.");
      }
      return result;
    };
    patched.__managerAddressPatched = true;
    window.validateForm = patched;
    try { validateForm = patched; } catch (_error) { }
  }

  function patchApplyPayload() {
    const original = window.applyPayload;
    if (typeof original !== "function" || original.__managerAddressPatched) return;
    const patched = function applyManagerPayload(payload, ...args) {
      const mapped = payload && typeof payload === "object"
        ? { ...payload, deliveryType: normaliseDeliveryValue(payload.deliveryType) }
        : payload;
      const result = original.call(this, mapped, ...args);
      window.setTimeout(() => {
        configureDeliveryTypes();
        setupStructuredAddress();
        syncStructuredAddressFromHidden();
        syncDeliverySelect();
        if (typeof updatePickupMode === "function") updatePickupMode();
        postRenderCleanup();
      }, 0);
      return result;
    };
    patched.__managerAddressPatched = true;
    window.applyPayload = patched;
    try { applyPayload = patched; } catch (_error) { }
  }

  function patchRenderCounts() {
    const original = window.renderCounts;
    if (typeof original !== "function" || original.__managerSummaryPatched) return;
    const patched = function renderManagerCounts(...args) {
      const result = original.apply(this, args);
      window.setTimeout(postRenderCleanup, 0);
      return result;
    };
    patched.__managerSummaryPatched = true;
    window.renderCounts = patched;
    try { renderCounts = patched; } catch (_error) { }
  }

  function patchRenderer() {
    const original = window.renderUnifiedFloorSheet;
    if (typeof original !== "function" || original.__managerRefinementPatched) return;
    const patched = function renderManagerSheet(...args) {
      const result = original.apply(this, args);
      window.setTimeout(postRenderCleanup, 0);
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

  function normaliseEmptyDefaultTab() {
    if (typeof state === "undefined" || !Array.isArray(state.deliveryAreas) || state.deliveryAreas.length !== 1) return;
    const area = state.deliveryAreas[0];
    const lines = typeof getFloorLines === "function" ? getFloorLines(area.id) : [];
    if (lines.length) return;
    if (!/^(?:Area 1|Ground Floor|1st Floor)$/i.test(area.label || "")) return;
    area.label = "Tab 1";
    if (typeof floorLabels !== "undefined") floorLabels[area.id] = "Tab 1";
    const label = document.querySelector(`[data-floor-tab="${CSS.escape(area.id)}"] .area-tab-label`);
    if (label) label.textContent = "Tab 1";
  }

  function interceptAddTab(event) {
    const button = event.target.closest("[data-add-area]");
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void addStandardTab();
  }

  async function addStandardTab() {
    if (typeof state === "undefined" || !Array.isArray(state.deliveryAreas) || state.deliveryAreas.length >= 20) return;
    const used = new Set(state.deliveryAreas.map((area) => String(area.label || "").toLowerCase()));
    let number = 1;
    while (used.has(`tab ${number}`)) number += 1;
    if (number === 1 && state.deliveryAreas.length) number = state.deliveryAreas.length + 1;
    while (used.has(`tab ${number}`)) number += 1;
    let id = `tab-${number}`;
    let suffix = 2;
    while (state.deliveryAreas.some((area) => area.id === id)) id = `tab-${number}-${suffix++}`;
    const label = `Tab ${number}`;
    state.deliveryAreas.push({ id, label });
    state.quantities[id] = new Map();
    state.otherMaterials[id] = [];
    floorLabels[id] = label;
    state.activeFloor = id;
    await rerenderAreas();
  }

  async function resetAllTabs() {
    if (typeof state === "undefined") return;
    const hasProducts = Array.isArray(state.deliveryAreas)
      && state.deliveryAreas.some((area) => (typeof getFloorLines === "function" ? getFloorLines(area.id).length : 0) > 0);
    if (hasProducts && !window.confirm("Reset all tabs to one blank Tab 1? All product quantities will be cleared.")) return;
    const id = "tab-1";
    state.deliveryAreas = [{ id, label: "Tab 1" }];
    state.activeFloor = id;
    state.quantities = { [id]: new Map() };
    state.otherMaterials = { [id]: [] };
    if (typeof floorLabels !== "undefined") {
      Object.keys(floorLabels).forEach((key) => delete floorLabels[key]);
      floorLabels[id] = "Tab 1";
    }
    await rerenderAreas();
  }

  async function rerenderAreas() {
    if (typeof loadCatalog === "function") await loadCatalog();
    if (typeof renderCounts === "function") renderCounts();
    if (typeof scheduleDraft === "function") scheduleDraft();
    window.setTimeout(postRenderCleanup, 0);
  }

  function observeTabRow() {
    const tabs = document.getElementById("deliveryAreaTabs") || document.querySelector(".floor-tabs");
    if (!tabs || tabs.dataset.managerObserved === "true") return;
    tabs.dataset.managerObserved = "true";
    tabObserver?.disconnect();
    tabObserver = new MutationObserver(scheduleTabArrangement);
    tabObserver.observe(tabs, { childList: true });
  }

  function scheduleTabArrangement() {
    window.clearTimeout(tabArrangeTimer);
    tabArrangeTimer = window.setTimeout(arrangeTabControls, 0);
  }

  function arrangeTabControls() {
    const tabs = document.getElementById("deliveryAreaTabs") || document.querySelector(".floor-tabs");
    if (!tabs) return;
    tabs.querySelectorAll(".area-tab-reset").forEach((node) => node.remove());
    let reset = tabs.querySelector(".area-tabs-reset");
    if (!reset) {
      reset = document.createElement("button");
      reset.type = "button";
      reset.className = "area-tabs-reset";
      reset.textContent = "Reset tabs";
      reset.title = "Clear all product tabs and return to Tab 1";
      reset.addEventListener("click", () => void resetAllTabs());
    }
    let summary = tabs.querySelector(".area-tab-summary");
    if (!summary) {
      summary = document.createElement("div");
      summary.className = "area-tab-summary";
      summary.innerHTML = '<span class="area-summary-metric" data-tab-products>Products 0</span><span class="area-summary-separator">·</span><span class="area-summary-metric" data-tab-units>Qty 0</span>';
    }
    const shells = [...tabs.querySelectorAll(":scope > .area-tab-shell")];
    const add = tabs.querySelector(":scope > [data-add-area]");
    const editor = tabs.querySelector(":scope > .area-name-editor");
    shells.forEach((shell) => tabs.append(shell));
    if (add) tabs.append(add);
    tabs.append(reset, summary);
    if (editor) tabs.append(editor);
    updateTabSummary();
  }

  function updateTabSummary() {
    const summary = document.querySelector(".area-tab-summary");
    if (!summary || typeof state === "undefined") return;
    const lines = typeof getFloorLines === "function" ? getFloorLines(state.activeFloor) : [];
    const productCount = lines.length;
    const unitCount = lines.reduce((total, line) => total + Number(line.quantity || 0), 0);
    const products = summary.querySelector("[data-tab-products]");
    const units = summary.querySelector("[data-tab-units]");
    if (products) products.textContent = `Products ${productCount}`;
    if (units) units.textContent = `Qty ${unitCount}`;
  }

  function postRenderCleanup() {
    refineInsulationLabels();
    capitaliseExtras();
    normaliseEmptyDefaultTab();
    arrangeTabControls();
    updateTabSummary();
  }
})();
