(() => {
  const previousRenderer = window.renderUnifiedFloorSheet;
  if (typeof previousRenderer !== "function" || previousRenderer.__boardWidthDescending) return;

  const reorderedRenderer = function renderUnifiedFloorSheetWithWideBoardsFirst(floor, ...args) {
    const result = previousRenderer.call(this, floor, ...args);
    reorderBoardWidthColumns(floor);
    return result;
  };

  reorderedRenderer.__boardWidthDescending = true;
  window.renderUnifiedFloorSheet = reorderedRenderer;

  function reorderBoardWidthColumns(floor) {
    const root = document.getElementById(`${floor}OrderSheet`);
    const table = root?.querySelector(".unified-board-table");
    if (!(table instanceof HTMLTableElement) || !table.tHead || !table.tBodies.length) return;

    const headerRows = table.tHead.rows;
    if (headerRows.length < 3) return;

    const thicknessRow = headerRows[1];
    const widthRow = headerRows[2];
    const bodyRows = [...table.tBodies[0].rows];
    const originalWidths = [...widthRow.cells].map((cell) => String(cell.textContent || "").trim());

    const order = [0];
    let columnIndex = 1;

    [...thicknessRow.cells].slice(1).forEach((thicknessCell) => {
      const span = Math.max(1, Number(thicknessCell.colSpan || 1));
      const indexes = Array.from({ length: span }, (_, offset) => columnIndex + offset);

      indexes.sort((left, right) => {
        const leftWidth = Number(originalWidths[left].replace(/[^0-9.]/g, ""));
        const rightWidth = Number(originalWidths[right].replace(/[^0-9.]/g, ""));
        if (!Number.isFinite(leftWidth) || !Number.isFinite(rightWidth)) return left - right;
        return rightWidth - leftWidth || left - right;
      });

      order.push(...indexes);
      columnIndex += span;
    });

    if (order.length !== widthRow.cells.length) return;

    [widthRow, ...bodyRows].forEach((row) => {
      const cells = [...row.cells];
      order.forEach((sourceIndex) => {
        if (cells[sourceIndex]) row.append(cells[sourceIndex]);
      });
    });
  }
})();
