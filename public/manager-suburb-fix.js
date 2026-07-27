(() => {
  let googleRetry = 0;
  let tabControlObserver = null;
  let addressObserver = null;
  let arrangingTabControls = false;

  document.addEventListener("click", (event) => {
    const reset = event.target.closest(".area-tabs-reset");
    if (reset) {
      const confirmed = window.confirm("Reset all tabs to one blank Tab 1? All product quantities will be cleared.");
      if (confirmed) {
        window.setTimeout(stabiliseTabControls, 0);
        window.setTimeout(stabiliseTabControls, 80);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    if (event.target.closest("[data-floor-tab], .area-tab-label, .area-tab-rename")) {
      window.setTimeout(stabiliseTabControls, 0);
      window.setTimeout(stabiliseTabControls, 40);
    }
  }, true);

  window.gm_authFailure = function managerGoogleAuthFailure() {
    document.documentElement.dataset.googleAddressUnavailable = "true";
    console.error("Google address autocomplete could not authenticate. Check the Maps JavaScript API key, billing and allowed website referrers in Google Cloud.");
  };

  start();
  document.addEventListener("DOMContentLoaded", start, { once: true });
  window.addEventListener("pageshow", () => {
    sanitiseStructuredAddress();
    stabiliseTabControls();
  });

  function start() {
    bindWhenReady();
    observeTabControls();
    observeAddressFields();
    sanitiseStructuredAddress();
    stabiliseTabControls();
    window.setTimeout(sanitiseStructuredAddress, 80);
    window.setTimeout(stabiliseTabControls, 80);
  }

  function stabiliseTabControls() {
    if (arrangingTabControls) return;
    arrangingTabControls = true;
    try {
      normaliseAddTabControl();
      positionRenameEditor();
    } finally {
      arrangingTabControls = false;
    }
  }

  function normaliseAddTabControl() {
    const tabs = document.getElementById("deliveryAreaTabs") || document.querySelector(".floor-tabs");
    const add = tabs?.querySelector(":scope > [data-add-area]");
    if (!tabs || !add) return;

    add.replaceChildren(document.createTextNode("+"));
    add.setAttribute("aria-label", "Add tab");
    add.setAttribute("title", "Add tab");
    add.style.setProperty("display", "inline-flex", "important");
    add.style.setProperty("align-items", "center", "important");
    add.style.setProperty("justify-content", "center", "important");
    add.style.setProperty("flex", "0 0 30px", "important");
    add.style.setProperty("width", "30px", "important");
    add.style.setProperty("min-width", "30px", "important");
    add.style.setProperty("max-width", "30px", "important");
    add.style.setProperty("height", "30px", "important");
    add.style.setProperty("min-height", "30px", "important");
    add.style.setProperty("padding", "0", "important");
    add.style.setProperty("line-height", "1", "important");
    add.style.setProperty("box-sizing", "border-box", "important");
    add.style.setProperty("overflow", "hidden", "important");
    add.style.removeProperty("position");
    add.style.removeProperty("left");
    add.style.removeProperty("top");
    add.style.removeProperty("transform");
  }

  function positionRenameEditor() {
    const tabs = document.getElementById("deliveryAreaTabs") || document.querySelector(".floor-tabs");
    const editor = tabs?.querySelector(":scope > .area-name-editor");
    if (!tabs || !editor) return;

    const activeTab = tabs.querySelector(
      ":scope > .area-tab-shell [data-floor-tab].is-active, " +
      ":scope > .area-tab-shell [data-floor-tab][aria-selected='true'], " +
      ":scope > .area-tab-shell .area-tab-label.is-active, " +
      ":scope > .area-tab-shell .is-active"
    );
    const activeShell = activeTab?.closest(".area-tab-shell")
      || [...tabs.querySelectorAll(":scope > .area-tab-shell")].find((shell) => shell.contains(document.activeElement))
      || tabs.querySelector(":scope > .area-tab-shell");
    if (!activeShell) return;

    editor.style.removeProperty("position");
    editor.style.removeProperty("z-index");
    editor.style.removeProperty("top");
    editor.style.removeProperty("left");
    editor.style.removeProperty("height");
    editor.style.removeProperty("transform");
    editor.style.setProperty("display", "inline-flex", "important");
    editor.style.setProperty("align-items", "center", "important");
    editor.style.setProperty("flex", "0 0 auto", "important");
    editor.style.setProperty("margin", "0 0 0 4px", "important");

    if (activeShell.nextElementSibling !== editor) {
      tabs.insertBefore(editor, activeShell.nextSibling);
    }
  }

  function observeTabControls() {
    const tabs = document.getElementById("deliveryAreaTabs") || document.querySelector(".floor-tabs");
    if (!tabs || tabs.dataset.addControlObserved === "true") return;
    tabs.dataset.addControlObserved = "true";
    tabControlObserver?.disconnect();
    tabControlObserver = new MutationObserver(() => {
      if (!arrangingTabControls) window.requestAnimationFrame(stabiliseTabControls);
    });
    tabControlObserver.observe(tabs, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "aria-selected"]
    });
    stabiliseTabControls();
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

    if (street && /^(?:street|street\s*[·-]?\s*optional)$/i.test(street.value.trim())) {
      street.value = "";
    }

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