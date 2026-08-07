(() => {
  function applyReferenceCopy() {
    const reference = document.getElementById("reference");
    if (!reference) return;
    reference.required = false;
    reference.placeholder = "Reference (optional)";
    reference.setAttribute("aria-label", "Reference, optional");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyReferenceCopy, { once: true });
  } else {
    applyReferenceCopy();
  }
})();
