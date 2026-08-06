(() => {
  function applyReferenceCopy() {
    const reference = document.getElementById("reference");
    if (!reference) return;
    reference.required = false;
    reference.placeholder = "Reference (optional)";
    reference.setAttribute("aria-label", "Reference, optional");
  }

  function loadOrderDetailsBehaviour() {
    if (document.querySelector('script[data-order-details-date-state="true"]')) return;
    const script = document.createElement("script");
    script.src = "/order-details-date-state.js?v=20260806-1";
    script.defer = true;
    script.dataset.orderDetailsDateState = "true";
    document.body.append(script);
  }

  function start() {
    applyReferenceCopy();
    loadOrderDetailsBehaviour();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
  window.addEventListener("load", applyReferenceCopy, { once: true });
})();
