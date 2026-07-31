(() => {
  const TAB_ROW_SELECTOR = "#deliveryAreaTabs, .products-area > .floor-tabs";
  const MAX_AREAS = 20;
  let tabs = null;
  let observer = null;
  let syncFrame = 0;
  let draggedAreaId = "";
  let operationPending = false;

  installStyles();
  initialise();
  document.addEventListener("DOMContentLoaded", initialise, { once: true });
  window.addEventListener("pageshow", initialise);

  document.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add-area]");
    const copy = event.target.closest("[data-duplicate-area]");
    const reset = event.target.closest("[data-reset-areas]");
    if (!add && !copy && !reset) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (add && !add.disabled) void addArea();
    else if (copy && !copy.disabled) void duplicateArea();
    else if (reset && !reset.disabled) void resetAreas();
  }, true);

  document.addEventListener("dblclick", (event) => {
    const tab = event.target.closest("[data-floor-tab]");
    if (!tab) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    commitEditor();
    openEditor(tab.dataset.floorTab || "", false);
  }, true);

  document.addEventListener("pointerdown", (event) => {
    const editor = currentEditor();
    if (!editor || editor.contains(event.target)) return;
    commitEditor();
  }, true);

  document.addEventListener("focusout", (event) => {
    const editor = event.target.closest?.(".area-name-editor[data-root-tab-editor='true']");
    if (!editor) return;
    const next = event.relatedTarget;
    if (next instanceof Element && editor.contains(next)) return;
    window.setTimeout(() => {
      if (editor.isConnected && !editor.contains(document.activeElement)) commitEditor(editor);
    }, 0);
  }, true);

  document.addEventListener("dragstart", (event) => {
    const shell = event.target.closest(".area-tab-shell[data-area-id]");
    if (!shell || !shell.closest(TAB_ROW_SELECTOR)) return;
    commitEditor();
    draggedAreaId = shell.dataset.areaId || "";
    if (!draggedAreaId) return;
    shell.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedAreaId);
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener("dragover", (event) => {
    if (!draggedAreaId) return;
    const target = event.target.closest(".area-tab-shell[data-area-id]");
    if (!target || !target.closest(TAB_ROW_SELECTOR) || target.dataset.areaId === draggedAreaId) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    clearDropIndicators();
    const rect = target.getBoundingClientRect();
    target.classList.add(event.clientX < rect.left + rect.width / 2 ? "drop-before" : "drop-after");
    event.dataTransfer.dropEffect = "move";
  }, true);

  document.addEventListener("drop", (event) => {
    if (!draggedAreaId) return;
    const target = event.target.closest(".area-tab-shell[data-area-id]");
    if (!target || !target.closest(TAB_ROW_SELECTOR) || target.dataset.areaId === draggedAreaId) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const rect = target.getBoundingClientRect();
    reorderArea(draggedAreaId, target.dataset.areaId || "", event.clientX < rect.left + rect.width / 2);
  }, true);

  document.addEventListener("dragend", (event) => {
    if (!draggedAreaId && !event.target.closest?.(".area-tab-shell")) return;
    event.stopPropagation();
    event.stopImmediatePropagation();
    finishDragging();
  }, true);

  function initialise() {
    const nextTabs = document.querySelector(TAB_ROW_SELECTOR);
    if (!nextTabs) return window.setTimeout(initialise, 80);
    if (tabs !== nextTabs) {
      observer?.disconnect();
      tabs = nextTabs;
      tabs.dataset.tabController = "root";
      observer = new MutationObserver(queueSync);
      observer.observe(tabs, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-selected", "hidden"] });
    }
    queueSync();
  }

  function queueSync() {
    window.cancelAnimationFrame(syncFrame);
    syncFrame = window.requestAnimationFrame(syncControls);
  }

  function syncControls() {
    const currentTabs = document.querySelector(TAB_ROW_SELECTOR);
    if (!currentTabs) return;
    if (currentTabs !== tabs) {
      tabs = currentTabs;
      initialise();
      return;
    }
    const areas = currentAreas();
    tabs.querySelectorAll(":scope > .area-tabs-duplicate, :scope > .area-tabs-reset").forEach((node) => node.remove());
    const add = tabs.querySelector(":scope > [data-add-area]");
    if (add) {
      add.textContent = "+";
      add.setAttribute("aria-label", "Add tab");
      add.title = "Add tab";
      add.disabled = operationPending || areas.length >= MAX_AREAS;
    }
    const copy = makeControl("area-tabs-duplicate", "Duplicate active tab", "duplicate");
    copy.dataset.duplicateArea = "true";
    copy.disabled = operationPending || areas.length >= MAX_AREAS || !activeArea();
    copy.append(makeCopyIcon());
    const reset = makeControl("area-tabs-reset", "Delete all tabs", "reset");
    reset.dataset.resetAreas = "true";
    reset.append(makeTrashIcon());
    if (add) add.after(copy, reset);
    else tabs.append(copy, reset);
    tabs.querySelectorAll(":scope > .area-tab-shell[data-area-id]").forEach((shell) => {
      shell.draggable = true;
      shell.querySelector("[data-floor-tab]")?.setAttribute("title", "Double-click to rename. Drag to reorder.");
    });
    tabs.querySelector(":scope > .area-tab-summary")?.remove();
  }

  function makeControl(className, label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.dataset.tabAction = action;
    button.setAttribute("aria-label", label);
    button.title = label;
    return button;
  }

  async function addArea() {
    if (operationPending || currentAreas().length >= MAX_AREAS) return;
    commitEditor();
    operationPending = true;
    queueSync();
    try {
      const label = nextDefaultLabel();
      const id = makeAreaId(label);
      state.deliveryAreas.push({ id, label });
      state.quantities[id] = new Map();
      state.otherMaterials[id] = [];
      floorLabels[id] = label;
      state.activeFloor = id;
      await rerender();
      openEditor(id, true);
    } finally {
      operationPending = false;
      queueSync();
    }
  }

  async function duplicateArea() {
    if (operationPending || currentAreas().length >= MAX_AREAS) return;
    commitEditor();
    const source = activeArea();
    if (!source) return;
    operationPending = true;
    queueSync();
    try {
      const label = nextDuplicateLabel(source.label);
      const id = makeAreaId(label);
      const index = state.deliveryAreas.findIndex((area) => area.id === source.id);
      state.deliveryAreas.splice(index + 1, 0, { id, label });
      state.quantities[id] = new Map(state.quantities[source.id] instanceof Map ? state.quantities[source.id] : []);
      state.otherMaterials[id] = cloneValue(Array.isArray(state.otherMaterials[source.id]) ? state.otherMaterials[source.id] : []);
      floorLabels[id] = label;
      state.activeFloor = id;
      await rerender();
      openEditor(id, true);
    } finally {
      operationPending = false;
      queueSync();
    }
  }

  async function resetAreas() {
    if (operationPending) return;
    if (!window.confirm("Delete all tabs and quantities and return to one blank Tab 1?")) return;
    commitEditor();
    operationPending = true;
    queueSync();
    try {
      const id = "tab-1";
      state.deliveryAreas = [{ id, label: "Tab 1" }];
      state.activeFloor = id;
      state.quantities = { [id]: new Map() };
      state.otherMaterials = { [id]: [] };
      Object.keys(floorLabels).forEach((key) => delete floorLabels[key]);
      floorLabels[id] = "Tab 1";
      await rerender();
    } finally {
      operationPending = false;
      queueSync();
    }
  }

  async function rerender() {
    if (typeof loadCatalog === "function") await loadCatalog();
    if (typeof renderCounts === "function") renderCounts();
    if (typeof scheduleDraft === "function") scheduleDraft();
    initialise();
  }

  function openEditor(areaId, placeholderOnly) {
    initialise();
    const area = currentAreas().find((candidate) => candidate.id === areaId);
    if (!tabs || !area) return;
    currentEditor()?.remove();
    const editor = document.createElement("form");
    editor.className = "area-name-editor";
    editor.dataset.rootTabEditor = "true";
    editor.dataset.polished = "true";
    editor.dataset.targetAreaId = areaId;
    editor.innerHTML = '<input type="text" maxlength="40" autocomplete="off" aria-label="Tab name"><button type="submit">Save</button><button type="button" data-cancel-area>Cancel</button>';
    const input = editor.querySelector("input");
    input.value = placeholderOnly ? "" : area.label;
    input.placeholder = area.label;
    editor.addEventListener("submit", (event) => {
      event.preventDefault();
      commitEditor(editor, true);
    });
    editor.querySelector("[data-cancel-area]").addEventListener("click", () => {
      editor.remove();
      document.querySelector(`[data-floor-tab="${CSS.escape(areaId)}"]`)?.focus();
    });
    input.addEventListener("input", () => input.setCustomValidity(""));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") editor.querySelector("[data-cancel-area]").click();
    });
    const shell = tabs.querySelector(`:scope > .area-tab-shell[data-area-id="${CSS.escape(areaId)}"]`);
    if (shell) shell.after(editor);
    else tabs.prepend(editor);
    window.requestAnimationFrame(() => {
      input.focus({ preventScroll: true });
      if (!placeholderOnly) input.select();
    });
  }

  function currentEditor() {
    return document.querySelector("#deliveryAreaTabs > .area-name-editor[data-root-tab-editor='true']");
  }

  function commitEditor(editor = currentEditor(), report = false) {
    if (!(editor instanceof HTMLFormElement) || !editor.isConnected) return true;
    const area = currentAreas().find((candidate) => candidate.id === editor.dataset.targetAreaId);
    const input = editor.querySelector("input");
    if (!area || !(input instanceof HTMLInputElement)) {
      editor.remove();
      return true;
    }
    const label = cleanLabel(input.value) || area.label;
    if (currentAreas().some((candidate) => candidate.id !== area.id && candidate.label.toLowerCase() === label.toLowerCase())) {
      if (report) {
        input.setCustomValidity("Use a different tab name.");
        input.reportValidity();
      }
      return false;
    }
    area.label = label;
    floorLabels[area.id] = label;
    const tab = document.querySelector(`[data-floor-tab="${CSS.escape(area.id)}"]`);
    const labelNode = tab?.querySelector(".area-tab-label");
    if (labelNode) labelNode.textContent = label;
    else if (tab) tab.textContent = label;
    const remove = document.querySelector(`[data-delete-area="${CSS.escape(area.id)}"]`);
    if (remove) remove.setAttribute("aria-label", `Delete ${label}`);
    editor.remove();
    if (typeof scheduleDraft === "function") scheduleDraft();
    queueSync();
    return true;
  }

  function reorderArea(sourceId, targetId, before) {
    const areas = currentAreas();
    const sourceIndex = areas.findIndex((area) => area.id === sourceId);
    const targetIndex = areas.findIndex((area) => area.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return finishDragging();
    const [moved] = areas.splice(sourceIndex, 1);
    let insertIndex = areas.findIndex((area) => area.id === targetId);
    if (!before) insertIndex += 1;
    areas.splice(insertIndex, 0, moved);
    const sourceShell = tabs?.querySelector(`:scope > .area-tab-shell[data-area-id="${CSS.escape(sourceId)}"]`);
    const targetShell = tabs?.querySelector(`:scope > .area-tab-shell[data-area-id="${CSS.escape(targetId)}"]`);
    if (sourceShell && targetShell) tabs.insertBefore(sourceShell, before ? targetShell : targetShell.nextSibling);
    const panels = document.querySelector(".products-area > .floor-panels");
    areas.forEach((area) => {
      const panel = panels?.querySelector(`[data-floor-panel="${CSS.escape(area.id)}"]`);
      if (panel) panels.append(panel);
    });
    if (typeof scheduleDraft === "function") scheduleDraft();
    finishDragging();
  }

  function finishDragging() {
    draggedAreaId = "";
    document.querySelectorAll(".area-tab-shell.is-dragging").forEach((shell) => shell.classList.remove("is-dragging"));
    clearDropIndicators();
  }

  function clearDropIndicators() {
    document.querySelectorAll(".area-tab-shell.drop-before, .area-tab-shell.drop-after").forEach((shell) => shell.classList.remove("drop-before", "drop-after"));
  }

  function currentAreas() {
    return typeof state !== "undefined" && Array.isArray(state.deliveryAreas) ? state.deliveryAreas : [];
  }

  function activeArea() {
    return currentAreas().find((area) => area.id === state.activeFloor) || null;
  }

  function nextDefaultLabel() {
    const used = new Set(currentAreas().map((area) => area.label.toLowerCase()));
    let number = currentAreas().length + 1;
    while (used.has(`tab ${number}`)) number += 1;
    return `Tab ${number}`;
  }

  function nextDuplicateLabel(sourceLabel) {
    const source = cleanLabel(sourceLabel) || "Tab";
    const used = new Set(currentAreas().map((area) => area.label.toLowerCase()));
    const numbered = source.match(/^(.*?)(\d+)$/);
    if (numbered) {
      let number = Number(numbered[2]) + 1;
      let label = `${numbered[1]}${number}`.trim();
      while (used.has(label.toLowerCase())) label = `${numbered[1]}${++number}`.trim();
      return label;
    }
    let label = `${source} Copy`;
    let suffix = 2;
    while (used.has(label.toLowerCase())) label = `${source} Copy ${suffix++}`;
    return label;
  }

  function makeAreaId(label) {
    const base = cleanLabel(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "tab";
    let id = `area-${base}`;
    let suffix = 2;
    while (currentAreas().some((area) => area.id === id)) id = `area-${base}-${suffix++}`;
    return id;
  }

  function cleanLabel(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
  }

  function cloneValue(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function makeCopyIcon() {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<path d="M20 4v12a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2Zm-4 17a1 1 0 0 0-1-1H6V6a1 1 0 0 0-2 0v14a2 2 0 0 0 2 2h9a1 1 0 0 0 1-1Z" fill="currentColor"/>';
    return icon;
  }

  function makeTrashIcon() {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 48 48");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<path d="M43 8.8a2.3 2.3 0 0 1-.6 1.6A1.7 1.7 0 0 1 41 11H7.1A2.1 2.1 0 0 1 5 9.2a2.3 2.3 0 0 1 .6-1.6A1.7 1.7 0 0 1 7 7h10V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2h9.9A2.1 2.1 0 0 1 43 8.8ZM11.2 15a2 2 0 0 0-2 2.2l2.6 26a2 2 0 0 0 2 1.8h20.4a2 2 0 0 0 2-1.8l2.6-26a2 2 0 0 0-2-2.2h-25.6Z" fill="currentColor"/>';
    return icon;
  }

  function installStyles() {
    if (document.getElementById("root-tab-controller-styles")) return;
    const style = document.createElement("style");
    style.id = "root-tab-controller-styles";
    style.textContent = `
      #deliveryAreaTabs>.area-tabs-duplicate,#deliveryAreaTabs>.area-tabs-reset{box-sizing:border-box;display:inline-grid;place-items:center;flex:0 0 32px;width:32px;min-width:32px;height:32px;margin:0;padding:0;border:1px solid #bcc6c3;border-radius:0;background:#fff;color:var(--bell-maroon,#a62b47);cursor:pointer}
      #deliveryAreaTabs>.area-tabs-duplicate:hover:not(:disabled),#deliveryAreaTabs>.area-tabs-reset:hover:not(:disabled){border-color:var(--bell-maroon,#a62b47);background:#fbf3f5}
      #deliveryAreaTabs>.area-tabs-duplicate:disabled{opacity:.45;cursor:not-allowed}
      #deliveryAreaTabs>.area-tabs-duplicate svg,#deliveryAreaTabs>.area-tabs-reset svg{width:15px;height:15px;pointer-events:none}
      #deliveryAreaTabs>.area-tab-summary{display:none!important}
      #deliveryAreaTabs>.area-tab-shell.is-dragging{opacity:.45;border-color:transparent!important;box-shadow:none!important}
      #deliveryAreaTabs>.area-tab-shell.drop-before{border-left:3px solid var(--bell-green,#006557)!important}
      #deliveryAreaTabs>.area-tab-shell.drop-after{border-right:3px solid var(--bell-green,#006557)!important}
    `;
    document.head.append(style);
  }
})();