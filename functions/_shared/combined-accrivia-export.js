import { PRODUCT_CATALOG } from "./catalog.js";
import { createAccriviaXlsx } from "./xlsx.js";

export async function replaceAreaExportsWithCombined(env, payload, result, auth) {
  if (!result?.ok || result?.duplicate || !Array.isArray(result.generatedFiles) || !result.generatedFiles.length) {
    return result;
  }

  const submissionId = String(result.submissionId || payload?.submissionId || "").trim();
  const reference = String(result.customerReference || payload?.reference || payload?.customerReference || "").trim();
  if (!submissionId || !reference) return result;

  const accountId = Number(auth?.accountId || payload?.customerAccountId || 0);
  const account = await env.DB.prepare(
    `SELECT id, debtor_code, company_name FROM customer_accounts WHERE id = ? AND active = 1 LIMIT 1`,
  ).bind(accountId).first();
  if (!account) throw new Error("The customer account for the combined export is missing.");

  const areaEntries = Object.entries(payload?.floors && typeof payload.floors === "object" ? payload.floors : {})
    .filter(([, area]) => area && typeof area === "object");
  if (!areaEntries.length) return result;

  const productRows = [];
  for (const [areaKey, area] of areaEntries) {
    const label = upper(area.label || areaKey || "AREA");
    const unit = parseUnitLabel(label);
    if (unit) productRows.push([`UNIT ${unit}`, `UNIT ${unit}`, 1]);

    const rows = [];
    for (const item of Array.isArray(area.items) ? area.items : []) {
      const product = PRODUCT_CATALOG[String(item?.key || "").trim()] || {};
      const sku = upper(item?.sku || product.sku);
      const description = upper(item?.description || item?.name || product.description || product.label);
      const quantity = Number(item?.quantity || 0);
      if (sku && Number.isInteger(quantity) && quantity > 0) rows.push({ sku, description, quantity });
    }
    for (const item of Array.isArray(area.otherMaterials) ? area.otherMaterials : []) {
      const sku = upper(item?.sku);
      const description = upper(item?.description || item?.name || item?.sku);
      const quantity = Number(item?.quantity || 0);
      if (sku && Number.isInteger(quantity) && quantity > 0) rows.push({ sku, description, quantity });
    }
    productRows.push(...combineRows(rows, label));
  }

  if (!productRows.length) throw new Error("The combined Accrivia export contains no products.");

  const pickup = isPickup(payload?.deliveryType);
  const addresses = buildExportAddresses(payload, areaEntries.map(([, area]) => String(area?.label || "")), pickup);
  const orderDate = String(payload?.orderDate || todayInMelbourne());
  const requiredDate = String(payload?.requiredDate || "");
  const contact = upper(payload?.contact || payload?.siteContact || "");
  const mobile = upper(payload?.mobile || payload?.siteContactPhone || "");

  const workbook = createAccriviaXlsx({
    debtorCode: upper(account.debtor_code),
    orderDate,
    requiredDate,
    orderNumber: upper(reference),
    jobName: upper(account.company_name),
    addressLine1: addresses.line1,
    addressLine2: addresses.line2,
    addressLine3: pickup ? addresses.line3 : [contact, mobile].filter(Boolean).join(" "),
    salesRepCode: upper(payload?.salesRepCode || ""),
    productRows,
  });

  const revisionNo = Number(result.revisionNo || 1);
  const safeReference = safeFilename(reference);
  const filename = revisionNo === 1 ? `${safeReference}.xlsx` : `${safeReference}-R${revisionNo}.xlsx`;
  const firstOldKey = String(result.generatedFiles[0]?.r2Key || "");
  const directory = firstOldKey.includes("/")
    ? firstOldKey.slice(0, firstOldKey.lastIndexOf("/"))
    : ["orders", String(account.id), orderDate.slice(0, 4), orderDate.slice(5, 7), submissionId, `revision-${revisionNo}`].join("/");
  const r2Key = `${directory}/${filename}`;

  await env.ORDER_FILES.put(r2Key, workbook.bytes, {
    httpMetadata: { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    customMetadata: {
      submissionId,
      orderNumber: reference,
      accountId: String(account.id),
      floor: "combined",
      floorLabel: "Combined",
      revision: String(revisionNo),
    },
  });

  const insertResult = await env.DB.prepare(
    `INSERT INTO order_files (
       submission_id, floor, floor_label, filename, r2_key, item_count, created_at
     ) VALUES (?, 'combined', 'Combined', ?, ?, ?, ?)`,
  ).bind(submissionId, filename, r2Key, productRows.length, new Date().toISOString()).run();
  const fileId = Number(insertResult?.meta?.last_row_id || 0);
  if (!fileId) throw new Error("The combined Accrivia export could not be recorded.");

  for (const file of result.generatedFiles) {
    const oldKey = String(file?.r2Key || "");
    const oldId = Number(file?.id || 0);
    if (oldKey && oldKey !== r2Key) await env.ORDER_FILES.delete(oldKey).catch(() => null);
    if (oldId) await env.DB.prepare(`DELETE FROM order_files WHERE id = ?`).bind(oldId).run().catch(() => null);
  }

  result.generatedFiles = [{
    id: fileId,
    floor: "combined",
    floorLabel: "Combined",
    filename,
    itemCount: productRows.length,
    r2Key,
    revision: revisionNo,
    downloadUrl: `/api/files/${fileId}`,
  }];
  return result;
}

function combineRows(items, areaLabel) {
  const combined = new Map();
  for (const item of items) {
    const key = item.sku.toUpperCase();
    const current = combined.get(key) || { ...item, quantity: 0 };
    current.quantity += item.quantity;
    if (current.quantity > 10000) throw new Error(`${areaLabel}: combined quantity for ${item.sku} exceeds 10000.`);
    if (!current.description && item.description) current.description = item.description;
    combined.set(key, current);
  }
  return [...combined.values()].map((item) => [upper(item.sku), upper(item.description), item.quantity]);
}

function buildExportAddresses(payload, labels, pickup) {
  const street = upper(payload?.addressLine1 || payload?.siteAddress1 || "");
  const suburbFull = upper(payload?.addressLine2 || payload?.siteAddress2 || payload?.deliveryAddress || "");
  const suburbOnly = extractSuburb(suburbFull);
  const contact = upper(payload?.contact || payload?.siteContact || "CUSTOMER");

  if (pickup) {
    return street
      ? { line1: `PICK UP ${contact}`, line2: street, line3: suburbOnly }
      : { line1: `PICK UP ${contact}`, line2: suburbOnly, line3: "" };
  }

  const cleanLabels = labels.map(upper).filter(Boolean);
  const unitNumbers = cleanLabels.map(parseUnitLabel).filter(Boolean);
  let prefix = "";
  if (cleanLabels.length && unitNumbers.length === cleanLabels.length) {
    const sorted = [...new Set(unitNumbers)].sort((a, b) => a - b);
    const consecutive = sorted.every((number, index) => index === 0 || number === sorted[index - 1] + 1);
    prefix = sorted.length === 1
      ? `UNIT ${sorted[0]}`
      : consecutive
        ? `UNIT ${sorted[0]}-${sorted.at(-1)}`
        : sorted.map((number) => `UNIT ${number}`).join(", ");
  } else {
    const meaningful = cleanLabels.filter((label) => !/^(TAB|AREA)\s*\d+$/i.test(label));
    if (meaningful.length) return {
      line1: [street, meaningful.join(", ")].filter(Boolean).join(" - "),
      line2: suburbFull,
      line3: "",
    };
  }

  return {
    line1: [prefix, street].filter(Boolean).join(" "),
    line2: suburbFull,
    line3: "",
  };
}

function parseUnitLabel(value) {
  const match = String(value || "").trim().match(/^UNIT\s*0*(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function extractSuburb(value) {
  const withoutState = upper(value)
    .replace(/\b(?:VIC|VICTORIA)\b\s*\d{4}\b.*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
  const parts = withoutState.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || withoutState;
}

function isPickup(value) {
  return /pickup|pick\s*up|collect/i.test(String(value || ""));
}

function upper(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function safeFilename(value) {
  return String(value || "ORDER").trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "ORDER";
}

function todayInMelbourne() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
