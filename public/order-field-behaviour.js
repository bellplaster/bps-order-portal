(() => {
  if (window.__bpsOrderFieldBehaviourStarted) return;
  window.__bpsOrderFieldBehaviourStarted = true;

  const FIELD_CONFIGS = {
    reference: { type: "reference", capitalisation: "sentence", required: false, message: "" },
    requiredDateDisplay: { type: "date", required: true, message: "Enter a complete valid date." },
    contactName: { type: "person", capitalisation: "words", required: true, message: "Use letters, spaces, apostrophes, hyphens and full stops only." },
    contactMobile: { type: "phone", required: true, message: "Enter a valid Australian phone number." },
    deliveryAddressSearch: { type: "street", capitalisation: "words", required: false, message: "Enter a valid street address." },
    deliveryInstructions: { type: "instructions", capitalisation: "sentence", required: false, message: "Remove unsupported characters from the instructions." },
  };

  const typingState = new WeakMap();
  const invisibleCharacters = /[\u200b-\u200d\u2060\ufeff]/g;
  const singleLineControls = /[\u0000-\u001f\u007f-\u009f]/g;
  const multilineControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
  const stateAbbreviations = new Map([
    ["Vic", "VIC"], ["Nsw", "NSW"], ["Qld", "QLD"], ["Sa", "SA"],
    ["Wa", "WA"], ["Act", "ACT"], ["Nt", "NT"], ["Tas", "TAS"],
  ]);

  function fieldFor(target) {
    if (typeof target === "string") return document.getElementById(target);
    return target || null;
  }

  function owns(target) {
    const field = fieldFor(target);
    return Boolean(field && (FIELD_CONFIGS[field.id] || field.id === "requiredDate"));
  }

  function cleanSingleLine(value, { trim = true } = {}) {
    let text = String(value ?? "")
      .normalize("NFKC")
      .replace(invisibleCharacters, "")
      .replace(singleLineControls, " ")
      .replace(/\s+/gu, " ");
    if (trim) text = text.trim();
    return text;
  }

  function cleanInstructions(value, { trim = true } = {}) {
    let text = String(value ?? "")
      .normalize("NFKC")
      .replace(/\r\n?/g, "\n")
      .replace(invisibleCharacters, "")
      .replace(multilineControls, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
    if (trim) text = text.trim();
    return text;
  }

  function phoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function domesticPhoneDigits(value) {
    let digits = phoneDigits(value);
    if (digits.startsWith("0061")) digits = digits.slice(2);
    if (digits.startsWith("61") && /^61[23478]\d{8}$/.test(digits)) digits = `0${digits.slice(2)}`;
    return digits;
  }

  function formatAustralianPhone(value, { typing = false } = {}) {
    const raw = String(value || "").trim();
    const international = /^\s*(?:\+|00)61/.test(raw);
    let digits = phoneDigits(raw);
    if (digits.startsWith("0061")) digits = digits.slice(2);

    if (international && digits.startsWith("61")) {
      const national = digits.slice(2).replace(/^0/, "").slice(0, 9);
      if (!national) return "+61";
      if (national.startsWith("4")) return ["+61", national.slice(0, 3), national.slice(3, 6), national.slice(6, 9)].filter(Boolean).join(" ");
      if (/^[2378]/.test(national)) return ["+61", national.slice(0, 1), national.slice(1, 5), national.slice(5, 9)].filter(Boolean).join(" ");
    }

    digits = domesticPhoneDigits(raw);
    const maximum = /^(?:1300|1800|1900)/.test(digits) || /^0[23478]/.test(digits) ? 10 : digits.startsWith("13") ? 6 : 10;
    digits = digits.slice(0, maximum);

    if (/^04/.test(digits)) return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 10)].filter(Boolean).join(" ");
    if (/^0[2378]/.test(digits)) return [digits.slice(0, 2), digits.slice(2, 6), digits.slice(6, 10)].filter(Boolean).join(" ");
    if (/^(?:1300|1800|1900)/.test(digits)) return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 10)].filter(Boolean).join(" ");
    if (/^13/.test(digits)) return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)].filter(Boolean).join(" ");
    if (/^\d{1,8}$/.test(digits)) return digits.length > 4 ? [digits.slice(0, 4), digits.slice(4, 8)].filter(Boolean).join(" ") : digits;
    return typing ? digits : raw;
  }

  function normaliseAustralianPhone(value, optional = false) {
    const formatted = formatAustralianPhone(value);
    if (!phoneDigits(value) && optional) return "";
    return isValidAustralianPhone(formatted) ? formatted : "";
  }

  function isValidAustralianPhone(value) {
    const raw = String(value || "").trim();
    if (/^\+61/.test(raw)) {
      const digits = phoneDigits(raw);
      return /^614\d{8}$/.test(digits) || /^61[2378]\d{8}$/.test(digits);
    }
    const digits = domesticPhoneDigits(raw);
    return /^04\d{8}$/.test(digits)
      || /^0[2378]\d{8}$/.test(digits)
      || /^(?:1300|1800|1900)\d{6}$/.test(digits)
      || /^13\d{4}$/.test(digits)
      || /^\d{8}$/.test(digits);
  }

  function suggestCapitalisation(value, mode) {
    const text = String(value || "");
    if (mode === "sentence") return text.replace(/^(\s*)(\p{Ll})/u, (_match, space, letter) => `${space}${letter.toLocaleUpperCase("en-AU")}`);
    if (mode === "words") return text.replace(/(^|[\s\-'’])(\p{Ll})/gu, (_match, boundary, letter) => `${boundary}${letter.toLocaleUpperCase("en-AU")}`);
    return text;
  }

  function letters(value) {
    return String(value || "").match(/\p{L}/gu) || [];
  }

  function isUniformCase(value) {
    const found = letters(value);
    if (!found.length) return false;
    const joined = found.join("");
    return joined === joined.toLocaleUpperCase("en-AU") || joined === joined.toLocaleLowerCase("en-AU");
  }

  function restoreAddressAbbreviations(value) {
    let text = String(value || "");
    stateAbbreviations.forEach((replacement, token) => {
      text = text.replace(new RegExp(`\\b${token}\\b`, "g"), replacement);
    });
    return text.replace(/\bPo Box\b/g, "PO Box");
  }

  function formatLoadedValue(value, type, capitalisation = "") {
    if (type === "phone") return formatAustralianPhone(value);
    const cleaner = type === "instructions" ? cleanInstructions : cleanSingleLine;
    let text = cleaner(value);
    if (!text) return "";
    if (capitalisation && isUniformCase(text)) text = suggestCapitalisation(text.toLocaleLowerCase("en-AU"), capitalisation);
    else if (capitalisation) text = suggestCapitalisation(text, capitalisation);
    return type === "street" ? restoreAddressAbbreviations(text) : text;
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function datePartsFromDigits(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    const day = digits.slice(0, 2);
    let month = "";
    let year = "";
    if (digits.length > 2) {
      const firstMonthDigit = digits[2];
      if (Number(firstMonthDigit) > 1) {
        month = `0${firstMonthDigit}`;
        year = digits.slice(3, 7);
      } else {
        month = digits.slice(2, 4);
        year = digits.slice(4, 8);
      }
    }
    return { day, month, year };
  }

  function dateDisplay(parts) {
    let value = parts.day;
    if (parts.day.length === 2) value += "-";
    if (parts.month) value += parts.month;
    if (parts.month.length === 2) value += "-";
    if (parts.year) value += parts.year;
    return value;
  }

  function dateIso(parts) {
    const day = Number(parts.day);
    const month = Number(parts.month);
    const year = Number(parts.year);
    if (parts.year.length !== 4 || year < 2000 || month < 1 || month > 12) return "";
    if (day < 1 || day > daysInMonth(year, month)) return "";
    return `${parts.year}-${parts.month.padStart(2, "0")}-${parts.day.padStart(2, "0")}`;
  }

  function setDateValue(iso, { emit = false } = {}) {
    const hidden = document.getElementById("requiredDate");
    const display = document.getElementById("requiredDateDisplay");
    if (!hidden || !display) return false;
    const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    hidden.value = match ? `${match[1]}-${match[2]}-${match[3]}` : "";
    display.value = match ? `${match[3]}-${match[2]}-${match[1]}` : "";
    clearValidation(display);
    if (emit) hidden.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function syncDateFromDisplay({ emit = true } = {}) {
    const hidden = document.getElementById("requiredDate");
    const display = document.getElementById("requiredDateDisplay");
    if (!hidden || !display) return "";
    const parts = datePartsFromDigits(display.value);
    display.value = dateDisplay(parts);
    const iso = dateIso(parts);
    hidden.value = iso;
    display.setCustomValidity(display.value && !iso ? FIELD_CONFIGS.requiredDateDisplay.message : "");
    if (emit && iso) hidden.dispatchEvent(new Event("change", { bubbles: true }));
    return iso;
  }

  function stateFor(field) {
    let state = typingState.get(field);
    if (!state) {
      state = { assistanceEnabled: true };
      typingState.set(field, state);
    }
    return state;
  }

  function configureField(field) {
    const config = FIELD_CONFIGS[field?.id];
    if (!config || field.dataset.orderFieldBehaviour === "true") return;
    field.dataset.orderFieldBehaviour = "true";
    field.autocapitalize = config.capitalisation === "words" ? "words" : config.capitalisation === "sentence" ? "sentences" : "off";
    if (config.type === "phone") {
      field.inputMode = "tel";
      field.maxLength = 18;
      field.setAttribute("title", config.message);
    }
    if (config.type === "reference") {
      field.required = false;
      field.placeholder = "Reference (optional)";
      field.inputMode = "text";
      field.maxLength = 80;
      field.removeAttribute("pattern");
      field.removeAttribute("title");
    }
    if (config.type === "date") {
      field.inputMode = "numeric";
      field.maxLength = 10;
      field.placeholder = "dd-mm-yyyy";
    }
    stateFor(field);
  }

  function ensureError(field) {
    const id = `${field.id}OrderValidationMessage`;
    let error = document.getElementById(id);
    if (error) return error;
    error = document.createElement("small");
    error.id = id;
    error.className = "order-field-validation-message";
    error.hidden = true;
    error.setAttribute("aria-live", "polite");
    field.insertAdjacentElement("afterend", error);
    field.setAttribute("aria-describedby", [field.getAttribute("aria-describedby"), id].filter(Boolean).join(" "));
    return error;
  }

  function clearValidation(target) {
    const field = fieldFor(target);
    if (!field || !FIELD_CONFIGS[field.id]) return;
    field.setCustomValidity("");
    field.classList.remove("is-order-field-invalid");
    field.removeAttribute("aria-invalid");
    const error = document.getElementById(`${field.id}OrderValidationMessage`);
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
  }

  function validateField(target, { show = true } = {}) {
    const field = fieldFor(target);
    const config = FIELD_CONFIGS[field?.id];
    if (!config) return true;
    configureField(field);
    const value = String(field.value || "").trim();
    let valid = true;
    if (config.type === "date") valid = Boolean(document.getElementById("requiredDate")?.value);
    else if (!value) valid = config.required !== true;
    else if (config.type === "person") valid = /^(?=.*\p{L})[\p{L}\p{M} .'’\-]+$/u.test(value);
    else if (config.type === "phone") valid = isValidAustralianPhone(value);
    else if (config.type === "street") valid = /^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} .,'’&/#()\-]+$/u.test(value);

    const message = valid ? "" : config.message;
    field.setCustomValidity(message);
    field.classList.toggle("is-order-field-invalid", !valid);
    field.toggleAttribute("aria-invalid", !valid);
    const error = ensureError(field);
    error.textContent = message;
    error.hidden = valid || !show;
    return valid;
  }

  function setValue(target, value, { assist = true, validate = false } = {}) {
    const field = fieldFor(target);
    if (field?.id === "requiredDate") return setDateValue(value);
    const config = FIELD_CONFIGS[field?.id];
    if (!field || !config) return false;
    configureField(field);
    field.value = config.type === "date" ? dateDisplay(datePartsFromDigits(value)) : formatLoadedValue(value, config.type, config.capitalisation);
    stateFor(field).assistanceEnabled = assist;
    clearValidation(field);
    if (validate) validateField(field, { show: true });
    return true;
  }

  function shouldCapitalise(field, config, data) {
    if (!config.capitalisation || !stateFor(field).assistanceEnabled || !/^\p{Ll}$/u.test(data || "")) return false;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    if (start == null || end == null || start !== end) return false;
    if (config.capitalisation === "sentence") return !field.value.slice(0, start).trim();
    return start === 0 || /[\s\-'’]/u.test(field.value[start - 1] || "");
  }

  function onBeforeInput(event) {
    const field = event.target;
    const config = FIELD_CONFIGS[field?.id];
    if (!config) return;
    configureField(field);
    const inputType = String(event.inputType || "");
    const hasSelection = field.selectionStart !== field.selectionEnd;
    const editingEarlierText = field.selectionStart != null && field.selectionStart !== String(field.value || "").length;
    if (inputType.startsWith("delete") || hasSelection || editingEarlierText || /Paste|Drop|History/i.test(inputType)) {
      stateFor(field).assistanceEnabled = false;
      return;
    }
    if (inputType === "insertText" && shouldCapitalise(field, config, event.data)) {
      event.preventDefault();
      const upper = event.data.toLocaleUpperCase("en-AU");
      field.setRangeText(upper, field.selectionStart, field.selectionEnd, "end");
      field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: upper }));
    }
  }

  function preservePhoneCursor(field, next) {
    const start = field.selectionStart ?? String(field.value || "").length;
    const digitsBefore = phoneDigits(String(field.value || "").slice(0, start)).length;
    field.value = next;
    if (document.activeElement !== field) return;
    let cursor = 0;
    let seen = 0;
    while (cursor < next.length && seen < digitsBefore) {
      if (/\d/.test(next[cursor])) seen += 1;
      cursor += 1;
    }
    try { field.setSelectionRange(cursor, cursor); } catch (_error) { }
  }

  function onInput(event) {
    const field = event.target;
    const config = FIELD_CONFIGS[field?.id];
    if (!config) return;
    if (config.type === "date") syncDateFromDisplay({ emit: true });
    else if (config.type === "reference") field.value = String(field.value || "").normalize("NFKC").replace(invisibleCharacters, "").replace(singleLineControls, " ").slice(0, 80);
    else if (config.type === "phone") preservePhoneCursor(field, formatAustralianPhone(field.value, { typing: true }));

    const hasValue = Boolean(String(field.value || "").trim());
    if (["person", "street", "date"].includes(config.type)) {
      if (hasValue) validateField(field, { show: true });
      else clearValidation(field);
    } else if (field.classList.contains("is-order-field-invalid")) validateField(field, { show: true });
  }

  function onBlur(event) {
    const field = event.target;
    const config = FIELD_CONFIGS[field?.id];
    if (!config) return;
    if (config.type === "date") syncDateFromDisplay({ emit: false });
    else if (config.type === "phone") field.value = formatAustralianPhone(field.value);
    else if (config.type === "instructions") field.value = cleanInstructions(field.value);
    else field.value = cleanSingleLine(field.value);
    validateField(field, { show: true });
  }

  function normaliseCurrentValues() {
    Object.keys(FIELD_CONFIGS).forEach((id) => {
      const field = document.getElementById(id);
      if (!field || document.activeElement === field || id === "requiredDateDisplay") return;
      setValue(field, field.value, { assist: true });
    });
    const hiddenDate = document.getElementById("requiredDate");
    if (hiddenDate?.value) setDateValue(hiddenDate.value);
  }

  function start() {
    document.querySelectorAll("#orderForm input, #orderForm textarea").forEach((field) => {
      if (!FIELD_CONFIGS[field.id]) return;
      configureField(field);
      if (field.value) setValue(field, field.value, { assist: true });
    });
    const hiddenDate = document.getElementById("requiredDate");
    if (hiddenDate?.value) setDateValue(hiddenDate.value);
    document.addEventListener("focusin", (event) => {
      if (!FIELD_CONFIGS[event.target?.id]) return;
      configureField(event.target);
    });
    document.addEventListener("beforeinput", onBeforeInput, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("blur", onBlur, true);
    document.getElementById("orderForm")?.addEventListener("reset", () => {
      typingState.clear?.();
      queueMicrotask(() => setDateValue(""));
    });
    window.addEventListener("pageshow", normaliseCurrentValues);
  }

  const phoneApi = {
    normalise: normaliseAustralianPhone,
    formatTyping: (value) => formatAustralianPhone(value, { typing: true }),
    format: formatAustralianPhone,
    isValid: isValidAustralianPhone,
  };

  window.BPSPhone = phoneApi;
  window.normaliseMobile = normaliseAustralianPhone;
  window.formatMobileTyping = phoneApi.formatTyping;
  window.formatMobileField = (event) => { event.target.value = phoneApi.formatTyping(event.target.value); };
  try { normaliseMobile = normaliseAustralianPhone; } catch (_error) { }
  try { formatMobileTyping = phoneApi.formatTyping; } catch (_error) { }
  try { formatMobileField = window.formatMobileField; } catch (_error) { }

  window.BPSOrderFields = {
    owns,
    setValue,
    setDateValue,
    validateField,
    clearValidation,
    normaliseCurrentValues,
    formatLoadedValue,
    formatAddressDisplay: (value) => formatLoadedValue(value, "street", "words"),
  };
  window.BPSOrderFieldRules = {
    formatAustralianPhone,
    normaliseAustralianPhone,
    isValidAustralianPhone,
    suggestCapitalisation,
    formatLoadedValue,
    datePartsFromDigits,
    dateDisplay,
    dateIso,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();