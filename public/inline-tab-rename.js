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
    const textWidth = Math.ceil(String(label || "").length * 7.2 + 24);
    return Math.max(64, Math.min(190, Math.max(measuredWidth, textWidth)));
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
    tab.style.removeProperty("display");
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

    const measuredWidth = Math.ceil(tab.getBoundingClientRect().width || 0);
    shell.style.setProperty("--inline-tab-editor-width", `${editorWidth(area.label, measuredWidth)}px`);

    const input = document.createElement("input");
    input.type = "text";
    input.className = "area-tab-inline-input";
    input.maxLength = 40;
    input.autocomplete = "off";
    input.value = area.label;
    input.setAttribute("aria-label", "Tab name");
    input.setAttribute("spellcheck", "false");

    editing = { areaId, area, shell, tab, input, originalLabel: area.label };

    shell.classList.add("is-renaming", "is-active");
    shell.draggable = false;
    tab.hidden = true;
    tab.style.setProperty("display", "none", "important");
    shell.insertBefore(input, shell.firstChild);

    input.addEventListener("input", () => {
      input.setCustomValidity("");
      shell.style.setProperty("--inline-tab-editor-width", `${editorWidth(input.value, measuredWidth)}px`);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        finish(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
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
      height:32px!important;
      background:#fff!important;
      border:1px solid #a62b45!important;
      box-shadow:inset 0 0 0 1px #a62b45!important;
      overflow:hidden!important;
    }
    #deliveryAreaTabs .area-tab-shell.is-renaming>[data-floor-tab]{
      display:none!important;
    }
    #deliveryAreaTabs .area-tab-shell.is-renaming>.area-tab-inline-input{
      appearance:none!important;
      -webkit-appearance:none!important;
      box-sizing:border-box!important;
      display:block!important;
      flex:0 0 var(--inline-tab-editor-width,88px)!important;
      width:var(--inline-tab-editor-width,88px)!important;
      min-width:var(--inline-tab-editor-width,88px)!important;
      max-width:var(--inline-tab-editor-width,88px)!important;
      height:30px!important;
      min-height:30px!important;
      margin:0!important;
      padding:0 9px!important;
      border:0!important;
      border-radius:0!important;
      background:#fff!important;
      color:#17211f!important;
      caret-color:#a62b45!important;
      outline:0!important;
      box-shadow:none!important;
      font:inherit!important;
      font-size:11px!important;
      font-weight:600!important;
      line-height:30px!important;
      text-align:left!important;
    }
    #deliveryAreaTabs .area-tab-shell.is-renaming>.area-tab-inline-input:focus,
    #deliveryAreaTabs .area-tab-shell.is-renaming>.area-tab-inline-input:focus-visible{
      border:0!important;
      background:#fff!important;
      box-shadow:none!important;
      outline:0!important;
    }
    #deliveryAreaTabs .area-tab-shell.is-renaming>.area-tab-inline-input::selection{
      background:rgba(166,43,69,.16);
      color:#17211f;
    }
    #deliveryAreaTabs .area-tab-shell.is-renaming .area-tab-delete{
      flex:0 0 30px!important;
      width:30px!important;
      min-width:30px!important;
      height:30px!important;
      border-left:1px solid #e2c0c8!important;
      background:#fff!important;
      color:#a62b45!important;
    }
    #deliveryAreaTabs .area-tab-shell.is-renaming .area-tab-delete:hover{
      background:#fbf2f4!important;
    }
    #deliveryAreaTabs>.area-name-editor{display:none!important}
  `;
  document.head.append(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan, { once: true });
  else scan();
  observer.observe(document.body, { childList: true, subtree: true });
})();