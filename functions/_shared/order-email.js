import { PRODUCT_CATALOG } from "./catalog.js";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_ATTACHMENT_BYTES = 3_500_000;
const DEFAULT_FROM = "portal@orders.bellplaster.com.au";
const DEFAULT_TO = "marketing@bellplaster.com.au";
const DEFAULT_CC = "";
const DEFAULT_REPLY_TO = "info@bellplaster.com.au";

export async function sendOrderFilesEmail(env, payload, result, auth = {}) {
  const accountId = String(env?.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const token = String(env?.CLOUDFLARE_EMAIL_API_TOKEN || "").trim();
  if (!accountId || !token) return { sent: false, reason: "not_configured" };
  if (!env?.ORDER_FILES?.get) return { sent: false, reason: "files_binding_missing" };

  const files = Array.isArray(result?.generatedFiles) ? result.generatedFiles : [];
  if (!files.length) return { sent: false, reason: "no_files" };

  const attachments = [];
  let attachmentBytes = 0;
  for (const file of files) {
    const key = String(file?.r2Key || "").trim();
    if (!key) continue;
    const object = await env.ORDER_FILES.get(key);
    if (!object) continue;
    const bytes = await object.arrayBuffer();
    attachmentBytes += bytes.byteLength;
    if (attachmentBytes > MAX_ATTACHMENT_BYTES) return { sent: false, reason: "attachments_too_large" };
    attachments.push({
      content: arrayBufferToBase64(bytes),
      filename: String(file.filename || "order.xlsx"),
      type: XLSX_MIME,
      disposition: "attachment",
    });
  }
  if (!attachments.length) return { sent: false, reason: "files_unavailable" };

  const to = parseEmailList(env.ORDER_EMAIL_TO || DEFAULT_TO);
  const cc = parseEmailList(env.ORDER_EMAIL_CC || DEFAULT_CC).filter((address) => !to.includes(address));
  if (!to.length) return { sent: false, reason: "recipient_missing" };

  const snapshot = await loadOrderSnapshot(env, payload, result);
  const areas = await buildAreaGroups(env, payload);
  const totals = areaTotals(areas);
  const reference = String(result?.customerReference || payload?.reference || "New order").trim();
  const company = String(snapshot.companyName || result?.companyName || payload?.customer || "Customer").trim();
  const requiredDate = formatRequiredDate(payload?.requiredDate);
  const timeSlot = timeSlotLabel(payload?.timeSlot);
  const subject = buildSubject(payload);
  const rows = [
    ["Reference", reference],
    ["Debtor code", snapshot.debtorCode || payload?.debtorCode || "—"],
    ["Customer", company],
    ["Submitted by", auth?.username || payload?.submittedBy || "Portal user"],
    ["Submitted", formatSubmittedAt(snapshot.createdAt || new Date().toISOString())],
    ["Required date", requiredDate],
    ["Time slot", timeSlot],
    ["Address", fullAddress(payload)],
    ["Contact", payload?.contact || snapshot.contact || "—"],
    ["Phone", payload?.mobile || snapshot.mobile || "—"],
    ["Delivery type", deliveryTypeLabel(payload?.deliveryType)],
    ["Extras", Array.isArray(payload?.extras) && payload.extras.length ? payload.extras.join(", ") : "None"],
    ["Instructions", String(payload?.deliveryInstructions || payload?.instructions || "").trim() || "None"],
  ];

  const text = buildText(rows, areas, totals, attachments.length);
  const html = buildHtml(company, rows, areas, totals);
  const message = {
    from: {
      address: String(env.ORDER_EMAIL_FROM || DEFAULT_FROM).trim(),
      name: "Bell Plaster Orders",
    },
    to: to.length === 1 ? to[0] : to,
    subject,
    reply_to: String(env.ORDER_EMAIL_REPLY_TO || DEFAULT_REPLY_TO).trim(),
    text,
    html,
    attachments,
  };
  if (cc.length) message.cc = cc;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const details = Array.isArray(body?.errors)
      ? body.errors.map((error) => error?.message || error?.code).filter(Boolean).join("; ")
      : "";
    throw new Error(details || `Cloudflare Email Service returned ${response.status}.`);
  }

  return {
    sent: true,
    messageId: body?.result?.message_id || null,
    recipient: to.join(", "),
    cc,
    subject,
    provider: "cloudflare_rest",
  };
}

function buildText(rows, areas, totals, attachmentCount) {
  const products = areas.length
    ? areas.flatMap((area) => [
        "",
        area.label,
        ...area.lines.map((line) => `${line.sku || "—"} | ${line.description} | Qty ${line.quantity}`),
      ])
    : ["", "No product lines were available in the email payload."];
  return [
    "A new Bell Plaster order has been submitted.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Products",
    ...products,
    "",
    `Product lines: ${totals.lineCount}`,
    `Total units: ${totals.unitCount}`,
    "",
    `${attachmentCount} Accrivia XLSX file${attachmentCount === 1 ? " is" : "s are"} attached.`,
  ].join("\n");
}

function buildHtml(company, rows, areas, totals) {
  const details = rows.map(([label, value]) => `
    <tr>
      <th style="width:145px;padding:8px 10px;text-align:left;vertical-align:top;border-bottom:1px solid #d9dfdd;color:#5f6c68;font-size:12px;">${escapeHtml(label)}</th>
      <td style="padding:8px 10px;border-bottom:1px solid #d9dfdd;color:#17211f;font-size:12px;line-height:1.45;">${escapeHtml(value)}</td>
    </tr>`).join("");
  const products = areas.length
    ? areas.map((area) => `
      <section style="margin-top:18px;border:1px solid #d9dfdd;">
        <div style="padding:9px 11px;background:#f1f5f3;font-size:13px;font-weight:700;">${escapeHtml(area.label)}</div>
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="padding:7px 9px;text-align:left;border-bottom:1px solid #d9dfdd;color:#5f6c68;font-size:11px;">SKU</th>
            <th style="padding:7px 9px;text-align:left;border-bottom:1px solid #d9dfdd;color:#5f6c68;font-size:11px;">Product</th>
            <th style="width:54px;padding:7px 9px;text-align:right;border-bottom:1px solid #d9dfdd;color:#5f6c68;font-size:11px;">Qty</th>
          </tr></thead>
          <tbody>${area.lines.map((line) => `
            <tr>
              <td style="padding:7px 9px;border-bottom:1px solid #edf0ef;font-size:11px;white-space:nowrap;">${escapeHtml(line.sku || "—")}</td>
              <td style="padding:7px 9px;border-bottom:1px solid #edf0ef;font-size:11px;">${escapeHtml(line.description)}</td>
              <td style="padding:7px 9px;text-align:right;border-bottom:1px solid #edf0ef;font-size:11px;font-weight:700;">${line.quantity}</td>
            </tr>`).join("")}</tbody>
        </table>
      </section>`).join("")
    : '<p style="margin:14px 0 0;color:#5f6c68;font-size:12px;">No product lines were available in the email payload.</p>';

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f7f6;font-family:Arial,sans-serif;color:#17211f;">
    <div style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #d9dfdd;">
      <div style="padding:15px 18px;background:#a62b47;color:#fff;font-size:17px;font-weight:700;">New customer order</div>
      <div style="padding:18px;">
        <p style="margin:0 0 14px;font-size:13px;line-height:1.5;"><strong>${escapeHtml(company)}</strong> has placed a new order through the Bell Plaster Order Portal.</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #d9dfdd;">${details}</table>
        <h2 style="margin:22px 0 0;font-size:15px;">Products</h2>
        ${products}
        <div style="margin-top:14px;padding:10px 12px;text-align:right;background:#f8faf9;border:1px solid #d9dfdd;font-size:12px;">
          Product lines: <strong>${totals.lineCount}</strong>&nbsp;&nbsp;&nbsp; Total units: <strong>${totals.unitCount}</strong>
        </div>
        <p style="margin:16px 0 0;color:#5f6c68;font-size:12px;">The stored combined Accrivia XLSX is attached.</p>
      </div>
    </div>
  </body></html>`;
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
    return row ? {
      debtorCode: row.debtor_code_snapshot || fallback.debtorCode,
      companyName: row.company_name_snapshot || fallback.companyName,
      contact: row.contact_snapshot || fallback.contact,
      mobile: row.mobile_snapshot || fallback.mobile,
      createdAt: row.created_at || fallback.createdAt,
    } : fallback;
  } catch (error) {
    console.warn("Order email snapshot lookup failed.", error);
    return fallback;
  }
}

async function buildAreaGroups(env, payload) {
  const floors = payload?.floors && typeof payload.floors === "object" ? payload.floors : {};
  const groups = Object.entries(floors).map(([key, area], index) => {
    const lines = [];
    for (const item of Array.isArray(area?.items) ? area.items : []) {
      const product = PRODUCT_CATALOG[String(item?.key || "").trim()] || {};
      addLine(lines, item?.sku || product.sku, item?.description || item?.name || product.description || product.label || item?.key, item?.quantity);
    }
    for (const item of Array.isArray(area?.otherMaterials) ? area.otherMaterials : []) {
      addLine(lines, item?.sku, item?.description || item?.name, item?.quantity);
    }
    return {
      label: String(area?.label || key || `Tab ${index + 1}`).trim(),
      lines: combineLines(lines),
    };
  }).filter((group) => group.lines.length);
  await enrichMissingDescriptions(env, groups);
  return groups;
}

function addLine(lines, rawSku, rawDescription, rawQuantity) {
  const quantity = Number(rawQuantity || 0);
  if (!Number.isInteger(quantity) || quantity <= 0) return;
  const sku = String(rawSku || "").trim().toUpperCase();
  const description = String(rawDescription || "").trim() || sku || "Product";
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
    .filter((line) => line.sku && line.description.toUpperCase() === line.sku)
    .map((line) => line.sku))];
  if (!missing.length) return;
  const descriptions = new Map();
  try {
    for (let start = 0; start < missing.length; start += 50) {
      const chunk = missing.slice(start, start + 50);
      const result = await env.DB.prepare(
        `SELECT sku, description_raw FROM products WHERE sku COLLATE NOCASE IN (${chunk.map(() => "?").join(", ")})`,
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
    if (descriptions.get(line.sku)) line.description = descriptions.get(line.sku);
  }));
}

function areaTotals(areas) {
  return areas.reduce((total, area) => ({
    lineCount: total.lineCount + area.lines.length,
    unitCount: total.unitCount + area.lines.reduce((sum, line) => sum + line.quantity, 0),
  }), { lineCount: 0, unitCount: 0 });
}

function buildSubject(payload) {
  const date = formatRequiredDate(payload?.requiredDate);
  const slot = timeSlotLabel(payload?.timeSlot);
  return isPickup(payload?.deliveryType)
    ? cleanSubject(`Pickup on ${date} ${slot}`)
    : cleanSubject(`Delivery to ${subjectAddress(payload)} on ${date} ${slot}`);
}

function subjectAddress(payload) {
  const street = titleCase(payload?.addressLine1 || payload?.siteAddress1 || extractStreet(payload?.deliveryAddress));
  const suburb = titleCase(extractSuburb(payload?.addressLine2 || payload?.siteAddress2 || payload?.deliveryAddress));
  return [street, suburb].filter(Boolean).join(", ") || "delivery address";
}

function fullAddress(payload) {
  if (isPickup(payload?.deliveryType)) return "Customer pickup";
  return String(payload?.deliveryAddress || "").trim()
    || [payload?.addressLine1, payload?.addressLine2].map((value) => String(value || "").trim()).filter(Boolean).join(", ")
    || "—";
}

function extractStreet(value) {
  return String(value || "").trim().split(",")[0].trim();
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
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
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
  return ({ "1ST": "1st Load", "2ND": "2nd Load", AM: "AM", PM: "PM", ANY: "Any" })[String(value || "").trim().toUpperCase()]
    || String(value || "Any");
}

function deliveryTypeLabel(value) {
  return ({
    "Pickup (Customer to collect)": "Customer Pickup",
    "Manual Unload (Knauf Labour)": "Hand Unload",
    "Mechanical (Forklift/Crane/Own)": "Forklift Delivery",
    "Mixed Unload (Hand + Machine)": "Delivery (No Assistance)",
  })[String(value || "")] || String(value || "—");
}

function isPickup(value) {
  return /pickup|pick\s*up|collect/i.test(String(value || ""));
}

function titleCase(value) {
  return String(value || "").trim().toLowerCase().replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function cleanSubject(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

function parseEmailList(value) {
  return [...new Set(String(value || "").split(/[;,\n]+/).map((address) => address.trim().toLowerCase()).filter(Boolean))];
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
