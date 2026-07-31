(() => {
  function numeric(value) {
    const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatArea(value) {
    const rounded = Math.round((numeric(value) + Number.EPSILON) * 100) / 100;
    return rounded.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }

  function calculateBoardColumnArea(widthMm, rows) {
    const width = numeric(widthMm);
    if (width <= 0 || !Array.isArray(rows)) return 0;

    return rows.reduce((total, row) => {
      const length = numeric(row?.lengthMm);
      const quantity = numeric(row?.quantity);
      if (length <= 0 || quantity <= 0) return total;
      return total + ((width * length * quantity) / 1_000_000);
    }, 0);
  }

  function calculateBoardSummary(widthsMm, rows) {
    const widths = Array.isArray(widthsMm) ? widthsMm : [];
    const sourceRows = Array.isArray(rows) ? rows : [];
    const columnTotals = widths.map((widthMm, columnIndex) => calculateBoardColumnArea(
      widthMm,
      sourceRows.map((row) => ({
        lengthMm: row?.lengthMm,
        quantity: Array.isArray(row?.quantities) ? row.quantities[columnIndex] : 0,
      })),
    ));

    return {
      columnTotals,
      grandTotal: columnTotals.reduce((total, value) => total + value, 0),
    };
  }

  globalThis.BpsBoardAreaMath = Object.freeze({
    numeric,
    formatArea,
    calculateBoardColumnArea,
    calculateBoardSummary,
  });
})();