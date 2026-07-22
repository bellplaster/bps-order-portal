function renderFloorSheet(floor) {
  const root = document.getElementById(`${floor}OrderSheet`);
  root.replaceChildren();

  const boardLayout = document.createElement("div");
  boardLayout.className = "board-layout-grid";
  boardLayout.append(
    renderMainBoardMatrix(floor, state.layout.mainBoard),
    renderSpecialtyBoards(floor, state.layout.specialtyBoards),
  );
  root.append(boardLayout);

  const lower = document.createElement("div");
  lower.className = "pdf-lower-grid";
  for (const columnIds of state.layout.lowerColumns || []) {
    const column = document.createElement("div");
    column.className = "pdf-lower-column";
    for (const id of columnIds) {
      if (["usg_tiles", "other_materials"].includes(id)) continue;
      const definition = state.layout.sections?.[id];
      if (definition) column.append(renderSection(floor, definition));
    }
    if (column.childElementCount) lower.append(column);
  }
  root.append(lower, renderOtherMaterialsSection(floor));
}

function renderMainBoardMatrix(floor, definition) {
  const section = document.createElement("section");
  section.className = "pdf-product-section pdf-board-section";

  const title = document.createElement("h3");
  title.className = "pdf-section-title";
  title.textContent = definition.title || "BOARD";
  section.append(title);

  const wrap = document.createElement("div");
  wrap.className = "board-table-wrap";
  const table = document.createElement("table");
  table.className = "pdf-table main-board-table";

  const thead = document.createElement("thead");
  const productRow = document.createElement("tr");
  const productCorner = document.createElement("th");
  productCorner.className = "board-corner-heading";
  productCorner.setAttribute("aria-hidden", "true");
  productRow.append(productCorner);

  const mergedGroups = [];
  (definition.groups || []).forEach((group) => {
    const previous = mergedGroups.at(-1);
    if (previous && previous.group === group.group) previous.span += Number(group.span || 0);
    else mergedGroups.push({ group: group.group, span: Number(group.span || 0) });
  });
  mergedGroups.forEach((group) => {
    const th = document.createElement("th");
    th.colSpan = group.span;
    th.className = "board-product-heading";
    th.textContent = displayBoardGroupName(group.group);
    productRow.append(th);
  });

  const thicknessRow = document.createElement("tr");
  const lengthHeading = document.createElement("th");
  lengthHeading.className = "board-length-heading";
  lengthHeading.textContent = "Length";
  thicknessRow.append(lengthHeading);
  (definition.groups || []).forEach((group) => {
    const th = document.createElement("th");
    th.colSpan = group.span;
    th.className = "board-thickness-heading";
    th.textContent = group.subgroup;
    thicknessRow.append(th);
  });

  const widthRow = document.createElement("tr");
  const unitHeading = document.createElement("th");
  unitHeading.className = "board-unit-heading";
  unitHeading.textContent = "mm";
  widthRow.append(unitHeading);
  (definition.columns || []).forEach((column) => {
    const th = document.createElement("th");
    th.className = "board-width-heading";
    th.textContent = column.variant;
    widthRow.append(th);
  });

  thead.append(productRow, thicknessRow, widthRow);
  const tbody = document.createElement("tbody");
  (definition.rows || []).forEach((row) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.className = "board-row-heading";
    th.textContent = row.length;
    tr.append(th);
    (row.cells || []).forEach((key) => tr.append(createQuantityCell(floor, key)));
    tbody.append(tr);
  });

  table.append(thead, tbody);
  wrap.append(table);
  section.append(wrap);
  return section;
}

function displayBoardGroupName(value) {
  const names = {
    "SHEETROCK ONE": "SHEETROCK® ONE",
    "SHEETROCK PLUS": "SHEETROCK® PLUS",
    WETSTOP: "WETSTOP®",
    FIRESTOP: "FIRESTOP®",
  };
  return names[value] || value;
}

function renderSpecialtyBoards(floor, groups) {
  const aside = document.createElement("aside");
  aside.className = "specialty-stack";
  (groups || []).forEach((group) => {
    const card = document.createElement("section");
    card.className = "specialty-card";
    const title = document.createElement("h3");
    title.className = "pdf-section-title";
    title.textContent = group.title;
    card.append(title);
    (group.rows || []).forEach((row) => {
      const line = document.createElement("div");
      line.className = "pdf-list-row specialty-row";
      const label = document.createElement("span");
      label.textContent = combinedLabel(row.label, row.detail);
      line.append(label, createQuantityInput(floor, row.key));
      card.append(line);
    });
    aside.append(card);
  });
  return aside;
}

function renderOtherMaterialsSection(floor) {
  const section = document.createElement("section");
  section.className = "additional-products-panel";

  const header = document.createElement("div");
  header.className = "additional-products-heading";
  const heading = document.createElement("h3");
  heading.textContent = "Additional products";
  header.append(heading);

  const search = document.createElement("div");
  search.className = "additional-search";
  search.innerHTML = `
    <label for="${floor}AdditionalSearch">Search products</label>
    <input id="${floor}AdditionalSearch" type="search" autocomplete="off" placeholder="Stock code, product name or size">
    <div class="additional-results" data-additional-results="${floor}" hidden></div>
  `;

  const selected = document.createElement("div");
  selected.className = "selected-additional";
  selected.dataset.selectedAdditional = floor;

  section.append(header, search, selected);
  search.querySelector("input").addEventListener("input", (event) => searchAdditionalProducts(floor, event.target.value));
  renderSelectedAdditional(floor, selected);
  return section;
}

function createQuantityInput(floor, key) {
  const product = state.catalog[key];
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.pattern = "[0-9]*";
  input.maxLength = 3;
  input.className = "quantity-input";
  input.dataset.floor = floor;
  input.dataset.productKey = key;
  input.value = String(state.quantities[floor].get(key) || "");
  input.placeholder = "0";
  updateQuantityState(input);
  input.setAttribute("aria-label", `${product?.label || key} quantity for ${floorLabels[floor]}`);
  input.addEventListener("focus", () => input.select());
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 3);
    const quantity = Math.min(999, Number(input.value || 0));
    if (quantity > 0) state.quantities[floor].set(key, quantity);
    else state.quantities[floor].delete(key);
    updateQuantityState(input);
    renderCounts();
    scheduleDraft();
  });
  return input;
}

function updateQuantityState(input) {
  input.classList.toggle("has-value", Number(input.value || 0) > 0);
}

function syncQuantityInputs(floor) {
  document.querySelectorAll(`#${floor}OrderSheet .quantity-input[data-product-key]`).forEach((input) => {
    input.value = state.quantities[floor].get(input.dataset.productKey) || "";
    updateQuantityState(input);
  });
}

async function initialiseGoogleAddress() {
  const input = document.getElementById("deliveryAddressSearch");
  const results = document.getElementById("addressSearchResults");
  bindRefinedAddressSearch(input, results);

  try {
    const config = await fetchJson("/api/address-config");
    if (!config.configured || !config.apiKey) return;

    window.gm_authFailure = () => {
      state.addressAutocompleteReady = false;
      showRefinedAddressStatus("Google address search is unavailable. Check the API key website restrictions and billing.");
    };

    await loadRefinedGoogleMaps(config.apiKey);
    const { AutocompleteSessionToken, AutocompleteSuggestion } = await google.maps.importLibrary("places");
    state.addressAutocompleteApi = { AutocompleteSessionToken, AutocompleteSuggestion };
    state.addressAutocompleteReady = true;
    refreshRefinedAddressSession();
  } catch (error) {
    state.addressAutocompleteReady = false;
    console.warn("Google address suggestions are unavailable.", error);
    showRefinedAddressStatus("Address suggestions are unavailable. You can still enter the complete address manually.");
  }
}

function loadRefinedGoogleMaps(apiKey) {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (loadRefinedGoogleMaps.promise) return loadRefinedGoogleMaps.promise;
  loadRefinedGoogleMaps.promise = new Promise((resolve, reject) => {
    const callback = "__bpsPlacesReady";
    window[callback] = () => {
      delete window[callback];
      resolve();
    };
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&libraries=places&region=AU&language=en&auth_referrer_policy=origin&callback=${callback}`;
    script.onerror = () => {
      delete window[callback];
      reject(new Error("Google Places could not be loaded."));
    };
    document.head.append(script);
  });
  return loadRefinedGoogleMaps.promise;
}

function bindRefinedAddressSearch(input, results) {
  input.addEventListener("input", () => {
    setValue("deliveryAddress", input.value.trim());
    setValue("deliveryAddressLine1", "");
    setValue("deliveryAddressLine2", "");
    document.getElementById("clearAddressButton").hidden = !input.value;
    queueRefinedAddressSuggestions(input.value);
    scheduleDraft();
  });
  input.addEventListener("blur", () => {
    parseAndStoreManualAddress();
    window.setTimeout(closeRefinedAddressSuggestions, 160);
  });
  input.addEventListener("keydown", (event) => {
    if (!state.addressPredictions.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next = state.addressPredictionIndex < 0 ? 0 : state.addressPredictionIndex + direction;
      state.addressPredictionIndex = Math.max(0, Math.min(state.addressPredictions.length - 1, next));
      updateRefinedAddressActive();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const prediction = state.addressPredictions[state.addressPredictionIndex < 0 ? 0 : state.addressPredictionIndex];
      if (prediction) void selectRefinedAddress(prediction);
    } else if (event.key === "Escape") {
      closeRefinedAddressSuggestions();
    }
  });
  results.addEventListener("mousedown", (event) => event.preventDefault());
  document.getElementById("clearAddressButton").addEventListener("click", closeRefinedAddressSuggestions);
}

function queueRefinedAddressSuggestions(value) {
  window.clearTimeout(state.addressSearchTimer);
  const query = String(value || "").trim();
  if (!state.addressAutocompleteReady || query.length < 3) {
    closeRefinedAddressSuggestions();
    return;
  }
  state.addressSearchTimer = window.setTimeout(() => requestRefinedAddressSuggestions(query), 180);
}

async function requestRefinedAddressSuggestions(input) {
  const requestId = ++state.addressRequestId;
  try {
    if (!state.addressSessionToken) refreshRefinedAddressSession();
    const { suggestions } = await state.addressAutocompleteApi.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input,
      sessionToken: state.addressSessionToken,
      includedRegionCodes: ["au"],
      locationRestriction: { west: 140.9, south: -39.25, east: 150.1, north: -33.8 },
      language: "en-AU",
      region: "au",
    });
    if (requestId !== state.addressRequestId) return;
    state.addressPredictions = (suggestions || []).map((suggestion) => suggestion.placePrediction).filter(Boolean).slice(0, 6);
    state.addressPredictionIndex = state.addressPredictions.length ? 0 : -1;
    renderRefinedAddressSuggestions();
  } catch (error) {
    console.warn("Google address suggestions failed.", error);
    closeRefinedAddressSuggestions();
    showRefinedAddressStatus("Address suggestions are temporarily unavailable. Enter the complete address manually.");
  }
}

function renderRefinedAddressSuggestions() {
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
      line.textContent = formatAddressDisplay(refinedPredictionText(prediction));
      button.append(line);
      button.addEventListener("click", () => void selectRefinedAddress(prediction));
      results.append(button);
    });
  }
  const attribution = document.createElement("div");
  attribution.className = "google-maps-attribution";
  attribution.textContent = "Google";
  results.append(attribution);
  results.hidden = false;
  document.getElementById("deliveryAddressSearch").setAttribute("aria-expanded", "true");
}

function refinedPredictionText(prediction) {
  return prediction?.text?.text || prediction?.text?.toString?.() || String(prediction?.text || "");
}

async function selectRefinedAddress(prediction) {
  try {
    const place = prediction.toPlace();
    await place.fetchFields({ fields: ["formattedAddress", "addressComponents"] });
    const parsed = parseRefinedGoogleAddress(place);
    const display = formatAddressDisplay(parsed.full);
    setValue("deliveryAddressSearch", display);
    setValue("deliveryAddress", display);
    setValue("deliveryAddressLine1", parsed.line1.toUpperCase());
    setValue("deliveryAddressLine2", parsed.line2.toUpperCase());
    document.getElementById("clearAddressButton").hidden = false;
    closeRefinedAddressSuggestions();
    refreshRefinedAddressSession();
    scheduleDraft();
  } catch (error) {
    console.warn("Google address selection failed.", error);
  }
}

function parseRefinedGoogleAddress(place) {
  const components = Array.isArray(place.addressComponents) ? place.addressComponents : [];
  const component = (...types) => {
    const match = components.find((entry) => types.some((type) => entry.types?.includes(type)));
    return String(match?.longText || match?.shortText || "").trim();
  };
  const unit = component("subpremise");
  const streetNumber = component("street_number");
  const route = component("route");
  const suburb = component("locality", "postal_town", "sublocality_level_1", "sublocality");
  const stateCode = component("administrative_area_level_1").replace(/\bVictoria\b/i, "VIC").toUpperCase();
  const postcode = component("postal_code");
  const street = [streetNumber, route].filter(Boolean).join(" ");
  const line1 = unit && street ? `${unit}/${street}` : street;
  const line2 = [suburb, stateCode, postcode].filter(Boolean).join(" ");
  const fallback = String(place.formattedAddress || "").replace(/,?\s*Australia$/i, "").trim();
  return {
    full: [line1, line2].filter(Boolean).join(", ") || fallback,
    line1: line1 || fallback.split(",")[0]?.trim() || fallback,
    line2,
  };
}

function formatAddressDisplay(value) {
  return String(value || "")
    .replace(/,?\s*Australia\s*$/i, "")
    .replace(/\bVictoria\b/gi, "VIC")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function updateRefinedAddressActive() {
  document.querySelectorAll(".address-result").forEach((button, index) => {
    const active = index === state.addressPredictionIndex;
    button.classList.toggle("is-active", active);
    if (active) button.scrollIntoView({ block: "nearest" });
  });
}

function closeRefinedAddressSuggestions() {
  const results = document.getElementById("addressSearchResults");
  if (!results) return;
  results.hidden = true;
  results.replaceChildren();
  state.addressPredictions = [];
  state.addressPredictionIndex = -1;
  document.getElementById("deliveryAddressSearch")?.setAttribute("aria-expanded", "false");
}

function showRefinedAddressStatus(message) {
  const results = document.getElementById("addressSearchResults");
  if (!results || !document.getElementById("deliveryAddressSearch")?.value) return;
  results.innerHTML = `<div class="address-no-results">${escapeHtml(message)}</div>`;
  results.hidden = false;
}

function refreshRefinedAddressSession() {
  const Token = state.addressAutocompleteApi?.AutocompleteSessionToken;
  state.addressSessionToken = Token ? new Token() : null;
}
