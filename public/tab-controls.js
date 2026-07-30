(() => {
  loadOnce("/tab-consolidation.js?v=20260730-2", "tabConsolidation");
  loadOnce("/tab-order-override.js?v=20260730-1", "tabOrderOverride");
  loadOnce("/tab-drag-indicator-fix.js?v=20260730-1", "tabDragIndicatorFix");

  function loadOnce(src, datasetKey) {
    const selector = `script[data-${datasetKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="true"]`;
    if (document.querySelector(selector)) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset[datasetKey] = "true";
    document.body.append(script);
  }
})();
