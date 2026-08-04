(() => {
  try {
    if (typeof state !== "undefined") globalThis.state = state;
  } catch (_error) {
    // The confirmation route can still load from the server without client state.
  }

  if (!document.body.classList.contains("order-form-page")) return;

  // Saved addresses remain available from the Account page, but the order-form
  // picker is intentionally unpublished until the workflow is approved.
  document.getElementById("savedAddressPickerButton")?.remove();
  document.getElementById("savedAddressPickerMenu")?.remove();
  document.querySelector(".address-control")?.classList.remove("has-saved-address-picker");
  document.querySelectorAll('[data-saved-address-picker="true"]').forEach((element) => element.remove());
})();
