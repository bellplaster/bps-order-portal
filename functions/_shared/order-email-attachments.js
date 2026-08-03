const XLSX_SUFFIX = /\.xlsx$/i;
const LEGACY_SUFFIX = /-OLD\.xlsx$/i;
const SITE_AREA_SUFFIX = /-NEW\.xlsx$/i;

export function prepareOrderFilesForViewer(generatedFiles, { isAdmin = false } = {}) {
  const files = Array.isArray(generatedFiles) ? generatedFiles : [];

  if (isAdmin) {
    return files
      .filter((file) => isSpreadsheet(file))
      .map((file) => ({
        ...file,
        filename: adminFilename(file?.filename),
        floorLabel: adminLabel(file),
        floor_label: adminLabel(file),
      }));
  }

  return files
    .filter((file) => isLegacyFile(file))
    .map((file) => ({
      ...file,
      filename: customerFilename(file?.filename),
      floorLabel: "Accrivia order file",
      floor_label: "Accrivia order file",
    }));
}

export function prepareOrderFileForDownload(file, options = {}) {
  return prepareOrderFilesForViewer(file ? [file] : [], options)[0] || null;
}

export const prepareOrderEmailFiles = prepareOrderFilesForViewer;

function isSpreadsheet(file) {
  return XLSX_SUFFIX.test(String(file?.filename || "").trim());
}

function isLegacyFile(file) {
  const filename = String(file?.filename || "").trim();
  const format = String(file?.format || file?.type || file?.floor || "").trim().toLowerCase();
  return LEGACY_SUFFIX.test(filename) || format === "legacy" || format === "old" || format === "combined-old";
}

function customerFilename(filename) {
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

function adminLabel(file) {
  const filename = String(file?.filename || "").trim();
  if (LEGACY_SUFFIX.test(filename)) return "Accrivia format · V1";
  if (SITE_AREA_SUFFIX.test(filename)) return "Site area format · V2";
  return String(file?.floorLabel || file?.floor_label || "Order spreadsheet").trim();
}
