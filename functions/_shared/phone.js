export function normaliseAustralianPhone(value, options = {}) {
  const { optional = false, error = "Enter a valid Australian phone number." } = options;
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits && optional) return "";
  if (digits.startsWith("61") && digits.length >= 11) digits = `0${digits.slice(2)}`;

  if (/^04\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (/^0[2378]\d{8}$/.test(digits)) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  if (/^(?:1300|1800)\d{6}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (/^13\d{4}$/.test(digits)) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  }

  const validationError = new Error(error);
  validationError.status = 400;
  throw validationError;
}