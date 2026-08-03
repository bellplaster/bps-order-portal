(() => {
  function openConfirmation(result) {
    const submissionId = String(result?.submissionId || "").trim();
    if (!submissionId) {
      throw new Error("The order was created without a confirmation ID.");
    }
    window.location.assign(`/checkouts/${encodeURIComponent(submissionId)}/thank-you`);
  }

  globalThis.showSuccess = openConfirmation;
  try { showSuccess = openConfirmation; } catch (_error) { }
})();
