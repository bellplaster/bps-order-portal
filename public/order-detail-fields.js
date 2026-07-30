(() => {
  const TITLE_CASE_IDS = new Set([
    "contactName",
    "defaultContactName",
    "deliveryStreet",
    "deliveryAddressSearch",
    "defaultStreet",
    "defaultSuburb",
  ]);
  const SENTENCE_CASE_IDS = new Set([
    "deliveryInstructions",
    "defaultInstructions",
  ]);
  const ADDRESS_GROUPS = [
    {
      name: "order",
      streetId: "deliveryStreet",
      suburbId: "deliveryAddressSearch",
      postcodeId: "deliveryPostcode",
      stateId: "deliveryState",
    },
    {
      name: "account",
      streetId: "defaultStreet",
      suburbId: "defaultSuburb",
      postcodeId: "defaultPostcode",
      stateId: null,
    },
  ];
  const formattedFields = new WeakSet();
  const addressFields = new WeakSet();

  let scanTimer = 0;
  let scanAttempts = 0;

  function titleCaseWords(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/(^|[\s\-/,'’])([a-z])/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
      .replace(/\bPo\s+Box\b/g, "PO Box")
      .replace(/\bVic\b/g, "VIC")
      .replace(/\bNsw\b/g, "NSW")
      .replace(/\bQld\b/g, "QLD")
      .replace(/\bSa\b/g, "SA")
      .replace(/\bWa\b/g, "WA")
      .replace(/\bAct\b/g, "ACT")
      .replace(/\bNt\b/g, "NT");
  }

  function sentenceCase(value) {
    const text = String(value || "");
    const index = text.search(/[a-z]/i);
    if (index < 0) return text;
    return `${text.slice(0, index)}${text[index].toUpperCase()}${text.slice(index + 1)}`;
  }

  function replaceFieldValue(field, formatter) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return false;
    const previous = field.value;
    const next = formatter(previous);
    if (next === previous) return false;

    const start = field.selectionStart;
    const end = field.selectionEnd;
    field.value = next;
    if (document.activeElement === field && start != null && end != null) {
      try { field.setSelectionRange(start, end); } catch (_error) { }
    }
    return true;
  }

  function formatField(field) {
    if (!(field instanceof HTMLElement)) return false;
    if (TITLE_CASE_IDS.has(field.id)) return replaceFieldValue(field, titleCaseWords);
    if (SENTENCE_CASE_IDS.has(field.id)) return replaceFieldValue(field, sentenceCase);
    return false;
  }

  function emitFieldEvents(field) {
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function bindFormatting(field) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
    if (formattedFields.has(field)) return;
    formattedFields.add(field);
    field.dataset.orderDetailFormatting = "true";

    const apply = (event) => {
      if (event?.isComposing) return;
      formatField(field);
    };
    field.addEventListener("input", apply);
    field.addEventListener("change", apply);
    field.addEventListener("blur", apply);
    formatField(field);
  }

  function formatAllFields() {
    [...TITLE_CASE_IDS, ...SENTENCE_CASE_IDS].forEach((id) => {
      const field = document.getElementById(id);
      if (field) formatField(field);
    });
    try {
      if (document.body.classList.contains("order-form-page") && typeof parseAndStoreManualAddress === "function") {
        parseAndStoreManualAddress();
      }
    } catch (_error) { }
  }

  function addressHost(input) {
    return input.closest(".structured-address-cell, .account-field, .address-control") || input.parentElement;
  }

  function bindAddressInput(input, mode, group) {
    if (!(input instanceof HTMLInputElement)) return;
    if (addressFields.has(input)) return;
    addressFields.add(input);

    const host = addressHost(input);
    if (!host) return;

    input.dataset.serverAddressSearch = "true";
    input.dataset.placesBound = "true";
    input.autocomplete = "off";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    host.classList.add("order-detail-autocomplete-host");

    host.querySelector(`:scope > .order-detail-suggestions[data-owner="${input.id}"]`)?.remove();
    const panel = document.createElement("div");
    panel.className = "order-detail-suggestions";
    panel.dataset.owner = input.id;
    panel.hidden = true;
    panel.setAttribute("role", "listbox");
    panel.id = `${input.id}Suggestions`;
    input.setAttribute("aria-controls", panel.id);
    host.append(panel);

    let searchTimer = 0;
    let controller = null;
    let suggestions = [];
    let activeIndex = -1;
    let selecting = false;

    const close = () => {
      panel.hidden = true;
      panel.replaceChildren();
      suggestions = [];
      activeIndex = -1;
      input.setAttribute("aria-expanded", "false");
      host.classList.remove("has-order-detail-suggestions");
    };

    const updateActive = () => {
      [...panel.querySelectorAll("button")].forEach((button, index) => {
        const active = index === activeIndex;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
        if (active) button.scrollIntoView({ block: "nearest" });
      });
    };

    const choose = async (suggestion) => {
      if (!suggestion?.placeId || selecting) return;
      selecting = true;
      controller?.abort();
      try {
        const response = await fetch(`/api/address-search?placeId=${encodeURIComponent(suggestion.placeId)}`, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.ok === false || !payload.place) {
          throw new Error(payload.error || "The selected address could not be confirmed.");
        }

        const place = payload.place;
        const street = document.getElementById(group.streetId);
        const suburb = document.getElementById(group.suburbId);
        const postcode = document.getElementById(group.postcodeId);
        const state = group.stateId ? document.getElementById(group.stateId) : null;

        if (mode === "street" && street && place.street) street.value = titleCaseWords(place.street);
        if (suburb && place.suburb) suburb.value = titleCaseWords(place.suburb);
        if (postcode) postcode.value = String(place.postcode || "").replace(/\D/g, "").slice(0, 4);
        if (state) state.value = "VIC";

        [street, suburb, postcode].filter(Boolean).forEach((field) => {
          formatField(field);
          field.dataset.addressSelectionInProgress = "true";
          emitFieldEvents(field);
          delete field.dataset.addressSelectionInProgress;
        });

        if (group.name === "order") {
          try { if (typeof parseAndStoreManualAddress === "function") parseAndStoreManualAddress(); } catch (_error) { }
          try { if (typeof scheduleDraft === "function") scheduleDraft(); } catch (_error) { }
          const clear = document.getElementById("clearAddressButton");
          if (clear) clear.hidden = false;
        }
        close();
        (mode === "street" ? street : suburb)?.focus();
      } catch (error) {
        console.warn("Address selection failed:", error);
      } finally {
        selecting = false;
      }
    };

    const render = () => {
      panel.replaceChildren();
      if (!suggestions.length) {
        close();
        return;
      }
      suggestions.forEach((suggestion, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "order-detail-suggestion";
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", String(index === activeIndex));
        const main = document.createElement("strong");
        main.textContent = suggestion.mainText || suggestion.text || "";
        button.append(main);
        if (suggestion.secondaryText) {
          const secondary = document.createElement("span");
          secondary.textContent = suggestion.secondaryText;
          button.append(secondary);
        }
        button.addEventListener("mousedown", (event) => event.preventDefault());
        button.addEventListener("click", () => void choose(suggestion));
        panel.append(button);
      });
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
      host.classList.add("has-order-detail-suggestions");
      updateActive();
    };

    const search = async () => {
      const query = input.value.trim();
      if (query.length < 2 || selecting) {
        close();
        return;
      }
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(`/api/address-search?q=${encodeURIComponent(query)}&mode=${mode}`, {
          credentials: "same-origin",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.ok === false) {
          close();
          return;
        }
        suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
        activeIndex = suggestions.length ? 0 : -1;
        render();
      } catch (error) {
        if (error?.name !== "AbortError") console.warn("Address suggestions are unavailable:", error);
        close();
      }
    };

    input.addEventListener("input", () => {
      if (input.dataset.addressSelectionInProgress === "true") return;
      window.clearTimeout(searchTimer);
      controller?.abort();
      if (input.value.trim().length < 2) {
        close();
        return;
      }
      searchTimer = window.setTimeout(() => void search(), 180);
    });

    input.addEventListener("keydown", (event) => {
      if (panel.hidden || !suggestions.length) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const change = event.key === "ArrowDown" ? 1 : -1;
        activeIndex = Math.max(0, Math.min(suggestions.length - 1, activeIndex + change));
        updateActive();
      } else if (event.key === "Enter") {
        event.preventDefault();
        void choose(suggestions[Math.max(0, activeIndex)]);
      } else if (event.key === "Escape") {
        close();
      }
    });

    input.addEventListener("blur", () => window.setTimeout(close, 150));
    input.__closeOrderDetailSuggestions = close;
  }

  function bindAddressGroup(group) {
    const street = document.getElementById(group.streetId);
    const suburb = document.getElementById(group.suburbId);
    const postcode = document.getElementById(group.postcodeId);
    if (!street || !suburb || !postcode) return false;

    bindAddressInput(street, "street", group);
    bindAddressInput(suburb, "suburb", group);
    return true;
  }

  function installStyles() {
    if (document.getElementById("orderDetailFieldStyles")) return;
    const style = document.createElement("style");
    style.id = "orderDetailFieldStyles";
    style.textContent = `
      .order-detail-autocomplete-host{position:relative!important;overflow:visible!important}
      .order-detail-autocomplete-host.has-order-detail-suggestions{z-index:100!important}
      .order-detail-suggestions{position:absolute;z-index:100002;top:100%;left:-1px;right:-1px;max-height:260px;overflow-y:auto;background:#fff;border:1px solid #cfd7d4;box-shadow:0 8px 20px rgba(23,33,31,.12)}
      .order-detail-suggestions[hidden]{display:none!important}
      .order-detail-suggestion{box-sizing:border-box;width:100%;display:grid;gap:2px;margin:0;padding:8px 10px;text-align:left;color:#17211f;background:#fff;border:0;border-bottom:1px solid #e1e6e4;border-radius:0;cursor:pointer;font-family:inherit}
      .order-detail-suggestion:last-child{border-bottom:0}
      .order-detail-suggestion:hover,.order-detail-suggestion.is-active{background:#eef6f3}
      .order-detail-suggestion strong{font-size:11px;font-weight:650;line-height:1.25}
      .order-detail-suggestion span{color:#66736f;font-size:10px;font-weight:400;line-height:1.25}
      .account-page .order-default-grid,.account-page .account-section-body{overflow:visible!important}
      .account-page .order-detail-autocomplete-host>input{border-radius:0!important}
    `;
    document.head.append(style);
  }

  function scan() {
    [...TITLE_CASE_IDS, ...SENTENCE_CASE_IDS].forEach((id) => {
      const field = document.getElementById(id);
      if (field) bindFormatting(field);
    });
    ADDRESS_GROUPS.forEach(bindAddressGroup);
    formatAllFields();
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = window.setTimeout(() => {
      scanTimer = 0;
      scanAttempts += 1;
      scan();
      if (scanAttempts < 80) scheduleScan();
    }, scanAttempts < 10 ? 100 : 300);
  }

  const serverInitialiser = async function initialiseServerAddressFields() {
    scan();
  };
  serverInitialiser.__managerAddressPatched = true;
  window.initialiseGoogleAddress = serverInitialiser;
  window.initialiseOrderDetailFields = scan;
  window.formatOrderDetailFields = formatAllFields;
  window.gm_authFailure = () => {};
  try { initialiseGoogleAddress = serverInitialiser; } catch (_error) { }

  installStyles();
  document.addEventListener("submit", formatAllFields, true);
  document.addEventListener("click", (event) => {
    if (event.target.closest("#continueToReviewButton, #submitButton, #accountForm button[type='submit'], #accountForm button:not([type])")) {
      formatAllFields();
    }
  }, true);
  document.addEventListener("mousedown", (event) => {
    if (event.target.closest(".order-detail-autocomplete-host")) return;
    document.querySelectorAll("[data-server-address-search='true']").forEach((input) => {
      input.__closeOrderDetailSuggestions?.();
    });
  });

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      scan();
      scheduleScan();
    }, { once: true });
  } else {
    scan();
    scheduleScan();
  }
  window.addEventListener("pageshow", () => {
    scan();
    scheduleScan();
  });
})();