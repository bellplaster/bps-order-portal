(() => {
  const originalGoogleInitialiser = window.initialiseGoogleAddress;
  if (typeof originalGoogleInitialiser === "function") {
    document.removeEventListener("DOMContentLoaded", originalGoogleInitialiser);
  }

  const serverAddressInitialiser = async function initialiseServerAddressSearch() {
    bindAddressFields();
  };
  serverAddressInitialiser.__managerAddressPatched = true;
  window.initialiseGoogleAddress = serverAddressInitialiser;
  try { initialiseGoogleAddress = serverAddressInitialiser; } catch (_error) { }
  window.gm_authFailure = () => { };

  loadStyles();
  let attempts = 0;
  initialise();
  document.addEventListener("DOMContentLoaded", initialise, { once: true });
  const retryTimer = window.setInterval(() => {
    attempts += 1;
    initialise();
    if (attempts >= 100 || (document.getElementById("deliveryStreet")?.dataset.serverAddressSearch === "true"
      && document.getElementById("deliveryAddressSearch")?.dataset.serverAddressSearch === "true")) {
      window.clearInterval(retryTimer);
    }
  }, 100);

  document.addEventListener("click", interceptResetTabs, true);
  document.addEventListener("mousedown", (event) => {
    if (!event.target.closest(".structured-address-cell")) closeAllAddressResults();
  });

  function loadStyles() {
    if (document.querySelector('link[data-manager-hotfix="true"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/manager-hotfix.css?v=20260727-1";
    link.dataset.managerHotfix = "true";
    document.head.append(link);
  }

  function initialise() {
    bindAddressFields();
    alignTabControls();
  }

  function bindAddressFields() {
    bindAddressInput("deliveryStreet", "street");
    bindAddressInput("deliveryAddressSearch", "suburb");
  }

  function bindAddressInput(id, mode) {
    const input = document.getElementById(id);
    if (!input || input.dataset.serverAddressSearch === "true") return;
    const cell = input.closest(".structured-address-cell");
    if (!cell) return;

    input.dataset.serverAddressSearch = "true";
    input.autocomplete = "off";
    input.removeAttribute("data-google-autocomplete");

    const panel = document.createElement("div");
    panel.className = "manager-address-results";
    panel.hidden = true;
    panel.setAttribute("role", "listbox");
    cell.append(panel);

    input.addEventListener("input", () => {
      window.clearTimeout(input.__managerSearchTimer);
      input.__managerSearchAbort?.abort?.();
      const query = input.value.trim();
      if (query.length < 2) {
        closeAddressResults(input);
        return;
      }
      input.__managerSearchTimer = window.setTimeout(() => void requestSuggestions(input, mode, query), 180);
    });

    input.addEventListener("keydown", (event) => {
      const suggestions = input.__managerSuggestions || [];
      if (!suggestions.length || panel.hidden) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const current = Number.isInteger(input.__managerActiveIndex) ? input.__managerActiveIndex : -1;
        input.__managerActiveIndex = Math.max(0, Math.min(suggestions.length - 1, current + direction));
        updateActiveResult(input);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const index = input.__managerActiveIndex >= 0 ? input.__managerActiveIndex : 0;
        const suggestion = suggestions[index];
        if (suggestion) void selectSuggestion(input, mode, suggestion);
      } else if (event.key === "Escape") {
        closeAddressResults(input);
      }
    });

    input.addEventListener("blur", () => {
      window.setTimeout(() => closeAddressResults(input), 140);
    });
    panel.addEventListener("mousedown", (event) => event.preventDefault());
  }

  async function requestSuggestions(input, mode, query) {
    const controller = new AbortController();
    input.__managerSearchAbort = controller;
    try {
      const response = await fetch(`/api/address-search?q=${encodeURIComponent(query)}&mode=${encodeURIComponent(mode)}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        closeAddressResults(input);
        return;
      }
      input.__managerSuggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
      input.__managerActiveIndex = input.__managerSuggestions.length ? 0 : -1;
      renderSuggestions(input, mode);
    } catch (error) {
      if (error?.name !== "AbortError") console.warn("Address suggestions are unavailable.", error);
      closeAddressResults(input);
    }
  }

  function renderSuggestions(input, mode) {
    const cell = input.closest(".structured-address-cell");
    const panel = cell?.querySelector(".manager-address-results");
    if (!cell || !panel) return;
    panel.replaceChildren();
    const suggestions = input.__managerSuggestions || [];
    if (!suggestions.length) {
      closeAddressResults(input);
      return;
    }

    suggestions.forEach((suggestion, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "manager-address-result";
      button.classList.toggle("is-active", index === input.__managerActiveIndex);
      button.setAttribute("role", "option");
      button.innerHTML = `<strong>${escapeHtml(suggestion.mainText || suggestion.text || "")}</strong>${suggestion.secondaryText ? `<span>${escapeHtml(suggestion.secondaryText)}</span>` : ""}`;
      button.addEventListener("click", () => void selectSuggestion(input, mode, suggestion));
      panel.append(button);
    });
    panel.hidden = false;
    cell.classList.add("has-manager-results");
    input.setAttribute("aria-expanded", "true");
  }

  function updateActiveResult(input) {
    const panel = input.closest(".structured-address-cell")?.querySelector(".manager-address-results");
    if (!panel) return;
    [...panel.querySelectorAll(".manager-address-result")].forEach((button, index) => {
      button.classList.toggle("is-active", index === input.__managerActiveIndex);
      if (index === input.__managerActiveIndex) button.scrollIntoView({ block: "nearest" });
    });
  }

  async function selectSuggestion(input, mode, suggestion) {
    if (!suggestion?.placeId) return;
    try {
      const response = await fetch(`/api/address-search?placeId=${encodeURIComponent(suggestion.placeId)}`, {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.place) return;
      const place = payload.place;
      const street = document.getElementById("deliveryStreet");
      const suburb = document.getElementById("deliveryAddressSearch");
      const postcode = document.getElementById("deliveryPostcode");
      const stateInput = document.getElementById("deliveryState");

      if (mode === "street" && street) street.value = place.street || input.value;
      if (suburb && place.suburb) suburb.value = place.suburb;
      if (postcode) postcode.value = place.postcode || "";
      if (stateInput) stateInput.value = "VIC";
      document.getElementById("clearAddressButton")?.removeAttribute("hidden");

      if (typeof parseAndStoreManualAddress === "function") parseAndStoreManualAddress();
      if (typeof scheduleDraft === "function") scheduleDraft();
      closeAllAddressResults();
      (mode === "street" ? street : suburb)?.focus();
    } catch (error) {
      console.warn("The selected address could not be confirmed.", error);
    }
  }

  function closeAddressResults(input) {
    const cell = input?.closest?.(".structured-address-cell");
    const panel = cell?.querySelector(".manager-address-results");
    if (panel) panel.hidden = true;
    cell?.classList.remove("has-manager-results");
    input?.setAttribute?.("aria-expanded", "false");
  }

  function closeAllAddressResults() {
    document.querySelectorAll(".manager-address-results").forEach((panel) => {
      panel.hidden = true;
      panel.closest(".structured-address-cell")?.classList.remove("has-manager-results");
    });
    document.querySelectorAll('[data-server-address-search="true"]').forEach((input) => input.setAttribute("aria-expanded", "false"));
  }

  async function interceptResetTabs(event) {
    const button = event.target.closest(".area-tabs-reset");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const confirmed = window.confirm("Reset all tabs? This will remove every product quantity and return to one blank Tab 1.");
    if (!confirmed) return;
    await resetTabs();
  }

  async function resetTabs() {
    if (typeof state === "undefined") return;
    const id = "tab-1";
    state.deliveryAreas = [{ id, label: "Tab 1" }];
    state.activeFloor = id;
    state.quantities = { [id]: new Map() };
    state.otherMaterials = { [id]: [] };
    if (typeof floorLabels !== "undefined") {
      Object.keys(floorLabels).forEach((key) => delete floorLabels[key]);
      floorLabels[id] = "Tab 1";
    }
    if (typeof loadCatalog === "function") await loadCatalog();
    if (typeof renderCounts === "function") renderCounts();
    if (typeof scheduleDraft === "function") scheduleDraft();
    window.setTimeout(alignTabControls, 0);
  }

  function alignTabControls() {
    const tabs = document.getElementById("deliveryAreaTabs") || document.querySelector(".floor-tabs");
    if (!tabs) return;
    const summary = tabs.querySelector(".area-tab-summary");
    if (summary) tabs.append(summary);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }
})();
