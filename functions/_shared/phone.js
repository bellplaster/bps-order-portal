function phoneError() {
  const error = new Error("Enter a valid Australian phone number.");
  error.status = 400;
  return error;
}

export function normaliseAustralianPhone(value, options = {}) {
  const { optional = false } = options;
  const raw = String(value || "").trim();
  let digits = raw.replace(/\D/g, "");
  if (!digits && optional) return "";

  if (digits.startsWith("0061")) digits = digits.slice(2);
  const international = /^\s*(?:\+|00)61/.test(raw);
  if (digits.startsWith("61") && /^61[23478]\d{8}$/.test(digits)) {
    const national = digits.slice(2);
    if (international) {
      if (/^4\d{8}$/.test(national)) return `+61 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
      if (/^[2378]\d{8}$/.test(national)) return `+61 ${national.slice(0, 1)} ${national.slice(1, 5)} ${national.slice(5)}`;
    }
    digits = `0${national}`;
  }

  if (/^04\d{8}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  if (/^0[2378]\d{8}$/.test(digits)) return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  if (/^(?:1300|1800|1900)\d{6}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  if (/^13\d{4}$/.test(digits)) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  if (/^\d{8}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4)}`;

  throw phoneError();
}
