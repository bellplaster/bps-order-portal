(() => {
  const TIME_SLOT_VALUES = new Set(["1ST", "2ND", "AM", "PM", "ANY"]);
  let patched = false;

  function visibleTimeSlot() {
    const select = document.querySelector(".delivery-select-timeSlot .delivery-select");
    const selectValue = String(select?.value || "").trim().toUpperCase();
    if (TIME_SLOT_VALUES.has(selectValue)) return selectValue;

    const checked = document.querySelector('input[name="timeSlot"]:checked');
    const radioValue = String(checked?.value || "").trim().toUpperCase();
    return TIME_SLOT_VALUES.has(radioValue) ? radioValue : "ANY";
  }

  function syncTimeSlotRadios() {
    const value = visibleTimeSlot();
    document.querySelectorAll('input[name="timeSlot"]').forEach((radio) => {
      radio.checked = String(radio.value || "").toUpperCase() === value;
    });
    return value;
  }

  function patchPayload() {
    if (patched || typeof window.buildPayload !== "function") return false;
    const originalBuildPayload = window.buildPayload;
    const canonicalBuildPayload = function buildPayloadFromVisibleSelections(...args) {
      const payload = originalBuildPayload.apply(this, args);
      payload.timeSlot = syncTimeSlotRadios();
      return payload;
    };
    canonicalBuildPayload.__visibleSelectionSource = true;
    window.buildPayload = canonicalBuildPayload;
    try { buildPayload = canonicalBuildPayload; } catch (_error) { }
    patched = true;
    return true;
  }

  function bindSelect() {
    const select = document.querySelector(".delivery-select-timeSlot .delivery-select");
    if (!(select instanceof HTMLSelectElement) || select.dataset.selectionSource === "true") return false;
    select.dataset.selectionSource = "true";
    select.addEventListener("change", () => {
      syncTimeSlotRadios();
      if (typeof updateGeneratedDeliverySummary === "function") updateGeneratedDeliverySummary();
      if (typeof scheduleDraft === "function") scheduleDraft();
    });
    syncTimeSlotRadios();
    return true;
  }

  function initialise() {
    patchPayload();
    bindSelect();
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      patchPayload();
      bindSelect();
      if ((patched && attempts >= 10) || attempts >= 60) window.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();
