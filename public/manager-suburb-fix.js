(() => {
  let googleRetry = 0;
  let tabControlObserver = null;

  document.addEventListener("click", (event) => {
    const reset = event.target.closest(".area-tabs-reset");
    if (!reset) return;
    const confirmed = window.confirm("Reset all tabs to one blank Tab 1? All product quantities will be cleared.");
    if (confirmed) {
      window.setTimeout(normaliseAddTabControl, 0);
      window.setTimeout(normaliseAddTabControl, 80);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);

  window.gm_authFailure = function managerGoogleAuthFailure() {
    document.documentElement.dataset.googleAddressUnavailable = "true";
    console.error("Google address autocomplete could not authenticate. Check the Maps JavaScript API key, billing and allowed website referrers in Google Cloud.");
  };

  bindWhenReady();
  observeTabControls();
  document.addEventListener("DOMContentLoaded", () => {
    bindWhenReady();
    observeTabControls();
    normaliseAddTabControl();
  }, { once: true });

  function normaliseAddTabControl() {
    const add = document.querySelector(".floor-tabs > [data-add-area]");
    if (!add) return;
    if (add.textContent !== "+") add.textContent = "+";
    add.setAttribute("aria-label", "Add tab");
    add.setAttribute("title", "Add tab");
  }

  function observeTabControls() {
    const tabs = document.getElementById("deliveryAreaTabs") || document.querySelector(".floor-tabs");
    if (!tabs || tabs.dataset.addControlObserved === "true") return;
    tabs.dataset.addControlObserved = "true";
    tabControlObserver?.disconnect();
    tabControlObserver = new MutationObserver(() => normaliseAddTabControl());
    tabControlObserver.observe(tabs, { childList: true, subtree: true, characterData: true });
    normaliseAddTabControl();
  }

  function bindWhenReady() {
    if (window.google?.maps?.places?.Autocomplete) {
      try {
        if (typeof setupStructuredAddress === "function") setupStructuredAddress();
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