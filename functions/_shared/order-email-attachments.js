const XLSX_SUFFIX = /\.xlsx$/i;
const LEGACY_SUFFIX = /-OLD\.xlsx$/i;
const SITE_AREA_SUFFIX = /-NEW\.xlsx$/i;

export function prepareOrderFilesForViewer(generatedFiles) {
  return (Array.isArray(generatedFiles) ? generatedFiles : [])
    .filter((file) => isSiteAreaFile(file))
    .map((file) => ({
      ...file,
      filename: productionFilename(file?.filename),
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

function isSiteAreaFile(file) {
  if (!isSpreadsheet(file)) return false;
  const filename = String(file?.filename || "").trim();
  const format = String(file?.format || file?.type || file?.floor || "").trim().toLowerCase();

  if (LEGACY_SUFFIX.test(filename) || format === "legacy" || format === "old" || format === "combined-old") {
    return false;
  }

  return SITE_AREA_SUFFIX.test(filename)
    || format === "site-area"
    || format === "new"
    || format === "combined-new"
    || format === "combined";
}

function productionFilename(filename) {
  const value = String(filename || "order.xlsx").trim();
  return SITE_AREA_SUFFIX.test(value)
    ? value.replace(SITE_AREA_SUFFIX, ".xlsx")
    : value;
}
