(() => {
  let attempts = 0;

  function install() {
    if (typeof buildFloorPayload !== "function") return false;
    if (buildFloorPayload.__canonicalProductPayload === true) return true;

    const previousBuildFloorPayload = buildFloorPayload;
    const reconciledBuildFloorPayload = function buildCanonicalProductPayload(floor, ...args) {
      const payload = previousBuildFloorPayload.call(this, floor, ...args) || {};
      const catalog = state?.catalog || {};
      const canonicalBySku = new Map();

      Object.entries(catalog).forEach(([key, product]) => {
        const sku = normaliseSku(product?.sku || product?.stockCode);
        if (!sku) return;

        const synthetic = /^source-/i.test(key);
        const current = canonicalBySku.get(sku);
        if (!current || (current.synthetic && !synthetic)) {
          canonicalBySku.set(sku, { key, synthetic });
        }
      });

      payload.items = (Array.isArray(payload.items) ? payload.items : []).map((item) => {
        const currentKey = String(item?.key || "");
        const product = catalog[currentKey] || {};
        const sku = normaliseSku(item?.sku || product?.sku || product?.stockCode);
        const canonicalKey = sku ? canonicalBySku.get(sku)?.key : "";
        const key = /^source-/i.test(currentKey)
          ? (canonicalKey || currentKey)
          : currentKey;
        return {
          ...item,
          key,
          sku,
          description: String(item?.description || product?.description || product?.label || "").trim(),
        };
      });

      return payload;
    };

    reconciledBuildFloorPayload.__canonicalProductPayload = true;
    buildFloorPayload = reconciledBuildFloorPayload;
    return true;
  }

  function normaliseSku(value) {
    return String(value || "").trim().toUpperCase();
  }

  if (install()) return;

  const timer = window.setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 40) window.clearInterval(timer);
  }, 100);
})();
