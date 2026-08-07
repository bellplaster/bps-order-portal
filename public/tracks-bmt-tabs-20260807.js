(() => {
  if (window.__bpsTracksBmtTabs20260807) return;
  window.__bpsTracksBmtTabs20260807 = true;

  const TABS = Object.freeze([
    { key: "0.50", label: "0.50 BMT" },
    { key: "0.70", label: "0.70 BMT" },
    { key: "0.75", label: "0.75 BMT" },
    { key: "1.15", label: "1.15 BMT" },
  ]);

  const TRACK_VARIANTS = Object.freeze({
    "0.50": Object.freeze({
      "51 mm Track": "40003000",
      "64 mm Track": "11103000",
      "76 mm Track": "40203000",
      "92 mm Track": "25003000",
      "64 mm DH Track": "48003000",
      "76 mm DH Track": "48203000",
      "92 mm DH Track": "48303000",
    }),
    "0.70": Object.freeze({
      "51 mm Track": "49003000",
      "76 mm Track": "49403000",
      "92 mm Track": "49603000",
      "51 mm DH Track": "48803000",
      "64 mm DH Track": "49703000",
      "76 mm DH Track": "49803000",
      "92 mm Seismic DH Track": "87203000",
    }),
    "0.75": Object.freeze({
      "64 mm Track": "49203000",
      "92 mm DH Track": "49903000",
      "150 mm DH Track": "51003000",
      "150 mm Seismic DH Track": "87303000",
    }),
    "1.15": Object.freeze({
      "64 mm Track": "66003000",
      "76 mm Track": "67003000",
      "92 mm Track": "68003000",
      "64 mm DH Track": "66303000",
      "76 mm DH Track": "67303000",
      "92 mm DH Track": "68303000",
      "150 mm DH Track": "69003000",
    }),
  });

  function ensureStyles() {
    if (document.querySelector('style[data-tracks-bmt-tabs="true"]')) return;
    const style = document.createElement("style");
    style.dataset.tracksBmtTabs = "true";
    style.textContent = `
      .tracks-bmt-section{display:grid;grid-template-columns:minmax(74px,.72fr) minmax(0,3.28fr);margin-top:8px;margin-bottom:8px;overflow:hidden;background:#a62b45}
      .tracks-bmt-section>.lower-category-title{grid-column:1;display:flex;align-items:center;height:34px;margin:0;padding:0 8px;border:1px solid #a62b45;border-right:0;background:#a62b45;color:#fff;line-height:34px;white-space:nowrap;box-sizing:border-box}
      .tracks-bmt-tabs{grid-column:2;position:relative;isolation:isolate;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;height:34px;padding:4px 8px;border:1px solid #a62b45;border-left:0;background:#a62b45;overflow:hidden;box-sizing:border-box}
      .tracks-bmt-tabs::before{content:"";position:absolute;z-index:0;top:4px;bottom:4px;left:8px;width:calc((100% - 28px)/4);border-radius:6px;background:#fff;box-shadow:0 2px 8px rgba(23,33,31,.18);transform:translateX(0);transition:transform .28s cubic-bezier(.22,.8,.28,1)}
      .tracks-bmt-tabs:has(.tracks-bmt-tab:nth-child(2).is-active)::before{transform:translateX(calc(100% + 4px))}
      .tracks-bmt-tabs:has(.tracks-bmt-tab:nth-child(3).is-active)::before{transform:translateX(calc(200% + 8px))}
      .tracks-bmt-tabs:has(.tracks-bmt-tab:nth-child(4).is-active)::before{transform:translateX(calc(300% + 12px))}
      .tracks-bmt-tab{position:relative;z-index:1;appearance:none;height:26px;margin:0;padding:1px 2px;border:0;border-radius:6px;background:transparent;color:#fff;font:700 11px/24px Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center;text-transform:uppercase;white-space:nowrap;cursor:pointer}
      .tracks-bmt-tab.is-active{color:#7f1f34}
      .tracks-bmt-content{grid-column:1/-1;background:#fff;overflow:hidden}
      .tracks-bmt-panel[hidden]{display:none}
      .tracks-bmt-table{table-layout:fixed}
      @media(max-width:720px){.tracks-bmt-section{grid-template-columns:minmax(62px,.65fr) minmax(0,3.35fr)}.tracks-bmt-section>.lower-category-title{padding:0 6px;font-size:10px}.tracks-bmt-tabs{gap:2px;padding:4px 6px}.tracks-bmt-tabs::before{left:6px;width:calc((100% - 20px)/4)}.tracks-bmt-tabs:has(.tracks-bmt-tab:nth-child(2).is-active)::before{transform:translateX(calc(100% + 2px))}.tracks-bmt-tabs:has(.tracks-bmt-tab:nth-child(3).is-active)::before{transform:translateX(calc(200% + 4px))}.tracks-bmt-tabs:has(.tracks-bmt-tab:nth-child(4).is-active)::before{transform:translateX(calc(300% + 6px))}}
    `;
    document.head.append(style);
  }

  function normalise(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
  }

  function findCatalogKey(sku) {
    return Object.entries(state?.catalog || {}).find(([, product]) =>
      String(product?.sku || product?.stockCode || "").trim() === sku,
    )?.[0] || "";
  }

  function floorIdFor(section) {
    return String(section?.closest?.('[id$="OrderSheet"]')?.id || "").replace(/OrderSheet$/, "");
  }

  function createTrackCell(floor, sku) {
    const key = findCatalogKey(sku);
    if (!key) throw new Error(`TRACKS: catalogue key missing for SKU ${sku}`);
    if (typeof createQuantityCell !== "function") throw new Error("TRACKS: createQuantityCell is unavailable");
    return createQuantityCell(floor, key);
  }

  function buildMatrix(floor, bmt) {
    const table = document.createElement("table");
    table.className = "lower-catalogue-table tracks-bmt-table";
    const colgroup = document.createElement("colgroup");
    [72, 28].forEach((width) => {
      const col = document.createElement("col");
      col.style.width = `${width}%`;
      colgroup.append(col);
    });
    table.append(colgroup);

    const tbody = document.createElement("tbody");
    const header = document.createElement("tr");
    header.className = "lower-subheader lower-matrix-header";
    ["Product", "3000"].forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      header.append(th);
    });
    tbody.append(header);

    Object.entries(TRACK_VARIANTS[bmt]).forEach(([label, sku]) => {
      const row = document.createElement("tr");
      const name = document.createElement("th");
      name.scope = "row";
      name.textContent = label;
      row.append(name, createTrackCell(floor, sku));
      tbody.append(row);
    });

    table.append(tbody);
    return table;
  }

  function activate(section, key) {
    section.querySelectorAll(".tracks-bmt-tab").forEach((button) => {
      const active = button.dataset.bmt === key;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    });
    section.querySelectorAll(".tracks-bmt-panel").forEach((panel) => {
      const active = panel.dataset.bmt === key;
      panel.hidden = !active;
    });
  }

  function buildSection(floor) {
    const section = document.createElement("section");
    section.className = "lower-catalogue-section tracks-bmt-section";

    const heading = document.createElement("h3");
    heading.className = "lower-category-title";
    heading.textContent = "TRACKS";

    const tabs = document.createElement("div");
    tabs.className = "tracks-bmt-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Track thickness");

    const content = document.createElement("div");
    content.className = "tracks-bmt-content";

    TABS.forEach((tab, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tracks-bmt-tab${index === 0 ? " is-active" : ""}`;
      button.textContent = tab.label;
      button.dataset.bmt = tab.key;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", index === 0 ? "true" : "false");
      button.tabIndex = index === 0 ? 0 : -1;
      tabs.append(button);

      const panel = document.createElement("div");
      panel.className = "tracks-bmt-panel";
      panel.dataset.bmt = tab.key;
      panel.setAttribute("role", "tabpanel");
      panel.hidden = index !== 0;
      panel.append(buildMatrix(floor, tab.key));
      content.append(panel);
    });

    tabs.addEventListener("click", (event) => {
      const button = event.target.closest(".tracks-bmt-tab");
      if (button) activate(section, button.dataset.bmt);
    });
    tabs.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...tabs.querySelectorAll(".tracks-bmt-tab")];
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

  function removeLegacyTrackSections(root) {
    [...root.querySelectorAll(".rondo-expanded-group, .lower-catalogue-section")].forEach((section) => {
      const title = normalise(section.querySelector(".rondo-expanded-title, .lower-category-title, h3")?.textContent);
      if (["RONDO TRACKS & DH TRACK", "RONDO HEAVY-DUTY WALL FRAMING"].includes(title)) section.remove();
    });
  }

  function apply() {
    const studs = document.querySelector(".studs-bmt-section");
    if (!studs) return false;
    const floor = floorIdFor(studs);
    if (!floor) return false;

    const newSection = buildSection(floor);
    document.querySelectorAll(".tracks-bmt-section").forEach((section) => section.remove());
    studs.insertAdjacentElement("afterend", newSection);
    removeLegacyTrackSections(studs.closest('[id$="OrderSheet"]') || document);
    return true;
  }

  let queued = false;
  function queueApply() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      apply();
    });
  }

  function initialise() {
    ensureStyles();
    apply();
    const root = document.querySelector(".floor-panels");
    if (!root || root.dataset.tracksBmtObserved === "true") return;
    root.dataset.tracksBmtObserved = "true";
    new MutationObserver((mutations) => {
      const changed = mutations.some((mutation) => [...mutation.addedNodes].some((node) =>
        node instanceof Element && (node.matches?.(".studs-bmt-section") || node.querySelector?.(".studs-bmt-section")),
      ));
      if (changed) queueApply();
    }).observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();
