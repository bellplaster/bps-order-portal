(() => {
  buildFloorPayload = function buildSourceTruthFloorPayload(floor) {
    const totals = new Map();
    [...state.quantities[floor].entries()]
      .filter(([, quantity]) => quantity > 0)
      .forEach(([key, quantity]) => {
        const product = state.catalog[key];
        const sku = String(product?.sku || "").trim();
        if (sku && sku !== "__UNAVAILABLE__") totals.set(sku, (totals.get(sku) || 0) + quantity);
      });
    (state.otherMaterials[floor] || [])
      .filter((item) => item.quantity > 0)
      .forEach((item) => totals.set(item.sku, (totals.get(item.sku) || 0) + item.quantity));
    return {
      items: [],
      otherMaterials: [...totals.entries()].map(([sku, quantity]) => ({ sku, quantity })),
    };
  };

  const originalApplyPayload = applyPayload;
  applyPayload = function applySourceTruthPayload(payload) {
    const next = typeof structuredClone === "function"
      ? structuredClone(payload)
      : JSON.parse(JSON.stringify(payload || {}));
    Object.values(next.floors || {}).forEach((area) => {
      const restoredItems = [];
      const remainingAdditional = [];
      (area.otherMaterials || []).forEach((item) => {
        const match = Object.entries(state.catalog || {}).find(([, product]) =>
          String(product?.sku || "").toUpperCase() === String(item?.sku || "").toUpperCase()
        );
        if (match) restoredItems.push({ key: match[0], quantity: Number(item.quantity || 0) });
        else remainingAdditional.push(item);
      });
      area.items = [...(area.items || []), ...restoredItems];
      area.otherMaterials = remainingAdditional;
    });
    return originalApplyPayload(next);
  };

  const previousRenderer = window.renderUnifiedFloorSheet;
  window.renderUnifiedFloorSheet = function renderSourceTruthOrder(floor, ...args) {
    const result = previousRenderer.call(this, floor, ...args);
    const body = document.querySelector(`#${CSS.escape(floor)}OrderSheet .partiwall-table tbody`);
    if (body) {
      const labels = [
        "Aluminium Clips Angled (each)",
        "Aluminium Clips Flat (each)",
        "50mm Partiwall Batt (3 Pack)",
        "16mm Small Head DP",
        "25mm Coarse NP",
        "32mm Coarse NP",
        "38mm Laminating",
      ];
      const rows = [...body.querySelectorAll("tr")];
      labels.forEach((label) => {
        const row = rows.find((candidate) => candidate.textContent.includes(label));
        if (row) body.append(row);
      });
    }
    return result;
  };
})();