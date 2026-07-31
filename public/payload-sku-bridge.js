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

  const naming = Object.freeze({ productDisplayName });
  globalThis.BpsProductDisplayName = naming;

  function ensureFloorState(floor) {
    if (!state.quantities || typeof state.quantities !== "object") state.quantities = {};
    if (!(state.quantities[floor] instanceof Map)) state.quantities[floor] = new Map();

    if (!state.otherMaterials || typeof state.otherMaterials !== "object") state.otherMaterials = {};
    if (!Array.isArray(state.otherMaterials[floor])) state.otherMaterials[floor] = [];

    return {
      quantities: state.quantities[floor],
      otherMaterials: state.otherMaterials[floor],
    };
  }

  buildFloorPayload = function buildSkuAwareFloorPayload(floor) {
    const floorState = ensureFloorState(floor);
    return {
      items: [...floorState.quantities.entries()]
        .filter(([, quantity]) => Number(quantity) > 0)
        .map(([key, quantity]) => {
          const product = state.catalog?.[key] || {};
          return {
            key,
            sku: clean(product.sku),
            description: productDisplayName(product),
            quantity: Number(quantity),
          };
        }),
      otherMaterials: floorState.otherMaterials
        .filter((item) => Number(item?.quantity) > 0)
        .map((item) => ({
          sku: clean(item?.sku),
          description: clean(item?.description),
          quantity: Number(item?.quantity),
        })),
    };
  };

  getFloorLines = function getSkuAwareFloorLines(floor) {
    const floorState = ensureFloorState(floor);
    const mapped = [...floorState.quantities.entries()].map(([key, quantity]) => {
      const product = state.catalog?.[key] || {};
      return {
        floor,
        key,
        sku: clean(product.sku) || "Pending mapping",
        label: productDisplayName(product) || key,
        quantity: Number(quantity),
      };
    });
    const additional = floorState.otherMaterials.map((item) => ({
      floor,
      sku: clean(item?.sku),
      label: clean(item?.description || item?.sku),
      quantity: Number(item?.quantity),
    }));
    return [...mapped, ...additional].filter((line) => line.quantity > 0);
  };
})();
