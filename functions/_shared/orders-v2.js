import { PRODUCT_CATALOG } from "./catalog.js";
import { normaliseAustralianPhone } from "./phone.js";
import { createAccriviaXlsx } from "./xlsx.js";
export { deleteOrderPermanently, getStatusResponse, setOrderArchiveStatus } from "./orders.js";

const CONFIG = Object.freeze({
  timeZone: "Australia/Melbourne",
  maxAreas: 20,
  maxItemsPerArea: 250,
  maxOtherMaterialsPerArea: 100,
});

const LEGACY_AREAS = Object.freeze({
  ground: { label: "Ground Floor", shortCode: "GF" },
  first: { label: "1st Floor", shortCode: "L1" },
});

export async function processOrderSubmission(env, rawPayload, auth) {
  requireBindings(env);
  const actor = await requireAccount(env, auth);
  const submissionId = cleanRequiredText(rawPayload?.submissionId, "Submission ID", 120);
  const orderDetails = normaliseOrderDetails(rawPayload, actor.account);
  const inserted = await reserveSubmission(env, submissionId, orderDetails, rawPayload, actor);
  if (!inserted) return buildDuplicateResponse(env, submissionId, actor);
  const order = await getOrderRecord(env, submissionId);
  return generateAndSaveRevision(env, {
    order,
    rawPayload,
    orderDetails,
    actor,
    revisionNo: 1,
    isInitial: true,
  });
}

export async function updateOrderSubmission(env, submissionId, rawPayload, auth) {
  requireBindings(env);
  const actor = await requireActor(env, auth);
  const order = await requireAccessibleOrder(env, submissionId, actor);
  if (order.status === "cancelled") throw new Error("A cancelled order cannot be edited.");
  if (order.status === "archived") throw new Error("An archived order must be restored before it can be edited.");
  const account = await getAccount(env, order.account_id);
  if (!account) throw new Error("The customer account for this order no longer exists.");
  const orderDetails = normaliseOrderDetails(rawPayload, account, order.customer_reference);
  const latestRevision = inferLatestRevision(await getOrderFiles(env, submissionId));
  return generateAndSaveRevision(env, {
    order,
    rawPayload: { ...rawPayload, submissionId },
    orderDetails,
    actor: { ...actor, account },
    revisionNo: latestRevision + 1,
    isInitial: false,
  });
}

export async function getOrderForEditing(env, submissionId, auth) {
  requireBindings(env);
  const actor = await requireActor(env, auth);
  const order = await requireAccessibleOrder(env, submissionId, actor);
  const files = await getOrderFiles(env, submissionId);
  let payload = {};
  try { payload = JSON.parse(order.payload_json || "{}"); } catch (_error) { payload = {}; }
  return {
    ok: true,
    order: {
      submissionId: order.submission_id,
      orderNumber: order.customer_reference,
      status: order.status,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      latestRevision: inferLatestRevision(files),
      companyName: order.company_name_snapshot || "",
      debtorCode: order.debtor_code_snapshot || "",
    },
    payload,
    files: files.map(addFilePresentationFields),
  };
}

async function generateAndSaveRevision(env, options) {
  const { order, rawPayload, orderDetails, actor, revisionNo, isInitial } = options;
  const submissionId = order.submission_id;
  const orderNumber = order.customer_reference;
  let stage = isInitial ? "Submission reserved" : `Revision ${revisionNo} started`;

  try {
    await addEvent(env, submissionId, stage, JSON.stringify({ userId: actor.userId }));
    stage = `Validating revision ${revisionNo}`;
    await addEvent(env, submissionId, stage);
    const areas = await normaliseAreas(env, rawPayload?.floors);
    if (!Object.keys(areas).length) throw new Error("The order contains no products.");

    const dateOrdered = todayInMelbourne();
    const generatedFiles = [];
    const manualReview = [];

    for (const [areaKey, area] of Object.entries(areas)) {
      if (area.otherProducts) {
        manualReview.push({ kind: "order-note", floor: areaKey, floorLabel: area.label, details: area.otherProducts });
      }

      const mappedItems = [];
      const unmappedItems = [];
      for (const item of area.items) {
        const product = PRODUCT_CATALOG[item.key];
        if (String(product?.sku || "").trim()) mappedItems.push(item);
        else unmappedItems.push({ key: item.key, label: product?.label || item.key, quantity: item.quantity });
      }
      if (unmappedItems.length) {
        manualReview.push({
          kind: "sku-mapping",
          floor: areaKey,
          floorLabel: area.label,
          details: unmappedItems.map((item) => `${item.label} × ${item.quantity}`).join("\n"),
          items: unmappedItems,
        });
      }

      const deliveryItem = buildDeliveryItem(orderDetails);
      const productRows = combineProductRows([
        ...mappedItems.map((item) => {
          const product = PRODUCT_CATALOG[item.key];
          return { sku: product.sku, description: product.description, quantity: item.quantity };
        }),
        ...area.otherMaterials,
        ...(deliveryItem ? [deliveryItem] : []),
      ], area.label);

      if (!productRows.length) continue;
      stage = `Generating ${area.label} revision ${revisionNo}`;
      await addEvent(env, submissionId, stage);
      const safeReference = safeFilename(orderNumber);
      const filename = revisionNo === 1
        ? `${safeReference}-${area.shortCode}.xlsx`
        : `${safeReference}-R${revisionNo}-${area.shortCode}.xlsx`;

      const workbook = createAccriviaXlsx({
        debtorCode: actor.account.debtor_code,
        orderDate: dateOrdered,
        requiredDate: orderDetails.requiredDate,
        orderNumber,
        jobName: `${actor.account.company_name} - ${area.label}`,
        addressLine1: orderDetails.addressLine1,
        addressLine2: orderDetails.addressLine2,
        addressLine3: [orderDetails.contact, orderDetails.mobile].filter(Boolean).join(" "),
        salesRepCode: "",
        productRows,
      });

      const r2Key = [
        "orders",
        String(actor.account.id),
        dateOrdered.slice(0, 4),
        dateOrdered.slice(5, 7),
        submissionId,
        `revision-${revisionNo}`,
        filename,
      ].join("/");
      stage = `Saving ${area.label} revision ${revisionNo} to R2`;
      await addEvent(env, submissionId, stage);
      await env.ORDER_FILES.put(r2Key, workbook.bytes, {
        httpMetadata: { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        customMetadata: {
          submissionId,
          orderNumber,
          accountId: String(actor.account.id),
          floor: areaKey,
          floorLabel: area.label,
          revision: String(revisionNo),
        },
      });
      const insertResult = await env.DB.prepare(
        `INSERT INTO order_files (
           submission_id, floor, floor_label, filename, r2_key, item_count, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(submissionId, areaKey, area.label, filename, r2Key, productRows.length, nowIso()).run();
      const fileId = Number(insertResult?.meta?.last_row_id || 0);
      generatedFiles.push({
        id: fileId || null,
        floor: areaKey,
        floorLabel: area.label,
        filename,
        itemCount: productRows.length,
        r2Key,
        revision: revisionNo,
        downloadUrl: fileId ? `/api/files/${fileId}` : null,
      });
    }

    if (!generatedFiles.length && !manualReview.length) throw new Error("No mapped products were supplied.");

    const metadataKey = [
      "orders",
      String(actor.account.id),
      dateOrdered.slice(0, 4),
      dateOrdered.slice(5, 7),
      submissionId,
      `revision-${revisionNo}`,
      "submission.json",
    ].join("/");
    await env.ORDER_FILES.put(metadataKey, JSON.stringify({
      submissionId,
      orderNumber,
      revision: revisionNo,
      account: {
        id: actor.account.id,
        debtorCode: actor.account.debtor_code,
        companyName: actor.account.company_name,
      },
      orderDetails,
      floors: areas,
      generatedFiles,
      manualReview,
    }, null, 2), { httpMetadata: { contentType: "application/json" } });

    await env.DB.prepare(
      `UPDATE orders
       SET status = 'completed',
           project_name = ?,
           site_address = ?,
           suburb_state_postcode = ?,
           site_contact = ?,
           site_contact_phone = ?,
           order_contact = ?,
           order_contact_phone = ?,
           general_comments = ?,
           debtor_code_snapshot = ?,
           company_name_snapshot = ?,
           contact_snapshot = ?,
           mobile_snapshot = ?,
           payload_json = ?,
           updated_at = ?
       WHERE submission_id = ?`,
    ).bind(
      actor.account.company_name,
      orderDetails.addressLine1,
      orderDetails.addressLine2,
      orderDetails.contact,
      orderDetails.mobile,
      orderDetails.contact,
      orderDetails.mobile,
      buildDeliverySummary(orderDetails),
      actor.account.debtor_code,
      actor.account.company_name,
      orderDetails.contact,
      orderDetails.mobile,
      JSON.stringify({ ...rawPayload, customer: actor.account.company_name, debtorCode: actor.account.debtor_code, floors: areas }),
      nowIso(),
      submissionId,
    ).run();

    await addEvent(env, submissionId, isInitial ? "Completed" : `Revision ${revisionNo} completed`, JSON.stringify({
      revision: revisionNo,
      generatedFileCount: generatedFiles.length,
      manualReviewCount: manualReview.length,
    }));

    return {
      ok: true,
      duplicate: false,
      updated: !isInitial,
      revisionNo,
      submissionId,
      customerReference: orderNumber,
      companyName: actor.account.company_name,
      generatedFiles,
      manualReview,
      emailSent: false,
      completedAt: nowIso(),
    };
  } catch (error) {
    const message = error?.message || String(error);
    const stack = error?.stack || "";
    await env.DB.prepare(`UPDATE orders SET status = 'failed', updated_at = ? WHERE submission_id = ?`)
      .bind(nowIso(), submissionId).run().catch(() => null);
    await addEvent(env, submissionId, stage, JSON.stringify({ error: message, stack })).catch(() => null);
    error.diagnostic = { lastStage: { stage }, lastError: { message, stack } };
    throw error;
  }
}

async function reserveSubmission(env, submissionId, details, rawPayload, actor) {
  const now = nowIso();
  try {
    const result = await env.DB.prepare(
      `INSERT OR IGNORE INTO orders (
         submission_id, customer_reference, project_name, site_address, suburb_state_postcode,
         site_contact, site_contact_phone, order_contact, order_contact_phone, general_comments,
         status, payload_json, created_at, updated_at, account_id,
         debtor_code_snapshot, company_name_snapshot, contact_snapshot, mobile_snapshot
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      submissionId,
      details.reference,
      actor.account.company_name,
      details.addressLine1,
      details.addressLine2,
      details.contact,
      details.mobile,
      details.contact,
      details.mobile,
      buildDeliverySummary(details),
      JSON.stringify(rawPayload),
      now,
      now,
      actor.account.id,
      actor.account.debtor_code,
      actor.account.company_name,
      details.contact,
      details.mobile,
    ).run();
    return Number(result?.meta?.changes || 0) > 0;
  } catch (error) {
    if (/UNIQUE constraint failed: orders\.account_id, orders\.customer_reference/i.test(String(error?.message || error))) {
      throw new Error(`Reference "${details.reference}" has already been used for this customer.`);
    }
    throw error;
  }
}

async function buildDuplicateResponse(env, submissionId, actor) {
  const order = await requireAccessibleOrder(env, submissionId, actor);
  const files = await getOrderFiles(env, submissionId);
  return {
    ok: true,
    duplicate: true,
    submissionId,
    customerReference: order.customer_reference,
    generatedFiles: files.map(addFilePresentationFields),
    manualReview: [],
    emailSent: false,
    completedAt: order.updated_at || null,
    previousStatus: order.status || null,
  };
}

async function normaliseAreas(env, rawAreas) {
  const entries = Object.entries(rawAreas && typeof rawAreas === "object" ? rawAreas : {});
  if (entries.length > CONFIG.maxAreas) throw new Error(`A maximum of ${CONFIG.maxAreas} delivery areas is allowed.`);
  const areas = {};
  const labels = new Set();
  const codes = new Set();

  for (let index = 0; index < entries.length; index += 1) {
    const [rawKey, rawArea] = entries[index];
    if (!rawArea || typeof rawArea !== "object") continue;
    const areaKey = cleanAreaKey(rawKey, index);
    const fallback = LEGACY_AREAS[rawKey] || {};
    const label = cleanRequiredText(rawArea.label || fallback.label || `Area ${index + 1}`, "Delivery area name", 40);
    const labelKey = label.toLowerCase();
    if (labels.has(labelKey)) throw new Error(`Delivery area name "${label}" is duplicated.`);
    labels.add(labelKey);
    let shortCode = safeAreaCode(rawArea.shortCode || fallback.shortCode || label);
    let suffix = 2;
    const baseCode = shortCode;
    while (codes.has(shortCode)) shortCode = `${baseCode.slice(0, 25)}-${suffix++}`;
    codes.add(shortCode);

    const items = normaliseItems(label, rawArea.items);
    const otherProducts = cleanOptionalText(rawArea.otherProducts, 3000);
    const otherMaterials = await normaliseOtherMaterials(env, label, rawArea.otherMaterials);
    const acousticFormat = ["Roll", "Batt"].includes(String(rawArea.acousticFormat || ""))
      ? String(rawArea.acousticFormat)
      : "Roll";
    if (!items.length && !otherProducts && !otherMaterials.length) continue;
    areas[areaKey] = { label, shortCode, items, otherProducts, otherMaterials, acousticFormat };
  }
  return areas;
}

function normaliseItems(areaLabel, rawItems) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  if (items.length > CONFIG.maxItemsPerArea) throw new Error(`${areaLabel}: Too many product lines.`);
  const totals = {};
  items.forEach((item, index) => {
    const key = String(item?.key || "").trim();
    if (!key) throw new Error(`${areaLabel}: Product line ${index + 1} has no product key.`);
    const product = PRODUCT_CATALOG[key];
    if (!product) throw new Error(`${areaLabel}: Unknown product key "${key}".`);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new Error(`${areaLabel}: ${product.label} requires a whole-number quantity from 1 to 999.`);
    }
    totals[key] = (totals[key] || 0) + quantity;
  });
  return Object.entries(totals).map(([key, quantity]) => ({ key, quantity }));
}

async function normaliseOtherMaterials(env, areaLabel, rawItems) {
  const rows = Array.isArray(rawItems) ? rawItems : [];
  if (rows.length > CONFIG.maxOtherMaterialsPerArea) throw new Error(`${areaLabel}: Too many Additional Products lines.`);
  const totals = new Map();
  rows.forEach((item, index) => {
    const sku = cleanRequiredText(item?.sku, `${areaLabel} Additional Products line ${index + 1} stock code`, 80).toUpperCase();
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new Error(`${areaLabel}: ${sku} requires a quantity from 1 to 999.`);
    }
    totals.set(sku, (totals.get(sku) || 0) + quantity);
  });
  const skus = [...totals.keys()];
  if (!skus.length) return [];
  const found = new Map();
  for (let start = 0; start < skus.length; start += 50) {
    const chunk = skus.slice(start, start + 50);
    const placeholders = chunk.map(() => "?").join(", ");
    const result = await env.DB.prepare(
      `SELECT sku, description_raw FROM products
       WHERE active = 1 AND sku COLLATE NOCASE IN (${placeholders})`,
    ).bind(...chunk).all();
    for (const product of result.results || []) {
      found.set(String(product.sku || "").toUpperCase(), {
        sku: String(product.sku || ""),
        description: String(product.description_raw || ""),
      });
    }
  }
  const missing = skus.filter((sku) => !found.has(sku));
  if (missing.length) throw new Error(`${areaLabel}: unknown or inactive Accrivia stock code${missing.length === 1 ? "" : "s"}: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}.`);
  return skus.map((sku) => ({ sku: found.get(sku).sku, description: found.get(sku).description, quantity: totals.get(sku) }));
}

function normaliseOrderDetails(rawPayload, account, existingReference = "") {
  const deliveryType = cleanRequiredText(rawPayload?.deliveryType, "Delivery Type", 120);
  const pickup = deliveryType === "Pickup (Customer to collect)";
  const parsedAddress = normaliseDeliveryAddress(rawPayload, pickup);
  if (!pickup && (!parsedAddress.line1 || !parsedAddress.line2)) throw new Error("Enter a complete Victorian delivery address with street, suburb and postcode.");
  if (!pickup && !/\b(?:VIC|VICTORIA)\b/i.test(parsedAddress.line2)) throw new Error("The delivery suburb must be located in Victoria.");
  if (!pickup && !/\b(?:3\d{3}|8\d{3})\b/.test(parsedAddress.line2)) throw new Error("The delivery suburb must include a valid Victorian postcode.");

  const orderDate = cleanOptionalText(rawPayload?.orderDate, 20) || todayInMelbourne();
  if (!isValidIsoDate(orderDate)) throw new Error("Order Date is invalid.");
  const requiredDate = cleanRequiredText(rawPayload?.requiredDate, "Required Date", 20);
  if (!isValidIsoDate(requiredDate)) throw new Error("Required Date is invalid.");
  const daysAhead = differenceInIsoCalendarDays(orderDate, requiredDate);
  if (daysAhead < 0) throw new Error("Required Date cannot be earlier than the Order Date.");
  if (daysAhead >= 180 && rawPayload?.futureDateConfirmed !== true) throw new Error("The Required Date is six months or more in the future and must be confirmed.");

  const timeSlot = cleanRequiredText(rawPayload?.timeSlot, "Time Slot", 10).toUpperCase();
  if (!["1ST", "2ND", "AM", "PM", "ANY"].includes(timeSlot)) throw new Error("Time Slot is invalid.");
  const extras = Array.isArray(rawPayload?.extras)
    ? [...new Set(rawPayload.extras.map((value) => cleanOptionalText(value, 40)).filter(Boolean))]
    : [];
  const allowedExtras = new Set(["Downstairs", "Upstairs", "Wrap", "Strap", "Extra Labour"]);
  if (extras.some((value) => !allowedExtras.has(value))) throw new Error("A delivery extra is invalid.");

  const contact = cleanRequiredText(rawPayload?.contact || rawPayload?.siteContact || account.default_contact_name, "Contact Name", 120);
  if (!isValidContactName(contact)) throw new Error("Contact Name must contain at least two letters and cannot contain numbers.");
  const mobile = normaliseAustralianPhone(rawPayload?.mobile || rawPayload?.siteContactPhone || account.default_mobile);
  const reference = existingReference || cleanRequiredText(rawPayload?.reference || rawPayload?.customerReference, "Reference", 80);

  return {
    orderDate,
    reference,
    customer: account.company_name,
    debtorCode: account.debtor_code,
    contact,
    mobile,
    deliveryAddress: parsedAddress.full,
    deliveryInstructions: cleanOptionalText(rawPayload?.deliveryInstructions || rawPayload?.comments, 1500),
    requiredDate,
    timeSlot,
    deliveryType,
    extras,
    addressLine1: parsedAddress.line1 || (pickup ? "Pickup" : ""),
    addressLine2: parsedAddress.line2.slice(0, 240),
  };
}

function normaliseDeliveryAddress(rawPayload, pickup) {
  if (pickup) return { full: "Pickup", line1: "Pickup", line2: "" };
  const suppliedLine1 = cleanOptionalText(rawPayload?.addressLine1 || rawPayload?.siteAddress1, 240);
  const suppliedLine2 = cleanOptionalText(rawPayload?.addressLine2 || rawPayload?.siteAddress2, 240);
  const suppliedFull = cleanOptionalText(rawPayload?.deliveryAddress, 500);
  if (suppliedLine1 && suppliedLine2) {
    const line2 = suppliedLine2.replace(/\bVICTORIA\b/i, "VIC").replace(/\s+/g, " ").trim();
    return { full: suppliedFull || `${suppliedLine1}, ${line2}`, line1: suppliedLine1, line2 };
  }
  const text = suppliedFull || [suppliedLine1, suppliedLine2].filter(Boolean).join(", ");
  const parts = text.split(/\n+|,(?=\s*[^,]+\b(?:VIC|VICTORIA)\b)/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const line1 = parts.slice(0, -1).join(", ");
    const line2 = parts.at(-1).replace(/\bVICTORIA\b/i, "VIC").replace(/\s+/g, " ").trim();
    return { full: `${line1}, ${line2}`, line1, line2 };
  }
  const match = text.match(/^(.+?),?\s+([^,]+?)\s+(VIC|VICTORIA)\s+(3\d{3}|8\d{3})$/i);
  if (match) {
    const line1 = match[1].trim();
    const line2 = `${match[2].trim()} VIC ${match[4]}`;
    return { full: `${line1}, ${line2}`, line1, line2 };
  }
  return { full: text, line1: suppliedLine1, line2: suppliedLine2 };
}

function combineProductRows(items, areaLabel) {
  const combined = new Map();
  for (const item of items) {
    const sku = String(item?.sku || "").trim();
    if (!sku) continue;
    const key = sku.toUpperCase();
    const current = combined.get(key) || { sku, description: String(item?.description || "").trim(), quantity: 0 };
    current.quantity += Number(item?.quantity || 0);
    if (current.quantity > 999) throw new Error(`${areaLabel}: combined quantity for ${sku} exceeds 999.`);
    combined.set(key, current);
  }
  return [...combined.values()].map((item) => [item.sku, item.description, item.quantity]);
}

function buildDeliveryItem(details) {
  if (details?.deliveryType === "Pickup (Customer to collect)") return null;
  const description = String(details?.deliveryType || "Delivery").replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  return { sku: "DEL", description: description || "Delivery", quantity: 1 };
}

function buildDeliverySummary(details) {
  return [
    `Required: ${details.requiredDate} ${details.timeSlot}`,
    `Delivery: ${details.deliveryType}`,
    details.extras.length ? `Extras: ${details.extras.join(", ")}` : "",
    details.deliveryInstructions ? `Instructions: ${details.deliveryInstructions}` : "",
  ].filter(Boolean).join(" | ");
}

async function requireAccount(env, auth) {
  const actor = await requireActor(env, auth);
  if (!actor.accountId) throw new Error("Choose a customer account before creating an order.");
  const account = await getAccount(env, actor.accountId);
  if (!account || account.active !== 1) throw new Error("The customer account is inactive or missing.");
  return { ...actor, account };
}

async function requireActor(env, auth) {
  if (!auth?.userId) throw new Error("Authentication required.");
  const user = await env.DB.prepare(`SELECT id, account_id, username, role, active FROM users WHERE id = ? LIMIT 1`).bind(auth.userId).first();
  if (!user || user.active !== 1) throw new Error("User account is inactive or missing.");
  return {
    userId: Number(user.id),
    accountId: Number(user.account_id || 0) || null,
    username: user.username,
    role: user.role === "admin" ? "admin" : "customer",
  };
}

async function getAccount(env, accountId) {
  if (!accountId) return null;
  return env.DB.prepare(
    `SELECT id, debtor_code, company_name, default_contact_name, default_mobile, active FROM customer_accounts WHERE id = ? LIMIT 1`,
  ).bind(accountId).first();
}

async function requireAccessibleOrder(env, submissionId, actor) {
  const order = await getOrderRecord(env, submissionId);
  if (!order) throw new Error("Order not found.");
  if (actor.role !== "admin" && Number(order.account_id || 0) !== Number(actor.accountId || 0)) throw new Error("Order not found.");
  return order;
}

async function getOrderRecord(env, submissionId) {
  return env.DB.prepare(`SELECT * FROM orders WHERE submission_id = ? LIMIT 1`).bind(submissionId).first();
}

async function getOrderFiles(env, submissionId) {
  const result = await env.DB.prepare(
    `SELECT id, submission_id, floor, floor_label, filename, r2_key, item_count, created_at FROM order_files WHERE submission_id = ? ORDER BY id DESC`,
  ).bind(submissionId).all();
  return result.results || [];
}

function addFilePresentationFields(file) {
  return {
    ...file,
    floorLabel: file.floor_label || file.floorLabel,
    itemCount: Number(file.item_count ?? file.itemCount ?? 0),
    revision: inferRevision(file.filename),
    downloadUrl: `/api/files/${file.id}`,
  };
}

function inferRevision(filename) {
  const match = String(filename || "").match(/-R(\d+)-[^/]+\.xlsx$/i);
  return match ? Number(match[1]) : 1;
}

function inferLatestRevision(files) {
  return Math.max(1, ...files.map((file) => inferRevision(file.filename)));
}

async function addEvent(env, submissionId, stage, detail = null) {
  await env.DB.prepare(`INSERT INTO order_events (submission_id, stage, detail, created_at) VALUES (?, ?, ?, ?)`).bind(submissionId, stage, detail, nowIso()).run();
}

function requireBindings(env) {
  const missing = [];
  if (!env.DB) missing.push("DB");
  if (!env.ORDER_FILES) missing.push("ORDER_FILES");
  if (missing.length) throw new Error(`Missing Cloudflare binding: ${missing.join(", ")}`);
}

function cleanAreaKey(value, index) {
  const text = String(value || "").trim();
  if (/^[a-z0-9][a-z0-9-]{0,59}$/i.test(text)) return text;
  return `area-${index + 1}`;
}

function safeAreaCode(value) {
  return String(value || "AREA").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "AREA";
}

function cleanRequiredText(value, label, maxLength) {
  const text = cleanOptionalText(value, maxLength);
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function cleanOptionalText(value, maxLength) {
  const text = String(value ?? "").trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (maxLength && text.length > maxLength) throw new Error(`A text field exceeds the ${maxLength} character limit.`);
  return text;
}

function isValidIsoDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function differenceInIsoCalendarDays(fromValue, toValue) {
  return Math.round((new Date(`${toValue}T00:00:00Z`).getTime() - new Date(`${fromValue}T00:00:00Z`).getTime()) / 86400000);
}

function isValidContactName(value) {
  const name = String(value || "").trim();
  const letters = name.match(/\p{L}/gu) || [];
  return letters.length >= 2 && /^[\p{L}\p{M}'’.\-\s]+$/u.test(name);
}

function safeFilename(value) {
  return String(value || "order").trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "order";
}

function todayInMelbourne() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function nowIso() { return new Date().toISOString(); }