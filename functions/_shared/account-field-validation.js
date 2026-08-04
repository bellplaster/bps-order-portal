const SINGLE_LINE_CONTROLS = /[\u0000-\u001f\u007f-\u009f]/g;
const MULTILINE_CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const INVISIBLE_CHARACTERS = /[\u200b-\u200d\u2060\ufeff]/g;

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export function cleanSingleLine(value, maxLength) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(INVISIBLE_CHARACTERS, "")
    .replace(SINGLE_LINE_CONTROLS, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

export function cleanReference(value, options = {}) {
  const { optional = true, maxLength = 80, label = "Reference" } = options;
  const text = cleanSingleLine(value, maxLength);
  if (!text) {
    if (optional) return "";
    throw badRequest(`${label} is required.`);
  }
  if (!/^\d+(?:-\d+)*$/.test(text)) {
    throw badRequest(`${label} must use numbers and single hyphens only.`);
  }
  return text;
}

export function cleanPersonName(value, options = {}) {
  const { optional = false, maxLength = 100, label = "Contact name" } = options;
  const text = cleanSingleLine(value, maxLength);
  if (!text) {
    if (optional) return "";
    throw badRequest(`Enter a ${label.toLowerCase()}.`);
  }
  if (!/^(?=.*\p{L})[\p{L}\p{M} .'’\-]+$/u.test(text)) {
    throw badRequest(`${label} may use letters, spaces, apostrophes, hyphens and full stops only.`);
  }
  return text;
}

export function cleanAddressLabel(value, options = {}) {
  const { optional = false, maxLength = 80, label = "Address name" } = options;
  const text = cleanSingleLine(value, maxLength);
  if (!text) {
    if (optional) return "";
    throw badRequest("Enter an address name, such as Site office or Warehouse.");
  }
  if (!/^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} .'’&\-]+$/u.test(text)) {
    throw badRequest(`${label} may use letters, numbers, spaces, apostrophes, hyphens, full stops and ampersands only.`);
  }
  return text;
}

export function cleanStreetAddress(value, options = {}) {
  const { optional = false, maxLength = 240, label = "Street address" } = options;
  const text = cleanSingleLine(value, maxLength);
  if (!text) {
    if (optional) return "";
    throw badRequest("Enter the street address.");
  }
  if (!/^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} .,'’&/#()\-]+$/u.test(text)) {
    throw badRequest(`${label} contains unsupported characters.`);
  }
  return text;
}

export function cleanSuburb(value, options = {}) {
  const { optional = false, maxLength = 120, label = "Suburb" } = options;
  const text = cleanSingleLine(value, maxLength);
  if (!text) {
    if (optional) return "";
    throw badRequest("Enter the suburb.");
  }
  if (!/^(?=.*\p{L})[\p{L}\p{M} .'’\-]+$/u.test(text)) {
    throw badRequest(`${label} may use letters, spaces, apostrophes, hyphens and full stops only.`);
  }
  return text;
}

export function cleanAustralianPostcode(value, options = {}) {
  const { optional = false, victorian = false, label = "Postcode" } = options;
  const text = cleanSingleLine(value, 4);
  if (!text) {
    if (optional) return "";
    throw badRequest(`Enter a valid four-digit ${victorian ? "Victorian " : "Australian "}postcode.`);
  }
  if (!/^\d{4}$/.test(text) || (victorian && !/^(?:3\d{3}|8\d{3})$/.test(text))) {
    throw badRequest(`Enter a valid four-digit ${victorian ? "Victorian " : "Australian "}postcode.`);
  }
  return text;
}

export function cleanInstructions(value, maxLength = 1500) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE_CHARACTERS, "")
    .replace(MULTILINE_CONTROLS, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}
