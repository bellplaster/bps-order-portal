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

  const WALL_FRAMING_BMT_BY_SKU = Object.freeze({
    // Studs
    "40103000": "0.50 BMT",
    "40103600": "0.50 BMT",
    "11203000": "0.50 BMT",
    "11203600": "0.50 BMT",
    "11204200": "0.50 BMT",
    "11204800": "0.50 BMT",
    "11206000": "0.50 BMT",
    "40303000": "0.55 BMT",
    "40303600": "0.55 BMT",
    "40304200": "0.55 BMT",
    "40304800": "0.55 BMT",
    "25103000": "0.55 BMT",
    "25103600": "0.55 BMT",
    "25104200": "0.55 BMT",
    "25104800": "0.55 BMT",
    "25106000": "0.55 BMT",
    "48903000": "0.75 BMT",
    "48903600": "0.75 BMT",
    "49103000": "0.75 BMT",
    "49103600": "0.75 BMT",
    "49104200": "0.75 BMT",
    "49104800": "0.75 BMT",
    "49106000": "0.75 BMT",
    "49303000": "0.75 BMT",
    "49303600": "0.75 BMT",
    "49304200": "0.75 BMT",
    "49304800": "0.75 BMT",
    "49306000": "0.75 BMT",
    "49503000": "0.75 BMT",
    "49503600": "0.75 BMT",
    "49504200": "0.75 BMT",
    "49504800": "0.75 BMT",
    "49506000": "0.75 BMT",
    "51103000": "0.75 BMT",
    "51103600": "0.75 BMT",
    "51104200": "0.75 BMT",
    "51104800": "0.75 BMT",
    "51106000": "0.75 BMT",
    "66103000": "1.15 BMT",
    "66103600": "1.15 BMT",
    "66104200": "1.15 BMT",
    "66104800": "1.15 BMT",
    "67103000": "1.15 BMT",
    "67103600": "1.15 BMT",
    "67104800": "1.15 BMT",
    "67106000": "1.15 BMT",
    "68103000": "1.15 BMT",
    "68103600": "1.15 BMT",
    "68104200": "1.15 BMT",
    "68104800": "1.15 BMT",
    "68106000": "1.15 BMT",
    "69103000": "1.15 BMT",
    "69103600": "1.15 BMT",
    "69104200": "1.15 BMT",
    "69104800": "1.15 BMT",
    "69106000": "1.15 BMT",

    // Tracks
    "40003000": "0.50 BMT",
    "11103000": "0.50 BMT",
    "40203000": "0.50 BMT",
    "25003000": "0.50 BMT",
    "48003000": "0.50 BMT",
    "48203000": "0.50 BMT",
    "48303000": "0.50 BMT",
    "49003000": "0.70 BMT",
    "49403000": "0.70 BMT",
    "49603000": "0.70 BMT",
    "48803000": "0.70 BMT",
    "49703000": "0.70 BMT",
    "49803000": "0.70 BMT",
    "87203000": "0.70 BMT",
    "49203000": "0.75 BMT",
    "49903000": "0.75 BMT",
    "51003000": "0.75 BMT",
    "87303000": "0.75 BMT",
    "66003000": "1.15 BMT",
    "67003000": "1.15 BMT",
    "68003000": "1.15 BMT",
    "66303000": "1.15 BMT",
    "67303000": "1.15 BMT",
    "68303000": "1.15 BMT",
    "69003000": "1.15 BMT",
  });

  function withWallFramingBmt(base, product = {}) {
    const sku = clean(product.sku || product.stockCode);
    const bmt = WALL_FRAMING_BMT_BY_SKU[sku];
    if (!bmt || !/\b(?:STUD|TRACK)\b/i.test(base)) return base;
    if (canonical(base).includes(canonical(bmt))) return base;
    return `${base} ${bmt}`;
  }

  function productDisplayName(product = {}) {
    const rawBase = clean(product.label || product.description || product.descriptionRaw || product.name || product.sku);
    const base = withWallFramingBmt(rawBase, product);
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
