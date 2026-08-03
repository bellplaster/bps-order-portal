import { PRODUCT_CATALOG } from "./catalog.js";
import { createAccriviaSiteAreaXlsx, createAccriviaXlsx } from "./xlsx.js";

const MAX_PRODUCT_QUANTITY = 99999;
const MAX_FILENAME_LENGTH = 100;

export async function replaceAreaExportsWithCombined(env, payload, result, auth) {
  if (!result?.ok || result?.duplicate || !Array.isArray(result.generatedFiles) || !result.generatedFiles.length) return result;

  const submissionId = String(result.submissionId || payload?.submissionId || "").trim();
  const reference = String(result.customerReference || payload?.reference || payload?.customerReference || "").trim();
  if (!submissionId || !reference) return result;

  const accountId = Number(auth?.accountId || payload?.customerAccountId || 0);
  const account = await env.DB.prepare(
    `SELECT id, debtor_code, company_name FROM customer_accounts WHERE id = ? AND active = 1 LIMIT 1`,
  ).bind(accountId).first();
  if (!account) throw new Error("The customer account for the combined export is missing.");

  const areaEntries = Object.entries(payload?.floors && typeof payload.floors === "object" ? payload.floors : {})
    .filter(([, area]) => hasAreaProducts(area));
  if (!areaEntries.length) return result;

  const legacyRows = [];
  const siteAreaRows = [];
  const includeLegacySeparators = areaEntries.length > 1;

  for (const [areaKey, area] of areaEntries) {
    const label = upper(area.label || areaKey || "AREA");
    const combinedRows = buildCombinedRows(area, label);
    if (!combinedRows.length) continue;

    if (includeLegacySeparators) legacyRows.push([label, "", 1]);
    legacyRows.push(...combinedRows.map((row) => [row.sku, "", row.quantity]));

    combinedRows.forEach((row, index) => {
      siteAreaRows.push([index === 0 ? label : "", row.sku, "", row.quantity]);
    });
  }

  if (!legacyRows.length || !siteAreaRows.length) {
    throw new Error("The combined Accrivia export contains no products.");
  }

  const notes = buildDeliveryNotesDescription(payload);
  legacyRows.push(["NOTES", notes, 1]);
  siteAreaRows.push(["", "NOTES", notes, 1]);

  const pickup = isPickup(payload?.deliveryType);
  const addresses = buildExportAddresses(payload, areaEntries.map(([, area]) => String(area?.label || "")), pickup);
  const orderDate = String(payload?.orderDate || todayInMelbourne());
  const requiredDate = String(payload?.requiredDate || "");
  const contact = upper(payload?.contact || payload?.siteContact || "");
  const mobile = upper(payload?.mobile || payload?.siteContactPhone || "");
  const common = {
    debtorCode: upper(account.debtor_code),
    orderDate,
    requiredDate,
    orderNumber: upper(reference),
    jobName: upper(account.company_name),
    addressLine1: addresses.line1,
    addressLine2: addresses.line2,
    addressLine3: pickup ? addresses.line3 : [contact, mobile].filter(Boolean).join(" "),
    salesRepCode: upper(payload?.salesRepCode || ""),
  };

  const legacyWorkbook = createAccriviaXlsx({ ...common, productRows: legacyRows });
  const siteAreaWorkbook = createAccriviaSiteAreaXlsx({ ...common, productRows: siteAreaRows });

  const revisionNo = Number(result.revisionNo || 1);
  const baseFilename = buildCombinedExportFilename(account.company_name, reference, revisionNo).replace(/\.xlsx$/i, "");
  const oldFilename = `${baseFilename}-OLD.xlsx`;
  const newFilename = `${baseFilename}-NEW.xlsx`;
  const firstOldKey = String(result.generatedFiles[0]?.r2Key || "");
  const directory = firstOldKey.includes("/")
    ? firstOldKey.slice(0, firstOldKey.lastIndexOf("/"))
    : ["orders", String(account.id), orderDate.slice(0, 4), orderDate.slice(5, 7), submissionId, `revision-${revisionNo}`].join("/");

  const exports = [
    { floor: "combined-old", floorLabel: "Combined (Old)", filename: oldFilename, workbook: legacyWorkbook, itemCount: legacyRows.length },
    { floor: "combined-new", floorLabel: "Combined (New)", filename: newFilename, workbook: siteAreaWorkbook, itemCount: siteAreaRows.length },
  ];
  const generatedFiles = [];

  for (const file of exports) {
    const r2Key = `${directory}/${file.filename}`;
    await env.ORDER_FILES.put(r2Key, file.workbook.bytes, {
      httpMetadata: { contentType: file.workbook.mimeType },
      customMetadata: {
        submissionId,
        orderNumber: reference,
        accountId: String(account.id),
        floor: file.floor,
        floorLabel: file.floorLabel,
        revision: String(revisionNo),
      },
    });

    const insertResult = await env.DB.prepare(
      `INSERT INTO order_files (submission_id, floor, floor_label, filename, r2_key, item_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(submissionId, file.floor, file.floorLabel, file.filename, r2Key, file.itemCount, new Date().toISOString()).run();
    const fileId = Number(insertResult?.meta?.last_row_id || 0);
    if (!fileId) throw new Error(`The ${file.floorLabel} Accrivia export could not be recorded.`);

    generatedFiles.push({
      id: fileId,
      floor: file.floor,
      floorLabel: file.floorLabel,
      filename: file.filename,
      itemCount: file.itemCount,
      r2Key,
      revision: revisionNo,
      downloadUrl: `/api/files/${fileId}`,
    });
  }

  for (const file of result.generatedFiles) {
    const oldKey = String(file?.r2Key || "");
    const oldId = Number(file?.id || 0);
    if (oldKey && !generatedFiles.some((generated) => generated.r2Key === oldKey)) {
      await env.ORDER_FILES.delete(oldKey).catch(() => null);
    }
    if (oldId) await env.DB.prepare(`DELETE FROM order_files WHERE id = ?`).bind(oldId).run().catch(() => null);
  }

  result.generatedFiles = generatedFiles;
  return result;
}

function buildCombinedRows(area, areaLabel) {
  const rows = [];
  for (const [index, item] of (Array.isArray(area.items) ? area.items : []).entries()) {
    const product = PRODUCT_CATALOG[String(item?.key || "").trim()] || {};
    const sku = upper(item?.sku || product.sku);
    const quantity = Number(item?.quantity || 0);
    const lineIdentity = String(item?.lineIdentity || item?.key || `standard-${index}`).trim();
    if (sku && Number.isInteger(quantity) && quantity > 0) rows.push({ sku, quantity, lineIdentity: `standard:${lineIdentity}` });
  }
  for (const item of Array.isArray(area.otherMaterials) ? area.otherMaterials : []) {
    const sku = upper(item?.sku);
    const quantity = Number(item?.quantity || 0);
    if (sku && Number.isInteger(quantity) && quantity > 0) rows.push({ sku, quantity, lineIdentity: `additional:${sku}` });
  }
  return combineRows(rows, areaLabel);
}

function hasAreaProducts(area) {
  if (!area || typeof area !== "object") return false;
  return (Array.isArray(area.items) && area.items.some((item) => Number(item?.quantity || 0) > 0)) ||
    (Array.isArray(area.otherMaterials) && area.otherMaterials.some((item) => Number(item?.quantity || 0) > 0));
}

function combineRows(items, areaLabel) {
  const combined = new Map();
  for (const item of items) {
    const key = String(item.lineIdentity || item.sku).toUpperCase();
    const current = combined.get(key) || { sku: item.sku, quantity: 0 };
    current.quantity += item.quantity;
    if (current.quantity > MAX_PRODUCT_QUANTITY) {
      throw new Error(`${areaLabel}: combined quantity for ${item.sku} exceeds ${MAX_PRODUCT_QUANTITY.toLocaleString("en-AU")}.`);
    }
    combined.set(key, current);
  }
  return [...combined.values()];
}

function buildDeliveryNotesDescription(payload) {
  const extras = Array.isArray(payload?.extras) ? payload.extras.map(upper).filter(Boolean).join(", ") : upper(payload?.extras || "");
  const instructions = upper(payload?.deliveryInstructions || payload?.instructions || "");
  return [
    `TIME SLOT: ${timeSlotLabel(payload?.timeSlot) || "NOT SELECTED"}`,
    `DELIVERY TYPE: ${deliveryTypeLabel(payload?.deliveryType) || "NOT SELECTED"}`,
    `EXTRAS: ${extras || "NONE"}`,
    `INSTRUCTIONS: ${instructions || "NONE"}`,
  ].join("; ");
}

function timeSlotLabel(value) {
  const key = upper(value);
  return ({ "1ST": "1ST", "2ND": "2ND", AM: "AM", PM: "PM", ANY: "ANY" })[key] || key;
}

function deliveryTypeLabel(value) {
  const key = String(value || "").trim();
  return ({
    "Manual Unload (Knauf Labour)": "MANUAL UNLOAD",
    "Mechanical (Forklift/Crane/Own)": "MECHANICAL",
    "Mixed Unload (Hand + Machine)": "MIXED UNLOAD",
    "Pickup (Customer to collect)": "CUSTOMER PICKUP",
    "Hand Unload": "HAND UNLOAD",
    "Forklift Delivery": "FORKLIFT DELIVERY",
    "Crane Delivery": "CRANE DELIVERY",
    "Delivery (No Assistance)": "DELIVERY (NO ASSISTANCE)",
  })[key] || upper(key);
}

function buildExportAddresses(payload, labels, pickup) {
  const street = upper(payload?.addressLine1 || payload?.siteAddress1 || "");
  const suburbFull = upper(payload?.addressLine2 || payload?.siteAddress2 || payload?.deliveryAddress || "");
  const suburbOnly = extractSuburb(suburbFull);
  const contact = upper(payload?.contact || payload?.siteContact || "CUSTOMER");
  if (pickup) return street ? { line1: `PICK UP ${contact}`, line2: street, line3: suburbOnly } : { line1: `PICK UP ${contact}`, line2: suburbOnly, line3: "" };

  const cleanLabels = labels.map(upper).filter(Boolean);
  const unitNumbers = cleanLabels.map(parseUnitLabel).filter(Boolean);
  let prefix = "";
  if (cleanLabels.length && unitNumbers.length === cleanLabels.length) {
    const sorted = [...new Set(unitNumbers)].sort((a, b) => a - b);
    const consecutive = sorted.every((number, index) => index === 0 || number === sorted[index - 1] + 1);
    prefix = sorted.length === 1 ? `UNIT ${sorted[0]}` : consecutive ? `UNIT ${sorted[0]}-${sorted.at(-1)}` : sorted.map((number) => `UNIT ${number}`).join(", ");
  } else {
    const meaningful = cleanLabels.filter((label) => !/^(TAB|AREA)\s*\d+$/i.test(label));
    if (meaningful.length) return { line1: [street, meaningful.join(", ")].filter(Boolean).join(" - "), line2: suburbFull, line3: "" };
  }
  return { line1: [prefix, street].filter(Boolean).join(" "), line2: suburbFull, line3: "" };
}

function parseUnitLabel(value) {
  const match = String(value || "").trim().match(/^UNIT\s*0*(\d+)$/i);
  return match ? Number(match[1]) : null;
}
function extractSuburb(value) {
  const withoutState = upper(value).replace(/\b(?:VIC|VICTORIA)\b\s*\d{4}\b.*$/i, "").replace(/\s+/g, " ").replace(/^[,\s]+|[,\s]+$/g, "").trim();
  const parts = withoutState.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || withoutState;
}
function isPickup(value) { return /pickup|pick\s*up|collect/i.test(String(value || "")); }
function upper(value) { return String(value || "").trim().replace(/\s+/g, " ").toUpperCase(); }

export function buildCombinedExportFilename(companyName, reference, revisionNo = 1) {
  const revisionNumber = Math.trunc(Number(revisionNo));
  const revisionSuffix = revisionNumber > 1 ? `-R${revisionNumber}` : "";
  const safeReference = trimFilenamePart(filenamePart(reference, "ORDER"), 40, "ORDER");
  const reservedLength = safeReference.length + revisionSuffix.length + ".xlsx".length + 1;
  const companyLimit = Math.max(1, MAX_FILENAME_LENGTH - reservedLength);
  const safeCompany = trimFilenamePart(filenamePart(companyName, "CUSTOMER"), companyLimit, "CUSTOMER");
  return `${safeCompany}-${safeReference}${revisionSuffix}.xlsx`;
}
function filenamePart(value, fallback) {
  const normalised = String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
  return normalised || fallback;
}
function trimFilenamePart(value, maximumLength, fallback) { return value.slice(0, maximumLength).replace(/-+$/g, "") || fallback; }
function todayInMelbourne() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
