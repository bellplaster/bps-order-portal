(() => {
  if (window.__bpsOrderEntryAssistanceStarted) return;
  window.__bpsOrderEntryAssistanceStarted = true;

  const MODES = new Map([
    ["reference", "sentence"],
    ["contactName", "words"],
    ["deliveryAddressSearch", "words"],
    ["deliveryInstructions", "sentence"],
  ]);
  const disabled = new WeakSet();

  function fieldMode(field) {
    return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
      ? MODES.get(field.id) || ""
      : "";
  }

  function isBoundary(value, cursor, mode) {
    if (mode === "sentence") return !value.slice(0, cursor).trim();
    if (cursor === 0) return true;
    return /[\s\-'’]/u.test(value[cursor - 1] || "");
  }

  function disableAssistance(field) {
    if (fieldMode(field)) disabled.add(field);
  }

  document.addEventListener("keydown", (event) => {
    const field = event.target;
    const mode = fieldMode(field);
    if (!mode) return;

    if (event.key === "Backspace" || event.key === "Delete" || event.ctrlKey || event.metaKey || event.altKey) {
      if (event.key === "Backspace" || event.key === "Delete") disableAssistance(field);
      return;
    }
    if (disabled.has(field) || event.key.length !== 1 || !/\p{Ll}/u.test(event.key)) return;

    const start = field.selectionStart;
    const end = field.selectionEnd;
    if (start == null || end == null || start !== end || !isBoundary(field.value, start, mode)) return;

    event.preventDefault();
    const upper = event.key.toLocaleUpperCase("en-AU");
    field.setRangeText(upper, start, end, "end");
    field.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: upper,
    }));
  }, true);

  document.addEventListener("beforeinput", (event) => {
    const field = event.target;
    if (!fieldMode(field)) return;
    const type = String(event.inputType || "");
    const editingEarlier = field.selectionStart != null && field.selectionStart !== String(field.value || "").length;
    const replacing = field.selectionStart !== field.selectionEnd;
    if (type.startsWith("delete") || /Paste|Drop|History/i.test(type) || editingEarlier || replacing) disableAssistance(field);
  }, true);

  document.getElementById("orderForm")?.addEventListener("reset", () => {
    MODES.forEach((_mode, id) => {
      const field = document.getElementById(id);
      if (field) disabled.delete?.(field);
    });
  });

  const reference = document.getElementById("reference");
  if (reference) {
    reference.required = false;
    reference.placeholder = "Reference (optional)";
    reference.setAttribute("aria-label", "Reference, optional");
  }
})();
