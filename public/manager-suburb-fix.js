(() => {
  let googleRetry = 0;
  let tabControlObserver = null;
  let addressObserver = null;
  let arrangingEditor = false;

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

    if (event.target.closest("[data-floor-tab], .area-tab-label")) {
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
    normaliseAddTabControl();
    positionRenameEditor();
  }

  function normaliseAddTabControl() {
    const add = document.querySelector(".floor-tabs > [data-add-area]");
    if (!add) return;
    if (add.textContent !== "+") add.textContent = "+";
    add.setAttribute("aria-label", "Add tab");
    add.setAttribute("title", "Add tab");
  }

  function positionRenameEditor() {
    if (arrangingEditor) return;
    const tabs = document.getElementById("deliveryAreaTabs") || document.querySelector(".floor-tabs");
    const editor = tabs?.querySelector(":scope > .area-name-editor");
    if (!tabs || !editor) return;

    const activeElement = tabs.querySelector(
      ":scope > .area-tab-shell .is-active, :scope > .area-tab-shell [aria-selected='true'], :scope > .area-tab-shell [data-floor-tab].is-active"
    );
    const activeShell = activeElement?.closest(".area-tab-shell")
      || [...tabs.querySelectorAll(":scope > .area-tab-shell")].find((shell) => shell.contains(document.activeElement))
      || tabs.querySelector(":scope > .area-tab-shell");
    if (!activeShell || activeShell.nextElementSibling === editor) return;

    arrangingEditor = true;
    tabs.insertBefore(editor, activeShell.nextSibling);
    arrangingEditor = false;
  }

  function observeTabControls() {
    const tabs = document.getElementById("deliveryAreaTabs") || document.querySelector(".floor-tabs");
    if (!tabs || tabs.dataset.addControlObserved === "true") return;
    tabs.dataset.addControlObserved = "true";
    tabControlObserver?.disconnect();
    tabControlObserver = new MutationObserver(() => {
      if (!arrangingEditor) window.requestAnimationFrame(stabiliseTabControls);
    });
    tabControlObserver.observe(tabs, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "aria-selected"] });
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