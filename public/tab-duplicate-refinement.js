(() => {
  const TAB_ROW_SELECTOR = "#deliveryAreaTabs, .products-area > .floor-tabs";
  const MAX_AREAS = 20;
  const COPY_BUTTON_CLASS = "area-tabs-duplicate";
  let observer = null;
  let syncFrame = 0;
  let duplicatePending = false;

  const start = () => {
    const tabs = document.querySelector(TAB_ROW_SELECTOR);
    if (!tabs) {
      window.setTimeout(start, 80);
      return;
    }

    if (!observer) {
      observer = new MutationObserver(queueSync);
      observer.observe(tabs, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-selected"] });
    }
    syncControls();
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest(`.${COPY_BUTTON_CLASS}`);
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void duplicateActiveArea();
  }, true);

  function queueSync() {
    window.cancelAnimationFrame(syncFrame);
    syncFrame = window.requestAnimationFrame(syncControls);
  }

  function syncControls() {
    const tabs = document.querySelector(TAB_ROW_SELECTOR);
    if (!tabs) return;

    const add = tabs.querySelector(":scope > [data-add-area]");
    const reset = tabs.querySelector(":scope > .area-tabs-reset");
    let duplicate = tabs.querySelector(`:scope > .${COPY_BUTTON_CLASS}`);

    if (!duplicate) {
      duplicate = document.createElement("button");
      duplicate.type = "button";
      duplicate.className = COPY_BUTTON_CLASS;
      duplicate.setAttribute("aria-label", "Duplicate active tab");
      duplicate.setAttribute("title", "Duplicate active tab");
      duplicate.replaceChildren(makeCopyIcon());
      if (reset) reset.insertAdjacentElement("beforebegin", duplicate);
      else if (add) add.insertAdjacentElement("afterend", duplicate);
      else tabs.append(duplicate);
    }

    duplicate.style.setProperty("order", "10005", "important");
    duplicate.disabled = duplicatePending || currentAreas().length >= MAX_AREAS || !activeArea();
    duplicate.replaceChildren(makeCopyIcon());

    if (reset) {
      reset.style.setProperty("order", "10010", "important");
      reset.replaceChildren(makeTrashIcon());
      reset.setAttribute("aria-label", "Delete all tabs");
      reset.setAttribute("title", "Delete all tabs");
    }
  }

  async function duplicateActiveArea() {
    if (duplicatePending) return;
    const areas = currentAreas();
    const source = activeArea();
    if (!source || areas.length >= MAX_AREAS) return;

    duplicatePending = true;
    syncControls();
    try {
      const label = nextDuplicateLabel(source.label, areas);
      const id = makeAreaId(label, areas);
      const sourceIndex = areas.findIndex((area) => String(area.id) === String(source.id));
      const duplicate = { ...source, id, label };
      areas.splice(sourceIndex + 1, 0, duplicate);

      state.quantities[id] = new Map(state.quantities[source.id] instanceof Map ? state.quantities[source.id] : []);
      state.otherMaterials[id] = cloneValue(Array.isArray(state.otherMaterials[source.id]) ? state.otherMaterials[source.id] : []);
      if (typeof floorLabels !== "undefined") floorLabels[id] = label;
      state.activeFloor = id;

      if (typeof loadCatalog === "function") await loadCatalog();
      if (typeof renderCounts === "function") renderCounts();
      if (typeof scheduleDraft === "function") scheduleDraft();

      window.requestAnimationFrame(() => {
        const tab = document.querySelector(`[data-floor-tab="${CSS.escape(String(id))}"]`);
        if (!tab) return;
        tab.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, view: window }));
      });
    } finally {
      duplicatePending = false;
      queueSync();
    }
  }

  function currentAreas() {
    return typeof state !== "undefined" && Array.isArray(state.deliveryAreas) ? state.deliveryAreas : [];
  }

  function activeArea() {
    if (typeof state === "undefined") return null;
    return currentAreas().find((area) => String(area.id) === String(state.activeFloor || "")) || null;
  }

  function nextDuplicateLabel(sourceLabel, areas) {
    const source = String(sourceLabel || "Tab").trim();
    const used = new Set(areas.map((area) => String(area.label || "").trim().toLowerCase()));
    const numbered = source.match(/^(.*?)(\d+)$/);
    if (numbered) {
      const prefix = numbered[1];
      let number = Number(numbered[2]) + 1;
      let candidate = `${prefix}${number}`.trim();
      while (used.has(candidate.toLowerCase())) {
        number += 1;
        candidate = `${prefix}${number}`.trim();
      }
      return candidate;
    }

    let candidate = `${source} Copy`;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) candidate = `${source} Copy ${suffix++}`;
    return candidate;
  }

  function makeAreaId(label, areas) {
    const base = String(label || "tab")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 28) || "tab";
    let id = `area-${base}`;
    let suffix = 2;
    while (areas.some((area) => String(area.id) === id)) id = `area-${base}-${suffix++}`;
    return id;
  }

  function cloneValue(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function makeCopyIcon() {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "15");
    icon.setAttribute("height", "15");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");
    icon.innerHTML = '<path d="M20 4v12a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2Zm-4 17a1 1 0 0 0-1-1H6V6a1 1 0 0 0-2 0v14a2 2 0 0 0 2 2h9a1 1 0 0 0 1-1Z" fill="currentColor"/>';
    return icon;
  }

  function makeTrashIcon() {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 48 48");
    icon.setAttribute("width", "15");
    icon.setAttribute("height", "15");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");
    icon.innerHTML = '<path d="M43 8.8a2.3 2.3 0 0 1-.6 1.6A1.7 1.7 0 0 1 41 11H7.1A2.1 2.1 0 0 1 5 9.2a2.3 2.3 0 0 1 .6-1.6A1.7 1.7 0 0 1 7 7h10V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2h9.9A2.1 2.1 0 0 1 43 8.8ZM11.2 15a2 2 0 0 0-2 2.2l2.6 26a2 2 0 0 0 2 1.8h20.4a2 2 0 0 0 2-1.8l2.6-26a2 2 0 0 0-2-2.2h-25.6Z" fill="currentColor"/>';
    return icon;
  }

  const style = document.createElement("style");
  style.dataset.tabDuplicateRefinement = "true";
  style.textContent = `
    .${COPY_BUTTON_CLASS} {
      display: inline-grid !important;
      place-items: center !important;
      flex: 0 0 32px !important;
      width: 32px !important;
      min-width: 32px !important;
      max-width: 32px !important;
      height: 32px !important;
      padding: 0 !important;
      border: 1px solid #cfd8d5 !important;
      background: #fff !important;
      color: var(--bell-red, #a62b47) !important;
      cursor: pointer !important;
    }
    .${COPY_BUTTON_CLASS}:hover:not(:disabled) { background: #f7f9f8 !important; }
    .${COPY_BUTTON_CLASS}:disabled { opacity: .45 !important; cursor: not-allowed !important; }
    .${COPY_BUTTON_CLASS} svg,
    .area-tabs-reset svg { pointer-events: none; }
  `;
  document.head.append(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  window.addEventListener("pageshow", start);
})();