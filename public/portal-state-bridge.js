(() => {
  try {
    if (typeof state !== "undefined") globalThis.state = state;
  } catch (_error) {
    // The confirmation route can still load from the server without client state.
  }

  if (!document.body.classList.contains("order-form-page")) return;

  if (!document.querySelector('link[data-saved-address-picker="true"]')) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/saved-address-picker.css?v=20260804-1";
    stylesheet.dataset.savedAddressPicker = "true";
    document.head.append(stylesheet);
  }

  if (!document.querySelector('script[data-saved-address-picker="true"]')) {
    const script = document.createElement("script");
    script.src = "/saved-address-picker.js?v=20260804-1";
    script.defer = true;
    script.dataset.savedAddressPicker = "true";
    document.body.append(script);
  }
})();
