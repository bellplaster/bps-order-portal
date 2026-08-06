(() => {
  if (window.__bpsRequiredDateControllerStarted) return;
  window.__bpsRequiredDateControllerStarted = true;

  const DISPLAY_ID = "requiredDateDisplay";
  const HIDDEN_ID = "requiredDate";
  const MESSAGE = "Enter a complete valid date.";

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
    const date = new Date(Date.UTC(fullYear, month - 1, day));
    if (
      date.getUTCFullYear() !== fullYear
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day
    ) return "";
    return `${fullYear}-${parts.month}-${parts.day}`;
  }

  function fromIso(iso) {
    const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}-${match[2]}-${match[1].slice(-2)}` : "";
  }

  function controls() {
    return {
      hidden: document.getElementById(HIDDEN_ID),
      display: document.getElementById(DISPLAY_ID),
    };
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
    const valid = Boolean(hidden.value);
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
    if (emit && changed) {
      hidden.dispatchEvent(new Event("input", { bubbles: true }));
      hidden.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return iso;
  }

  function syncFromHidden() {
    const { hidden, display } = controls();
    if (!hidden || !display) return;
    const formatted = fromIso(hidden.value);
    if (display.value !== formatted) display.value = formatted;
    display.classList.toggle("has-date-value", Boolean(formatted));
    clearValidation();
  }

  function setValue(value, { emit = false } = {}) {
    const { hidden, display } = controls();
    if (!hidden || !display) return false;
    const source = String(value || "").trim();
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(source) ? source : toIso(parseSmartDateDigits(source));
    const changed = hidden.value !== iso;
    hidden.value = iso;
    display.value = fromIso(iso);
    display.classList.toggle("has-date-value", Boolean(display.value));
    clearValidation();
    if (emit && changed) hidden.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function initialiseDateField() {
    const nativeInput = document.getElementById(HIDDEN_ID);
    const display = document.getElementById(DISPLAY_ID);
    if (!nativeInput || !display) return;

    let shell = nativeInput.closest(".date-input-shell") || display.closest(".date-input-shell");
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "date-input-shell";
      display.parentNode?.insertBefore(shell, display);
    }
    if (display.parentElement !== shell) shell.append(display);
    if (nativeInput.parentElement !== shell) shell.append(nativeInput);

    nativeInput.type = "date";
    nativeInput.hidden = false;
    nativeInput.disabled = false;
    nativeInput.tabIndex = -1;
    nativeInput.className = "date-native-picker";
    nativeInput.setAttribute("aria-label", "Choose required date from calendar");

    display.type = "text";
    display.inputMode = "numeric";
    display.autocomplete = "off";
    display.maxLength = 8;
    display.placeholder = "dd-mm-yy";
    display.setAttribute("aria-label", "Required date, day month two digit year");
    document.querySelector(`label[for="${HIDDEN_ID}"], label[for="${DISPLAY_ID}"]`)?.setAttribute("for", DISPLAY_ID);

    if (display.dataset.requiredDateBound !== "true") {
      display.dataset.requiredDateBound = "true";
      display.addEventListener("input", () => syncFromDisplay({ emit: true }));
      display.addEventListener("blur", () => syncFromDisplay({ emit: false }));
      nativeInput.addEventListener("change", syncFromHidden);
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

  const style = document.createElement("style");
  style.id = "required-date-and-state-source-styles";
  style.textContent = `
    .date-input-shell{position:relative!important;display:block!important;width:100%!important;height:39px!important}
    .date-input-shell #requiredDateDisplay{box-sizing:border-box!important;width:100%!important;height:39px!important;margin:0!important;padding:0 42px 0 10px!important;color:#17211f!important;background:#fff!important;border:0!important;border-radius:0!important;outline:0!important;font:400 11px/39px Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;text-align:left!important}
    .date-input-shell #requiredDateDisplay::placeholder{color:#aab0b2!important;opacity:1!important}
    .date-input-shell #requiredDateDisplay:not(.has-date-value){color:#aab0b2!important}
    .date-input-shell #requiredDateDisplay.has-date-value{color:#17211f!important}
    .date-input-shell #requiredDateDisplay:focus{position:relative!important;z-index:2!important;box-shadow:inset 0 0 0 1px var(--bell-green)!important}
    .date-input-shell #requiredDate.date-native-picker{position:absolute!important;z-index:4!important;top:0!important;right:0!important;left:auto!important;width:40px!important;min-width:40px!important;height:39px!important;min-height:39px!important;margin:0!important;padding:0!important;opacity:.001!important;cursor:pointer!important}
    .order-address-without-state{grid-template-columns:minmax(0,1fr) 110px!important}
  `;
  document.head.append(style);

  window.BPSRequiredDate = {
    setValue,
    validate,
    clearValidation,
    syncFromDisplay,
    syncFromHidden,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
