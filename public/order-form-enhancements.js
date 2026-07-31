(() => {
  const BOARD_TABLE_SELECTOR = ".unified-board-table";
  const RONDO_OLD_LABEL = /^Battens\s+Nail\s+Up$/i;
  const RONDO_NEW_LABEL = "301 Nail Up Batten";
  let updateFrame = 0;
  let renderCountsAttempts = 0;

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
    if (!widthRow || widthRow.cells.length < 3) return;

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
    if (!totalRow || totalRow.cells.length !== 3) {
      totalRow?.remove();
      totalRow = document.createElement("tr");
      totalRow.className = "board-area-total-row";

      const spacer = document.createElement("td");
      spacer.className = "board-area-total-spacer";

      const label = document.createElement("th");
      label.scope = "row";
      label.className = "board-area-total-label";
      label.textContent = "Total m²";

      const value = document.createElement("td");
      value.className = "board-area-total-value";
      value.textContent = "0";

      totalRow.append(spacer, label, value);
      tfoot.append(totalRow);
    }

    const spacer = totalRow.querySelector(".board-area-total-spacer");
    if (spacer) spacer.colSpan = Math.max(1, widthRow.cells.length - 2);

    updateBoardSummary(table);
  }

  function updateBoardSummary(table) {
    if (!(table instanceof HTMLTableElement) || !table.tHead || !table.tBodies.length) return;
    const math = globalThis.BpsBoardAreaMath;
    if (!math) throw new Error("Board area calculation module is not loaded.");

    const widthRow = table.tHead.rows[2];
    const tbody = table.tBodies[0];
    const summaryRow = tbody.querySelector(":scope > .board-area-summary-row");
    const totalValue = table.tFoot?.querySelector(".board-area-total-value");
    if (!widthRow || !summaryRow || !totalValue) return;

    const productRows = [...tbody.rows].filter((row) => {
      if (row.classList.contains("board-area-summary-row")) return false;
      return numericText(row.cells[0]?.textContent) >= 1000;
    });

    const widthsMm = [...widthRow.cells].slice(1).map((cell) => numericText(cell.textContent));
    const rows = productRows.map((row) => ({
      lengthMm: numericText(row.cells[0]?.textContent),
      quantities: [...widthRow.cells].slice(1).map((_cell, columnOffset) => {
        const input = row.cells[columnOffset + 1]?.querySelector(".quantity-input");
        return input?.value || 0;
      }),
    }));

    const result = math.calculateBoardSummary(widthsMm, rows);
    result.columnTotals.forEach((columnTotal, columnOffset) => {
      const next = math.formatArea(columnTotal);
      setMetricValue(summaryRow.cells[columnOffset + 1], next, `${next} square metres`);
    });

    const nextTotal = math.formatArea(result.grandTotal);
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
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === "childList")) scheduleBoardUpdate();
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function installStyles() {
    let style = document.getElementById("order-form-enhancement-styles");
    if (!style) {
      style = document.createElement("style");
      style.id = "order-form-enhancement-styles";
      document.head.append(style);
    }
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
        padding: 0 2px !important;
        line-height: 26px !important;
        vertical-align: middle !important;
      }
      .unified-board-table .board-area-summary-row > th,
      .unified-board-table .board-area-summary-row > td {
        background: #eef3f1 !important;
        border-top: 1px solid #bcc8c4 !important;
        border-bottom: 1px solid #d7dfdc !important;
        font-weight: 600 !important;
      }
      .unified-board-table .board-area-summary-label {
        padding-left: 5px !important;
        text-align: left !important;
        white-space: nowrap !important;
        font-size: 11px !important;
      }
      .unified-board-table .board-area-summary-value {
        min-width: 0 !important;
        padding-inline: 1px !important;
        color: #40504b !important;
        font-size: var(--board-metric-font-size, 11px) !important;
        font-variant-numeric: tabular-nums !important;
        letter-spacing: -0.01em !important;
        text-align: center !important;
        white-space: nowrap !important;
        overflow: hidden !important;
      }
      .unified-board-table tfoot {
        border-top: 0 !important;
      }
      .unified-board-table .board-area-total-row > td,
      .unified-board-table .board-area-total-row > th {
        background: #eef3f1 !important;
        border-bottom: 1px solid #d7dfdc !important;
        font-weight: 700 !important;
      }
      .unified-board-table .board-area-total-spacer {
        padding: 0 !important;
      }
      .unified-board-table .board-area-total-label {
        text-align: center !important;
        white-space: nowrap !important;
        font-size: 11px !important;
      }
      .unified-board-table .board-area-total-value {
        min-width: 0 !important;
        padding-inline: 1px !important;
        color: var(--bell-green, #006557) !important;
        font-size: var(--board-metric-font-size, 11px) !important;
        font-variant-numeric: tabular-nums !important;
        letter-spacing: -0.01em !important;
        text-align: center !important;
        white-space: nowrap !important;
        overflow: hidden !important;
      }
    `;
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