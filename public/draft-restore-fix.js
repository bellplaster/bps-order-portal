(() => {
  const readOnlySubmissionId = String(new URLSearchParams(window.location.search).get("viewOrder") || "").trim();
  if (readOnlySubmissionId && !globalThis.BPS_ORDER_READONLY) {
    globalThis.BPS_ORDER_READONLY = Object.freeze({ submissionId: readOnlySubmissionId });
  }

  if (!document.querySelector('link[data-address-autocomplete-layout="true"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/address-autocomplete-layout.css?v=20260731-1";
    link.dataset.addressAutocompleteLayout = "true";
    document.head.append(link);
  }

  const controllers = [
    ["order-defaults", "/order-defaults.js?v=20260729-1"],
    ["order-product-payload", "/order-product-payload.js?v=20260801-1"],
    ["admin-defaults", "/admin-defaults.js?v=20260731-1"],
    ["board-width-order", "/board-width-order.js?v=20260729-1"],
    ["order-form-enhancements", "/order-form-enhancements.js?v=20260801-4"],
    ["product-quantity-authority", "/product-quantity-authority.js?v=20260731-1"],
    ["order-selection-source", "/order-selection-source.js?v=20260731-4"],
    ["admin-testing", "/admin-testing.js?v=20260731-4"],
    ["portal-identity-ux", "/portal-identity-ux.js?v=20260731-2"],
    ["inline-tab-rename", "/inline-tab-rename.js?v=20260801-4"],
    ["board-area-summary", "/board-area-summary.js?v=20260801-3"],
    ["compound-range-update", "/compound-range-update-20260807.js?v=20260807-1"],
    ["partiwall-wall-track-label", "/partiwall-wall-track-label.js?v=20260807-1"],
    ["remove-rondo-finishing-beads", "/remove-rondo-finishing-beads-20260807.js?v=20260807-1"],
    ["rondo-variant-removals", "/rondo-variant-removals-20260807.js?v=20260807-3"],
  ];

  controllers.forEach(([marker, src]) => {
    if (document.querySelector(`script[data-${marker}="true"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.dataset[marker.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = "true";
    document.body.append(script);
  });

  const initialiseSafeOrderSubmission = () => {
    const form = document.getElementById("orderForm");
    if (!(form instanceof HTMLFormElement) || form.dataset.safeSubmitBound === "true") return Boolean(form);
    form.dataset.safeSubmitBound = "true";

    form.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest(".area-name-editor") || target instanceof HTMLTextAreaElement) return;
      if (target instanceof HTMLButtonElement && target.id === "submitButton") return;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    form.addEventListener("submit", (event) => {
      if (event.target instanceof HTMLFormElement && event.target.classList.contains("area-name-editor")) return;
      const submitter = event.submitter;
      const intentionalSubmit = submitter instanceof HTMLButtonElement
        && submitter.id === "submitButton"
        && typeof state !== "undefined"
        && state.activeStep === "review";
      if (intentionalSubmit) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }, true);
    return true;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiseSafeOrderSubmission, { once: true });
  } else {
    initialiseSafeOrderSubmission();
  }
  window.addEventListener("pageshow", initialiseSafeOrderSubmission);
})();
