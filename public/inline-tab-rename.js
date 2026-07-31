(() => {
  if (window.__bpsInlineTabRenameStarted) return;
  window.__bpsInlineTabRenameStarted = true;

  let editing = null;

  function cleanLabel(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
  }

  function areaById(areaId) {
    try {
      return Array.isArray(state?.deliveryAreas)
        ? state.deliveryAreas.find((area) => area.id === areaId)
        : null;
    } catch (_error) {
      return null;
    }
  }

  function duplicateLabel(areaId, label) {
    try {
      return state.deliveryAreas.some((area) => area.id !== areaId && String(area.label || "").toLowerCase() === label.toLowerCase());
    } catch (_error) {
      return false;
    }
  }

  function editorWidth(label, measuredWidth = 0) {
    const textWidth = Math.ceil(String(label || "").length * 7.2 + 28);
    return Math.max(72, Math.min(190, Math.max(measuredWidth, textWidth)));
  }

  function finish(save) {
    if (!editing) return;
    const { areaId, area, shell, tab, input, originalLabel } = editing;
    editing = null;

    let label = cleanLabel(input.value);
    if (!save || !label) label = originalLabel;

    if (save && duplicateLabel(areaId, label)) {
      editing = { areaId, area, shell, tab, input, originalLabel };
      input.setCustomValidity("Use a different tab name.");
      input.reportValidity();
      input.focus();
      input.select();
      return;
    }

    input.setCustomValidity("");
    area.label = label;
    try { floorLabels[areaId] = label; } catch (_error) { }

    tab.textContent = label;
    tab.hidden = false;
    tab.title = "Double-click to rename. Drag to reorder.";
    shell.classList.remove("is-renaming");
    shell.style.removeProperty("--inline-tab-editor-width");
    shell.draggable = true;
    input.remove();

    const remove = shell.querySelector("[data-delete-area]");
    if (remove) remove.setAttribute("aria-label", `Delete ${label}`);

    try { scheduleDraft(); } catch (_error) { }
    tab.focus({ preventScroll: true });
  }

  function begin(areaId, selectText = true) {
    const area = areaById(areaId);
    const shell = document.querySelector(`.area-tab-shell[data-area-id="${CSS.escape(areaId)}"]`);
    const tab = shell?.querySelector(`[data-floor-tab="${CSS.escape(areaId)}"]`);
    if (!area || !shell || !tab) return false;

    if (editing?.areaId === areaId) return true;
    if (editing) finish(true);

    document.querySelector(".area-name-editor")?.remove();

    const measuredWidth = Math.ceil(tab.getBoundingClientRect().width || shell.getBoundingClientRect().width || 0);
    const width = editorWidth(area.label, measuredWidth);
    shell.style.setProperty("--inline-tab-editor-width", `${width}px`);

    const input = document.createElement("input");
    input.type = "text";
    input.className = "area-tab-inline-input";
    input.maxLength = 40;
    input.autocomplete = "off";
    input.value = area.label;
    input.setAttribute("aria-label", "Tab name");

    editing = { areaId, area, shell, tab, input, originalLabel: area.label };

    shell.classList.add("is-renaming");
    shell.draggable = false;
    tab.hidden = true;
    shell.insertBefore(input, shell.firstChild);

    input.addEventListener("input", () => {
      input.setCustomValidity("");
      shell.style.setProperty("--inline-tab-editor-width", `${editorWidth(input.value, measuredWidth)}px`);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        finish(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    });
    input.addEventListener("blur", () => window.setTimeout(() => {
      if (editing?.input === input) finish(true);
    }, 0));

    input.focus({ preventScroll: true });
    if (selectText) input.select();
    return true;
  }

  function convertLegacyEditor(editor) {
    if (!(editor instanceof HTMLFormElement) || !editor.classList.contains("area-name-editor")) return;
    const shell = editor.previousElementSibling?.matches?.(".area-tab-shell[data-area-id]")
      ? editor.previousElementSibling
      : null;
    const areaId = shell?.dataset.areaId;
    editor.remove();
    if (areaId) begin(areaId, true);
  }

  function bind() {
    const tabs = document.getElementById("deliveryAreaTabs");
    if (!tabs || tabs.dataset.inlineRenameBound === "true") return false;
    tabs.dataset.inlineRenameBound = "true";

    tabs.addEventListener("dblclick", (event) => {
      const tab = event.target.closest("[data-floor-tab]");
      if (!tab) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      begin(tab.dataset.floorTab, true);
    }, true);

    tabs.addEventListener("pointerdown", (event) => {
      if (!editing) return;
      if (event.target === editing.input || editing.shell.contains(event.target)) return;
      finish(true);
    }, true);

    return true;
  }

  function scan() {
    bind();
    document.querySelectorAll(".area-name-editor").forEach(convertLegacyEditor);
  }

  const observer = new MutationObserver((mutations) => {
    let relevant = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.("#deliveryAreaTabs, .area-name-editor, .area-tab-shell") || node.querySelector?.("#deliveryAreaTabs, .area-name-editor, .area-tab-shell")) {
          relevant = true;
          break;
        }
      }
      if (relevant) break;
    }
    if (relevant) window.requestAnimationFrame(scan);
  });

  const style = document.createElement("style");
  style.id = "inline-tab-rename-styles";
  style.textContent = `
    #deliveryAreaTabs .area-tab-shell.is-renaming{
      display:inline-flex!important;
      flex:0 0 auto!important;
      align-items:stretch!important;
      width:auto!important;
      min-width:0!important;
      max-width:none!important;
      background:#fff!important;
      border-color:#006557!important;
      box-shadow:inset 0 0 0 1px #006557!important;
      overflow:hidden!important;
    }
    #deliveryAreaTabs .area-tab-shell.is-renaming>.area-tab-inline-input{
      box-sizing:border-box!important;
      display:block!important;
      flex:0 0 var(--inline-tab-editor-width,88px)!important;
      width:var(--inline-tab-editor-width,88px)!important;
      min-width:var(--inline-tab-editor-width,88px)!important;
      max-width:var(--inline-tab-editor-width,88px)!important;
      height:32px!important;
      min-height:32px!important;
      margin:0!important;
      padding:0 10px!important;
      border:0!important;
      border-radius:0!important;
      background:#fff!important;
      color:#17211f!important;
      outline:0!important;
      box-shadow:none!important;
      font:inherit!important;
      font-size:11px!important;
      font-weight:600!important;
      line-height:32px!important;
      text-align:left!important;
    }
    #deliveryAreaTabs .area-tab-shell.is-renaming>.area-tab-inline-input:focus{
      border:0!important;
      box-shadow:none!important;
      outline:0!important;
    }
    #deliveryAreaTabs .area-tab-shell.is-renaming .area-tab-delete{
      flex:0 0 32px!important;
      width:32px!important;
      min-width:32px!important;
    }
    #deliveryAreaTabs>.area-name-editor{display:none!important}
  `;
  document.head.append(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan, { once: true });
  else scan();
  observer.observe(document.body, { childList: true, subtree: true });
})();