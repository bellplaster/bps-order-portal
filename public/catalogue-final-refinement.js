(() => {
  const previousRenderer = window.renderUnifiedFloorSheet;
  if (typeof previousRenderer !== "function" || previousRenderer.__catalogueFinalRefinement) return;

  const refinedRenderer = function renderCatalogueFinalRefinement(floor, ...args) {
    const result = previousRenderer.call(this, floor, ...args);
    refineFasteners(floor);
    mergeAcousticWeights(floor);
    removeEmptyRondo6100(floor);
    return result;
  };

  refinedRenderer.__catalogueFinalRefinement = true;
  window.renderUnifiedFloorSheet = refinedRenderer;

  function getRoot(floor) {
    return document.getElementById(`${floor}OrderSheet`);
  }

  function refineFasteners(floor) {
    const table = getRoot(floor)?.querySelector(".fasteners-table");
    if (!table) return;

    const rows = [...table.querySelectorAll("tbody > tr")];
    rows.forEach((row) => {
      const firstText = normalise(row.cells[0]?.textContent);
      if (firstText === "SCREWS") {
        row.remove();
        return;
      }
      if (firstText === "LOOSE") setMatrixHeader(row, "Loose Screws", ["25 mm", "32 mm"]);
      if (firstText === "COLLATED") setMatrixHeader(row, "Collated Screws", ["25 mm", "32 mm"]);
    });

    const nailHeader = [...table.querySelectorAll("tbody > tr")]
      .find((row) => normalise(row.cells[0]?.textContent) === "NAILS");
    if (nailHeader) setMatrixHeader(nailHeader, "Nails", ["30 mm", "40 mm"]);
  }

  function setMatrixHeader(row, title, columns) {
    row.replaceChildren();
    row.className = "lower-subheader lower-matrix-header";
    [title, ...columns].forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      row.append(th);
    });
  }

  function mergeAcousticWeights(floor) {
    const table = getRoot(floor)?.querySelector(".acoustics-table");
    if (!table) return;

    const rows = [...table.querySelectorAll("tbody > tr:not(.lower-subheader)")];
    for (let index = 0; index < rows.length;) {
      const firstCell = rows[index].querySelector(":scope > th:first-child");
      if (!firstCell) {
        index += 1;
        continue;
      }

      const weight = normalise(firstCell.textContent);
      let end = index + 1;
      while (end < rows.length) {
        const nextCell = rows[end].querySelector(":scope > th:first-child");
        if (!nextCell || normalise(nextCell.textContent) !== weight) break;
        end += 1;
      }

      const span = end - index;
      if (span > 1) {
        firstCell.rowSpan = span;
        firstCell.classList.add("acoustic-weight-cell");
        for (let rowIndex = index + 1; rowIndex < end; rowIndex += 1) {
          rows[rowIndex].querySelector(":scope > th:first-child")?.remove();
        }
      }
      index = end;
    }
  }

  function removeEmptyRondo6100(floor) {
    const table = getRoot(floor)?.querySelector(".rondo-table");
    if (!table) return;

    const header = [...table.querySelectorAll("tbody > tr")]
      .find((row) => [...row.cells].some((cell) => normalise(cell.textContent) === "6100"));
    if (!header) return;

    const columnIndex = [...header.cells].findIndex((cell) => normalise(cell.textContent) === "6100");
    if (columnIndex < 0) return;

    table.querySelectorAll("tbody > tr").forEach((row) => row.cells[columnIndex]?.remove());
    table.querySelector(`colgroup col:nth-child(${columnIndex + 1})`)?.remove();
  }

  function normalise(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
  }
})();
