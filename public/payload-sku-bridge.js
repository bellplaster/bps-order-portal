(() => {
  // The live review catalogue is the source of truth for SKU identity and
  // description. Include both with every standard matrix line so the backend
  // can build a complete Accrivia XLSX without depending on the old catalogue.
  buildFloorPayload = function buildSkuAwareFloorPayload(floor) {
    return {
      items: [...state.quantities[floor].entries()]
        .filter(([, quantity]) => quantity > 0)
        .map(([key, quantity]) => {
          const product = state.catalog?.[key] || {};
          return {
            key,
            sku: String(product.sku || "").trim(),
            description: String(product.description || product.descriptionRaw || product.label || product.name || "").trim(),
            quantity,
          };
        }),
      otherMaterials: (state.otherMaterials[floor] || [])
        .filter((item) => item.quantity > 0)
        .map((item) => ({ sku: item.sku, quantity: item.quantity })),
    };
  };
})();
