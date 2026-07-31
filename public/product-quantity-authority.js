(() => {
  const MAX_QUANTITY = 99999;

  function normalise(value) {
    const digits = String(value ?? "").replace(/\D/g, "").slice(0, 5);
    if (!digits) return 0;
    return Math.min(MAX_QUANTITY, Number(digits));
  }

  function handleQuantityInput(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!input.matches(".quantity-input[data-product-key]")) return;

    event.stopImmediatePropagation();
    const areaId = String(input.dataset.floor || "");
    const key = String(input.dataset.productKey || "").trim();
    if (!areaId || !key || typeof state === "undefined") return;

    if (!(state.quantities[areaId] instanceof Map)) state.quantities[areaId] = new Map();
    const quantity = normalise(input.value);
    input.maxLength = 5;
    input.value = quantity > 0 ? String(quantity) : "";
    input.classList.toggle("has-value", quantity > 0);

    if (quantity > 0) state.quantities[areaId].set(key, quantity);
    else state.quantities[areaId].delete(key);

    if (typeof renderCounts === "function") renderCounts();
    if (typeof scheduleDraft === "function") scheduleDraft();
  }

  function enforceInputAttributes(root = document) {
    root.querySelectorAll?.(".quantity-input[data-product-key]").forEach((input) => {
      input.maxLength = 5;
      input.inputMode = "numeric";
      input.pattern = "[0-9]*";
      input.dataset.quantityAuthority = "true";
    });
  }

  document.addEventListener("input", handleQuantityInput, true);
  document.addEventListener("DOMContentLoaded", () => enforceInputAttributes(), { once: true });

  const observer = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches(".quantity-input[data-product-key]")) enforceInputAttributes(node.parentElement || node);
      else enforceInputAttributes(node);
    }));
  });

  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
})();