(() => {
  let googleRetry = 0;
  let tabObserver = null;
  let addressObserver = null;
  let frame = 0;

  document.addEventListener("click", (event) => {
    const reset = event.target.closest(".area-tabs-reset");
    if (reset) {
      const confirmed = window.confirm("Reset all tabs to one blank Tab 1? All product quantities will be cleared.");
      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }
    }
    if (event.target.closest("[data-add-area], [data-floor-tab], .area-tab-rename, .area-tabs-reset, [data-delete-area]")) {
      queueTabLayout();
      window.setTimeout(queueTabLayout, 50);
    }
  }, true);

  document.addEventListener("dblclick", (event) => {
    if (event.target.closest("[data-floor-tab]")) {
      queueTabLayout();
      window.setTimeout(queueTabLayout, 20);
    }
  }, true);

  document.addEventListener("submit", (event) => {
    if (event.target.matches(".area-name-editor")) window.setTimeout(queueTabLayout, 0);
  }, true);

  window.gm_authFailure = function managerGoogleAuthFailure() {
    document.documentElement.dataset.googleAddressUnavailable = "true";
    console.error("Google address autocomplete could not authenticate. Check the Maps JavaScript API key, billing and allowed website referrers in Google Cloud.");
  };

  start();
  document.addEventListener("DOMContentLoaded", start, { once: true });
  window.addEventListener("pageshow", start);
  window.addEventListener("resize", queueTabLayout);

  function start() {
    bindWhenReady();
    observeTabs();
    observeAddressFields();
    sanitiseStructuredAddress();
    queueTabLayout();
    window.setTimeout(sanitiseStructuredAddress, 80);
    window.setTimeout(queueTabLayout, 80);
  }

  function queueTabLayout() {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(applyTabLayout);
  }

  function applyTabLayout() {
    const tabs = document.getElementById("deliveryAreaTabs") || document.querySelector(".floor-tabs");
    if (!tabs) return;

    const shells = [...tabs.querySelectorAll(":scope > .area-tab-shell")];
    const add = tabs.querySelector(":scope > [data-add-area]");
    const reset = tabs.querySelector(":scope > .area-tabs-reset");
    const summary = tabs.querySelector(":scope > .area-tab-summary");
    const editor = tabs.querySelector(":scope > .area-name-editor");

    tabs.style.setProperty("display", "flex", "important");
    tabs.style.setProperty("align-items", "flex-end", "important");
    tabs.style.setProperty("gap", "4px", "important");

    shells.forEach((shell, index) => {
      shell.style.setProperty("order", String((index + 1) * 10), "important");
    });

    if (add) {
      add.replaceChildren(document.createTextNode("+"));
      add.classList.add("area-tab-add");
      add.setAttribute("aria-label", "Add tab");
      add.setAttribute("title", "Add tab");
      add.style.setProperty("order", "1000", "important");
      add.style.setProperty("display", "grid", "important");
      add.style.setProperty("place-items", "center", "important");
      add.style.setProperty("flex", "0 0 32px", "important");
      add.style.setProperty("width", "32px", "important");
      add.style.setProperty("min-width", "32px", "important");
      add.style.setProperty("max-width", "32px", "important");
      add.style.setProperty("height", "32px", "important");
      add.style.setProperty("min-height", "32px", "important");
      add.style.setProperty("max-height", "32px", "important");
      add.style.setProperty("margin", "0", "important");
      add.style.setProperty("padding", "0", "important");
      add.style.setProperty("font-size", "18px", "important");
      add.style.setProperty("font-weight", "600", "important");
      add.style.setProperty("line-height", "1", "important");
      add.style.setProperty("text-indent", "0", "important");
      add.style.setProperty("overflow", "hidden", "important");
      add.style.setProperty("box-sizing", "border-box", "important");
    }

    if (reset) reset.style.setProperty("order", "1010", "important");
    if (summary) {
      summary.style.setProperty("order", "2000", "important");
      summary.style.setProperty("margin-left", "auto", "important");
    }

    if (editor) {
      const activeTab = tabs.querySelector(":scope > .area-tab-shell [data-floor-tab][aria-selected='true']")
        || tabs.querySelector(":scope > .area-tab-shell [data-floor-tab].is-active")
        || tabs.querySelector(":scope > .area-tab-shell .is-active");
      const activeShell = activeTab?.closest(".area-tab-shell") || shells[0];
      const activeIndex = Math.max(0, shells.indexOf(activeShell));
      editor.style.setProperty("order", String((activeIndex + 1) * 10 + 1), "important");
      editor.style.setProperty("position", "static", "important");
      editor.style.setProperty("display", "inline-flex", "important");
      editor.style.setProperty("flex", "0 0 auto", "important");
      editor.style.setProperty("height", "32px", "important");
      editor.style.setProperty("min-height", "32px", "important");
      editor.style.setProperty("margin", "0", "important");
      editor.style.setProperty("transform", "none", "important");
    }
  }

  function observeTabs() {
    const tabs = document.getElementById("deliveryAreaTabs") || document.querySelector(".floor-tabs");
    if (!tabs) {
      window.setTimeout(observeTabs, 100);
      return;
    }
    if (tabs.dataset.finalTabObserver === "true") return;
    tabs.dataset.finalTabObserver = "true";
    tabObserver?.disconnect();
    tabObserver = new MutationObserver(queueTabLayout);
    tabObserver.observe(tabs, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "aria-selected"]
    });
    queueTabLayout();
  }

  function observeAddressFields() {
    const field = document.querySelector(".delivery-address-field");
    if (!field || field.dataset.addressSanitiserObserved === "true") return;
    field.dataset.addressSanitiserObserved = "true";
    addressObserver?.disconnect();
    addressObserver = new MutationObserver(() => window.requestAnimationFrame(sanitiseStructuredAddress));
    addressObserver.observe(field, { childList: true, subtree: true });
  }

  function sanitiseStructuredAddress() {
    const street = document.getElementById("deliveryStreet");
    const suburb = document.getElementById("deliveryAddressSearch");
    const postcode = document.getElementById("deliveryPostcode");
    const stateInput = document.getElementById("deliveryState");

    if (stateInput && stateInput.value !== "VIC") stateInput.value = "VIC";
    if (street && /^(?:street|street\s*[·-]?\s*optional)$/i.test(street.value.trim())) street.value = "";

    const suburbValue = suburb?.value.trim().replace(/\s+/g, " ") || "";
    const invalidSuburb = /^(?:(?:VIC|Victoria)(?:\s+(?:VIC|Victoria))*)$/i.test(suburbValue)
      || /^(?:suburb)$/i.test(suburbValue);

    if (invalidSuburb && suburb) {
      suburb.value = "";
      suburb.setCustomValidity("");
      if (postcode) postcode.value = "";
      clearInvalidAddressDraftValues();
    }
  }

  function clearInvalidAddressDraftValues() {
    const line2 = document.getElementById("deliveryAddressLine2");
    const full = document.getElementById("deliveryAddress");
    const line1 = document.getElementById("deliveryAddressLine1");
    if (line1 && /^(?:street|street\s*[·-]?\s*optional)$/i.test(line1.value.trim())) line1.value = "";
    if (line2 && /^(?:(?:VIC|Victoria)(?:\s+(?:VIC|Victoria))*)$/i.test(line2.value.trim().replace(/\s+/g, " "))) line2.value = "";
    if (full && /^(?:(?:street|suburb)?\s*,?\s*)?(?:(?:VIC|Victoria)(?:\s+(?:VIC|Victoria))*)$/i.test(full.value.trim().replace(/\s+/g, " "))) full.value = "";
  }

  function bindWhenReady() {
    if (window.google?.maps?.places?.Autocomplete) {
      try {
        if (typeof setupStructuredAddress === "function") setupStructuredAddress();
        sanitiseStructuredAddress();
        if (typeof bindAddressAutocompletes === "function") bindAddressAutocompletes();
      } catch (error) {
        console.warn("Address autocomplete could not be rebound.", error);
      }
      return;
    }
    if (googleRetry >= 60) return;
    googleRetry += 1;
    window.setTimeout(bindWhenReady, 250);
  }
})();