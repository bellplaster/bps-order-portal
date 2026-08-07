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
  const STUD_VARIANTS = Object.freeze({
    "0.50": Object.freeze({
      "51 mm Stud": Object.freeze({ "3000": "40103000", "3600": "40103600" }),
      "64 mm Stud": Object.freeze({ "3000": "11203000", "3600": "11203600", "4200": "11204200", "4800": "11204800", "6000": "11206000" }),
    }),
    "0.55": Object.freeze({
      "76 mm Stud": Object.freeze({ "3000": "40303000", "3600": "40303600", "4200": "40304200", "4800": "40304800" }),
      "92 mm Stud": Object.freeze({ "3000": "25103000", "3600": "25103600", "4200": "25104200", "4800": "25104800", "6000": "25106000" }),
    }),
    "0.75": Object.freeze({
      "51 mm Stud": Object.freeze({ "3000": "48903000", "3600": "48903600" }),
      "64 mm Stud": Object.freeze({ "3000": "49103000", "3600": "49103600", "4200": "49104200", "4800": "49104800", "6000": "49106000" }),
      "76 mm Stud": Object.freeze({ "3000": "49303000", "3600": "49303600", "4200": "49304200", "4800": "49304800", "6000": "49306000" }),
      "92 mm Stud": Object.freeze({ "3000": "49503000", "3600": "49503600", "4200": "49504200", "4800": "49504800", "6000": "49506000" }),
      "150 mm Stud": Object.freeze({ "3000": "51103000", "3600": "51103600", "4200": "51104200", "4800": "51104800", "6000": "51106000" }),
    }),
    "1.15": Object.freeze({
      "64 mm Stud": Object.freeze({ "3000": "66103000", "3600": "66103600", "4200": "66104200", "4800": "66104800" }),
      "76 mm Stud": Object.freeze({ "3000": "67103000", "3600": "67103600", "4800": "67104800", "6000": "67106000" }),
      "92 mm Stud": Object.freeze({ "3000": "68103000", "3600": "68103600", "4200": "68104200", "4800": "68104800", "6000": "68106000" }),
      "150 mm Stud": Object.freeze({ "3000": "69103000", "3600": "69103600", "4200": "69104200", "4800": "69104800", "6000": "69106000" }),
    }),
  });

  function normalise(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
  }

  function sectionTitle(section) {
    return normalise(section?.querySelector(".rondo-expanded-title, .lower-category-title, h3")?.textContent);
  }

  function findSection(title) {
    const target = normalise(title);
    return [...document.querySelectorAll(".rondo-expanded-group, .lower-catalogue-section")]
      .find((section) => sectionTitle(section) === target);
  }

  function findCatalogKey(sku) {
    return Object.entries(state?.catalog || {}).find(([, product]) =>
      String(product?.sku || product?.stockCode || "").trim() === sku,
    )?.[0] || "";
  }

  function floorIdFor(section) {
    const sheet = section?.closest?.('[id$="OrderSheet"]');
    return String(sheet?.id || "").replace(/OrderSheet$/, "");
  }

  function unavailableTemplate(sections) {
    const cell = sections.flatMap((section) => [...section.querySelectorAll("td")])
      .find((candidate) => !candidate.querySelector("input"));
    if (!cell) throw new Error("STUDS: unavailable cell template not found");
    const template = cell.cloneNode(false);
    template.removeAttribute("id");
    template.removeAttribute("data-product-key");
    template.removeAttribute("data-key");
    template.textContent = "";
    return template;
  }

  function collectStudSources() {
    const standard = findSection("RONDO WALL FRAMING");
    const medium = findSection("RONDO MEDIUM GAUGE STUDS — 0.75 BMT");
    const heavy = findSection("RONDO HEAVY-DUTY WALL FRAMING");
    if (!standard || !medium || !heavy) return null;
    const floor = floorIdFor(standard);
    if (!floor) return null;
    return {
      standard,
      medium,
      heavy,
      floor,
      unavailableCell: unavailableTemplate([standard, medium, heavy]),
    };
  }

  function createStudCell(floor, sku, unavailableCell) {
    if (!sku) return unavailableCell.cloneNode(false);
    const key = findCatalogKey(sku);
    if (!key) throw new Error(`STUDS: catalogue key missing for SKU ${sku}`);
    if (typeof createQuantityCell !== "function") throw new Error("STUDS: createQuantityCell is unavailable");
    return createQuantityCell(floor, key);
  }

  function buildMatrix(floor, bmt, unavailableCell) {
    const variants = STUD_VARIANTS[bmt];
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

    Object.entries(variants).forEach(([label, skuByLength]) => {
      const row = document.createElement("tr");
      const name = document.createElement("th");
      name.scope = "row";
      name.textContent = label;
      row.append(name);
      LENGTHS.forEach((length) => row.append(createStudCell(floor, skuByLength[length], unavailableCell)));
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

  function buildSection(floor, unavailableCell) {
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
      panel.append(buildMatrix(floor, tab.key, unavailableCell));
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
    const collected = collectStudSources();
    if (!collected) return false;

    const newSection = buildSection(collected.floor, collected.unavailableCell);
    document.querySelectorAll(".studs-bmt-section").forEach((section) => section.remove());
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
    new MutationObserver((mutations) => {
      const catalogueChanged = mutations.some((mutation) => [...mutation.addedNodes].some((node) =>
        node instanceof Element && (
          node.matches?.(".rondo-expanded-group, .lower-catalogue-section")
          || node.querySelector?.(".rondo-expanded-group, .lower-catalogue-section")
        ),
      ));
      if (catalogueChanged) queueApply();
    }).observe(root, { childList: true, subtree: true });
  }

  function initialise() {
    observeCatalogueLifecycle();
    apply();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();
