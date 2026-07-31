(() => {
  if (window.__bpsBoardAreaSummaryStarted) return;
  window.__bpsBoardAreaSummaryStarted = true;

  function normalise(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function clearObsoleteWrapper(root = document) {
    root.querySelectorAll?.(".board-area-total-summary").forEach((element) => {
      element.classList.remove("board-area-total-summary");
    });
  }

  function markSummaryRow(table) {
    if (!(table instanceof HTMLTableElement) || !table.tBodies.length) return;

    const body = table.tBodies[0];
    const row = [...body.rows].find((candidate) => {
      const first = candidate.cells?.[0];
      const text = normalise(first?.textContent);
      return text === "m²" || text === "m2";
    });
    if (!row) return;

    [...body.rows].forEach((candidate) => {
      if (candidate !== row) candidate.classList.remove("board-area-summary-row");
    });

    row.classList.add("board-area-summary-row");
    row.setAttribute("aria-label", "Calculated board area by product size");

    [...row.cells].forEach((cell, index) => {
      cell.classList.toggle("board-area-summary-label", index === 0);
      cell.classList.toggle("board-area-summary-value", index > 0);
      cell.setAttribute("aria-readonly", "true");
    });
  }

  function scan(root = document) {
    clearObsoleteWrapper(root);
    root.querySelectorAll?.(".unified-board-table").forEach(markSummaryRow);
  }

  function scheduleScan() {
    window.requestAnimationFrame(() => scan());
  }

  const style = document.createElement("style");
  style.id = "board-area-summary-styles";
  style.textContent = `
    .unified-board-table tbody>.board-area-summary-row>*{
      box-sizing:border-box!important;
      height:26px!important;
      min-height:26px!important;
      max-height:26px!important;
      padding:0 2px!important;
      vertical-align:middle!important;
      text-align:center!important;
      background:#eef3f1!important;
      color:#40504b!important;
      border-top:1px solid #bcc8c4!important;
      border-bottom:1px solid #d7dfdc!important;
      font-size:11px!important;
      font-weight:600!important;
      line-height:26px!important;
      cursor:default!important;
    }
    .unified-board-table tbody>.board-area-summary-row>.board-area-summary-label{
      padding-left:5px!important;
      text-align:left!important;
      color:#34423e!important;
      font-weight:700!important;
    }
    .unified-board-table tbody>.board-area-summary-row>.board-area-summary-value{
      font-variant-numeric:tabular-nums!important;
    }
  `;
  document.getElementById(style.id)?.remove();
  document.head.append(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan, { once: true });
  else scan();

  document.addEventListener("input", (event) => {
    if (event.target.closest?.(".unified-board-table")) scheduleScan();
  });

  const products = document.querySelector(".products-area");
  if (products) {
    const observer = new MutationObserver((mutations) => {
      const relevant = mutations.some((mutation) =>
        [...mutation.addedNodes].some((node) =>
          node instanceof Element
          && (node.matches?.(".unified-board-table") || node.querySelector?.(".unified-board-table"))
        )
      );
      if (relevant) scheduleScan();
    });
    observer.observe(products, { childList: true, subtree: true });
  }
})();