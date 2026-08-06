(() => {
  if (window.__bpsReviewValidationGateStarted) return;
  window.__bpsReviewValidationGateStarted = true;

  const form = document.getElementById("orderForm");
  const reviewTriggers = "#continueToReviewButton, [data-step-target='review']";
  const attemptedClass = "order-validation-attempted";

  function markReviewAttempted() {
    document.body.classList.add(attemptedClass);
  }

  function resetValidationGate() {
    document.body.classList.remove(attemptedClass);
    document.querySelectorAll("#orderForm .is-order-field-invalid").forEach((field) => {
      window.BPSOrderFields?.clearValidation?.(field);
    });
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest(reviewTriggers)) markReviewAttempted();
    if (event.target.closest("#startNewOrderButton")) resetValidationGate();
  }, true);

  form?.addEventListener("reset", () => queueMicrotask(resetValidationGate));

  window.BPSReviewValidationGate = {
    markReviewAttempted,
    reset: resetValidationGate,
  };
})();
