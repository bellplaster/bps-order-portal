const XLSX_SUFFIX = /\.xlsx$/i;
const LEGACY_SUFFIX = /-OLD\.xlsx$/i;
const SITE_AREA_SUFFIX = /-NEW\.xlsx$/i;

export function prepareOrderEmailFiles(generatedFiles, { isAdmin = false } = {}) {
  const files = Array.isArray(generatedFiles) ? generatedFiles : [];

  if (isAdmin) {
    return files
      .filter((file) => isSpreadsheet(file))
      .map((file) => ({
        ...file,
        filename: adminFilename(file?.filename),
      }));
  }

  return files
    .filter((file) => isLegacyFile(file))
    .map((file) => ({
      ...file,
      filename: customerServiceFilename(file?.filename),
    }));
}

function isSpreadsheet(file) {
  return XLSX_SUFFIX.test(String(file?.filename || "").trim());
}

function isLegacyFile(file) {
  const filename = String(file?.filename || "").trim();
  const format = String(file?.format || file?.type || "").trim().toLowerCase();
  return LEGACY_SUFFIX.test(filename) || format === "legacy" || format === "old";
}

function customerServiceFilename(filename) {
  const value = String(filename || "order.xlsx").trim();
  return LEGACY_SUFFIX.test(value)
    ? value.replace(LEGACY_SUFFIX, ".xlsx")
    : value;
}

function adminFilename(filename) {
  const value = String(filename || "order.xlsx").trim();
  if (LEGACY_SUFFIX.test(value)) return value.replace(LEGACY_SUFFIX, "-V1.xlsx");
  if (SITE_AREA_SUFFIX.test(value)) return value.replace(SITE_AREA_SUFFIX, "-V2.xlsx");
  return value;
}
