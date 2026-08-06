(() => {
  const RENDER_GATE_STYLE_ID = "portal-initial-render-gate";
  let renderRevealed = false;

  function installRenderGate() {
    document.documentElement.classList.add("portal-is-initialising");
    let style = document.getElementById(RENDER_GATE_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = RENDER_GATE_STYLE_ID;
      style.textContent = `
        html.portal-is-initialising body.order-form-page,
        html.portal-is-initialising body.account-page{visibility:hidden!important}
      `;
      document.head.append(style);
    }
  }

  function revealPortal() {
    if (renderRevealed) return;
    renderRevealed = true;
    document.documentElement.classList.remove("portal-is-initialising");
  }

  installRenderGate();
  window.addEventListener("load", () => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(revealPortal));
  }, { once: true });
  window.setTimeout(revealPortal, 3500);

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

  const addressFields = new WeakSet();
  let scanQueued = false;

  function addressDisplayValue(value) {
    const text = String(value || "").trim();
    return window.BPSOrderFields?.formatAddressDisplay?.(text) || text;
  }

  function assignFieldValue(field, value, { address = false } = {}) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
    const next = address ? addressDisplayValue(value) : String(value ?? "");
    if (window.BPSOrderFields?.owns?.(field)) {
      window.BPSOrderFields.setValue(field, next, { assist: true });
    } else {
      field.value = next;
    }
  }

  function mergeManualStreetDetails(manualValue, resolvedValue) {
    const manual = String(manualValue || "").trim();
    const resolved = String(resolvedValue || "").trim();
    if (!manual || !resolved) return resolved;

    const resolvedHasUnit = /^(?:(?:unit|suite|shop|factory|warehouse|tenancy|level|lot)\s*[A-Za-z0-9-]+|[A-Za-z0-9-]+\s*\/)/i.test(resolved);
    if (resolvedHasUnit) return resolved;

    const unitPrefix = manual.match(
      /^((?:(?:unit|suite|shop|factory|warehouse|tenancy|level|lot)\s*[A-Za-z0-9-]+(?:\s*[/,-]\s*|\s+)|[A-Za-z0-9-]+\s*\/\s*))/i,
    )?.[1] || "";

    let prefix = unitPrefix;
    if (!/^\d/.test(resolved)) {
      const remaining = manual.slice(unitPrefix.length);
      prefix += remaining.match(/^(\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?\s+)/)?.[1] || "";
    }

    prefix = prefix.trimEnd();
    if (!prefix) return resolved;
    return `${prefix}${/[\/,]$/.test(prefix) ? "" : " "}${resolved}`;
  }

  function emitFieldEvents(field) {
    field.dataset.addressSelectionInProgress = "true";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    delete field.dataset.addressSelectionInProgress;
  }

  function addressHost(input) {
    return input.closest(".structured-address-cell, .account-field, .address-control") || input.parentElement;
  }

  function bindAddressInput(input, mode, group) {
    if (!(input instanceof HTMLInputElement) || addressFields.has(input)) return;
    const host = addressHost(input);
    if (!host) return;
    addressFields.add(input);

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
    panel.dataset.group = group.name;
    panel.hidden = true;
    panel.id = `${input.id}Suggestions`;
    panel.setAttribute("role", "listbox");
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
      input.removeAttribute("aria-activedescendant");
      input.setAttribute("aria-expanded", "false");
      host.classList.remove("has-order-detail-suggestions");
    };

    const updateActive = () => {
      let activeId = "";
      [...panel.querySelectorAll("button")].forEach((button, index) => {
        const active = index === activeIndex;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
        if (active) {
          activeId = button.id;
          button.scrollIntoView({ block: "nearest" });
        }
      });
      if (activeId) input.setAttribute("aria-activedescendant", activeId);
      else input.removeAttribute("aria-activedescendant");
    };

    const choose = async (suggestion) => {
      if (!suggestion?.placeId || selecting) return;
      selecting = true;
      controller?.abort();
      const manualStreet = mode === "street" ? input.value : "";
      try {
        const response = await fetch(`/api/address-search?placeId=${encodeURIComponent(suggestion.placeId)}&mode=${encodeURIComponent(mode)}`, {
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

        if (mode === "street" && !place.street) {
          throw new Error("Choose a street address rather than a business or landmark.");
        }
        if (mode === "street" && street && place.street) {
          assignFieldValue(street, mergeManualStreetDetails(manualStreet, place.street), { address: true });
        }
        if (suburb && place.suburb) assignFieldValue(suburb, place.suburb, { address: true });
        if (postcode) assignFieldValue(postcode, String(place.postcode || "").replace(/\D/g, "").slice(0, 4));
        if (state) assignFieldValue(state, "VIC");

        [street, suburb, postcode].filter(Boolean).forEach(emitFieldEvents);

        if (group.name === "order") {
          try { window.parseAndStoreManualAddress?.(); } catch (_error) { }
          try { window.scheduleDraft?.(); } catch (_error) { }
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
      if (!suggestions.length) return close();
      suggestions.forEach((suggestion, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.id = `${panel.id}Option${index}`;
        button.className = "order-detail-suggestion";
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", String(index === activeIndex));

        const main = document.createElement("strong");
        main.textContent = addressDisplayValue(suggestion.mainText || suggestion.text || "");
        button.append(main);

        if (suggestion.secondaryText) {
          const secondary = document.createElement("span");
          secondary.textContent = addressDisplayValue(suggestion.secondaryText);
          button.append(secondary);
        }

        button.addEventListener("mouseenter", () => {
          activeIndex = index;
          updateActive();
        });
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
      if (query.length < 2 || selecting) return close();
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(`/api/address-search?q=${encodeURIComponent(query)}&mode=${mode}`, {
          credentials: "same-origin",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.ok === false) return close();
        suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
        activeIndex = -1;
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
      if (input.value.trim().length < 2) return close();
      searchTimer = window.setTimeout(() => void search(), 180);
    });

    input.addEventListener("keydown", (event) => {
      if (panel.hidden || !suggestions.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeIndex = activeIndex >= suggestions.length - 1 ? 0 : activeIndex + 1;
        updateActive();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex = activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1;
        updateActive();
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (activeIndex >= 0) {
          void choose(suggestions[activeIndex]);
        } else {
          close();
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
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
      .order-detail-suggestion{box-sizing:border-box;width:100%;display:grid;gap:2px;margin:0;padding:8px 10px;text-align:left;text-transform:none;color:#17211f;background:#fff;border:0;border-bottom:1px solid #e1e6e4;border-radius:0;cursor:pointer;font-family:inherit}
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
    ADDRESS_GROUPS.forEach(bindAddressGroup);
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    queueMicrotask(() => {
      scanQueued = false;
      scan();
    });
  }

  const serverInitialiser = async function initialiseServerAddressFields() { scan(); };
  serverInitialiser.__managerAddressPatched = true;
  window.initialiseGoogleAddress = serverInitialiser;
  window.initialiseOrderDetailFields = scan;
  window.formatOrderDetailFields = () => window.BPSOrderFields?.normaliseCurrentValues?.();
  window.gm_authFailure = () => {};
  try { initialiseGoogleAddress = serverInitialiser; } catch (_error) { }

  installStyles();
  document.addEventListener("mousedown", (event) => {
    if (event.target.closest(".order-detail-autocomplete-host")) return;
    document.querySelectorAll("[data-server-address-search='true']").forEach((input) => input.__closeOrderDetailSuggestions?.());
  });

  const observer = new MutationObserver((records) => {
    const relevant = records.some((record) => [...record.addedNodes].some((node) => {
      if (!(node instanceof Element)) return false;
      return ADDRESS_GROUPS.some((group) => node.id === group.streetId
        || node.id === group.suburbId
        || node.id === group.postcodeId
        || node.querySelector?.(`#${group.streetId}, #${group.suburbId}, #${group.postcodeId}`));
    }));
    if (relevant) queueScan();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan, { once: true });
  else scan();
  window.addEventListener("pageshow", scan);
})();
