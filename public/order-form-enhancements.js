(() => {
  const BOARD_TABLE_SELECTOR = ".unified-board-table";
  const RONDO_OLD_LABEL = /^Battens\s+Nail\s+Up$/i;
  const RONDO_NEW_LABEL = "301 Nail Up Batten";
  let updateFrame = 0;
  let renderCountsAttempts = 0;

  function formatArea(value) {
    const rounded = Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
    return rounded.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }

  function metricFontSize(value) {
    const length = String(value ?? "").length;
    if (length >= 14) return "7px";
    if (length >= 12) return "8px";
    if (length >= 10) return "9px";
    if (length >= 8) return "10px";
    return "11px";
  }

  function setMetricValue(cell, value, ariaLabel) {
    if (!cell) return;
    const text = String(value ?? "0");
    if (cell.textContent !== text) cell.textContent = text;
    cell.style.setProperty("--board-metric-font-size", metricFontSize(text));
    cell.setAttribute("aria-label", ariaLabel);
    cell.title = text;
  }

  function numericText(value) {
    const match = String(value || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function ensureBoardSummary(table) {
    if (!(table instanceof HTMLTableElement) || !table.tHead || !table.tBodies.length) return;
    const widthRow = table.tHead.rows[2];
    if (!widthRow || widthRow.cells.length < 2) return;

    const tbody = table.tBodies[0];
    let summaryRow = tbody.querySelector(":scope > .board-area-summary-row");
    if (!summaryRow || summaryRow.cells.length !== widthRow.cells.length) {
      summaryRow?.remove();
      summaryRow = document.createElement("tr");
      summaryRow.className = "board-area-summary-row";

      const label = document.createElement("th");
      label.scope = "row";
      label.className = "board-row-heading board-area-summary-label";
      label.textContent = "m²";
      summaryRow.append(label);

      for (let index = 1; index < widthRow.cells.length; index += 1) {
        const cell = document.createElement("td");
        cell.className = "board-area-summary-value";
        cell.textContent = "0";
        summaryRow.append(cell);
      }
      tbody.append(summaryRow);
    }

    let tfoot = table.tFoot;
    if (!tfoot) tfoot = table.createTFoot();
    let totalRow = tfoot.querySelector(":scope > .board-area-total-row");
    if (!totalRow) {
      totalRow = document.createElement("tr");
      totalRow.className = "board-area-total-row";
      const label = document.createElement("th");
      label.className = "board-area-total-label";
      label.colSpan = Math.max(1, widthRow.cells.length - 1);
      label.textContent = "Total m²";
      const value = document.createElement("td");
      value.className = "board-area-total-value";
      value.textContent = "0";
      totalRow.append(label, value);
      tfoot.append(totalRow);
    } else {
      totalRow.querySelector(".board-area-total-label")?.setAttribute("colspan", String(Math.max(1, widthRow.cells.length - 1)));
    }

    updateBoardSummary(table);
  }

  function updateBoardSummary(table) {
    if (!(table instanceof HTMLTableElement) || !table.tHead || !table.tBodies.length) return;
    const widthRow = table.tHead.rows[2];
    const tbody = table.tBodies[0];
    const summaryRow = tbody.querySelector(":scope > .board-area-summary-row");
    const totalValue = table.tFoot?.querySelector(".board-area-total-value");
    if (!widthRow || !summaryRow || !totalValue) return;

    const productRows = [...tbody.rows].filter((row) => {
      if (row.classList.contains("board-area-summary-row")) return false;
      const length = numericText(row.cells[0]?.textContent);
      return length >= 1000;
    });

    let grandTotal = 0;
    for (let columnIndex = 1; columnIndex < widthRow.cells.length; columnIndex += 1) {
      const widthMm = numericText(widthRow.cells[columnIndex]?.textContent);
      let columnTotal = 0;

      productRows.forEach((row) => {
        const lengthMm = numericText(row.cells[0]?.textContent);
        const input = row.cells[columnIndex]?.querySelector(".quantity-input");
        const quantity = Number(input?.value || 0);
        if (!widthMm || !lengthMm || !quantity) return;
        columnTotal += (widthMm * lengthMm * quantity) / 1_000_000;
      });

      grandTotal += columnTotal;
      const next = formatArea(columnTotal);
      setMetricValue(summaryRow.cells[columnIndex], next, `${next} square metres`);
    }

    const nextTotal = formatArea(grandTotal);
    setMetricValue(totalValue, nextTotal, `${nextTotal} total square metres`);
  }

  function updateAllBoardSummaries() {
    document.querySelectorAll(BOARD_TABLE_SELECTOR).forEach(ensureBoardSummary);
  }

  function scheduleBoardUpdate() {
    if (updateFrame) return;
    updateFrame = window.requestAnimationFrame(() => {
      updateFrame = 0;
      patchRondoSource();
      renameRenderedRondoRows();
      updateAllBoardSummaries();
    });
  }

  function patchRenderCounts() {
    renderCountsAttempts += 1;
    try {
      const current = typeof renderCounts === "function" ? renderCounts : window.renderCounts;
      if (typeof current === "function" && !current.__boardAreaSummary) {
        const wrapped = function renderCountsWithBoardArea(...args) {
          const result = current.apply(this, args);
          scheduleBoardUpdate();
          return result;
        };
        wrapped.__boardAreaSummary = true;
        window.renderCounts = wrapped;
        try { renderCounts = wrapped; } catch (_error) { }
      }
    } catch (_error) { }

    if (renderCountsAttempts < 30) window.setTimeout(patchRenderCounts, 200);
  }

  function patchRondoSource() {
    try {
      if (typeof state === "undefined") return;
      const rows = state.layout?.sections?.rondo?.rows;
      if (Array.isArray(rows)) {
        rows.forEach((row) => {
          if (RONDO_OLD_LABEL.test(String(row?.label || "").trim())) row.label = RONDO_NEW_LABEL;
        });
      }

      const product = state.catalog?.pdf_rondo_battens_nail_up_6000;
      if (product) {
        product.label = `${RONDO_NEW_LABEL} - 6000 mm`;
        product.description = "301 NAIL UP BATTEN - 6000 MM";
      }
    } catch (_error) { }
  }

  function renameRenderedRondoRows() {
    document.querySelectorAll(".rondo-table th").forEach((cell) => {
      if (RONDO_OLD_LABEL.test(String(cell.textContent || "").trim())) cell.textContent = RONDO_NEW_LABEL;
    });
  }

  function installListeners() {
    document.addEventListener("input", (event) => {
      if (event.target.matches(`${BOARD_TABLE_SELECTOR} .quantity-input`)) scheduleBoardUpdate();
    }, true);
    document.addEventListener("change", (event) => {
      if (event.target.matches(`${BOARD_TABLE_SELECTOR} .quantity-input`)) scheduleBoardUpdate();
    }, true);
  }

  function installObserver() {
    const root = document.querySelector(".products-area") || document.body;
    const observer = new MutationObserver(scheduleBoardUpdate);
    observer.observe(root, { childList: true, subtree: true });
  }

  function installStyles() {
    if (document.getElementById("order-form-enhancement-styles")) return;
    const style = document.createElement("style");
    style.id = "order-form-enhancement-styles";
    style.textContent = `
      .unified-board-table .board-area-summary-row,
      .unified-board-table .board-area-total-row {
        height: 26px !important;
      }
      .unified-board-table .board-area-summary-row > th,
      .unified-board-table .board-area-summary-row > td,
      .unified-board-table .board-area-total-row > th,
      .unified-board-table .board-area-total-row > td {
        box-sizing: border-box !important;
        height: 26px !important;
        min-height: 26px !important;
        max-height: 26px !important;
        padding: 1px 2px !important;
        line-height: 24px !important;
        vertical-align: middle !important;
      }
      .unified-board-table .board-area-summary-row > th,
      .unified-board-table .board-area-summary-row > td {
        background: #f7f9f8;
        font-weight: 600;
      }
      .unified-board-table .board-area-summary-label {
        padding-left: 5px !important;
        text-align: left;
        white-space: nowrap;
        font-size: 11px !important;
      }
      .unified-board-table .board-area-summary-value {
        min-width: 0 !important;
        padding-inline: 1px !important;
        color: #17211f;
        font-size: var(--board-metric-font-size, 11px) !important;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.01em;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
      }
      .unified-board-table tfoot {
        border-top: 1px solid var(--line);
      }
      .unified-board-table .board-area-total-row > th,
      .unified-board-table .board-area-total-row > td {
        background: #eef2f0;
        font-weight: 700;
      }
      .unified-board-table .board-area-total-label {
        padding-right: 5px !important;
        text-align: right;
        white-space: nowrap;
        font-size: 11px !important;
      }
      .unified-board-table .board-area-total-value {
        min-width: 0 !important;
        padding-inline: 2px !important;
        color: var(--bell-green, #006557);
        font-size: var(--board-metric-font-size, 11px) !important;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.01em;
        text-align: right;
        white-space: nowrap;
        overflow: hidden;
      }
    `;
    document.head.append(style);
  }

  function initialise() {
    installStyles();
    installListeners();
    installObserver();
    patchRenderCounts();
    patchRondoSource();
    renameRenderedRondoRows();
    updateAllBoardSummaries();

    [0, 100, 300, 700, 1500, 3000].forEach((delay) => {
      window.setTimeout(() => {
        patchRondoSource();
        renameRenderedRondoRows();
        updateAllBoardSummaries();
      }, delay);
    });

    window.addEventListener("pageshow", scheduleBoardUpdate);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();