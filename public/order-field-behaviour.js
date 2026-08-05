(() => {
  if (window.__bpsOrderFieldBehaviourStarted) return;
  window.__bpsOrderFieldBehaviourStarted = true;

  const fields = {
    reference: { type: "reference", capitalisation: "sentence", message: "Enter the customer order reference." },
    contactName: { type: "person", capitalisation: "words", message: "Use letters, spaces, apostrophes, hyphens and full stops only." },
    contactMobile: { type: "phone", message: "Enter a valid Australian phone number." },
    deliveryAddressSearch: { type: "street", capitalisation: "words", message: "Enter a valid street address." },
    deliveryInstructions: { type: "instructions", capitalisation: "sentence", message: "Remove unsupported characters from the instructions." },
  };

  const typingState = new WeakMap();
  const invisibleCharacters = /[\u200b-\u200d\u2060\ufeff]/g;
  const singleLineControls = /[\u0000-\u001f\u007f-\u009f]/g;
  const multilineControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;

  function cleanSingleLine(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .replace(invisibleCharacters, "")
      .replace(singleLineControls, " ")
      .replace(/\s+/gu, " ")
      .trim();
  }

  function cleanInstructions(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .replace(/\r\n?/g, "\n")
      .replace(invisibleCharacters, "")
      .replace(multilineControls, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
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

  function stateFor(field) {
    let state = typingState.get(field);
    if (!state) {
      state = { disabled: Boolean(field.value), previousValue: String(field.value || "") };
      typingState.set(field, state);
    }
    return state;
  }

  function capitaliseInitialTyping(field, mode) {
    const state = stateFor(field);
    if (state.disabled || !mode) return;
    const value = String(field.value || "");
    let next = value;
    if (mode === "sentence") {
      next = value.replace(/^(\s*)(\p{Ll})/u, (_match, space, letter) => `${space}${letter.toLocaleUpperCase("en-AU")}`);
    } else if (mode === "words") {
      next = value.replace(/(^|[\s-])(\p{Ll})/gu, (_match, boundary, letter) => `${boundary}${letter.toLocaleUpperCase("en-AU")}`);
    }
    if (next !== value) {
      const cursor = field.selectionStart;
      field.value = next;
      if (cursor != null) field.setSelectionRange(cursor, cursor);
    }
  }

  function configureField(field) {
    const config = fields[field?.id];
    if (!config || field.dataset.orderFieldBehaviour === "true") return;
    field.dataset.orderFieldBehaviour = "true";
    if (config.capitalisation) field.autocapitalize = config.capitalisation === "words" ? "words" : "sentences";
    if (config.type === "phone") {
      field.inputMode = "tel";
      field.maxLength = 18;
      field.setAttribute("title", config.message);
    }
    if (config.type === "reference") {
      field.inputMode = "text";
      field.removeAttribute("pattern");
      field.removeAttribute("title");
    }
  }

  function validateField(field, { show = true } = {}) {
    const config = fields[field?.id];
    if (!config) return true;
    const value = String(field.value || "").trim();
    let valid = true;
    if (!value && ["reference", "person", "phone"].includes(config.type)) valid = false;
    else if (config.type === "person") valid = /^(?=.*\p{L})[\p{L}\p{M} .'’\-]+$/u.test(value);
    else if (config.type === "phone") valid = isValidAustralianPhone(value);
    else if (config.type === "street" && value) valid = /^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} .,'’&/#()\-]+$/u.test(value);

    const message = valid ? "" : config.message;
    field.setCustomValidity(message);
    field.classList.toggle("is-order-field-invalid", !valid);
    let error = document.getElementById(`${field.id}OrderValidationMessage`);
    if (!error) {
      error = document.createElement("small");
      error.id = `${field.id}OrderValidationMessage`;
      error.className = "order-field-validation-message";
      error.hidden = true;
      error.setAttribute("aria-live", "polite");
      field.insertAdjacentElement("afterend", error);
    }
    error.textContent = message;
    error.hidden = valid || !show;
    return valid;
  }

  function onBeforeInput(event) {
    const field = event.target;
    const config = fields[field?.id];
    if (!config) return;
    configureField(field);
    const state = stateFor(field);
    const hasSelection = field.selectionStart !== field.selectionEnd;
    const editingEarlierText = field.selectionStart !== String(field.value || "").length;
    if (String(event.inputType || "").startsWith("delete") || hasSelection || editingEarlierText || event.inputType === "insertFromPaste") {
      state.disabled = true;
    }
    state.previousValue = String(field.value || "");
  }

  function onInput(event) {
    const field = event.target;
    const config = fields[field?.id];
    if (!config) return;
    configureField(field);

    if (config.type === "reference") {
      event.stopPropagation();
      field.value = String(field.value || "").replace(invisibleCharacters, "").replace(singleLineControls, " ").slice(0, 80);
      capitaliseInitialTyping(field, config.capitalisation);
      field.setCustomValidity("");
      if (typeof window.scheduleDraft === "function") window.scheduleDraft();
      return;
    }

    if (config.type === "phone") field.value = formatAustralianPhone(field.value, { typing: true });
    else capitaliseInitialTyping(field, config.capitalisation);
    if (field.classList.contains("is-order-field-invalid")) validateField(field, { show: true });
  }

  function onBlur(event) {
    const field = event.target;
    const config = fields[field?.id];
    if (!config) return;
    if (config.type === "phone") field.value = formatAustralianPhone(field.value);
    else if (config.type === "instructions") field.value = cleanInstructions(field.value);
    else field.value = cleanSingleLine(field.value);
    validateField(field, { show: true });
    if (field.id === "deliveryAddressSearch") event.stopPropagation();
  }

  function start() {
    document.querySelectorAll("#orderForm input, #orderForm textarea").forEach(configureField);
    document.addEventListener("focusin", (event) => configureField(event.target));
    document.addEventListener("beforeinput", onBeforeInput, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("blur", onBlur, true);

    window.BPSPhone = {
      normalise: normaliseAustralianPhone,
      formatTyping: (value) => formatAustralianPhone(value, { typing: true }),
      format: formatAustralianPhone,
      isValid: isValidAustralianPhone,
    };
    window.normaliseMobile = normaliseAustralianPhone;
    window.formatMobileTyping = (value) => formatAustralianPhone(value, { typing: true });
    window.formatMobileField = (event) => { event.target.value = formatAustralianPhone(event.target.value, { typing: true }); };

    if (typeof window.validateForm === "function") window.validateForm.__referenceFormat = true;
    if (typeof window.setValue === "function") window.setValue.__referenceFormat = true;
  }

  if (typeof validateForm === "function") validateForm.__referenceFormat = true;
  if (typeof setValue === "function") setValue.__referenceFormat = true;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
