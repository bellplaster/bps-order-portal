(() => {
  if (window.__bpsOrderFieldBehaviourStarted) return;
  window.__bpsOrderFieldBehaviourStarted = true;

  const FIELD_CONFIGS = {
    reference: { type: "reference", capitalisation: "sentence", required: true, message: "Enter the customer order reference." },
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
    return Boolean(field && FIELD_CONFIGS[field.id]);
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

  function suggestCapitalisation(value, mode) {
    const text = String(value || "");
    if (mode === "sentence") {
      return text.replace(/^(\s*)(\p{Ll})/u, (_match, space, letter) => `${space}${letter.toLocaleUpperCase("en-AU")}`);
    }
    if (mode === "words") {
      return text.replace(/(^|[\s\-'’])(\p{Ll})/gu, (_match, boundary, letter) => `${boundary}${letter.toLocaleUpperCase("en-AU")}`);
    }
    return text;
  }

  function formatLoadedValue(value, type, capitalisation = "") {
    if (type === "phone") return formatAustralianPhone(value);
    const cleaner = type === "instructions" ? cleanInstructions : cleanSingleLine;
    let text = cleaner(value);
    if (!text) return "";

    if (capitalisation && isUniformCase(text)) {
      text = text.toLocaleLowerCase("en-AU");
      text = suggestCapitalisation(text, capitalisation);
    } else if (capitalisation) {
      text = suggestCapitalisation(text, capitalisation);
    }

    return type === "street" ? restoreAddressAbbreviations(text) : text;
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
      field.inputMode = "text";
      field.maxLength = 80;
      field.removeAttribute("pattern");
      field.removeAttribute("title");
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

  function clearValidation(field) {
    if (!owns(field)) return;
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

    if (!value) valid = config.required !== true;
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
    const config = FIELD_CONFIGS[field?.id];
    if (!field || !config) return false;
    configureField(field);
    field.value = formatLoadedValue(value, config.type, config.capitalisation);
    stateFor(field).assistanceEnabled = assist;
    clearValidation(field);
    if (validate) validateField(field, { show: true });
    return true;
  }

  function normaliseCurrentValues() {
    Object.keys(FIELD_CONFIGS).forEach((id) => {
      const field = document.getElementById(id);
      if (!field || document.activeElement === field) return;
      setValue(field, field.value, { assist: true });
    });
  }

  function capitaliseInitialTyping(field, mode) {
    const state = stateFor(field);
    if (!state.assistanceEnabled || !mode) return;
    const previous = String(field.value || "");
    const next = suggestCapitalisation(previous, mode);
    if (next === previous) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    field.value = next;
    if (start != null && end != null) {
      try { field.setSelectionRange(start, end); } catch (_error) { }
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
    }
  }

  function onInput(event) {
    const field = event.target;
    const config = FIELD_CONFIGS[field?.id];
    if (!config) return;
    configureField(field);

    if (config.type === "reference") {
      field.value = String(field.value || "").normalize("NFKC").replace(invisibleCharacters, "").replace(singleLineControls, " ").slice(0, 80);
      capitaliseInitialTyping(field, config.capitalisation);
    } else if (config.type === "phone") {
      preservePhoneCursor(field, formatAustralianPhone(field.value, { typing: true }));
    } else {
      capitaliseInitialTyping(field, config.capitalisation);
    }

    const hasValue = Boolean(String(field.value || "").trim());
    if (["person", "street"].includes(config.type)) {
      if (hasValue) validateField(field, { show: true });
      else clearValidation(field);
    } else if (field.classList.contains("is-order-field-invalid")) {
      validateField(field, { show: true });
    }
  }

  function onBlur(event) {
    const field = event.target;
    const config = FIELD_CONFIGS[field?.id];
    if (!config) return;
    if (config.type === "phone") field.value = formatAustralianPhone(field.value);
    else if (config.type === "instructions") field.value = cleanInstructions(field.value);
    else field.value = cleanSingleLine(field.value);
    validateField(field, { show: true });
  }

  function start() {
    document.querySelectorAll("#orderForm input, #orderForm textarea").forEach((field) => {
      if (!owns(field)) return;
      configureField(field);
      if (field.value) setValue(field, field.value, { assist: true });
    });
    document.addEventListener("focusin", (event) => {
      if (!owns(event.target)) return;
      configureField(event.target);
      if (!event.target.dataset.orderFieldFocusNormalised) {
        event.target.dataset.orderFieldFocusNormalised = "true";
        setValue(event.target, event.target.value, { assist: true });
      }
    });
    document.addEventListener("beforeinput", onBeforeInput, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("blur", onBlur, true);
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
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
