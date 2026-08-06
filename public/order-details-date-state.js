(() => {
  if (window.__bpsRequiredDateControllerStarted) return;
  window.__bpsRequiredDateControllerStarted = true;

  const DISPLAY_ID = "requiredDateDisplay";
  const HIDDEN_ID = "requiredDate";
  const BUTTON_ID = "requiredDateCalendarButton";
  const PANEL_ID = "requiredDateCalendarPanel";
  const MESSAGE = "Enter a complete valid date.";
  const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  let visibleMonth = null;

  function parseSmartDateDigits(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 6);
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

    if (cursor < digits.length) year = digits.slice(cursor, cursor + 2);
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
    if (parts.day.length !== 2 || parts.month.length !== 2 || parts.year.length !== 2) return "";
    const day = Number(parts.day);
    const month = Number(parts.month);
    const fullYear = 2000 + Number(parts.year);
    const date = new Date(fullYear, month - 1, day);
    if (
      date.getFullYear() !== fullYear
      || date.getMonth() !== month - 1
      || date.getDate() !== day
    ) return "";
    return `${fullYear}-${parts.month}-${parts.day}`;
  }

  function parseIso(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year
      || date.getMonth() !== month - 1
      || date.getDate() !== day
    ) return null;
    return date;
  }

  function isoFromDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function fromIso(iso) {
    const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}-${match[2]}-${match[1].slice(-2)}` : "";
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function sameDay(left, right) {
    return Boolean(left && right)
      && left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate();
  }

  function controls() {
    return {
      hidden: document.getElementById(HIDDEN_ID),
      display: document.getElementById(DISPLAY_ID),
      button: document.getElementById(BUTTON_ID),
      panel: document.getElementById(PANEL_ID),
    };
  }

  function emitHiddenValue(hidden) {
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
    hidden.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function ensureError(display) {
    const id = `${DISPLAY_ID}OrderValidationMessage`;
    let error = document.getElementById(id);
    if (error) return error;
    error = document.createElement("small");
    error.id = id;
    error.className = "order-field-validation-message";
    error.hidden = true;
    error.setAttribute("aria-live", "polite");
    display.closest(".date-input-shell")?.insertAdjacentElement("afterend", error);
    display.setAttribute("aria-describedby", id);
    return error;
  }

  function clearValidation() {
    const { display } = controls();
    if (!display) return;
    display.setCustomValidity("");
    display.classList.remove("is-order-field-invalid");
    display.removeAttribute("aria-invalid");
    const error = document.getElementById(`${DISPLAY_ID}OrderValidationMessage`);
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
  }

  function validate({ show = true } = {}) {
    const { hidden, display } = controls();
    if (!hidden || !display) return false;
    const valid = Boolean(parseIso(hidden.value));
    display.setCustomValidity(valid ? "" : MESSAGE);
    display.classList.toggle("is-order-field-invalid", !valid);
    display.toggleAttribute("aria-invalid", !valid);
    const error = ensureError(display);
    error.textContent = valid ? "" : MESSAGE;
    error.hidden = valid || !show;
    return valid;
  }

  function syncFromDisplay({ emit = true } = {}) {
    const { hidden, display } = controls();
    if (!hidden || !display) return "";
    const parts = parseSmartDateDigits(display.value);
    const formatted = displayDate(parts);
    if (display.value !== formatted) display.value = formatted;
    display.classList.toggle("has-date-value", Boolean(formatted));
    const iso = toIso(parts);
    const changed = hidden.value !== iso;
    hidden.value = iso;
    clearValidation();
    if (emit && changed) emitHiddenValue(hidden);
    return iso;
  }

  function syncFromHidden() {
    const { hidden, display, panel } = controls();
    if (!hidden || !display) return;
    const formatted = fromIso(hidden.value);
    if (display.value !== formatted) display.value = formatted;
    display.classList.toggle("has-date-value", Boolean(formatted));
    clearValidation();
    if (panel && !panel.hidden) renderCalendar(hidden, panel);
  }

  function setValue(value, { emit = false } = {}) {
    const { hidden, display } = controls();
    if (!hidden || !display) return false;
    const source = String(value || "").trim();
    const parsedIso = parseIso(source);
    const iso = parsedIso ? isoFromDate(parsedIso) : toIso(parseSmartDateDigits(source));
    const changed = hidden.value !== iso;
    hidden.value = iso;
    display.value = fromIso(iso);
    display.classList.toggle("has-date-value", Boolean(display.value));
    clearValidation();
    if (emit && changed) emitHiddenValue(hidden);
    return true;
  }

  function dateWithinLimits(date, hidden) {
    const minimum = parseIso(hidden.min || document.getElementById("orderDateIso")?.value);
    const maximum = parseIso(hidden.max);
    if (minimum && date < minimum) return false;
    if (maximum && date > maximum) return false;
    return true;
  }

  function renderCalendar(hidden, panel) {
    const selected = parseIso(hidden.value);
    const today = new Date();
    visibleMonth = startOfMonth(visibleMonth || selected || today);

    const monthLabel = panel.querySelector(".required-date-calendar-month");
    if (monthLabel) {
      monthLabel.textContent = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(visibleMonth);
    }

    const grid = panel.querySelector(".required-date-calendar-grid");
    if (!grid) return;
    grid.replaceChildren();

    const mondayOffset = (visibleMonth.getDay() + 6) % 7;
    const firstVisible = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1 - mondayOffset);

    for (let index = 0; index < 42; index += 1) {
      const date = new Date(firstVisible.getFullYear(), firstVisible.getMonth(), firstVisible.getDate() + index);
      const dayButton = document.createElement("button");
      dayButton.type = "button";
      dayButton.className = "required-date-calendar-day";
      dayButton.textContent = String(date.getDate());
      dayButton.dataset.date = isoFromDate(date);
      dayButton.setAttribute("aria-label", new Intl.DateTimeFormat("en-AU", { dateStyle: "full" }).format(date));
      dayButton.classList.toggle("is-outside", date.getMonth() !== visibleMonth.getMonth());
      dayButton.classList.toggle("is-today", sameDay(date, today));
      dayButton.classList.toggle("is-selected", sameDay(date, selected));
      dayButton.disabled = !dateWithinLimits(date, hidden);
      dayButton.addEventListener("click", () => {
        setValue(dayButton.dataset.date || "", { emit: true });
        closeCalendar({ restoreFocus: true });
      });
      grid.append(dayButton);
    }
  }

  function openCalendar() {
    const { hidden, button, panel } = controls();
    if (!hidden || !button || !panel) return;
    visibleMonth = startOfMonth(parseIso(hidden.value) || new Date());
    renderCalendar(hidden, panel);
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    button.closest(".sheet-field-row")?.classList.add("required-date-calendar-open");
    const selected = panel.querySelector(".required-date-calendar-day.is-selected:not(:disabled)");
    const today = panel.querySelector(".required-date-calendar-day.is-today:not(:disabled)");
    (selected || today || panel.querySelector(".required-date-calendar-day:not(:disabled)"))?.focus({ preventScroll: true });
  }

  function closeCalendar({ restoreFocus = false } = {}) {
    const { button, panel } = controls();
    if (!button || !panel) return;
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.closest(".sheet-field-row")?.classList.remove("required-date-calendar-open");
    if (restoreFocus) button.focus({ preventScroll: true });
  }

  function initialiseCalendar(shell, hidden) {
    let button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement("button");
      button.id = BUTTON_ID;
      button.type = "button";
      button.setAttribute("aria-label", "Choose required date");
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-controls", PANEL_ID);
      button.setAttribute("aria-expanded", "false");
      button.title = "Choose required date";
      button.innerHTML = '<img src="/calendar.svg?v=20260731-4" alt="">';
      shell.append(button);
    }

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.hidden = true;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Choose required date");
      panel.innerHTML = `
        <div class="required-date-calendar-header">
          <button type="button" class="required-date-calendar-nav" data-calendar-previous aria-label="Previous month">‹</button>
          <div class="required-date-calendar-month" aria-live="polite"></div>
          <button type="button" class="required-date-calendar-nav" data-calendar-next aria-label="Next month">›</button>
        </div>
        <div class="required-date-calendar-weekdays" aria-hidden="true">${WEEKDAYS.map((day) => `<span>${day}</span>`).join("")}</div>
        <div class="required-date-calendar-grid"></div>
        <div class="required-date-calendar-footer">
          <button type="button" class="required-date-calendar-action" data-calendar-clear>Clear</button>
          <button type="button" class="required-date-calendar-action" data-calendar-today>Today</button>
        </div>
      `;
      shell.append(panel);
    }

    if (button.dataset.requiredDateCalendarBound === "true") return;
    button.dataset.requiredDateCalendarBound = "true";
    button.addEventListener("click", () => {
      if (panel.hidden) openCalendar();
      else closeCalendar({ restoreFocus: true });
    });
    panel.querySelector("[data-calendar-previous]")?.addEventListener("click", () => {
      visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
      renderCalendar(hidden, panel);
    });
    panel.querySelector("[data-calendar-next]")?.addEventListener("click", () => {
      visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
      renderCalendar(hidden, panel);
    });
    panel.querySelector("[data-calendar-clear]")?.addEventListener("click", () => {
      setValue("", { emit: true });
      closeCalendar({ restoreFocus: true });
    });
    panel.querySelector("[data-calendar-today]")?.addEventListener("click", () => {
      const today = new Date();
      if (!dateWithinLimits(today, hidden)) return;
      setValue(isoFromDate(today), { emit: true });
      closeCalendar({ restoreFocus: true });
    });
    panel.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeCalendar({ restoreFocus: true });
    });
    document.addEventListener("pointerdown", (event) => {
      if (panel.hidden || shell.contains(event.target)) return;
      closeCalendar();
    }, true);
  }

  function initialiseDateField() {
    const hidden = document.getElementById(HIDDEN_ID);
    const display = document.getElementById(DISPLAY_ID);
    if (!hidden || !display) return;

    let shell = hidden.closest(".date-input-shell") || display.closest(".date-input-shell");
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "date-input-shell";
      display.parentNode?.insertBefore(shell, display);
    }
    if (display.parentElement !== shell) shell.append(display);
    if (hidden.parentElement !== shell) shell.append(hidden);

    hidden.type = "hidden";
    hidden.hidden = true;
    hidden.tabIndex = -1;
    hidden.classList.remove("date-native-picker");
    hidden.removeAttribute("aria-label");

    display.type = "text";
    display.inputMode = "numeric";
    display.autocomplete = "off";
    display.maxLength = 8;
    display.placeholder = "dd-mm-yy";
    display.setAttribute("aria-label", "Required date, day month two digit year");
    document.querySelector(`label[for="${HIDDEN_ID}"], label[for="${DISPLAY_ID}"]`)?.setAttribute("for", DISPLAY_ID);

    initialiseCalendar(shell, hidden);

    if (display.dataset.requiredDateBound !== "true") {
      display.dataset.requiredDateBound = "true";
      display.addEventListener("input", () => syncFromDisplay({ emit: true }));
      display.addEventListener("blur", () => syncFromDisplay({ emit: false }));
      hidden.addEventListener("change", syncFromHidden);
    }
    syncFromHidden();
  }

  function removeFixedStateField() {
    const input = document.getElementById("deliveryState");
    if (!input) return false;
    input.value = "VIC";
    input.type = "hidden";
    input.hidden = true;

    const cell = input.closest(".structured-address-cell, .sheet-field-row, td");
    if (!cell) return true;
    const host = cell.parentElement;
    document.getElementById("orderForm")?.append(input);
    cell.remove();
    host?.classList.add("order-address-without-state");
    return true;
  }

  function start() {
    initialiseDateField();
    if (removeFixedStateField()) return;

    const observer = new MutationObserver(() => {
      if (!removeFixedStateField()) return;
      observer.disconnect();
    });
    observer.observe(document.getElementById("orderForm") || document.body, { childList: true, subtree: true });
  }

  let style = document.getElementById("required-date-and-state-source-styles");
  if (!style) {
    style = document.createElement("style");
    style.id = "required-date-and-state-source-styles";
    document.head.append(style);
  }
  style.textContent = `
    .order-details-section .sheet-details-grid{overflow:visible}
    .sheet-field-row.required-date-calendar-open{position:relative;z-index:100005;overflow:visible}
    .date-input-shell{position:relative;display:block;width:100%;height:39px;overflow:visible;background:#fff}
    .date-input-shell::after{display:none!important;content:none!important}
    .date-input-shell #requiredDate{display:none!important}
    .date-input-shell #requiredDateDisplay{box-sizing:border-box;width:100%;height:39px;margin:0;padding:0 42px 0 10px;color:#17211f;background:#fff;border:0;border-radius:0;outline:0;font:400 11px/39px Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left}
    .date-input-shell #requiredDateDisplay::placeholder{color:#aab0b2;opacity:1}
    .date-input-shell #requiredDateDisplay:not(.has-date-value){color:#aab0b2}
    .date-input-shell #requiredDateDisplay.has-date-value{color:#17211f}
    .date-input-shell #requiredDateDisplay:focus{position:relative;z-index:2;box-shadow:inset 0 0 0 1px var(--bell-green,#006557)}
    #${BUTTON_ID}{position:absolute;z-index:5;top:0;right:0;display:grid;place-items:center;width:39px;height:39px;margin:0;padding:0;border:0;border-left:1px solid #d5dcda;border-radius:0;background:#fff;cursor:pointer;box-sizing:border-box}
    #${BUTTON_ID} img{display:block;width:12px;height:12px;pointer-events:none}
    #${BUTTON_ID}:hover{background:#f5f8f7}
    #${BUTTON_ID}:focus-visible,#${BUTTON_ID}[aria-expanded="true"]{outline:0;box-shadow:inset 0 0 0 1px var(--bell-green,#006557)}
    #${PANEL_ID}{position:absolute;z-index:100006;top:100%;right:0;width:258px;margin:0;padding:10px;border:1px solid #cfd7d4;border-radius:0 0 4px 4px;background:#fff;box-shadow:0 10px 24px rgba(23,33,31,.16);box-sizing:border-box;color:#17211f;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    #${PANEL_ID}[hidden]{display:none}
    .required-date-calendar-header{display:grid;grid-template-columns:32px minmax(0,1fr) 32px;align-items:center;gap:4px;height:32px;margin:0 0 6px}
    .required-date-calendar-month{overflow:hidden;color:#17211f;font-size:11px;font-weight:700;line-height:1.2;text-align:center;text-overflow:ellipsis;white-space:nowrap}
    .required-date-calendar-nav{display:grid;place-items:center;width:32px;height:32px;margin:0;padding:0;border:0;border-radius:3px;background:#fff;color:#42514d;cursor:pointer;font:500 18px/1 Inter,system-ui,sans-serif}
    .required-date-calendar-nav:hover,.required-date-calendar-nav:focus-visible{outline:0;background:#eef6f3}
    .required-date-calendar-weekdays,.required-date-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px}
    .required-date-calendar-weekdays{margin-bottom:3px}
    .required-date-calendar-weekdays span{display:grid;place-items:center;height:24px;color:#687471;font-size:9px;font-weight:600;line-height:1}
    .required-date-calendar-day{display:grid;place-items:center;width:100%;height:28px;margin:0;padding:0;border:0;border-radius:3px;background:#fff;color:#17211f;cursor:pointer;font:500 10px/1 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums}
    .required-date-calendar-day:hover,.required-date-calendar-day:focus-visible{outline:0;background:#eef6f3}
    .required-date-calendar-day.is-outside{color:#a2aaa8}
    .required-date-calendar-day.is-today{box-shadow:inset 0 0 0 1px #9fb5ae}
    .required-date-calendar-day.is-selected{background:var(--bell-green,#006557);color:#fff;font-weight:700;box-shadow:none}
    .required-date-calendar-day:disabled{color:#c7cecc;background:#fff;cursor:not-allowed}
    .required-date-calendar-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0 0;padding:8px 0 0;border-top:1px solid #e2e7e5}
    .required-date-calendar-action{min-height:28px;margin:0;padding:0 8px;border:0;border-radius:3px;background:#fff;color:var(--bell-green,#006557);cursor:pointer;font:600 10px/1 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .required-date-calendar-action:hover,.required-date-calendar-action:focus-visible{outline:0;background:#eef6f3}
    .order-address-without-state{grid-template-columns:minmax(0,1fr) 110px!important}
    @media(max-width:760px){#${PANEL_ID}{width:min(258px,calc(100vw - 32px))}}
  `;

  window.BPSRequiredDate = {
    setValue,
    validate,
    clearValidation,
    syncFromDisplay,
    syncFromHidden,
    openCalendar,
    closeCalendar,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
