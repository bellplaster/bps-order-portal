(() => {
  if (window.__bpsStudsBmtTabs20260807) return;
  window.__bpsStudsBmtTabs20260807 = true;

  const LENGTHS = ["3000", "3600", "4200", "4800", "6000"];
  const TABS = Object.freeze([
    { key: "0.50", label: "0.50 BMT" },
    { key: "0.55", label: "0.55 BMT" },
    { key: "0.75", label: "0.75 BMT" },
    { key: "1.15", label: "1.15 BMT" },
  ]);

  function normalise(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
  }

  function rowLabel(row) {
    return String(row?.querySelector("th")?.textContent || row?.children?.[0]?.textContent || "").trim();
  }

  function sectionTitle(section) {
    return normalise(section?.querySelector(".rondo-expanded-title, .lower-category-title, h3")?.textContent);
  }

  function findSection(title) {
    const target = normalise(title);
    return [...document.querySelectorAll(".rondo-expanded-group, .lower-catalogue-section")]
      .find((section) => sectionTitle(section) === target);
  }

  function matrixFromTable(table) {
    if (!(table instanceof HTMLTableElement)) return null;
    const header = table.querySelector("tr.lower-matrix-header, thead tr, tbody tr");
    if (!header) return null;
    const columns = [...header.children].slice(1).map((cell) => String(cell.textContent || "").trim());
    const rows = [...table.rows].slice(1)
      .filter((row) => !row.classList.contains("lower-group-heading") && !row.classList.contains("lower-matrix-header"))
      .map((row) => ({ label: rowLabel(row), cells: [...row.children].slice(1) }));
    return { columns, rows };
  }

  function collectStudMatrices() {
    const standard = findSection("RONDO WALL FRAMING");
    const medium = findSection("RONDO MEDIUM GAUGE STUDS — 0.75 BMT");
    const heavy = findSection("RONDO HEAVY-DUTY WALL FRAMING");
    if (!standard || !medium || !heavy) return null;

    const standardMatrix = matrixFromTable(standard.querySelector("table"));
    const mediumTables = [...medium.querySelectorAll("table")];
    const heavyTables = [...heavy.querySelectorAll("table")];
    const mediumMatrices = mediumTables.slice(0, 2).map(matrixFromTable).filter(Boolean);
    const heavyMatrices = heavyTables.slice(0, 2).map(matrixFromTable).filter(Boolean);
    if (!standardMatrix || !mediumMatrices.length || !heavyMatrices.length) return null;

    const records = [];
    standardMatrix.rows.forEach((row) => {
      const match = row.label.match(/^(\d+)\s*mm\s+Stud\s+(0\.50|0\.55)\s+BMT$/i);
      if (!match) return;
      records.push({ bmt: match[2], label: `${match[1]} mm Stud`, columns: standardMatrix.columns, cells: row.cells });
    });
    mediumMatrices.forEach((matrix) => matrix.rows.forEach((row) => {
      if (!/^\d+\s*mm\s+Stud$/i.test(row.label)) return;
      records.push({ bmt: "0.75", label: row.label, columns: matrix.columns, cells: row.cells });
    }));
    heavyMatrices.forEach((matrix) => matrix.rows.forEach((row) => {
      const match = row.label.match(/^(\d+)\s*mm\s+Stud\s+1\.15\s+BMT$/i);
      if (!match) return;
      records.push({ bmt: "1.15", label: `${match[1]} mm Stud`, columns: matrix.columns, cells: row.cells });
    }));

    return { standard, medium, heavy, records };
  }

  function cloneCell(cell) {
    if (!cell) return document.createElement("td");
    const clone = cell.cloneNode(true);
    clone.removeAttribute("id");
    return clone;
  }

  function buildMatrix(records, bmt) {
    const rowsByLabel = new Map();
    records.filter((record) => record.bmt === bmt).forEach((record) => {
      if (!rowsByLabel.has(record.label)) rowsByLabel.set(record.label, new Map());
      const map = rowsByLabel.get(record.label);
      record.columns.forEach((column, index) => {
        if (!map.has(column)) map.set(column, record.cells[index]);
      });
    });

    const table = document.createElement("table");
    table.className = "lower-catalogue-table studs-bmt-table";
    const colgroup = document.createElement("colgroup");
    [36, 12.8, 12.8, 12.8, 12.8, 12.8].forEach((width) => {
      const col = document.createElement("col");
      col.style.width = `${width}%`;
      colgroup.append(col);
    });
    table.append(colgroup);

    const tbody = document.createElement("tbody");
    const header = document.createElement("tr");
    header.className = "lower-subheader lower-matrix-header";
    ["Product", ...LENGTHS].forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      header.append(th);
    });
    tbody.append(header);

    rowsByLabel.forEach((cellMap, label) => {
      const row = document.createElement("tr");
      const name = document.createElement("th");
      name.scope = "row";
      name.textContent = label;
      row.append(name);
      LENGTHS.forEach((length) => row.append(cloneCell(cellMap.get(length))));
      tbody.append(row);
    });

    table.append(tbody);
    return table;
  }

  function activate(section, key) {
    section.dataset.activeBmt = key;
    section.querySelectorAll(".studs-bmt-tab").forEach((button) => {
      const active = button.dataset.bmt === key;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    });
    section.querySelectorAll(".studs-bmt-panel").forEach((panel) => {
      const active = panel.dataset.bmt === key;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
  }

  function buildSection(records) {
    const section = document.createElement("section");
    section.className = "lower-catalogue-section studs-bmt-section";

    const heading = document.createElement("h3");
    heading.className = "lower-category-title";
    heading.textContent = "STUDS";

    const tabs = document.createElement("div");
    tabs.className = "studs-bmt-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Stud thickness");

    const content = document.createElement("div");
    content.className = "studs-bmt-content";

    TABS.forEach((tab, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "studs-bmt-tab";
      button.textContent = tab.label;
      button.dataset.bmt = tab.key;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", index === 0 ? "true" : "false");
      button.tabIndex = index === 0 ? 0 : -1;
      if (index === 0) button.classList.add("is-active");
      tabs.append(button);

      const panel = document.createElement("div");
      panel.className = "studs-bmt-panel";
      panel.dataset.bmt = tab.key;
      panel.setAttribute("role", "tabpanel");
      panel.hidden = index !== 0;
      if (index === 0) panel.classList.add("is-active");
      panel.append(buildMatrix(records, tab.key));
      content.append(panel);
    });

    tabs.addEventListener("click", (event) => {
      const button = event.target.closest(".studs-bmt-tab");
      if (button) activate(section, button.dataset.bmt);
    });
    tabs.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...tabs.querySelectorAll(".studs-bmt-tab")];
      const current = Math.max(0, buttons.indexOf(document.activeElement));
      let next = current;
      if (event.key === "ArrowRight") next = (current + 1) % buttons.length;
      if (event.key === "ArrowLeft") next = (current - 1 + buttons.length) % buttons.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = buttons.length - 1;
      buttons[next].focus();
      activate(section, buttons[next].dataset.bmt);
    });

    section.append(heading, tabs, content);
    return section;
  }

  function apply() {
    const collected = collectStudMatrices();
    if (!collected) return false;
    document.querySelectorAll(".studs-bmt-section").forEach((section) => section.remove());

    const newSection = buildSection(collected.records);
    collected.standard.parentElement?.insertBefore(newSection, collected.standard);

    [collected.standard, collected.medium, collected.heavy].forEach((section) => {
      [...section.querySelectorAll("table")].slice(0, 2).forEach((table) => table.remove());
      if (!section.querySelector("table")) section.remove();
    });
    return true;
  }

  const previousRenderer = window.renderUnifiedFloorSheet;
  if (typeof previousRenderer === "function" && !previousRenderer.__studsBmtTabs20260807) {
    const renderer = function renderWithTabbedStuds(floor, ...args) {
      const result = previousRenderer.call(this, floor, ...args);
      apply();
      return result;
    };
    renderer.__studsBmtTabs20260807 = true;
    window.renderUnifiedFloorSheet = renderer;
  }

  let applyQueued = false;
  function queueApply() {
    if (applyQueued) return;
    applyQueued = true;
    queueMicrotask(() => {
      applyQueued = false;
      apply();
    });
  }

  function observeCatalogueLifecycle() {
    const root = document.querySelector(".floor-panels");
    if (!root || root.dataset.studsBmtObserved === "true") return;
    root.dataset.studsBmtObserved = "true";
    const observer = new MutationObserver((mutations) => {
      const catalogueChanged = mutations.some((mutation) => [...mutation.addedNodes].some((node) =>
        node instanceof Element && (
          node.matches?.(".rondo-expanded-group, .lower-catalogue-section")
          || node.querySelector?.(".rondo-expanded-group, .lower-catalogue-section")
        ),
      ));
      if (catalogueChanged) queueApply();
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function initialise() {
    observeCatalogueLifecycle();
    apply();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();
