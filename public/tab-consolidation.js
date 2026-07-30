(() => {
  const TAB_ROW_SELECTOR = "#deliveryAreaTabs, .products-area > .floor-tabs";
  const MAX_AREAS = 20;
  let tabs = null;
  let observer = null;
  let syncFrame = 0;
  let draggedAreaId = "";
  let editorTargetAreaId = "";
  let operationPending = false;

  installStyles();
  initialise();
  document.addEventListener("DOMContentLoaded", initialise, { once: true });
  window.addEventListener("pageshow", initialise);

  document.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add-area]");
    if (!addButton || addButton.disabled) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void addAreaAndOpenEditor();
  }, true);

  document.addEventListener("dblclick", (event) => {
    const tab = event.target.closest("[data-floor-tab]");
    if (!tab) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    editorTargetAreaId = tab.dataset.floorTab || "";
    openAreaEditor(editorTargetAreaId, { selectText: true });
  }, true);

  document.addEventListener("dragstart", (event) => {
    const shell = event.target.closest(".area-tab-shell[data-area-id]");
    if (!shell || !shell.closest(TAB_ROW_SELECTOR)) return;

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
    const rect = target.getBoundingClientRect();
    const before = event.clientX < rect.left + rect.width / 2;
    clearDropIndicators();
    target.classList.add(before ? "drop-before" : "drop-after");
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
    const before = event.clientX < rect.left + rect.width / 2;
    void reorderArea(draggedAreaId, target.dataset.areaId || "", before);
  }, true);

  document.addEventListener("dragend", (event) => {
    if (!draggedAreaId && !event.target.closest(".area-tab-shell")) return;
    event.stopPropagation();
    event.stopImmediatePropagation();
    finishDragging();
  }, true);

  function initialise() {
    const nextTabs = document.querySelector(TAB_ROW_SELECTOR);
    if (!nextTabs) {
      window.setTimeout(initialise, 50);
      return;
    }

    if (tabs !== nextTabs) {
      observer?.disconnect();
      tabs = nextTabs;
      tabs.dataset.tabController = "consolidated";
      observer = new MutationObserver(queueSync);
      observer.observe(tabs, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "aria-selected", "hidden", "draggable"],
      });
    }

    queueSync();
  }

  function queueSync() {
    window.cancelAnimationFrame(syncFrame);
    syncFrame = window.requestAnimationFrame(syncTabRow);
  }

  function syncTabRow() {
    initialiseCurrentTabsReference();
    if (!tabs) return;

    const areas = currentAreas();
    const orderById = new Map(areas.map((area, index) => [String(area.id), (index + 1) * 10]));
    const shells = [...tabs.querySelectorAll(":scope > .area-tab-shell[data-area-id]")];

    shells.forEach((shell, index) => {
      const areaId = shell.dataset.areaId || "";
      shell.draggable = true;
      shell.style.order = String(orderById.get(areaId) || (index + 1) * 10);
      shell.querySelector("[data-floor-tab]")?.setAttribute("title", "Double-click to rename. Drag to reorder.");
    });

    const editor = tabs.querySelector(":scope > .area-name-editor");
    if (editor) {
      const previousAreaId = editor.previousElementSibling?.matches?.(".area-tab-shell[data-area-id]")
        ? editor.previousElementSibling.dataset.areaId || ""
        : "";
      const targetAreaId = editor.dataset.targetAreaId
        || previousAreaId
        || editorTargetAreaId
        || currentActiveAreaId();
      if (targetAreaId) editor.dataset.targetAreaId = targetAreaId;
      editor.style.order = String((orderById.get(targetAreaId) || 0) + 1);
    }

    const add = tabs.querySelector(":scope > [data-add-area]");
    if (add) {
      add.style.order = "10000";
      add.textContent = "+";
      add.setAttribute("aria-label", "Add tab");
      add.setAttribute("title", "Add tab");
      add.disabled = operationPending || areas.length >= MAX_AREAS;
    }

    const reset = tabs.querySelector(":scope > .area-tabs-reset");
    if (reset) reset.style.order = "10010";
    const summary = tabs.querySelector(":scope > .area-tab-summary");
    if (summary) summary.style.order = "10020";
  }

  function initialiseCurrentTabsReference() {
    const current = document.querySelector(TAB_ROW_SELECTOR);
    if (current && current !== tabs) {
      tabs = current;
      initialise();
    }
  }

  async function addAreaAndOpenEditor() {
    if (operationPending) return;
    const areas = currentAreas();
    if (areas.length >= MAX_AREAS) return;

    operationPending = true;
    queueSync();
    try {
      const label = nextDefaultAreaLabel(areas);
      const id = makeAreaId(label, areas);
      areas.push({ id, label });
      state.quantities[id] = new Map();
      state.otherMaterials[id] = [];
      if (typeof floorLabels !== "undefined") floorLabels[id] = label;
      state.activeFloor = id;
      editorTargetAreaId = id;

      await rerenderAreas();
      openAreaEditor(id, { selectText: true });
    } finally {
      operationPending = false;
      queueSync();
    }
  }

  function openAreaEditor(areaId, options = {}) {
    initialiseCurrentTabsReference();
    if (!tabs || !areaId) return;

    const existing = currentAreas().find((area) => String(area.id) === String(areaId));
    if (!existing) return;

    tabs.querySelector(":scope > .area-name-editor")?.remove();
    editorTargetAreaId = String(areaId);

    const editor = document.createElement("form");
    editor.className = "area-name-editor";
    editor.dataset.targetAreaId = String(areaId);
    editor.setAttribute("aria-label", "Tab name editor");
    editor.innerHTML = '<input type="text" maxlength="40" autocomplete="off" aria-label="Tab name"><button type="submit">Save</button><button type="button" data-cancel-area>Cancel</button>';

    const input = editor.querySelector("input");
    const cancel = editor.querySelector("[data-cancel-area]");
    input.value = existing.label;
    input.placeholder = "Tab name";

    editor.addEventListener("submit", (event) => {
      event.preventDefault();
      void saveAreaName(existing, input);
    });

    cancel.addEventListener("click", () => {
      editor.remove();
      editorTargetAreaId = "";
      document.querySelector(`[data-floor-tab="${CSS.escape(String(areaId))}"]`)?.focus();
      queueSync();
    });

    input.addEventListener("input", () => input.setCustomValidity(""));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") cancel.click();
    });

    const shell = tabs.querySelector(`:scope > .area-tab-shell[data-area-id="${CSS.escape(String(areaId))}"]`);
    if (shell) shell.insertAdjacentElement("afterend", editor);
    else tabs.append(editor);

    queueSync();
    input.focus();
    if (options.selectText !== false) input.select();
  }

  async function saveAreaName(area, input) {
    if (operationPending) return;
    const typed = cleanAreaLabel(input.value);
    const label = typed || area.label;
    const duplicate = currentAreas().some((candidate) => (
      candidate.id !== area.id && String(candidate.label || "").toLowerCase() === label.toLowerCase()
    ));

    if (duplicate) {
      input.setCustomValidity("Use a different tab name.");
      input.reportValidity();
      return;
    }

    operationPending = true;
    input.setCustomValidity("");
    try {
      area.label = label;
      if (typeof floorLabels !== "undefined") floorLabels[area.id] = label;
      editorTargetAreaId = "";
      await rerenderAreas();
    } finally {
      operationPending = false;
      queueSync();
    }
  }

  async function reorderArea(sourceId, targetId, before) {
    if (operationPending || !sourceId || !targetId || sourceId === targetId) {
      finishDragging();
      return;
    }

    const areas = currentAreas();
    const sourceIndex = areas.findIndex((area) => String(area.id) === String(sourceId));
    const targetIndex = areas.findIndex((area) => String(area.id) === String(targetId));
    if (sourceIndex < 0 || targetIndex < 0) {
      finishDragging();
      return;
    }

    operationPending = true;
    try {
      const [moved] = areas.splice(sourceIndex, 1);
      let insertIndex = areas.findIndex((area) => String(area.id) === String(targetId));
      if (!before) insertIndex += 1;
      areas.splice(insertIndex, 0, moved);
      await rerenderAreas();
    } finally {
      operationPending = false;
      finishDragging();
      queueSync();
    }
  }

  async function rerenderAreas() {
    if (typeof loadCatalog === "function") await loadCatalog();
    if (typeof renderCounts === "function") renderCounts();
    if (typeof scheduleDraft === "function") scheduleDraft();
    initialise();
  }

  function finishDragging() {
    draggedAreaId = "";
    document.querySelectorAll(".area-tab-shell.is-dragging").forEach((shell) => shell.classList.remove("is-dragging"));
    clearDropIndicators();
  }

  function clearDropIndicators() {
    document.querySelectorAll(".area-tab-shell.drop-before, .area-tab-shell.drop-after").forEach((shell) => {
      shell.classList.remove("drop-before", "drop-after");
    });
  }

  function currentAreas() {
    return typeof state !== "undefined" && Array.isArray(state.deliveryAreas) ? state.deliveryAreas : [];
  }

  function currentActiveAreaId() {
    return typeof state !== "undefined" ? String(state.activeFloor || "") : "";
  }

  function nextDefaultAreaLabel(areas) {
    const used = new Set(areas.map((area) => String(area.label || "").toLowerCase()));
    let number = areas.length + 1;
    let label = `Tab ${number}`;
    while (used.has(label.toLowerCase())) {
      number += 1;
      label = `Tab ${number}`;
    }
    return label;
  }

  function makeAreaId(label, areas) {
    const base = String(label || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 28) || "tab";
    let id = `area-${base}`;
    let suffix = 2;
    while (areas.some((area) => String(area.id) === id)) id = `area-${base}-${suffix++}`;
    return id;
  }

  function cleanAreaLabel(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
  }

  function installStyles() {
    if (document.getElementById("consolidated-tab-styles")) return;
    const style = document.createElement("style");
    style.id = "consolidated-tab-styles";
    style.textContent = `
      #deliveryAreaTabs > .area-tab-summary,
      .products-area > .floor-tabs > .area-tab-summary {
        display: none !important;
      }

      #deliveryAreaTabs > .area-tab-shell,
      .products-area > .floor-tabs > .area-tab-shell {
        cursor: grab !important;
        user-select: none;
      }

      #deliveryAreaTabs > .area-tab-shell:active,
      .products-area > .floor-tabs > .area-tab-shell:active {
        cursor: grabbing !important;
      }

      .area-tab-shell.is-dragging {
        opacity: 0.45 !important;
      }

      .area-tab-shell.drop-before {
        box-shadow: inset 3px 0 0 var(--bell-green, #006557) !important;
      }

      .area-tab-shell.drop-after {
        box-shadow: inset -3px 0 0 var(--bell-green, #006557) !important;
      }
    `;
    document.head.append(style);
  }
})();