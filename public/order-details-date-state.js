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

  function syncHidden(display, nativeInput) {
    const parts = parseSmartDateDigits(display.value);
    const formatted = displayDate(parts);
    if (display.value !== formatted) display.value = formatted;
    display.classList.toggle("has-date-value", Boolean(formatted));
    nativeInput.value = toIso(parts);
    nativeInput.dispatchEvent(new Event("input", { bubbles: true }));
    if (nativeInput.value) nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function initialiseDateField() {
    const nativeInput = document.getElementById(HIDDEN_ID);
    if (!nativeInput) return;

    let shell = nativeInput.closest(".date-input-shell");
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "date-input-shell";
      nativeInput.parentNode?.insertBefore(shell, nativeInput);
      shell.append(nativeInput);
    }

    let display = document.getElementById(DISPLAY_ID);
    if (!display) {
      display = document.createElement("input");
      display.id = DISPLAY_ID;
      display.type = "text";
      shell.append(display);
    } else if (display.parentElement !== shell) {
      shell.append(display);
    }

    nativeInput.type = "date";
    nativeInput.hidden = false;
    nativeInput.disabled = false;
    nativeInput.tabIndex = -1;
    nativeInput.classList.add("date-native-picker");
    nativeInput.setAttribute("aria-label", "Choose required date from calendar");

    display.inputMode = "numeric";
    display.autocomplete = "off";
    display.maxLength = 10;
    display.placeholder = "dd-mm-yyyy";
    display.setAttribute("aria-label", "Required date, day month year");
    display.classList.toggle("has-date-value", Boolean(display.value));
    document.querySelector('label[for="requiredDate"]')?.setAttribute("for", DISPLAY_ID);

    if (display.dataset.smartDateBound === "true") return;
    display.dataset.smartDateBound = "true";

    display.addEventListener("input", (event) => {
      event.stopImmediatePropagation();
      syncHidden(display, nativeInput);
    }, true);

    display.addEventListener("blur", () => syncHidden(display, nativeInput));
    nativeInput.addEventListener("change", () => {
      const match = String(nativeInput.value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
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
    .date-input-shell{position:relative!important;display:block!important;width:100%!important;height:39px!important}
    .date-input-shell #requiredDateDisplay{box-sizing:border-box!important;width:100%!important;height:39px!important;margin:0!important;padding:0 42px 0 10px!important;background:#fff!important;border:0!important;outline:0!important;font:400 11px/39px Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}
    .date-input-shell #requiredDateDisplay::placeholder{color:#aab0b2!important;opacity:1!important}
    .date-input-shell #requiredDateDisplay:not(.has-date-value){color:#aab0b2!important}
    .date-input-shell #requiredDateDisplay.has-date-value{color:#17211f!important}
    .date-input-shell #requiredDateDisplay:focus{position:relative!important;z-index:2!important;box-shadow:inset 0 0 0 2px var(--bell-green)!important}
    .date-input-shell #requiredDate.date-native-picker{position:absolute!important;z-index:4!important;top:0!important;right:0!important;left:auto!important;width:40px!important;min-width:40px!important;height:39px!important;min-height:39px!important;margin:0!important;padding:0!important;opacity:.001!important;cursor:pointer!important}
    .order-address-without-state{grid-template-columns:minmax(0,1fr) 110px!important}
  `;
  document.head.append(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
