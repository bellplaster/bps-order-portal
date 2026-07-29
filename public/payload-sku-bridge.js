(() => {
  // The live review catalogue is the source of truth for SKU identity.
  // Include the SKU with every standard matrix line so the backend does not
  // have to rely on the older static key-to-SKU map when building Accrivia XLSX.
  buildFloorPayload = function buildSkuAwareFloorPayload(floor) {
    return {
      items: [...state.quantities[floor].entries()]
        .filter(([, quantity]) => quantity > 0)
        .map(([key, quantity]) => {
          const product = state.catalog?.[key] || {};
          return {
            key,
            sku: String(product.sku || "").trim(),
            quantity,
          };
        }),
      otherMaterials: (state.otherMaterials[floor] || [])
        .filter((item) => item.quantity > 0)
        .map((item) => ({ sku: item.sku, quantity: item.quantity })),
    };
  };
})();
