(() => {
  const TIME_SLOT_VALUES = new Set(["1ST", "2ND", "AM", "PM", "ANY"]);
  let payloadPatched = false;
  let validationPatched = false;

  function timeSlotSelect() {
    return document.querySelector(".delivery-select-timeSlot .delivery-select");
  }

  function canonicalTimeSlot() {
    const selectValue = String(timeSlotSelect()?.value || "").trim().toUpperCase();
    if (TIME_SLOT_VALUES.has(selectValue)) return selectValue;

    const checkedValue = String(document.querySelector('input[name="timeSlot"]:checked')?.value || "")
      .trim()
      .toUpperCase();
    return TIME_SLOT_VALUES.has(checkedValue) ? checkedValue : "";
  }

  function syncTimeSlot() {
    const value = canonicalTimeSlot();
    document.querySelectorAll('input[name="timeSlot"]').forEach((radio) => {
      radio.checked = Boolean(value) && String(radio.value || "").trim().toUpperCase() === value;
    });
    const select = timeSlotSelect();
    if (select && value && select.value !== value) select.value = value;
    return value;
  }

  function patchPayload() {
    if (payloadPatched || typeof window.buildPayload !== "function") return false;
    const original = window.buildPayload;
    const refined = function buildPayloadFromVisibleSelections(...args) {
      const timeSlot = syncTimeSlot();
      const payload = original.apply(this, args);
      payload.timeSlot = timeSlot || "ANY";
      return payload;
    };
    refined.__visibleSelectionSource = true;
    window.buildPayload = refined;
    try { buildPayload = refined; } catch (_error) { }
    payloadPatched = true;
    return true;
  }

  function patchValidation() {
    if (validationPatched || typeof window.validateForm !== "function") return false;
    const original = window.validateForm;
    const refined = function validateVisibleSelections(...args) {
      const timeSlot = syncTimeSlot();
      if (!timeSlot) throw new Error("Choose a time slot.");
      return original.apply(this, args);
    };
    refined.__visibleSelectionSource = true;
    window.validateForm = refined;
    try { validateForm = refined; } catch (_error) { }
    validationPatched = true;
    return true;
  }

  function bindSelect() {
    const select = timeSlotSelect();
    if (!(select instanceof HTMLSelectElement) || select.dataset.selectionSource === "true") return false;
    select.dataset.selectionSource = "true";
    select.addEventListener("change", () => {
      syncTimeSlot();
      window.updateGeneratedDeliverySummary?.();
      window.scheduleDraft?.();
    });
    syncTimeSlot();
    return true;
  }

  function initialise() {
    patchPayload();
    patchValidation();
    bindSelect();

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      patchPayload();
      patchValidation();
      bindSelect();
      if ((payloadPatched && validationPatched && attempts >= 10) || attempts >= 60) window.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();
