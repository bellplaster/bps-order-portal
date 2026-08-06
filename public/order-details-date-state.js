(() => {
  const DISPLAY_ID = "requiredDateDisplay";
  const HIDDEN_ID = "requiredDate";

  function parseSmartDateDigits(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    let cursor = 0;
    let day = "";
    let month = "";
    let year = "";

    if (digits.length) {
      const first = digits[0];
      if (Number(first) > 3) {
        day = `0${first}`;
        cursor = 1;
      } else {
        day = digits.slice(0, 2);
        cursor = Math.min(2, digits.length);
      }
    }

    if (cursor < digits.length) {
      const first = digits[cursor];
      if (Number(first) > 1) {
        month = `0${first}`;
        cursor += 1;
      } else {
        month = digits.slice(cursor, cursor + 2);
        cursor = Math.min(cursor + 2, digits.length);
      }
    }

    if (cursor < digits.length) year = digits.slice(cursor, cursor + 4);
    return { day, month, year };
  }

  function displayDate(parts) {
    let value = parts.day;
    if (parts.day.length === 2) value += "-";
    if (parts.month) value += parts.month;
    if (parts.month.length === 2) value += "-";
    if (parts.year) value += parts.year;
    return value;
  }

  function toIso(parts) {
    if (parts.day.length !== 2 || parts.month.length !== 2 || parts.year.length !== 4) return "";
    const day = Number(parts.day);
    const month = Number(parts.month);
    const year = Number(parts.year);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      year < 2000
      || date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day
    ) return "";
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function syncHidden(display, hidden) {
    const parts = parseSmartDateDigits(display.value);
    const formatted = displayDate(parts);
    if (display.value !== formatted) display.value = formatted;
    display.classList.toggle("has-date-value", Boolean(formatted));
    hidden.value = toIso(parts);
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
    if (hidden.value) hidden.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function initialiseDateField() {
    const hidden = document.getElementById(HIDDEN_ID);
    const display = document.getElementById(DISPLAY_ID);
    if (!hidden || !display) return;

    display.inputMode = "numeric";
    display.autocomplete = "off";
    display.maxLength = 10;
    display.placeholder = "dd-mm-yyyy";
    display.setAttribute("aria-label", "Required date, day month year");
    display.classList.toggle("has-date-value", Boolean(display.value));

    if (display.dataset.smartDateBound === "true") return;
    display.dataset.smartDateBound = "true";

    display.addEventListener("input", (event) => {
      event.stopImmediatePropagation();
      syncHidden(display, hidden);
    }, true);

    display.addEventListener("blur", () => syncHidden(display, hidden));
    hidden.addEventListener("change", () => {
      const match = String(hidden.value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      display.value = match ? `${match[3]}-${match[2]}-${match[1]}` : "";
      display.classList.toggle("has-date-value", Boolean(display.value));
    });
  }

  function removeFixedStateField() {
    const input = document.getElementById("deliveryState");
    if (!input || input.dataset.fixedStateRemoved === "true") return;
    input.dataset.fixedStateRemoved = "true";
    input.value = "VIC";
    input.type = "hidden";

    const cell = input.closest(".structured-address-cell, .sheet-field-row, td");
    if (!cell) return;
    const host = cell.parentElement;
    host?.classList.add("order-address-without-state");
    cell.remove();
  }

  function start() {
    initialiseDateField();
    removeFixedStateField();

    const observer = new MutationObserver(() => {
      initialiseDateField();
      removeFixedStateField();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  const style = document.createElement("style");
  style.dataset.orderDetailsDateState = "true";
  style.textContent = `
    .date-input-shell #requiredDateDisplay::placeholder{color:#aab0b2!important;opacity:1!important}
    .date-input-shell #requiredDateDisplay:not(.has-date-value){color:#aab0b2!important}
    .date-input-shell #requiredDateDisplay.has-date-value{color:#17211f!important}
    .order-address-without-state{grid-template-columns:minmax(0,1fr) 110px!important}
  `;
  document.head.append(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
