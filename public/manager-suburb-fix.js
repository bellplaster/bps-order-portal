(() => {
  let googleRetry = 0;

  document.addEventListener("click", (event) => {
    const reset = event.target.closest(".area-tabs-reset");
    if (!reset) return;
    const confirmed = window.confirm("Reset all tabs to one blank Tab 1? All product quantities will be cleared.");
    if (confirmed) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);

  window.gm_authFailure = function managerGoogleAuthFailure() {
    document.documentElement.dataset.googleAddressUnavailable = "true";
    console.error("Google address autocomplete could not authenticate. Check the Maps JavaScript API key, billing and allowed website referrers in Google Cloud.");
  };

  bindWhenReady();
  document.addEventListener("DOMContentLoaded", bindWhenReady, { once: true });

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