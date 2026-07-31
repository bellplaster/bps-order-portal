(() => {
  if (window.__bpsBoardAreaSummaryStarted) return;
  window.__bpsBoardAreaSummaryStarted = true;

  function normalise(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function ownText(element) {
    return [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function markSummaryRow(table) {
    if (!(table instanceof HTMLTableElement)) return;
    const rows = [...table.rows];
    const row = rows.find((candidate) => {
      const first = candidate.cells?.[0];
      const text = normalise(first?.textContent);
      return text === "m²" || text === "m2";
    });
    if (!row) return;

    row.classList.add("board-area-summary-row");
    row.setAttribute("aria-label", "Calculated board area summary");

    [...row.cells].forEach((cell, index) => {
      cell.classList.add(index === 0 ? "board-area-summary-label" : "board-area-summary-value");
      cell.setAttribute("aria-readonly", "true");
      cell.querySelectorAll("input,button,select,textarea").forEach((control) => {
        control.tabIndex = -1;
        if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) control.readOnly = true;
      });
    });
  }

  function markTotalSummary(section) {
    const candidates = [...section.querySelectorAll("*")].filter((element) => {
      const text = normalise(ownText(element));
      return text === "total m²" || text === "total m2";
    });

    candidates.forEach((label) => {
      label.classList.add("board-area-total-label");
      const parent = label.parentElement;
      if (!parent) return;
      parent.classList.add("board-area-total-summary");
      const siblings = [...parent.children].filter((child) => child !== label);
      const value = siblings.find((child) => /^[-+]?\d[\d,.]*$/.test(String(child.textContent || "").trim())) || siblings.at(-1);
      value?.classList.add("board-area-total-value");
    });
  }

  function scan(root = document) {
    root.querySelectorAll?.(".unified-board-table").forEach(markSummaryRow);
    root.querySelectorAll?.(".unified-board-section").forEach(markTotalSummary);
  }

  function scheduleScan() {
    window.requestAnimationFrame(() => scan());
  }

  const style = document.createElement("style");
  style.id = "board-area-summary-styles";
  style.textContent = `
    .unified-board-table .board-area-summary-row > *{
      height:30px!important;
      min-height:30px!important;
      padding:0 6px!important;
      vertical-align:middle!important;
      text-align:center!important;
      background:#eef3f1!important;
      color:#40504b!important;
      border-top:1px solid #bcc8c4!important;
      border-bottom:1px solid #d7dfdc!important;
      font-size:11px!important;
      font-weight:600!important;
      line-height:30px!important;
      cursor:default!important;
      user-select:text!important;
    }
    .unified-board-table .board-area-summary-row > .board-area-summary-label{
      padding-left:8px!important;
      text-align:left!important;
      color:#34423e!important;
      font-weight:700!important;
    }
    .unified-board-table .board-area-summary-row input,
    .unified-board-table .board-area-summary-row button,
    .unified-board-table .board-area-summary-row select,
    .unified-board-table .board-area-summary-row textarea{
      pointer-events:none!important;
      border:0!important;
      outline:0!important;
      box-shadow:none!important;
      background:transparent!important;
      color:inherit!important;
      text-align:center!important;
    }
    .unified-board-section .board-area-total-summary{
      display:grid!important;
      grid-template-columns:auto minmax(44px,auto)!important;
      align-items:center!important;
      justify-content:end!important;
      min-height:30px!important;
      margin:0!important;
      padding:0!important;
      background:#e5ece9!important;
      border-top:1px solid #bcc8c4!important;
      border-bottom:1px solid #d7dfdc!important;
      color:#34423e!important;
    }
    .unified-board-section .board-area-total-label,
    .unified-board-section .board-area-total-value{
      display:flex!important;
      height:30px!important;
      align-items:center!important;
      justify-content:center!important;
      margin:0!important;
      padding:0 8px!important;
      box-sizing:border-box!important;
      font-size:11px!important;
      line-height:1!important;
      white-space:nowrap!important;
    }
    .unified-board-section .board-area-total-label{
      font-weight:700!important;
    }
    .unified-board-section .board-area-total-value{
      min-width:44px!important;
      border-left:1px solid #c7d1ce!important;
      font-weight:700!important;
      font-variant-numeric:tabular-nums!important;
      text-align:center!important;
    }
  `;
  document.head.append(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan, { once: true });
  else scan();

  document.addEventListener("input", (event) => {
    if (event.target.closest?.(".unified-board-table")) scheduleScan();
  });

  const products = document.querySelector(".products-area");
  if (products) {
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => [...mutation.addedNodes].some((node) => node instanceof Element && (node.matches?.(".unified-board-table,.unified-board-section") || node.querySelector?.(".unified-board-table,.unified-board-section"))))) {
        scheduleScan();
      }
    });
    observer.observe(products, { childList: true, subtree: true });
  }
})();