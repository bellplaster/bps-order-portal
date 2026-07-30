(() => {
  const EDITOR_SELECTOR = ".area-name-editor";
  let saveTimer = 0;

  function editorInput(editor) {
    return editor?.querySelector?.('input[aria-label="Tab name"]') || editor?.querySelector?.('input[type="text"]') || null;
  }

  function focusEditor(editor) {
    const input = editorInput(editor);
    if (!(input instanceof HTMLInputElement)) return false;
    input.focus({ preventScroll: true });
    if (input.value) input.select();
    return document.activeElement === input;
  }

  function scheduleFocus(editor) {
    window.clearTimeout(saveTimer);
    queueMicrotask(() => focusEditor(editor));
    window.requestAnimationFrame(() => focusEditor(editor));
    window.setTimeout(() => focusEditor(editor), 40);
  }

  function submitEditor(editor) {
    if (!(editor instanceof HTMLFormElement) || !editor.isConnected || editor.dataset.autoSaving === "true") return;
    const input = editorInput(editor);
    if (!(input instanceof HTMLInputElement)) return;
    editor.dataset.autoSaving = "true";
    editor.requestSubmit();
    window.setTimeout(() => {
      if (editor.isConnected) delete editor.dataset.autoSaving;
    }, 250);
  }

  function scheduleOutsideSave(editor) {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      if (!editor.isConnected) return;
      if (editor.contains(document.activeElement)) return;
      submitEditor(editor);
    }, 0);
  }

  document.addEventListener("focusout", (event) => {
    const editor = event.target instanceof Element ? event.target.closest(EDITOR_SELECTOR) : null;
    if (!(editor instanceof HTMLFormElement)) return;
    const next = event.relatedTarget;
    if (next instanceof Element && editor.contains(next)) return;
    if (next instanceof Element && next.closest("[data-cancel-area]")) return;
    scheduleOutsideSave(editor);
  }, true);

  document.addEventListener("pointerdown", (event) => {
    const editor = document.querySelector(EDITOR_SELECTOR);
    if (!(editor instanceof HTMLFormElement) || editor.contains(event.target)) return;
    if (event.target instanceof Element && event.target.closest("[data-cancel-area]")) return;
    scheduleOutsideSave(editor);
  }, true);

  document.addEventListener("dblclick", () => {
    const editor = document.querySelector(EDITOR_SELECTOR);
    if (editor instanceof HTMLFormElement) scheduleFocus(editor);
  }, true);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        const editor = node.matches(EDITOR_SELECTOR) ? node : node.querySelector?.(EDITOR_SELECTOR);
        if (editor instanceof HTMLFormElement) scheduleFocus(editor);
      }
    }
  });

  const start = () => observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();