(() => {
  function applyReferenceCopy() {
    const reference = document.getElementById("reference");
    if (!reference) return;
    reference.required = false;
    reference.placeholder = "Reference (optional)";
    reference.setAttribute("aria-label", "Reference, optional");
  }

  function loadGateCodeControl() {
    if (document.querySelector('script[data-gate-code-control="true"]')) return;
    const script = document.createElement("script");
    script.src = "/gate-code.js?v=20260807-1";
    script.defer = true;
    script.dataset.gateCodeControl = "true";
    document.head.append(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyReferenceCopy();
      loadGateCodeControl();
    }, { once: true });
  } else {
    applyReferenceCopy();
    loadGateCodeControl();
  }
})();
