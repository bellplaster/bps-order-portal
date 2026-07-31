(() => {
  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function canonical(value) {
    return clean(value)
      .replace(/[×]/g, "x")
      .replace(/[–—]/g, "-")
      .toUpperCase();
  }

  function productDisplayName(product = {}) {
    const base = clean(product.label || product.description || product.descriptionRaw || product.name || product.sku);
    const detail = clean(product.detail);
    if (!base) return detail;
    if (!detail) return base;
    if (canonical(base).includes(canonical(detail))) return base;
    return `${base} - ${detail}`;
  }

  globalThis.BpsProductDisplayName = Object.freeze({ productDisplayName });
})();