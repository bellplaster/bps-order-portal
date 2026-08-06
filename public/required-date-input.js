(() => {
  if (window.__bpsRequiredDateInputStarted) return;
  window.__bpsRequiredDateInputStarted = true;

  const input = document.getElementById("requiredDate");
  if (!input) return;

  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.maxLength = 10;
  input.placeholder = "dd-mm-yyyy";
  input.setAttribute("aria-label", "Required date, day month year");

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function validIso(day, month, year) {
    const numericDay = Number(day);
    const numericMonth = Number(month);
    const numericYear = Number(year);
    if (year.length !== 4 || numericYear < 2000 || numericMonth < 1 || numericMonth > 12) return "";
    if (numericDay < 1 || numericDay > daysInMonth(numericYear, numericMonth)) return "";
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  function partsFromDigits(digits) {
    const clean = String(digits || "").replace(/\D/g, "").slice(0, 8);
    const day = clean.slice(0, 2);
    let month = "";
    let year = "";

    if (clean.length > 2) {
      const firstMonthDigit = clean[2];
      if (Number(firstMonthDigit) > 1) {
        month = `0${firstMonthDigit}`;
        year = clean.slice(3, 7);
      } else {
        month = clean.slice(2, 4);
        year = clean.slice(4, 8);
      }
    }
    return { day, month, year };
  }

  function displayFromParts({ day, month, year }) {
    let display = day;
    if (day.length === 2) display += "-";
    if (month) display += month;
    if (month.length === 2) display += "-";
    if (year) display += year;
    return display;
  }

  function syncFromDisplay({ emit = true } = {}) {
    const parts = partsFromDigits(input.value);
    const display = displayFromParts(parts);
    if (input.value !== display) input.value = display;

    const iso = validIso(parts.day, parts.month, parts.year);
    input.dataset.iso = iso;
    input.classList.toggle("has-date-value", Boolean(input.value));
    input.setCustomValidity(input.value && !iso ? "Enter a complete valid date." : "");
    if (emit && iso) input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setIso(value, { emit = false } = {}) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      input.value = "";
      input.dataset.iso = "";
      input.classList.remove("has-date-value");
      input.setCustomValidity("");
      return;
    }
    const [, year, month, day] = match;
    input.value = `${day}-${month}-${year}`;
    input.dataset.iso = `${year}-${month}-${day}`;
    input.classList.add("has-date-value");
    input.setCustomValidity("");
    if (emit) input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  input.addEventListener("input", () => syncFromDisplay({ emit: true }));
  input.addEventListener("blur", () => {
    if (!input.value) return;
    syncFromDisplay({ emit: false });
  });

  const originalValue = window.value;
  if (typeof originalValue === "function") {
    const dateAwareValue = function dateAwareValue(id) {
      if (id === "requiredDate") return input.dataset.iso || "";
      return originalValue(id);
    };
    window.value = dateAwareValue;
    try { value = dateAwareValue; } catch (_error) { }
  }

  const originalSetValue = window.setValue;
  if (typeof originalSetValue === "function") {
    const dateAwareSetValue = function dateAwareSetValue(id, nextValue, ...args) {
      if (id === "requiredDate") {
        setIso(nextValue);
        return;
      }
      return originalSetValue(id, nextValue, ...args);
    };
    window.setValue = dateAwareSetValue;
    try { setValue = dateAwareSetValue; } catch (_error) { }
  }

  window.BPSRequiredDate = { setValue: setIso, getValue: () => input.dataset.iso || "" };
})();
