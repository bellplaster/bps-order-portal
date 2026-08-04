(() => {
  if (window.__bpsAccountFieldValidationStarted) return;
  window.__bpsAccountFieldValidationStarted = true;

  const configs = {
    defaultReference: { type: "reference", optional: true, message: "Use numbers and single hyphens only." },
    defaultContactName: { type: "person", optional: true, message: "Use letters, spaces, apostrophes, hyphens and full stops only." },
    defaultMobile: { type: "phone", optional: true, message: "Enter a valid Australian phone number." },
    defaultStreet: { type: "street", optional: true, message: "Enter a valid street address." },
    defaultSuburb: { type: "suburb", optional: true, message: "Use letters, spaces, apostrophes, hyphens and full stops only." },
    defaultPostcode: { type: "postcode", optional: true, victorian: true, message: "Enter a valid four-digit Victorian postcode." },
    defaultInstructions: { type: "instructions", optional: true, message: "Remove unsupported characters from the instructions." },
    savedContactName: { type: "person", optional: false, message: "Use letters, spaces, apostrophes, hyphens and full stops only." },
    savedContactMobile: { type: "phone", optional: true, message: "Enter a valid Australian phone number." },
    savedAddressLabel: { type: "label", optional: false, message: "Use letters, numbers, spaces, apostrophes, hyphens, full stops and ampersands only." },
    savedAddressStreet: { type: "street", optional: false, message: "Enter a valid street address." },
    savedAddressSuburb: { type: "suburb", optional: false, message: "Use letters, spaces, apostrophes, hyphens and full stops only." },
    savedAddressPostcode: { type: "postcode", optional: false, victorian: true, message: "Enter a valid four-digit Victorian postcode." },
  };

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

  function normaliseReference(value, final = false) {
    let text = String(value ?? "").replace(/[^\d-]/g, "").replace(/-{2,}/g, "-");
    if (final) text = text.replace(/^-+|-+$/g, "");
    return text;
  }

  function normalisePhone(value, final = false) {
    let text = String(value ?? "").replace(/[^\d+\s]/g, "");
    text = text.replace(/(?!^)\+/g, "").replace(/\s+/g, " ");
    if (final) text = text.trim();
    return text;
  }

  function formatAustralianPhone(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("61") && digits.length >= 11) digits = `0${digits.slice(2)}`;
    if (/^04\d{8}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    if (/^0[2378]\d{8}$/.test(digits)) return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
    if (/^(?:1300|1800)\d{6}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    if (/^13\d{4}$/.test(digits)) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
    return value;
  }

  function isValidAustralianPhone(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("61") && digits.length >= 11) digits = `0${digits.slice(2)}`;
    return /^04\d{8}$/.test(digits)
      || /^0[2378]\d{8}$/.test(digits)
      || /^(?:1300|1800)\d{6}$/.test(digits)
      || /^13\d{4}$/.test(digits);
  }

  function configureField(field) {
    const config = configs[field?.id];
    if (!config || field.dataset.accountValidationConfigured === "true") return;
    field.dataset.accountValidationConfigured = "true";
    field.autocapitalize = config.type === "person" || config.type === "street" || config.type === "suburb" || config.type === "label" ? "words" : "off";
    if (config.type === "reference") {
      field.inputMode = "text";
      field.setAttribute("pattern", "[0-9]+(?:-[0-9]+)*");
      field.setAttribute("title", config.message);
    }
    if (config.type === "postcode") {
      field.inputMode = "numeric";
      field.maxLength = 4;
      field.setAttribute("pattern", "[0-9]{4}");
      field.setAttribute("title", config.message);
    }
    if (config.type === "phone") {
      field.inputMode = "tel";
      field.setAttribute("title", config.message);
    }
  }

  function normaliseField(field, final = false) {
    const config = configs[field?.id];
    if (!config) return;
    if (config.type === "reference") field.value = normaliseReference(field.value, final);
    else if (config.type === "postcode") field.value = String(field.value || "").replace(/\D/g, "").slice(0, 4);
    else if (config.type === "phone") {
      field.value = normalisePhone(field.value, final);
      if (final && field.value) field.value = formatAustralianPhone(field.value);
    } else if (config.type === "instructions") field.value = cleanInstructions(field.value);
    else if (final) field.value = cleanSingleLine(field.value);
  }

  function validateField(field, { show = true } = {}) {
    const config = configs[field?.id];
    if (!config) return true;
    configureField(field);
    const value = String(field.value || "").trim();
    let valid = true;

    if (!value) valid = config.optional === true;
    else if (config.type === "reference") valid = /^\d+(?:-\d+)*$/.test(value);
    else if (config.type === "person") valid = /^(?=.*\p{L})[\p{L}\p{M} .'’\-]+$/u.test(value);
    else if (config.type === "phone") valid = isValidAustralianPhone(value);
    else if (config.type === "street") valid = /^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} .,'’&/#()\-]+$/u.test(value);
    else if (config.type === "suburb") valid = /^(?=.*\p{L})[\p{L}\p{M} .'’\-]+$/u.test(value);
    else if (config.type === "label") valid = /^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} .'’&\-]+$/u.test(value);
    else if (config.type === "postcode") valid = /^\d{4}$/.test(value) && (!config.victorian || /^(?:3\d{3}|8\d{3})$/.test(value));

    const message = valid ? "" : config.message;
    field.setCustomValidity(message);
    field.classList.toggle("is-account-field-invalid", !valid);
    const error = ensureError(field);
    error.textContent = message;
    error.hidden = valid || !show;
    return valid;
  }

  function ensureError(field) {
    const id = `${field.id}ValidationMessage`;
    let error = document.getElementById(id);
    if (error) return error;
    error = document.createElement("small");
    error.id = id;
    error.className = "account-field-validation-message";
    error.hidden = true;
    error.setAttribute("aria-live", "polite");
    field.insertAdjacentElement("afterend", error);
    field.setAttribute("aria-describedby", [field.getAttribute("aria-describedby"), id].filter(Boolean).join(" "));
    return error;
  }

  function validateForm(form) {
    const fields = Array.from(form.querySelectorAll("input, textarea")).filter((field) => configs[field.id]);
    fields.forEach((field) => {
      configureField(field);
      normaliseField(field, true);
    });
    const invalid = fields.filter((field) => !validateField(field, { show: true }));
    if (!invalid.length) return true;
    invalid[0].focus();
    invalid[0].reportValidity();
    return false;
  }

  function onInput(event) {
    const field = event.target;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) || !configs[field.id]) return;
    configureField(field);
    const type = configs[field.id].type;
    if (["reference", "postcode", "phone"].includes(type)) normaliseField(field, false);
    if (field.classList.contains("is-account-field-invalid")) validateField(field, { show: true });
  }

  function onBlur(event) {
    const field = event.target;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) || !configs[field.id]) return;
    normaliseField(field, true);
    validateField(field, { show: true });
  }

  function onSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.querySelector("#defaultReference, #savedContactName, #savedAddressLabel")) return;
    if (validateForm(form)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function start() {
    document.querySelectorAll("input, textarea").forEach(configureField);
    document.addEventListener("focusin", (event) => configureField(event.target));
    document.addEventListener("input", onInput, true);
    document.addEventListener("blur", onBlur, true);
    document.addEventListener("submit", onSubmit, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
