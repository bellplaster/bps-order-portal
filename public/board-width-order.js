(() => {
  let installAttempts = 0;
  let observerStarted = false;

  function installRendererWrapper() {
    const previousRenderer = window.renderUnifiedFloorSheet;

    if (typeof previousRenderer !== "function") {
      installAttempts += 1;
      if (installAttempts < 100) window.setTimeout(installRendererWrapper, 50);
      return;
    }

    if (!previousRenderer.__boardWidthDescending) {
      const reorderedRenderer = function renderUnifiedFloorSheetWithWideBoardsFirst(floor, ...args) {
        const result = previousRenderer.call(this, floor, ...args);
        reorderBoardWidthColumns(floor);
        return result;
      };

      reorderedRenderer.__boardWidthDescending = true;
      window.renderUnifiedFloorSheet = reorderedRenderer;
    }

    reorderAllBoardMatrices();
    startBoardMatrixObserver();
  }

  function startBoardMatrixObserver() {
    if (observerStarted || !document.body) return;
    observerStarted = true;

    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        reorderAllBoardMatrices();
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function reorderAllBoardMatrices() {
    document.querySelectorAll(".unified-board-table").forEach((table) => {
      reorderBoardWidthColumnsFromTable(table);
    });
  }

  function reorderBoardWidthColumns(floor) {
    const root = document.getElementById(`${floor}OrderSheet`);
    const table = root?.querySelector(".unified-board-table");
    reorderBoardWidthColumnsFromTable(table);
  }

  function reorderBoardWidthColumnsFromTable(table) {
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
    if (order.every((sourceIndex, targetIndex) => sourceIndex === targetIndex)) return;

    [widthRow, ...bodyRows].forEach((row) => {
      const cells = [...row.cells];
      order.forEach((sourceIndex) => {
        if (cells[sourceIndex]) row.append(cells[sourceIndex]);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installRendererWrapper, { once: true });
  } else {
    installRendererWrapper();
  }
})();