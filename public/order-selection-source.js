(() => {
  const TIME_SLOT_VALUES = new Set(["1ST", "2ND", "AM", "PM", "ANY"]);
  const TIME_SLOT_SELECTORS = [
    ".time-slot-field select",
    ".delivery-select-timeSlot select",
    "select[data-delivery-field='timeSlot']",
    "select[aria-label='Time Slot']",
    "select[aria-label='Time slot']",
  ];

  let originalSelectedRadio = null;
  let originalBuildPayload = null;

  function findTimeSlotSelect() {
    for (const selector of TIME_SLOT_SELECTORS) {
      const select = document.querySelector(selector);
      if (select instanceof HTMLSelectElement) return select;
    }

    return [...document.querySelectorAll("select")].find((select) => {
      const host = select.closest(".sheet-field-row, .form-field, label, td, div");
      return /time\s*slot/i.test(`${select.name} ${select.id} ${select.getAttribute("aria-label") || ""} ${host?.textContent || ""}`);
    }) || null;
  }

  function normaliseTimeSlot(value) {
    const key = String(value || "").trim().toUpperCase();
    return TIME_SLOT_VALUES.has(key) ? key : "";
  }

  function canonicalTimeSlot() {
    const select = findTimeSlotSelect();
    const selected = normaliseTimeSlot(select?.value);
    if (selected) return selected;

    return normaliseTimeSlot(document.querySelector('input[name="timeSlot"]:checked')?.value);
  }

  function ensureRadio(value) {
    if (!value) return;
    let radio = document.querySelector(`input[name="timeSlot"][value="${CSS.escape(value)}"]`);
    if (!radio) {
      const source = document.querySelector('input[name="timeSlot"]');
      const host = source?.parentElement || document.querySelector(".time-slot-field") || document.body;
      radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "timeSlot";
      radio.value = value;
      radio.hidden = true;
      radio.tabIndex = -1;
      host.append(radio);
    }

    document.querySelectorAll('input[name="timeSlot"]').forEach((input) => {
      input.checked = input === radio;
    });
  }

  function syncTimeSlot() {
    const value = canonicalTimeSlot();
    ensureRadio(value);
    return value;
  }

  function installSelectedRadioAuthority() {
    const current = typeof selectedRadio === "function" ? selectedRadio : window.selectedRadio;
    if (typeof current !== "function") return false;
    if (current.__canonicalTimeSlotSource) return true;

    originalSelectedRadio ||= current;
    const authoritative = function selectedRadioFromCanonicalControl(name) {
      if (name === "timeSlot") return syncTimeSlot();
      return originalSelectedRadio.call(this, name);
    };
    authoritative.__canonicalTimeSlotSource = true;
    window.selectedRadio = authoritative;
    try { selectedRadio = authoritative; } catch (_error) { }
    return true;
  }

  function installPayloadAuthority() {
    const current = typeof buildPayload === "function" ? buildPayload : window.buildPayload;
    if (typeof current !== "function") return false;
    if (current.__canonicalTimeSlotSource) return true;

    originalBuildPayload ||= current;
    const authoritative = function buildPayloadFromCanonicalTimeSlot(...args) {
      const timeSlot = syncTimeSlot();
      const payload = originalBuildPayload.apply(this, args);
      payload.timeSlot = timeSlot || "ANY";
      return payload;
    };
    authoritative.__canonicalTimeSlotSource = true;
    window.buildPayload = authoritative;
    try { buildPayload = authoritative; } catch (_error) { }
    return true;
  }

  function refreshAuthorities() {
    installSelectedRadioAuthority();
    installPayloadAuthority();
    syncTimeSlot();
  }

  document.addEventListener("change", (event) => {
    if (event.target === findTimeSlotSelect()) {
      syncTimeSlot();
      window.updateGeneratedDeliverySummary?.();
      window.scheduleDraft?.();
    }
  }, true);

  document.addEventListener("click", (event) => {
    if (event.target.closest("#continueToReviewButton, [data-step-target='review'], #submitButton")) {
      refreshAuthorities();
    }
  }, true);

  document.addEventListener("submit", refreshAuthorities, true);

  const observer = new MutationObserver(refreshAuthorities);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  function initialise() {
    refreshAuthorities();
    [0, 100, 300, 700, 1500, 3000, 6000].forEach((delay) => window.setTimeout(refreshAuthorities, delay));
    window.addEventListener("pageshow", refreshAuthorities);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();
