(() => {
  const TIME_SLOT_VALUES = new Set(["1ST", "2ND", "AM", "PM", "ANY"]);
  let selectionPatched = false;
  let payloadPatched = false;

  function timeSlotSelect() {
    return document.querySelector(
      ".time-slot-field select, .delivery-select-timeSlot .delivery-select, select[data-delivery-field='timeSlot']"
    );
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
    return value;
  }

  function patchSelectedRadio() {
    if (selectionPatched || typeof window.selectedRadio !== "function") return false;
    const original = window.selectedRadio;
    const refined = function selectedVisibleControl(name) {
      if (name === "timeSlot") return syncTimeSlot();
      return original.call(this, name);
    };
    refined.__visibleSelectionSource = true;
    window.selectedRadio = refined;
    try { selectedRadio = refined; } catch (_error) { }
    selectionPatched = true;
    return true;
  }

  function patchPayload() {
    if (payloadPatched || typeof window.buildPayload !== "function") return false;
    const original = window.buildPayload;
    const refined = function buildPayloadFromVisibleSelections(...args) {
      const payload = original.apply(this, args);
      payload.timeSlot = syncTimeSlot();
      return payload;
    };
    refined.__visibleSelectionSource = true;
    window.buildPayload = refined;
    try { buildPayload = refined; } catch (_error) { }
    payloadPatched = true;
    return true;
  }

  function bindSelect() {
    const select = timeSlotSelect();
    if (!(select instanceof HTMLSelectElement) || select.dataset.selectionSource === "true") return false;
    select.dataset.selectionSource = "true";
    select.addEventListener("change", () => {
      syncTimeSlot();
      if (typeof updateGeneratedDeliverySummary === "function") updateGeneratedDeliverySummary();
      if (typeof scheduleDraft === "function") scheduleDraft();
    });
    syncTimeSlot();
    return true;
  }

  function initialise() {
    patchSelectedRadio();
    patchPayload();
    bindSelect();

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      patchSelectedRadio();
      patchPayload();
      bindSelect();
      if ((selectionPatched && payloadPatched && attempts >= 10) || attempts >= 80) window.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();
