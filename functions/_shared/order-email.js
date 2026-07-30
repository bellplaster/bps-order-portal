import { PRODUCT_CATALOG } from "./catalog.js";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_ATTACHMENT_BYTES = 3_500_000;
const DEFAULT_FROM = "portal@orders.bellplaster.com.au";
const DEFAULT_TO = "info@bellplaster.com.au";
const DEFAULT_CC = "zac@bellplaster.com.au,maria@bellplaster.com.au,marketing@bellplaster.com.au";
const DEFAULT_REPLY_TO = "info@bellplaster.com.au";

export async function sendOrderFilesEmail(env, payload, result, auth = {}) {
  const transport = emailTransport(env);
  if (!transport) return { sent: false, reason: "not_configured" };

  const generatedFiles = Array.isArray(result?.generatedFiles) ? result.generatedFiles : [];
  if (!generatedFiles.length) return { sent: false, reason: "no_files" };
  if (!env.ORDER_FILES?.get) return { sent: false, reason: "files_binding_missing" };

  const attachments = [];
  let attachmentBytes = 0;
  for (const file of generatedFiles) {
    const key = String(file?.r2Key || "").trim();
    if (!key) continue;
    const object = await env.ORDER_FILES.get(key);
    if (!object) continue;
    const content = await object.arrayBuffer();
    attachmentBytes += content.byteLength;
    if (attachmentBytes > MAX_ATTACHMENT_BYTES) {
      return { sent: false, reason: "attachments_too_large" };
    }
    attachments.push({
      content: arrayBufferToBase64(content),
      filename: String(file.filename || "order.xlsx"),
      type: XLSX_MIME,
      disposition: "attachment",
    });
  }
  if (!attachments.length) return { sent: false, reason: "files_unavailable" };

  const to = parseEmailList(env.ORDER_EMAIL_TO || DEFAULT_TO);
  const cc = parseEmailList(env.ORDER_EMAIL_CC || DEFAULT_CC).filter((address) => !to.includes(address));
  if (!to.length) return { sent: false, reason: "recipient_missing" };

  const from = String(env.ORDER_EMAIL_FROM || DEFAULT_FROM).trim();
  const replyTo = String(env.ORDER_EMAIL_REPLY_TO || DEFAULT_REPLY_TO).trim();
  const snapshot = await loadOrderSnapshot(env, payload, result);
  const areas = await buildAreaGroups(env, payload);
  const reference = String(result?.customerReference || payload?.reference || "New order").trim();
  const company = String(snapshot.companyName || result?.companyName || payload?.customer || "Customer").trim();
  const debtorCode = String(snapshot.debtorCode || payload?.debtorCode || "—").trim();
  const contact = String(payload?.contact || snapshot.contact || "—").trim();
  const phone = String(payload?.mobile || snapshot.mobile || "—").trim();
  const requiredDate = formatRequiredDate(payload?.requiredDate);
  const timeSlot = timeSlotLabel(payload?.timeSlot);
  const delivery = displayDeliveryType(payload?.deliveryType);
  const address = fullAddress(payload);
  const extras = Array.isArray(payload?.extras) && payload.extras.length ? payload.extras.join(", ") : "None";
  const instructions = String(payload?.deliveryInstructions || payload?.instructions || "").trim() || "None";
  const submittedBy = String(auth?.username || payload?.submittedBy || "Portal user").trim();
  const submittedAt = formatSubmittedAt(snapshot.createdAt || new Date().toISOString());
  const totals = areaTotals(areas);
  const subject = buildSubject(payload);

  const rows = [
    ["Reference", reference],
    ["Debtor code", debtorCode],
    ["Customer", company],
    ["Submitted by", submittedBy],
    ["Submitted", submittedAt],
    ["Required date", requiredDate],
    ["Time slot", timeSlot],
    ["Address", address],
    ["Contact", contact],
    ["Phone", phone],
    ["Delivery type", delivery],
    ["Extras", extras],
    ["Instructions", instructions],
  ];

  const textProducts = areas.length
    ? areas.flatMap((area) => [
        "",
        area.label,
        ...area.lines.map((line) => `${line.sku || "—"} | ${line.description} | Qty ${line.quantity}`),
      ])
    : ["", "No product lines were available in the email payload."];

  const text = [
    "A new Bell Plaster order has been submitted.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Products",
    ...textProducts,
    "",
    `Product lines: ${totals.lineCount}`,
    `Total units: ${totals.unitCount}`,
    "",
    `${attachments.length} Accrivia XLSX file${attachments.length === 1 ? " is" : "s are"} attached.`,
  ].join("\n");

  const htmlRows = rows.map(([label, value]) => `
    <tr>
      <th style="width:145px;padding:8px 10px;text-align:left;vertical-align:top;border-bottom:1px solid #d9dfdd;color:#5f6c68;font-size:12px;font-weight:600;">${escapeHtml(label)}</th>
      <td style="padding:8px 10px;border-bottom:1px solid #d9dfdd;color:#17211f;font-size:12px;line-height:1.45;">${escapeHtml(value)}</td>
    </tr>`).join("");

  const htmlAreas = areas.length
    ? areas.map((area) => `
      <section style="margin-top:18px;border:1px solid #d9dfdd;">
        <div style="padding:9px 11px;background:#f1f5f3;color:#17211f;font-size:13px;font-weight:700;">${escapeHtml(area.label)}</div>
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:7px 9px;text-align:left;border-bottom:1px solid #d9dfdd;color:#5f6c68;font-size:11px;">SKU</th>
              <th style="padding:7px 9px;text-align:left;border-bottom:1px solid #d9dfdd;color:#5f6c68;font-size:11px;">Product</th>
              <th style="width:54px;padding:7px 9px;text-align:right;border-bottom:1px solid #d9dfdd;color:#5f6c68;font-size:11px;">Qty</th>
            </tr>
          </thead>
          <tbody>${area.lines.map((line) => `
            <tr>
              <td style="padding:7px 9px;border-bottom:1px solid #edf0ef;color:#17211f;font-size:11px;white-space:nowrap;">${escapeHtml(line.sku || "—")}</td>
              <td style="padding:7px 9px;border-bottom:1px solid #edf0ef;color:#17211f;font-size:11px;">${escapeHtml(line.description)}</td>
              <td style="padding:7px 9px;text-align:right;border-bottom:1px solid #edf0ef;color:#17211f;font-size:11px;font-weight:700;">${line.quantity}</td>
            </tr>`).join("")}</tbody>
        </table>
      </section>`).join("")
    : '<p style="margin:14px 0 0;color:#5f6c68;font-size:12px;">No product lines were available in the email payload.</p>';

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f7f6;font-family:Arial,sans-serif;color:#17211f;">
    <div style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #d9dfdd;">
      <div style="padding:15px 18px;background:#a62b47;color:#fff;font-size:17px;font-weight:700;">New customer order</div>
      <div style="padding:18px;">
        <p style="margin:0 0 14px;font-size:13px;line-height:1.5;"><strong>${escapeHtml(company)}</strong> has placed a new order through the Bell Plaster Order Portal.</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #d9dfdd;">${htmlRows}</table>
        <h2 style="margin:22px 0 0;font-size:15px;color:#17211f;">Products</h2>
        ${htmlAreas}
        <div style="display:flex;justify-content:flex-end;gap:24px;margin-top:14px;padding:10px 12px;background:#f8faf9;border:1px solid #d9dfdd;font-size:12px;">
          <span>Product lines: <strong>${totals.lineCount}</strong></span>
          <span>Total units: <strong>${totals.unitCount}</strong></span>
        </div>
        <p style="margin:16px 0 0;color:#5f6c68;font-size:12px;">The stored combined Accrivia XLSX is attached.</p>
      </div>
    </div>
  </body></html>`;

  const message = {
    to: to.length === 1 ? to[0] : to,
    from: { email: from, name: "Bell Plaster Orders" },
    replyTo,
    subject,
    text,
    html,
    attachments,
  };
  if (cc.length) message.cc = cc;

  const response = await sendEmail(env, message, transport);
  return {
    sent: true,
    messageId: response?.messageId || null,
    recipient: to.join(", "),
    cc,
    subject,
    provider: transport,
  };
}

function emailTransport(env) {
  if (env?.ORDER_EMAIL?.send) return "binding";
  if (String(env?.CLOUDFLARE_ACCOUNT_ID || "").trim() && String(env?.CLOUDFLARE_EMAIL_API_TOKEN || "").trim()) return "cloudflare_rest";
  return "";
}

async function sendEmail(env, message, transport) {
  if (transport === "binding") return env.ORDER_EMAIL.send(message);

  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const token = String(env.CLOUDFLARE_EMAIL_API_TOKEN || "").trim();
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/email/sending/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const details = Array.isArray(body?.errors)
      ? body.errors.map((error) => error?.message || error?.code).filter(Boolean).join("; ")
      : "";
    throw new Error(details || `Cloudflare Email Service returned ${response.status}.`);
  }
  return {
    messageId: body?.result?.message_id || body?.result?.messageId || null,
    result: body?.result || null,
  };
}

async function loadOrderSnapshot(env, payload, result) {
  const fallback = {
    debtorCode: payload?.debtorCode || "",
    companyName: result?.companyName || payload?.customer || "",
    contact: payload?.contact || "",
    mobile: payload?.mobile || "",
    createdAt: "",
  };
  const submissionId = String(result?.submissionId || payload?.submissionId || "").trim();
  if (!submissionId || !env?.DB?.prepare) return fallback;
  try {
    const row = await env.DB.prepare(
      `SELECT debtor_code_snapshot, company_name_snapshot, contact_snapshot, mobile_snapshot, created_at
       FROM orders WHERE submission_id = ? LIMIT 1`,
    ).bind(submissionId).first();
    if (!row) return fallback;
    return {
      debtorCode: row.debtor_code_snapshot || fallback.debtorCode,
      companyName: row.company_name_snapshot || fallback.companyName,
      contact: row.contact_snapshot || fallback.contact,
      mobile: row.mobile_snapshot || fallback.mobile,
      createdAt: row.created_at || fallback.createdAt,
    };
  } catch (error) {
    console.warn("Order email snapshot lookup failed.", error);
    return fallback;
  }
}

async function buildAreaGroups(env, payload) {
  const floors = payload?.floors && typeof payload.floors === "object" ? payload.floors : {};
  const groups = Object.entries(floors).map(([areaKey, area], index) => {
    const lines = [];
    for (const item of Array.isArray(area?.items) ? area.items : []) {
      const product = PRODUCT_CATALOG[String(item?.key || "").trim()] || {};
      pushLine(lines, {
        sku: item?.sku || product.sku || "",
        description: item?.description || item?.name || product.description || product.label || item?.key || "Product",
        quantity: item?.quantity,
      });
    }
    for (const item of Array.isArray(area?.otherMaterials) ? area.otherMaterials : []) {
      pushLine(lines, {
        sku: item?.sku || "",
        description: item?.description || item?.name || "",
        quantity: item?.quantity,
      });
    }
    return {
      label: String(area?.label || areaKey || `Tab ${index + 1}`).trim(),
      lines: combineLines(lines),
    };
  }).filter((group) => group.lines.length);

  await enrichMissingDescriptions(env, groups);
  return groups;
}

function pushLine(lines, item) {
  const quantity = Number(item?.quantity || 0);
  if (!Number.isInteger(quantity) || quantity <= 0) return;
  const sku = String(item?.sku || "").trim().toUpperCase();
  const description = String(item?.description || "").trim() || sku || "Product";
  lines.push({ sku, description, quantity });
}

function combineLines(lines) {
  const combined = new Map();
  for (const line of lines) {
    const key = line.sku || line.description.toUpperCase();
    const current = combined.get(key) || { ...line, quantity: 0 };
    current.quantity += line.quantity;
    if ((!current.description || current.description === current.sku) && line.description) current.description = line.description;
    combined.set(key, current);
  }
  return [...combined.values()];
}

async function enrichMissingDescriptions(env, groups) {
  if (!env?.DB?.prepare) return;
  const missing = [...new Set(groups.flatMap((group) => group.lines)
    .filter((line) => line.sku && (!line.description || line.description.toUpperCase() === line.sku))
    .map((line) => line.sku))];
  if (!missing.length) return;

  const descriptions = new Map();
  try {
    for (let start = 0; start < missing.length; start += 50) {
      const chunk = missing.slice(start, start + 50);
      const placeholders = chunk.map(() => "?").join(", ");
      const result = await env.DB.prepare(
        `SELECT sku, description_raw FROM products WHERE sku COLLATE NOCASE IN (${placeholders})`,
      ).bind(...chunk).all();
      for (const product of result.results || []) {
        descriptions.set(String(product.sku || "").trim().toUpperCase(), String(product.description_raw || "").trim());
      }
    }
  } catch (error) {
    console.warn("Order email product descriptions could not be enriched.", error);
    return;
  }

  groups.forEach((group) => group.lines.forEach((line) => {
    const description = descriptions.get(line.sku);
    if (description && (!line.description || line.description.toUpperCase() === line.sku)) line.description = description;
  }));
}

function areaTotals(areas) {
  return areas.reduce((totals, area) => {
    totals.lineCount += area.lines.length;
    totals.unitCount += area.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    return totals;
  }, { lineCount: 0, unitCount: 0 });
}

function buildSubject(payload) {
  const date = formatRequiredDate(payload?.requiredDate);
  const slot = timeSlotLabel(payload?.timeSlot);
  if (isPickup(payload?.deliveryType)) return cleanSubject(`Pickup on ${date} ${slot}`);
  return cleanSubject(`Delivery to ${subjectAddress(payload)} on ${date} ${slot}`);
}

function subjectAddress(payload) {
  const street = titleCaseAddress(payload?.addressLine1 || payload?.siteAddress1 || extractStreet(payload?.deliveryAddress));
  const suburb = titleCaseAddress(extractSuburb(payload?.addressLine2 || payload?.siteAddress2 || payload?.deliveryAddress));
  return [street, suburb].filter(Boolean).join(", ") || "delivery address";
}

function fullAddress(payload) {
  if (isPickup(payload?.deliveryType)) return "Customer pickup";
  const supplied = String(payload?.deliveryAddress || "").trim();
  if (supplied) return supplied;
  return [payload?.addressLine1, payload?.addressLine2].map((value) => String(value || "").trim()).filter(Boolean).join(", ") || "—";
}

function extractStreet(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.split(",")[0].trim();
}

function extractSuburb(value) {
  const text = String(value || "")
    .replace(/,?\s*Australia\s*$/i, "")
    .replace(/\b(?:VIC|VICTORIA)\b\s*(?:3\d{3}|8\d{3})?\b.*$/i, "")
    .trim();
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || text;
}

function formatRequiredDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return text || "unspecified date";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatSubmittedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "—");
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function timeSlotLabel(value) {
  const labels = {
    "1ST": "1st Load",
    "2ND": "2nd Load",
    "AM": "AM",
    "PM": "PM",
    "ANY": "Any",
  };
  const key = String(value || "").trim().toUpperCase();
  return labels[key] || key || "Any";
}

function displayDeliveryType(value) {
  const labels = {
    "Pickup (Customer to collect)": "Customer Pickup",
    "Manual Unload (Knauf Labour)": "Hand Unload",
    "Mechanical (Forklift/Crane/Own)": "Forklift Delivery",
    "Mixed Unload (Hand + Machine)": "Delivery (No Assistance)",
    "Hand unload": "Hand Unload",
    Forklift: "Forklift Delivery",
    Crane: "Crane Delivery",
    "Delivery (No assistance)": "Delivery (No Assistance)",
  };
  return labels[String(value || "")] || String(value || "—");
}

function isPickup(value) {
  return /pickup|pick\s*up|collect/i.test(String(value || ""));
}

function titleCaseAddress(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .replace(/\bVic\b/g, "VIC");
}

function cleanSubject(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

function parseEmailList(value) {
  return [...new Set(String(value || "")
    .split(/[;,\n]+/)
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean))];
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}
