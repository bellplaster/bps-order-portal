(() => {
  if (window.__bpsReviewValidationGateStarted) return;
  window.__bpsReviewValidationGateStarted = true;

  const form = document.getElementById("orderForm");
  const reference = document.getElementById("reference");
  const reviewTriggers = "#continueToReviewButton, [data-step-target='review']";
  const attemptedClass = "order-validation-attempted";

  if (reference) {
    reference.required = false;
    reference.placeholder = "Reference (optional)";
    reference.setAttribute("aria-label", "Reference, optional");
  }

  const style = document.createElement("style");
  style.dataset.reviewValidationGate = "true";
  style.textContent = `
    .order-form-page:not(.${attemptedClass}) .is-order-field-invalid{box-shadow:none!important}
    .order-form-page:not(.${attemptedClass}) .order-field-validation-message{display:none!important}
    .order-form-page #reference.is-order-field-invalid{box-shadow:none!important}
    .order-form-page #reference + .order-field-validation-message{display:none!important}
  `;
  document.head.append(style);

  function clearReferenceValidation() {
    if (!reference) return;
    window.BPSOrderFields?.clearValidation?.(reference);
  }

  function markReviewAttempted() {
    document.body.classList.add(attemptedClass);
  }

  function resetValidationGate() {
    document.body.classList.remove(attemptedClass);
    document.querySelectorAll("#orderForm .is-order-field-invalid").forEach((field) => {
      window.BPSOrderFields?.clearValidation?.(field);
    });
    clearReferenceValidation();
  }

  function generatedReference() {
    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      "-",
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
      "-",
      crypto.randomUUID().slice(0, 4).toUpperCase(),
    ].join("");
    return `WEB-${stamp}`;
  }

  function makeReferenceOptionalInSharedValidation() {
    const api = window.BPSOrderFields;
    if (!api || api.__optionalReferencePatched) return;
    const originalValidate = api.validateField.bind(api);
    api.validateField = (target, options) => {
      const field = typeof target === "string" ? document.getElementById(target) : target;
      if (field?.id === "reference" && !String(field.value || "").trim()) {
        api.clearValidation(field);
        return true;
      }
      return originalValidate(target, options);
    };
    api.__optionalReferencePatched = true;
  }

  makeReferenceOptionalInSharedValidation();

  document.addEventListener("click", (event) => {
    if (event.target.closest(reviewTriggers)) markReviewAttempted();
    if (event.target.closest("#startNewOrderButton")) resetValidationGate();
  }, true);

  document.addEventListener("input", (event) => {
    if (event.target === reference) clearReferenceValidation();
  }, true);

  document.addEventListener("blur", (event) => {
    if (event.target === reference) queueMicrotask(clearReferenceValidation);
  }, true);

  form?.addEventListener("reset", () => queueMicrotask(resetValidationGate));

  form?.addEventListener("submit", () => {
    if (!reference || String(reference.value || "").trim()) return;
    const generated = generatedReference();
    reference.value = generated;
    queueMicrotask(() => {
      if (reference.value === generated) reference.value = "";
      clearReferenceValidation();
    });
  }, true);

  window.BPSReviewValidationGate = {
    markReviewAttempted,
    reset: resetValidationGate,
  };
})();
