(() => {
  // The live review catalogue is the source of truth for SKU identity and
  // description. Dynamic tabs may be created or restored before their state
  // containers exist, so normalise the tab state before reading it.
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

  function displayName(product) {
    const formatter = globalThis.BpsProductDisplayName?.productDisplayName;
    if (typeof formatter !== "function") throw new Error("Product display-name module is not loaded.");
    return formatter(product);
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
            sku: String(product.sku || "").trim(),
            description: displayName(product),
            quantity: Number(quantity),
          };
        }),
      otherMaterials: floorState.otherMaterials
        .filter((item) => Number(item?.quantity) > 0)
        .map((item) => ({
          sku: String(item?.sku || "").trim(),
          quantity: Number(item?.quantity),
        })),
    };
  };
})();
